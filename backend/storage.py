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
  owner TEXT NOT NULL DEFAULT 'local'
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
        c = psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=10)
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
        if not PG:
            cols = {r["name"] for r in c.execute("PRAGMA table_info(hackathons)").fetchall()}
            if "owner" not in cols:
                c.execute("ALTER TABLE hackathons ADD COLUMN owner TEXT NOT NULL DEFAULT 'local'")


def engine() -> str:
    return "postgres" if PG else "sqlite"


def create_hackathon(urls: list[str], owner: str = "local") -> str:
    hid = uuid.uuid4().hex[:10]
    with conn() as c:
        c.execute("INSERT INTO hackathons (id, created_at, updated_at, status, urls_json, owner) VALUES (?,?,?,?,?,?)",
                  (hid, _now(), _now(), "building", json.dumps(urls), owner))
    return hid


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
            r = c.execute("SELECT * FROM hackathons WHERE id = ? AND owner = ?", (hid, owner)).fetchone()
    return _row(r) if r else None


def list_all(owner: str = "local") -> list[dict]:
    with conn() as c:
        rows = c.execute("SELECT * FROM hackathons WHERE owner = ? ORDER BY created_at DESC", (owner,)).fetchall()
    out = []
    for r in rows:
        d = _row(r)
        b = d.get("brief") or {}
        out.append({"id": d["id"], "status": d["status"], "name": d.get("name") or b.get("name") or "Untitled",
                    "start": b.get("start"), "end": b.get("end"), "format": b.get("format"),
                    "city": (b.get("venue") or {}).get("city"), "deadline": (b.get("submission") or {}).get("deadline"),
                    "after": d.get("after"), "created_at": d["created_at"], "error": d.get("error")})
    return out


def delete(hid: str, owner: str = "local"):
    with conn() as c:
        c.execute("DELETE FROM hackathons WHERE id = ? AND owner = ?", (hid, owner))


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
