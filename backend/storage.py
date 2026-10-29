"""Storage: SQLite by default (one-command local run), Postgres when DATABASE_URL is set (hosted, Supabase).
Same SQL on both, with the few dialect differences handled here."""
from __future__ import annotations
import json
import os
import sqlite3
import uuid
import datetime as dt
from contextlib import contextmanager
import settings

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
PG = DATABASE_URL.startswith(("postgres://", "postgresql://"))

STATEMENTS = [
    """CREATE TABLE IF NOT EXISTS hackathons (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL,
  name TEXT,
  urls_json TEXT NOT NULL,
  sources_json TEXT,
  brief_json TEXT,
  tools_json TEXT,
  plan_json TEXT,
  after_json TEXT,
  error TEXT,
  owner TEXT NOT NULL DEFAULT 'local',
  draft INTEGER NOT NULL DEFAULT 0,
  progress_json TEXT
)""",
    """CREATE TABLE IF NOT EXISTS kv (
  owner TEXT NOT NULL,
  k TEXT NOT NULL,
  v TEXT NOT NULL,
  PRIMARY KEY (owner, k)
)""",
    """CREATE TABLE IF NOT EXISTS profiles (
  owner TEXT PRIMARY KEY,
  data_json TEXT NOT NULL
)""",
    "CREATE INDEX IF NOT EXISTS hackathons_owner ON hackathons (owner, created_at)",
    """CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  leader TEXT NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
)""",
    """CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  requested_at TEXT NOT NULL,
  PRIMARY KEY (team_id, owner)
)""",
]


def _now() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


class _Conn:
    """A thin wrapper so the rest of the file writes '?' placeholders and reads rows as dicts on both engines."""

    def __init__(self, raw):
        self.raw = raw

    def execute(self, sql: str, params=()):
        if PG:
            sql = sql.replace("?", "%s")
        return _Cursor(self.raw.execute(sql, params))


class _Cursor:
    def __init__(self, cur):
        self.cur = cur

    def fetchone(self):
        r = self.cur.fetchone()
        return dict(r) if r is not None else None

    def fetchall(self):
        return [dict(r) for r in self.cur.fetchall()]


@contextmanager
def conn():
    if PG:
        import psycopg
        from psycopg.rows import dict_row
        # prepare_threshold=None: no server-side prepared statements, so Supabase's connection pooler is happy.
        c = psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=10, prepare_threshold=None)
    else:
        c = sqlite3.connect(settings.DB_PATH)
        c.row_factory = sqlite3.Row
    try:
        yield _Conn(c)
        c.commit()
    finally:
        c.close()


def init():
    with conn() as c:
        for stmt in STATEMENTS:
            c.execute(stmt)
        if PG:
            c.execute("ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS draft INTEGER NOT NULL DEFAULT 0")
            c.execute("ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS progress_json TEXT")
            c.execute("ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS team_id TEXT")
        else:
            cols = {r["name"] for r in c.execute("PRAGMA table_info(hackathons)").fetchall()}
            if "owner" not in cols:
                c.execute("ALTER TABLE hackathons ADD COLUMN owner TEXT NOT NULL DEFAULT 'local'")
            if "draft" not in cols:
                c.execute("ALTER TABLE hackathons ADD COLUMN draft INTEGER NOT NULL DEFAULT 0")
            if "progress_json" not in cols:
                c.execute("ALTER TABLE hackathons ADD COLUMN progress_json TEXT")
            if "team_id" not in cols:
                c.execute("ALTER TABLE hackathons ADD COLUMN team_id TEXT")


def engine() -> str:
    return "postgres" if PG else "sqlite"


def create_hackathon(urls: list[str], owner: str = "local", team_id: str | None = None) -> str:
    hid = uuid.uuid4().hex[:10]
    with conn() as c:
        c.execute("INSERT INTO hackathons (id, created_at, updated_at, status, urls_json, owner, team_id) VALUES (?,?,?,?,?,?,?)",
                  (hid, _now(), _now(), "building", json.dumps(urls), owner, team_id))
    return hid


def _visible_clause(owner: str) -> tuple[str, tuple]:
    """A hackathon is visible to its owner and to approved members of its team."""
    return ("(owner = ? OR team_id IN (SELECT team_id FROM team_members WHERE owner = ? AND status = 'approved'))", (owner, owner))


