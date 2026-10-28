"""You.com: grounding. Search finds pages, Contents reads them. Header is X-API-Key."""
import httpx
import settings

BASE = "https://ydc-index.io/v1"


def _headers():
    if not settings.YDC_API_KEY:
        raise RuntimeError("YDC_API_KEY is empty. Put the You.com key in .env")
    return {"X-API-Key": settings.YDC_API_KEY, "Content-Type": "application/json"}


def search(query: str, count: int = 8) -> list[dict]:
    r = httpx.post(f"{BASE}/search", headers=_headers(), json={"query": query, "count": count}, timeout=30)
    r.raise_for_status()
    web = (r.json().get("results") or {}).get("web") or []
    return [{"title": w.get("title"), "url": w.get("url"), "description": w.get("description")} for w in web]


def contents(urls: list[str]) -> list[dict]:
    """Returns [{url, markdown}] in the order You.com gives them. Pages it could not read are dropped."""
    r = httpx.post(f"{BASE}/contents", headers=_headers(), json={"urls": urls, "format": "markdown"}, timeout=90)
    r.raise_for_status()
    pages = r.json() if isinstance(r.json(), list) else (r.json().get("results") or [])
    out = []
    for p in pages:
        md = p.get("markdown") or p.get("content") or ""
        if md.strip():
            out.append({"url": p.get("url"), "markdown": md})
    return out
