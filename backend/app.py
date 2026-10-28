"""FastAPI backend. Run: uvicorn app:app --port 8000"""
from __future__ import annotations
import asyncio
import json
import queue
import threading
from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

import settings  # noqa: F401  (loads .env)
import storage
import youcom
import parasail
from crew import build_brief
import discover as discover_mod
import one_actions

app = FastAPI(title="Hackathon companion API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
storage.init()

# One event queue per hackathon being built. Late subscribers get a replay from the database.
_queues: dict[str, list[queue.Queue]] = {}
_lock = threading.Lock()


def _broadcast(hid: str, event: dict):
    with _lock:
        for q in _queues.get(hid, []):
            q.put(event)


def _subscribe(hid: str) -> queue.Queue:
    q: queue.Queue = queue.Queue()
    with _lock:
        _queues.setdefault(hid, []).append(q)
    return q


def _unsubscribe(hid: str, q: queue.Queue):
    with _lock:
        if q in _queues.get(hid, []):
            _queues[hid].remove(q)


def _build(hid: str, urls: list[str]):
    def emit(kind: str, name_or_msg: str, data: dict | None):
        if kind == "status":
            _broadcast(hid, {"type": "status", "message": name_or_msg})
        elif kind == "sources":
            storage.update(hid, sources_json=data)
            _broadcast(hid, {"type": "sources", "data": data})
        elif kind == "section":
            if name_or_msg == "brief":
                storage.update(hid, brief_json=data, name=data.get("name"))
            elif name_or_msg == "tools":
                storage.update(hid, tools_json=data)
            elif name_or_msg == "plan":
                storage.update(hid, plan_json=data)
            _broadcast(hid, {"type": "section", "name": name_or_msg, "data": data})
    try:
        build_brief(urls, emit)
        storage.update(hid, status="ready")
        _broadcast(hid, {"type": "done"})
    except Exception as exc:  # noqa: BLE001
        storage.update(hid, status="error", error=str(exc)[:500])
        _broadcast(hid, {"type": "error", "message": str(exc)[:500]})


class NewHackathon(BaseModel):
    urls: list[str]


class DiscoverBody(BaseModel):
    query: str = ""


class CalendarBody(BaseModel):
    what: str = "deadline"  # deadline | agenda | all


class DiscordBody(BaseModel):
    channel_id: str | None = None


class Patch(BaseModel):
    name: str | None = None
    status: str | None = None
    after: dict[str, Any] | None = None
    plan: dict[str, Any] | None = None


@app.get("/api/health")
def health():
    return {"ok": True, "parasail_key": bool(settings.PARASAIL_API_KEY), "youcom_key": bool(settings.YDC_API_KEY)}


@app.get("/api/hackathons")
def list_hackathons():
    return storage.list_all()


@app.post("/api/hackathons")
def create_hackathon(body: NewHackathon):
    urls = [u.strip() for u in body.urls if u.strip()]
    if not urls:
        raise HTTPException(400, "Paste at least one link")
    hid = storage.create_hackathon(urls)
    threading.Thread(target=_build, args=(hid, urls), daemon=True).start()
    return {"id": hid}


@app.get("/api/hackathons/{hid}")
def get_hackathon(hid: str):
    d = storage.get(hid)
    if not d:
        raise HTTPException(404, "Not found")
    return d


@app.patch("/api/hackathons/{hid}")
def patch_hackathon(hid: str, body: Patch):
    d = storage.get(hid)
    if not d:
        raise HTTPException(404, "Not found")
    fields = {}
    if body.name is not None:
        fields["name"] = body.name
    if body.status is not None:
        fields["status"] = body.status
    if body.after is not None:
        fields["after_json"] = {**(d.get("after") or {}), **body.after}
    if body.plan is not None:
        fields["plan_json"] = body.plan
    if fields:
        storage.update(hid, **fields)
    return storage.get(hid)


@app.delete("/api/hackathons/{hid}")
def delete_hackathon(hid: str):
    storage.delete(hid)
    return {"ok": True}


@app.get("/api/hackathons/{hid}/events")
async def events(hid: str):
    d = storage.get(hid)
    if not d:
        raise HTTPException(404, "Not found")
    q = _subscribe(hid)

    async def gen():
        try:
            # Replay what already exists, so a reload never shows a blank page.
            for name in ("brief", "tools", "plan"):
                if d.get(name):
                    yield {"event": "message", "data": json.dumps({"type": "section", "name": name, "data": d[name]})}
            if d["status"] in ("ready", "error"):
                yield {"event": "message", "data": json.dumps({"type": "done"} if d["status"] == "ready" else {"type": "error", "message": d.get("error")})}
                return
            while True:
                try:
                    ev = q.get_nowait()
                except queue.Empty:
                    await asyncio.sleep(0.25)
                    continue
                yield {"event": "message", "data": json.dumps(ev)}
                if ev.get("type") in ("done", "error"):
                    return
        finally:
            _unsubscribe(hid, q)

    return EventSourceResponse(gen())


@app.get("/api/one/status")
def one_status():
    return one_actions.status()


def _event_rows(d: dict, what: str) -> list[dict]:
    """Turn the brief's deadline and agenda into calendar rows. Agenda items need a date; we take the event's start date."""
    import datetime as dt
    b = d.get("brief") or {}
    rows = []
    sub = b.get("submission") or {}
    if what in ("deadline", "all") and sub.get("deadline"):
        end = dt.datetime.fromisoformat(sub["deadline"])
        start = end - dt.timedelta(minutes=45)
        rows.append({"summary": f"{b.get('name')}: submission freeze and deadline", "start": start.isoformat(), "end": end.isoformat(),
                     "description": f"Submit at {sub.get('url') or 'the form'}. Fields: {', '.join(sub.get('fields') or [])}",
                     "location": (b.get("venue") or {}).get("address") or ""})
    if what in ("agenda", "all") and b.get("agenda") and b.get("start"):
        day = dt.datetime.fromisoformat(b["start"])
        for item in b["agenda"]:
            t = item.get("time", "")
            try:
                when = dt.datetime.fromisoformat(t) if t[:4].isdigit() and "-" in t else day.replace(hour=int(t.split(":")[0]), minute=int(t.split(":")[1][:2]))
            except Exception:  # noqa: BLE001
                continue
            rows.append({"summary": f"{b.get('name')}: {item.get('title')}", "start": when.isoformat(), "end": (when + dt.timedelta(minutes=30)).isoformat(),
                         "description": "", "location": (b.get("venue") or {}).get("address") or ""})
    return rows


@app.post("/api/hackathons/{hid}/calendar")
def to_calendar(hid: str, body: CalendarBody):
    d = storage.get(hid)
    if not d:
        raise HTTPException(404, "Not found")
    rows = _event_rows(d, body.what)
    if not rows:
        raise HTTPException(400, "The brief has no dated deadline or agenda to put on the calendar")
    created = []
    try:
        for r in rows:
            ev = one_actions.add_calendar_event(r["summary"], r["start"], r["end"], r["description"], r["location"])
            created.append({"summary": r["summary"], "start": r["start"], "link": (ev or {}).get("htmlLink")})
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"One could not create the event: {str(exc)[:300]}. Created so far: {len(created)}")
    after = {**(d.get("after") or {}), "calendar_events": created}
    storage.update(hid, after_json=after)
    return {"created": created}


