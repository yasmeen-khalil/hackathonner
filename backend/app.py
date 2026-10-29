"""FastAPI backend. Run: uvicorn app:app --port 8000"""
from __future__ import annotations
import asyncio
import json
import queue
import threading
from typing import Any
from fastapi import FastAPI, HTTPException, Header, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

import settings  # noqa: F401  (loads .env)
import storage
import youcom
import parasail
from crew import build_brief
import discover as discover_mod
import one_actions

app = FastAPI(title="Hackathonner API")
storage.init()
storage.mark_interrupted()

BACKEND_SECRET = settings.os.environ.get("BACKEND_SECRET", "")


@app.middleware("http")
async def require_secret(request: Request, call_next):
    """When BACKEND_SECRET is set (hosted), every call except /api/health must carry it. Locally it is open."""
    if BACKEND_SECRET and request.url.path != "/api/health" and request.method != "OPTIONS":
        if request.headers.get("x-api-key", "") != BACKEND_SECRET:
            from fastapi.responses import JSONResponse
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    return await call_next(request)


def owner_of(x_user_id: str | None) -> str:
    """The signed-in user, as forwarded by the web app's proxy. 'local' when running without sign-in."""
    return (x_user_id or "local").strip()[:128] or "local"

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


class DiscordBody(BaseModel):
    channel_id: str | None = None


class Patch(BaseModel):
    name: str | None = None
    status: str | None = None
    after: dict[str, Any] | None = None
    plan: dict[str, Any] | None = None
    brief: dict[str, Any] | None = None  # shallow merge; "submission" and "venue" merge one level deeper


@app.get("/api/health")
def health():
    return {"ok": True, "parasail_key": bool(settings.PARASAIL_API_KEY), "youcom_key": bool(settings.YDC_API_KEY), "db": storage.engine(), "secured": bool(BACKEND_SECRET), "version": (settings.os.environ.get("RENDER_GIT_COMMIT") or "local")[:7]}


@app.get("/api/hackathons")
def list_hackathons(x_user_id: str | None = Header(default=None)):
    return storage.list_all(owner_of(x_user_id))


@app.post("/api/hackathons")
def create_hackathon(body: NewHackathon, x_user_id: str | None = Header(default=None)):
    urls = [u.strip() for u in body.urls if u.strip().lower().startswith(("http://", "https://"))][:10]
    if not urls:
        raise HTTPException(400, "Paste at least one http(s) link")
    if any(len(u) > 2000 for u in urls):
        raise HTTPException(400, "A link is too long")
    hid = storage.create_hackathon(urls, owner_of(x_user_id))
    threading.Thread(target=_build, args=(hid, urls), daemon=True).start()
    return {"id": hid}


@app.get("/api/hackathons/{hid}")
def get_hackathon(hid: str, x_user_id: str | None = Header(default=None)):
    d = storage.get(hid, owner_of(x_user_id))
    if not d:
        raise HTTPException(404, "Not found")
    return d


@app.patch("/api/hackathons/{hid}")
def patch_hackathon(hid: str, body: Patch, x_user_id: str | None = Header(default=None)):
    d = storage.get(hid, owner_of(x_user_id))
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
    if body.brief is not None and d.get("brief"):
        merged = {**d["brief"]}
        for k, v in body.brief.items():
            if k in ("submission", "venue") and isinstance(v, dict):
                merged[k] = {**(merged.get(k) or {}), **v}
            else:
                merged[k] = v
        fields["brief_json"] = merged
    if fields:
        storage.update(hid, **fields)
    return storage.get(hid)


@app.delete("/api/hackathons/{hid}")
def delete_hackathon(hid: str, x_user_id: str | None = Header(default=None)):
    storage.delete(hid, owner_of(x_user_id))
    return {"ok": True}


@app.post("/api/hackathons/{hid}/rebuild")
def rebuild(hid: str, x_user_id: str | None = Header(default=None)):
    """Run the helpers again on the same links. Used after an interrupted build or when the pages changed."""
    d = storage.get(hid, owner_of(x_user_id))
    if not d:
        raise HTTPException(404, "Not found")
    storage.update(hid, status="building", error=None, tools_json=None, plan_json=None)
    threading.Thread(target=_build, args=(hid, d["urls"]), daemon=True).start()
    return {"id": hid, "status": "building"}


@app.get("/api/hackathons/{hid}/events")
async def events(hid: str, x_user_id: str | None = Header(default=None)):
    d = storage.get(hid, owner_of(x_user_id))
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


@app.post("/api/hackathons/{hid}/discord")
def to_discord(hid: str, body: DiscordBody, x_user_id: str | None = Header(default=None)):
    d = storage.get(hid, owner_of(x_user_id))
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
def discover(body: DiscoverBody, x_user_id: str | None = Header(default=None)):
    try:
        return discover_mod.discover(body.query, storage.get_profile(owner_of(x_user_id)))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Discover failed: {str(exc)[:300]}")


class KvBody(BaseModel):
    value: str


@app.get("/api/kv/{key}")
def kv_get(key: str, x_user_id: str | None = Header(default=None)):
    """Tiny per-user store. The web app keeps each user's One Connect grant identifier here."""
    return {"value": storage.kv_get(owner_of(x_user_id), key)}


@app.put("/api/kv/{key}")
def kv_put(key: str, body: KvBody, x_user_id: str | None = Header(default=None)):
    storage.kv_put(owner_of(x_user_id), key, body.value)
    return {"ok": True}


@app.delete("/api/kv/{key}")
def kv_delete(key: str, x_user_id: str | None = Header(default=None)):
    storage.kv_delete(owner_of(x_user_id), key)
    return {"ok": True}


@app.get("/api/profile")
def get_profile(x_user_id: str | None = Header(default=None)):
    return storage.get_profile(owner_of(x_user_id))


@app.put("/api/profile")
def put_profile(data: dict[str, Any], x_user_id: str | None = Header(default=None)):
    storage.put_profile(data, owner_of(x_user_id))
    return data
