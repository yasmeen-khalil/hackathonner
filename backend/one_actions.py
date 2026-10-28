"""One: the actuator. Every real action in an outside app goes through One's three-step loop
(list connections, find the action, execute it), via the vendored one_cli wrapper and the One CLI.
Action ids are resolved at run time by method and path, never pasted from a previous session."""
from __future__ import annotations
import glob
import os
import shutil
import one_cli as oc

# The One CLI is a Node program. Make sure the nvm-installed node bin is on PATH for subprocesses.
if shutil.which("one") is None:
    for b in sorted(glob.glob(os.path.expanduser("~/.nvm/versions/node/*/bin")), reverse=True):
        if os.path.exists(os.path.join(b, "one")):
            os.environ["PATH"] = b + os.pathsep + os.environ.get("PATH", "")
            break

PLATFORMS = ("google-calendar", "discord", "gmail")


def status() -> dict:
    """Which platforms have an operational connection. Never raises: the UI shows the message instead."""
    out = {"cli": shutil.which("one") is not None, "platforms": {}}
    if not out["cli"]:
        out["error"] = "One CLI not found. Install with: npm i -g @withone/cli, then: one init --auth browser"
        return out
    try:
        rows = oc.one("list", "--limit", "100").get("connections", [])
    except oc.OneError as exc:
        out["error"] = str(exc)[:300]
        return out
    for p in PLATFORMS:
        mine = [c for c in rows if c.get("platform") == p and c.get("state") == "operational"]
        out["platforms"][p] = {"connected": bool(mine), "count": len(mine), "name": (mine[0].get("name") if mine else None)}
    return out


def add_calendar_event(summary: str, start_iso: str, end_iso: str, description: str = "", location: str = "") -> dict:
    """Create one event on the primary Google Calendar. Returns the created event (id, htmlLink...)."""
    key = oc.connection("google-calendar")
    action_id = oc.resolve("google-calendar", "create an event on a calendar", "POST", "/calendars/{calendarId}/events",
                           task="put a hackathon's deadline and agenda on the builder's calendar")
    body = {"summary": summary, "start": {"dateTime": start_iso}, "end": {"dateTime": end_iso}}
    if description:
        body["description"] = description
    if location:
        body["location"] = location
    return oc.execute("google-calendar", action_id, key, data=body, path_vars={"calendarId": "primary"}) or {}


def post_discord(channel_id: str, content: str) -> dict:
    """Post one message to a Discord channel the connected account can see."""
    key = oc.connection("discord")
    action_id = oc.resolve("discord", "send a message to a channel", "POST", "/channels/{channelId}/messages",
                           task="post a hackathon brief summary to the team's channel")
    return oc.execute("discord", action_id, key, data={"content": content[:1900]}, path_vars={"channelId": channel_id}) or {}
