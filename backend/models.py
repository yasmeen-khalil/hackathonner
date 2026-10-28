from typing import List, Literal, Optional
from pydantic import BaseModel


class Link(BaseModel):
    label: str
    url: str
    kind: str = "other"  # event_page, rules, discord, form, docs, slides, repo, tickets, other


class Venue(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    map_url: Optional[str] = None
    doors_time: Optional[str] = None


class Track(BaseModel):
    name: str
    summary: str
    requirements: List[str] = []
    disqualifiers: List[str] = []


class RequiredTool(BaseModel):
    name: str
    what_it_is: str
    job_here: str
    key_source: Optional[str] = None
    docs_url: Optional[str] = None
    free_for_event: Optional[bool] = None


class RubricItem(BaseModel):
    track: Optional[str] = None  # which track this criterion belongs to, when the rubric differs per track
    criterion: str
    weight: Optional[str] = None
    looks_for: Optional[str] = None


class Submission(BaseModel):
    url: Optional[str] = None
    deadline: Optional[str] = None       # ISO 8601 with offset when the page gives a time zone
    deadline_text: Optional[str] = None  # the deadline exactly as written on the page
    fields: List[str] = []
    instructions: Optional[str] = None


class AgendaItem(BaseModel):
    time: str
    title: str


class ChecklistItem(BaseModel):
    title: str
    due: Optional[str] = None
    done: bool = False


class Brief(BaseModel):
    name: str
    tagline: Optional[str] = None
    organizer: Optional[str] = None
    partners: List[str] = []
    start: Optional[str] = None
    end: Optional[str] = None
    timezone: Optional[str] = None
    format: Literal["in_person", "online", "hybrid", "unknown"] = "unknown"
    venue: Venue = Venue()
    links: List[Link] = []
    contacts: List[str] = []
    tracks: List[Track] = []
    required_tools: List[RequiredTool] = []
    rubric: List[RubricItem] = []
    submission: Submission = Submission()
    agenda: List[AgendaItem] = []
    prizes: List[str] = []
    unknowns: List[str] = []  # facts the sources did not state, to ask the organizers


class ToolExplanations(BaseModel):
    tools: List[RequiredTool]


class Plan(BaseModel):
    next_action: str
    checklist: List[ChecklistItem]
    timeline: List[AgendaItem]  # the agenda plus our own milestones, in time order
    warnings: List[str] = []    # rules that are easy to break, in one line each