def update(hid: str, **fields):
    cols, vals = [], []
    for k, v in fields.items():
        cols.append(f"{k} = ?")
        vals.append(json.dumps(v) if k.endswith("_json") and not isinstance(v, str) and v is not None else v)
    cols.append("updated_at = ?")
    vals.append(_now())
    vals.append(hid)
    with conn() as c:
        c.execute(f"UPDATE hackathons SET {', '.join(cols)} WHERE id = ?", tuple(vals))


def _row(r: dict) -> dict:
    d = dict(r)
    for k in list(d):
        if k.endswith("_json"):
            d[k[:-5]] = json.loads(d[k]) if d[k] else None
            del d[k]
    return d


def get(hid: str, owner: str | None = None) -> dict | None:
    with conn() as c:
        if owner is None:
            r = c.execute("SELECT * FROM hackathons WHERE id = ?", (hid,)).fetchone()
        else:
            clause, params = _visible_clause(owner)
            r = c.execute(f"SELECT * FROM hackathons WHERE id = ? AND {clause}", (hid, *params)).fetchone()
    return _row(r) if r else None


def list_all(owner: str = "local") -> list[dict]:
    with conn() as c:
        clause, params = _visible_clause(owner)
        rows = c.execute(f"SELECT h.*, t.name AS team_name FROM hackathons h LEFT JOIN teams t ON t.id = h.team_id WHERE {clause} ORDER BY h.created_at DESC", params).fetchall()
    out = []
    for r in rows:
        d = _row(r)
        b = d.get("brief") or {}
        out.append({"id": d["id"], "status": d["status"], "name": d.get("name") or b.get("name") or "Untitled", "team_id": d.get("team_id"), "team_name": d.get("team_name"), "mine": d["owner"] == owner,
                    "start": b.get("start"), "end": b.get("end"), "format": b.get("format"),
                    "city": (b.get("venue") or {}).get("city"), "deadline": (b.get("submission") or {}).get("deadline"),
                    "after": d.get("after"), "created_at": d["created_at"], "error": d.get("error")})
    return out


def delete(hid: str, owner: str = "local"):
    """Only the person who added a hackathon can remove it, even inside a team."""
    with conn() as c:
        c.execute("DELETE FROM hackathons WHERE id = ? AND owner = ?", (hid, owner))


# --- teams ---------------------------------------------------------------

def create_team(name: str, leader: str, display_name: str | None, email: str | None) -> dict:
    tid = uuid.uuid4().hex[:10]
    token = uuid.uuid4().hex
    with conn() as c:
        c.execute("INSERT INTO teams (id, name, leader, invite_token, created_at) VALUES (?,?,?,?,?)", (tid, name.strip()[:80], leader, token, _now()))
        c.execute("INSERT INTO team_members (team_id, owner, role, status, display_name, email, requested_at) VALUES (?,?,?,?,?,?,?)",
                  (tid, leader, "leader", "approved", display_name, email, _now()))
    return get_team(tid)


def get_team(tid: str) -> dict | None:
    with conn() as c:
        t = c.execute("SELECT * FROM teams WHERE id = ?", (tid,)).fetchone()
        if not t:
            return None
        members = c.execute("SELECT owner, role, status, display_name, email, requested_at FROM team_members WHERE team_id = ? ORDER BY requested_at", (tid,)).fetchall()
    return {**t, "members": members}


def team_by_token(token: str) -> dict | None:
    with conn() as c:
        t = c.execute("SELECT id, name, leader FROM teams WHERE invite_token = ?", (token,)).fetchone()
    return t


def my_teams(owner: str) -> list[dict]:
    """Every team the person belongs to or has asked to join, with members (pending ones only shown to the leader)."""
    with conn() as c:
        rows = c.execute("SELECT t.id FROM teams t JOIN team_members m ON m.team_id = t.id WHERE m.owner = ? ORDER BY t.created_at", (owner,)).fetchall()
    out = []
    for r in rows:
        t = get_team(r["id"])
        me = next((m for m in t["members"] if m["owner"] == owner), None)
        is_leader = t["leader"] == owner
        members = [m for m in t["members"] if m["status"] == "approved" or is_leader]
        out.append({"id": t["id"], "name": t["name"], "role": "leader" if is_leader else "member", "status": me["status"] if me else None,
                    "invite_token": t["invite_token"] if (me and me["status"] == "approved") else None, "members": members,
                    "pending_count": sum(1 for m in t["members"] if m["status"] == "pending") if is_leader else 0})
    return out


