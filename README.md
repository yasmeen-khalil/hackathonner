# Hackathonner

Paste a hackathon's links. Get its brief, gameplan and countdown.

Built in one day at Hack With YOU: Halloween Edition (You.com, One, CrewAI, Parasail), San Francisco, October 28 2026. Track 3, The Open Haunt.

Live: https://hackathonner.vercel.app

## The problem

Every hackathon scatters its information. Today's event alone lived on a Luma page, a sponsor's page and skill file, the host's own GitHub page, two Discord servers, a Google Form, a slide deck for credits and a card on the table. Participants spend the first hour reading instead of building, and still miss rules: eligibility, the submission format, which tools are mandatory, the deadline.

## What it does

1. **Brief.** Paste every link you have, or photograph the QR codes on the card, slide or poster and the links are read out of them. Hackathonner reads the pages and builds a dashboard for that hackathon: when and where, tracks, requirements and disqualifiers, the rubric with weights, every must-use tool explained in plain words, the submission link and what the form asks for, the agenda, prizes, Discord, and a list of what the pages did not say so you can ask the organizers.
2. **Countdown.** The submission deadline is on every screen. Amber in the last two hours, red in the last thirty minutes.
3. **Gameplan.** A checklist with times, built backwards from the deadline, plus the agenda as a timeline. Tick things off.
4. **Actions.** One click puts the deadline and agenda on a Hackathonner calendar inside your own Google account (your main calendar is never touched), emails you the brief and gameplan through your own Gmail, or posts the brief to a Discord channel. All through One Connect, with a grant you control and can revoke.
5. **Discover.** Live search for upcoming hackathons, ranked against your profile with an honest fit score and reason.
6. **Debrief.** Mark the project submitted, then record placing, prizes, judge comments and notes as they arrive.

## How the four partners work together

- **You.com** is the grounding. Its Contents endpoint turns each event page into clean markdown, which is the only material the helpers are allowed to use. Its Search endpoint finds upcoming hackathons for Discover. Remove You.com and nothing can be read or found.
- **CrewAI** is the team. A Flow runs the helpers: the Reader turns pages into the brief, then the Explainer (tool cards) and the Planner (checklist and timeline) run in parallel on the brief. Discover runs a Matcher. Each helper is an Agent with a role, and every section streams to the page the moment it lands.
- **Parasail** is the model behind every helper, through its OpenAI-compatible API. Extraction uses `parasail-deepseek-v4-flash` with schema-locked JSON (`response_format` with a `json_schema`), so the dashboard always receives a valid brief. Nothing in the brief is hardcoded: the same code built this event's brief from its public pages.
- **One** is the hands. Through One Connect, each signed-in user links their own Google Calendar and Discord to Hackathonner and grants only the access they choose. The app finds the right action with `searchActions`, runs it with `runAction`, and One enforces the grant on every call. A fallback path uses the One CLI with the operator's own connections.

Partners are load-bearing: delete any one of them and a feature disappears.

## Architecture

```
Browser (Next.js on Vercel, Clerk sign-in)
  -> /api/backend/*   same-origin proxy: checks the session, adds the shared secret and the user id, streams SSE
  -> /api/one/*       One Connect authorize and callback (SDK generated)
  -> /api/actions     calendar and Discord actions with the user's One grant
Python API (FastAPI on Render, Docker)
  CrewAI Flow -> You.com Contents -> Reader / Explainer / Planner agents on Parasail -> SQLite or Postgres (Supabase)
```

The Python API only answers requests that carry the shared secret. Every row is scoped to the signed-in user. Keys live in `.env` files that are never committed.

## Run it yourself (one command)

```bash
cp .env.example .env            # fill in YDC_API_KEY and PARASAIL_API_KEY. Everything else is optional.
./run.sh                        # starts the API on :8000 and the web app on :3000
```

Then open http://localhost:3000, paste a hackathon's links, and watch the brief build. Without Clerk keys the app runs as one local user with no sign-in. Without One Connect keys the action buttons explain what is missing instead of failing silently.

Requirements: Python 3.10 to 3.13 (CrewAI does not support 3.14) and Node 20 or newer.

### Keys

| Variable | Where it comes from |
|---|---|
| `YDC_API_KEY` | https://you.com/home (You.com API key) |
| `PARASAIL_API_KEY` | https://www.saas.parasail.io/keys |
| `ONE_CLIENT_ID`, `ONE_CLIENT_SECRET`, `ONE_CONNECT_KEY`, `ONE_PERMISSION_SET` | https://app.withone.ai, Developers, Connect (web/.env.local) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | https://dashboard.clerk.com (web/.env.local, optional) |
| `BACKEND_SECRET` | any long random string, same value in `.env` and `web/.env.local` |
| `DATABASE_URL` | optional Postgres connection string; empty means a local SQLite file |

## Deploy

- Web: `cd web && vercel deploy --prod`. Set the variables above plus `BACKEND_URL`.
- API: `render.yaml` at the repo root is a Render Blueprint for the Docker service in `backend/`.

## Roadmap

Teams: one leader, a share link any member can pass on, join requests that the leader approves, and briefs owned by the team so everyone sees the same gameplan. In-app chat with the helpers that edits the checklist. A Claude Code or Codex bridge. A Loom-style recorder with spacebar pause for the demo video. Apple Calendar and Luma sync. QR code scanning at the venue. Team members sharing one brief.

## Honest notes

Extraction is only as good as the pages: when a page omits the date or the deadline, the brief says so under "ask the organizers" and you can set the deadline by hand. The Reader takes two to three minutes on a long page; sections stream in as they finish. Fit scores in Discover come from search snippets, not from reading each event page.
