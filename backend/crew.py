"""The CrewAI pipeline: a Flow that reads sources (You.com), then runs agents on Parasail.
Reader -> brief. Then, in parallel, Explainer -> tools and Planner -> plan. Every section is emitted as it lands."""
from __future__ import annotations
import json
import datetime as dt
from typing import Callable, Optional
from pydantic import BaseModel
from crewai import Agent, Task, Crew, Process, LLM
from crewai.flow.flow import Flow, start, listen

import settings
import youcom
import parasail
from models import Brief, ToolExplanations, Plan

Emit = Callable[[str, str, Optional[dict]], None]  # (type, message_or_section_name, data)


def make_llm(model: str | None = None, max_tokens: int = 8000) -> LLM:
    return LLM(model=model or settings.FAST_MODEL, provider="openai", base_url=settings.PARASAIL_BASE,
               api_key=settings.PARASAIL_API_KEY, temperature=0.1, max_tokens=max_tokens)


def _now_text() -> str:
    now = dt.datetime.now().astimezone()
    return now.strftime("%A %B %d %Y, %H:%M %Z (UTC%z)")


def _sources_text(sources: list[dict], limit_chars: int = 60000) -> str:
    parts, used = [], 0
    for s in sources:
        chunk = f"\n\n===== SOURCE: {s['url']} =====\n{s['markdown']}"
        if used + len(chunk) > limit_chars:
            chunk = chunk[: max(0, limit_chars - used)]
        parts.append(chunk)
        used += len(chunk)
        if used >= limit_chars:
            break
    return "".join(parts)


def _run_agent_json(agent: Agent, description: str, expected: str, model_cls: type[BaseModel], system_hint: str) -> dict:
    """Run one agent through a Crew and get its output as model_cls. If the crew's own conversion fails,
    repair with a schema-locked Parasail call over the agent's raw answer. Both paths are real model work."""
    task = Task(description=description, expected_output=expected, agent=agent, output_pydantic=model_cls)
    crew = Crew(agents=[agent], tasks=[task], process=Process.sequential, verbose=False)
    try:
        result = crew.kickoff()
    except Exception as exc:  # noqa: BLE001 - a model that ran out of output budget or returned junk
        # Same job, same model family, one direct schema-locked call. Still Parasail, still grounded on the same input.
        data = parasail.json_chat(f"{system_hint}\nRole: {agent.role}. {agent.goal}", description,
                                  schema=model_cls.model_json_schema(), max_tokens=8000)
        return model_cls.model_validate(data).model_dump()
    if getattr(result, "pydantic", None) is not None:
        return result.pydantic.model_dump()
    if getattr(result, "json_dict", None):
        return model_cls.model_validate(result.json_dict).model_dump()
    raw = result.raw or ""
    data = parasail.json_chat(system_hint, f"Convert this answer into the required JSON. Keep every fact, add nothing.\n\n{raw}",
                              schema=model_cls.model_json_schema(), max_tokens=8000)
    return model_cls.model_validate(data).model_dump()


READER_RULES = (
    "You extract facts about a hackathon from its web pages. Use only what the sources say. Never invent dates, "
    "links, prizes, rules or tools. If a fact is missing, leave it null or empty and list what is missing in 'unknowns'. "
    "Dates: output ISO 8601, with the time zone offset when the page states a time zone. Links: keep full URLs exactly. "
    "Required tools: list every sponsor product the rules say teams must build with. Rubric: copy criteria and weights. "
    "Submission: the exact deadline as written, the form or link, and the fields or materials it asks for. "
    "Rubric: when tracks are scored differently, set 'track' on each criterion. Prizes and agenda: copy every line you find. "
    "Time zone: if the pages state none but the venue city is stated, use that city's IANA time zone (for example "
    "America/Los_Angeles for San Francisco) and add 'time zone inferred from the venue city' to unknowns. "
    "Dates: if an agenda or deadline gives a clock time and the event date is stated anywhere in the sources (title, "
    "header, text), combine them into full ISO 8601 with the offset. If no date is stated anywhere, leave dates null."
)


class BriefState(BaseModel):
    urls: list[str] = []
    sources: list[dict] = []
    brief: dict | None = None
    tools: dict | None = None
    plan: dict | None = None