def request_join(token: str, owner: str, display_name: str | None, email: str | None) -> dict | None:
    t = team_by_token(token)
    if not t:
        return None
    with conn() as c:
        existing = c.execute("SELECT status FROM team_members WHERE team_id = ? AND owner = ?", (t["id"], owner)).fetchone()
        if not existing:
            c.execute("INSERT INTO team_members (team_id, owner, role, status, display_name, email, requested_at) VALUES (?,?,?,?,?,?,?)",
                      (t["id"], owner, "member", "pending", display_name, email, _now()))
    return {"team_id": t["id"], "name": t["name"], "status": existing["status"] if existing else "pending"}


def set_member_status(tid: str, leader: str, member: str, status: str) -> bool:
    with conn() as c:
        t = c.execute("SELECT leader FROM teams WHERE id = ?", (tid,)).fetchone()
        if not t or t["leader"] != leader or member == leader:
            return False
        if status == "removed":
            c.execute("DELETE FROM team_members WHERE team_id = ? AND owner = ?", (tid, member))
        else:
            c.execute("UPDATE team_members SET status = ? WHERE team_id = ? AND owner = ?", (status, tid, member))
    return True


def leave_team(tid: str, owner: str) -> bool:
    with conn() as c:
        t = c.execute("SELECT leader FROM teams WHERE id = ?", (tid,)).fetchone()
        if not t or t["leader"] == owner:
            return False  # a leader cannot leave; they can delete the team
        c.execute("DELETE FROM team_members WHERE team_id = ? AND owner = ?", (tid, owner))
    return True


def delete_team(tid: str, leader: str) -> bool:
    with conn() as c:
        t = c.execute("SELECT leader FROM teams WHERE id = ?", (tid,)).fetchone()
        if not t or t["leader"] != leader:
            return False
        c.execute("UPDATE hackathons SET team_id = NULL WHERE team_id = ?", (tid,))
        c.execute("DELETE FROM team_members WHERE team_id = ?", (tid,))
        c.execute("DELETE FROM teams WHERE id = ?", (tid,))
    return True


def is_approved_member(tid: str, owner: str) -> bool:
    with conn() as c:
        r = c.execute("SELECT 1 FROM team_members WHERE team_id = ? AND owner = ? AND status = 'approved'", (tid, owner)).fetchone()
    return bool(r)


def get_profile(owner: str = "local") -> dict:
    with conn() as c:
        r = c.execute("SELECT data_json FROM profiles WHERE owner = ?", (owner,)).fetchone()
    return json.loads(r["data_json"]) if r else {}


def put_profile(data: dict, owner: str = "local"):
    with conn() as c:
        c.execute("INSERT INTO profiles (owner, data_json) VALUES (?, ?) ON CONFLICT(owner) DO UPDATE SET data_json = excluded.data_json",
                  (owner, json.dumps(data)))


def kv_get(owner: str, k: str) -> str | None:
    with conn() as c:
        r = c.execute("SELECT v FROM kv WHERE owner = ? AND k = ?", (owner, k)).fetchone()
    return r["v"] if r else None


def kv_put(owner: str, k: str, v: str):
    with conn() as c:
        c.execute("INSERT INTO kv (owner, k, v) VALUES (?,?,?) ON CONFLICT(owner, k) DO UPDATE SET v = excluded.v", (owner, k, v))


def kv_delete(owner: str, k: str):
    with conn() as c:
        c.execute("DELETE FROM kv WHERE owner = ? AND k = ?", (owner, k))


def mark_interrupted():
    """A server restart kills in-flight builds. Mark them so the page offers Rebuild instead of waiting forever."""
    with conn() as c:
        c.execute("UPDATE hackathons SET status = 'error', error = 'The build was interrupted by a server restart. Press Rebuild.' WHERE status = 'building'")
