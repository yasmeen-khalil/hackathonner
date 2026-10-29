"""Parasail: inference. OpenAI-compatible. Schema-locked JSON through response_format."""
import json
import re
import httpx
import settings


def _headers():
    if not settings.PARASAIL_API_KEY:
        raise RuntimeError("PARASAIL_API_KEY is empty. Put the Parasail key in .env")
    return {"Authorization": f"Bearer {settings.PARASAIL_API_KEY}", "Content-Type": "application/json"}


def chat(messages, model=None, schema=None, max_tokens=8000, temperature=0.1) -> str:
    body = {"model": model or settings.FAST_MODEL, "messages": messages, "max_tokens": max_tokens, "temperature": temperature}
    if schema is not None:
        body["response_format"] = {"type": "json_schema", "json_schema": {"name": "out", "schema": schema}}
    r = httpx.post(f"{settings.PARASAIL_BASE}/chat/completions", headers=_headers(), json=body, timeout=240)
    r.raise_for_status()
    return r.json()["choices"][0]["message"].get("content") or ""


def _strip_fences(text: str) -> str:
    text = text.strip()
    m = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.S)
    return m.group(1) if m else text


def json_chat(system: str, user: str, schema: dict, model=None, max_tokens=6000) -> dict:
    text = chat([{"role": "system", "content": system}, {"role": "user", "content": user}],
                model=model, schema=schema, max_tokens=max_tokens)
    return json.loads(_strip_fences(text))
