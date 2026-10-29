"""Discover: You.com Search finds candidate events, then a Matcher agent on Parasail ranks them against the profile.
Only facts present in the search snippets are used. Missing dates or places stay null."""
from __future__ import annotations
import datetime as dt
import json
from typing import List, Literal, Optional
from pydantic import BaseModel
from crewai import Agent

import settings
import youcom
from crew import make_llm, _run_agent_json


class Found(BaseModel):
    title: str
    url: str
    when: Optional[str] = None     # as written in the snippet, or null
    where: Optional[str] = None    # city or "online", or null
    format: Optional[Literal["in_person", "online", "hybrid"]] = None
    fit: Optional[int] = None      # 1 to 10 against the profile, null when the snippet says too little
    why: Optional[str] = None      # one sentence
    description: Optional[str] = None


class DiscoverResult(BaseModel):
    results: List[Found]


def _queries(query: str, profile: dict) -> list[str]:
    now = dt.date.today()
    month = now.strftime("%B %Y")
    qs = []
    if query.strip():
        qs.append(query.strip())
    city = (profile.get("city") or "").strip()
    if city:
        qs.append(f"upcoming hackathons {city} {month}")
    interests = (profile.get("interests") or "").strip()
    if interests and not query.strip():
        qs.append(f"hackathon {interests[:60]} {now.year}")
    if not qs:
        qs.append(f"upcoming hackathons {month}")
    return qs[:3]


def discover(query: str, profile: dict) -> dict:
    seen, hits = set(), []
    for q in _queries(query, profile):
        for r in youcom.search(q, count=8):
            if r["url"] and r["url"] not in seen:
                seen.add(r["url"])
                hits.append(r)
    hits = hits[:12]  # keep the Matcher's input small so it answers in about a minute
    if not hits:
        return {"results": [], "queries": _queries(query, profile)}
    matcher = Agent(role="Hackathon Matcher",
                    goal="Rank hackathon search results against a builder's profile, honestly.",
                    backstory=("You read search results about hackathons and a builder's profile. Keep only results that are "
                               "actual hackathons or hackathon listings. For each, copy the date and place exactly as the snippet "
                               "states them, or leave them null. format is in_person, online or hybrid only when the snippet says so, "
                               "else null. Give a fit score from 1 to 10 against the profile with a one-sentence reason that names "
                               "the matching interest, city or stack. A listing page that merely aggregates events gets fit 5 at most. "
                               "Never invent dates, places or prizes."),
                    llm=make_llm(settings.FAST_MODEL, 8000), verbose=False, allow_delegation=False)
    desc = (f"Today is {dt.date.today().isoformat()}.\nProfile:\n{json.dumps(profile, indent=1)}\n\nSearch results:\n"
            + json.dumps(hits, indent=1) + "\n\nReturn the ranked list, best fit first, as JSON matching DiscoverResult.")
    out = _run_agent_json(matcher, desc, "JSON matching DiscoverResult.", DiscoverResult,
                          "You convert a ranked list into the required JSON without adding facts.")
    out["queries"] = _queries(query, profile)
    return out