@app.post("/api/hackathons/{hid}/discord")
def to_discord(hid: str, body: DiscordBody):
    d = storage.get(hid)
    if not d or not d.get("brief"):
        raise HTTPException(404, "Not found or brief not ready")
    b = d["brief"]
    channel = body.channel_id or settings.os.environ.get("DISCORD_CHANNEL_ID", "")
    if not channel:
        raise HTTPException(400, "No Discord channel id")
    sub = b.get("submission") or {}
    text = (f"**{b.get('name')}** brief\n"
            f"Deadline: {sub.get('deadline_text') or sub.get('deadline') or 'not found'}\n"
            f"Submit: {sub.get('url') or 'see event page'}\n"
            f"Required tools: {', '.join(t['name'] for t in b.get('required_tools') or [])}\n"
            f"Tracks: {', '.join(t['name'] for t in b.get('tracks') or [])}")
    try:
        res = one_actions.post_discord(channel, text)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"One could not post to Discord: {str(exc)[:300]}")
    return {"ok": True, "message_id": (res or {}).get("id")}


@app.post("/api/discover")
def discover(body: DiscoverBody):
    try:
        return discover_mod.discover(body.query, storage.get_profile())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Discover failed: {str(exc)[:300]}")


@app.get("/api/profile")
def get_profile():
    return storage.get_profile()


@app.put("/api/profile")
def put_profile(data: dict[str, Any]):
    storage.put_profile(data)
    return data