class BriefFlow(Flow[BriefState]):
    emit: Emit = staticmethod(lambda t, m, d=None: None)

    @start()
    def fetch_sources(self):
        self.emit("status", f"Reading {len(self.state.urls)} page(s) with You.com", None)
        sources = youcom.contents(self.state.urls)
        if not sources:
            raise RuntimeError("You.com could not read any of the pages")
        self.state.sources = sources
        self.emit("sources", "sources", {"sources": [{"url": s["url"], "chars": len(s["markdown"])} for s in sources]})
        return sources

    @listen(fetch_sources)
    def extract_brief(self, sources):
        self.emit("status", "Reader agent is extracting the brief on Parasail", None)
        reader = Agent(role="Event Reader", goal="Turn hackathon web pages into one exact, honest brief.",
                       backstory=READER_RULES, llm=make_llm(settings.FAST_MODEL, 8000), verbose=False, allow_delegation=False)
        desc = (f"Today is {_now_text()}.\nRead these sources and produce the brief as JSON matching the Brief schema.\n"
                f"{_sources_text(sources)}")
        brief = _run_agent_json(reader, desc, "A single JSON object matching the Brief schema.", Brief, READER_RULES)
        self.state.brief = brief
        self.emit("section", "brief", brief)
        return brief

    @listen(extract_brief)
    def explain_tools(self, brief):
        self.emit("status", "Explainer agent is writing the tool cards", None)
        explainer = Agent(role="Tool Explainer",
                          goal="Explain each required tool to a builder who has never used it, in plain words.",
                          backstory=("You write for a builder under time pressure who has never used these tools. For each tool write "
                                     "full sentences, never copy a table cell. what_it_is: two or three sentences on what the product "
                                     "is and what talking to it looks like (an API you send text to, a Python library, a connector "
                                     "that holds logins), using your general knowledge of the product. job_here: two or three "
                                     "sentences on the exact job the rules give it at THIS event, grounded in the sources, with the "
                                     "endpoints, commands or steps the sources name, covering every track or category the rules describe, not only "
                                     "the first one. key_source: where the key or account comes from, and whether the event provides it. "
                                     "docs_url: only a link the sources give. No marketing words."),
                          llm=make_llm(settings.FAST_MODEL, 8000), verbose=False, allow_delegation=False)
        desc = ("Required tools and partner notes from the brief:\n" + json.dumps(
            {"partners": brief.get("partners"), "required_tools": brief.get("required_tools"), "tracks": brief.get("tracks")},
            indent=1) + "\n\nSource excerpts:\n" + _sources_text(self.state.sources, 30000))
        tools = _run_agent_json(explainer, desc, "JSON matching ToolExplanations, one entry per required tool, full sentences.",
                                ToolExplanations, "You rewrite tool descriptions into plain full sentences without inventing event facts.")
        self.state.tools = tools
        self.emit("section", "tools", tools)
        return tools

    @listen(extract_brief)
    def make_plan(self, brief):
        self.emit("status", "Planner agent is building the checklist", None)
        planner = Agent(role="Prep Planner",
                        goal="Turn the deadline, agenda and submission rules into a checklist with times.",
                        backstory=("You plan a hackathon day backwards from the submission deadline. The checklist always "
                                   "includes: read rules, set up every required tool, build the smallest end-to-end demo, write "
                                   "the README, record the demo video if one is required, fill the submission form, and a "
                                   "freeze time 45 minutes before the deadline. Times are ISO 8601 in the event's time zone; when the brief gives a "
                                   "time zone, use it. If the brief has a deadline clock time but no date and the event date is known, "
                                   "combine them. If the brief has no submission deadline at all, do NOT assume one: leave every 'due' "
                                   "null, make next_action 'Find the submission deadline: ask the organizers', and say so in warnings. "
                                   "The timeline must keep every agenda item, converted to ISO 8601 when the date and time zone are known."),
                        llm=make_llm(settings.FAST_MODEL, 8000), verbose=False, allow_delegation=False)
        desc = (f"Today is {_now_text()}.\nBrief:\n" + json.dumps(
            {k: brief.get(k) for k in ("name", "start", "end", "timezone", "agenda", "submission", "tracks", "required_tools")},
            indent=1))
        plan = _run_agent_json(planner, desc, "JSON matching Plan.", Plan,
                               "You convert a plan into the required JSON without adding facts.")
        self.state.plan = plan
        self.emit("section", "plan", plan)
        return plan


def build_brief(urls: list[str], emit: Emit) -> BriefState:
    flow = BriefFlow()
    flow.emit = emit  # type: ignore[assignment]
    flow.kickoff(inputs={"urls": urls})
    return flow.state
