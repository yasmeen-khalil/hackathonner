# Hackathonner — design handoff

Open `Workspace.dc.html` in a browser to see the live, clickable design (it needs `support.js` and `icons.js` next to it). Rebuild it in your stack using the tokens in `tokens/`.

## What's in here
- `Workspace.dc.html` — the hackathon workspace page. **This is the approved direction.**
- `tokens/tokens.css`, `tokens/tokens.json`, `tokens/tailwind.preset.js` — the same values in three formats.
- `brand/wordmark.svg`, `brand/wordmark-reverse.svg` — the chosen wordmark (option 3g): lowercase Arial Bold, tight tracking, hot pink full stop. The SVG uses live text, so outline it in a vector editor before using it where Arial may be missing.
- `icons/` — Phosphor Icons, bold weight (MIT). `icons.js` holds the same paths for the prototype.

## Scope
Only the Workspace page is in the final style. Home, Discover, Add, Profile and Sign-in have not been redesigned to match yet; build them from these tokens and the Workspace patterns, or ask for designs.

## Design rules
1. **White page, Arial only.** Regular for big display text, Bold for titles, buttons and the countdown.
2. **One brand color.** Hot pink `#EC6699` marks the main action and where you are. Text on pink is always ink `#1A1712`, never white.
3. **No divider lines.** Lists are separate light green blocks (`#E4F2E7`, 12px radius, 6px gap).
4. **Action first.** Every row that needs work gets a button (pink when it's urgent, white when it's a utility like Copy). Status words only where nothing needs doing.
5. **No repeats.** The countdown lives only in the top bar. Status lives in the tables, not as tags above the title.
6. **Pill buttons.** 999px radius. Pressed: scale to 0.98.

## Page structure (Workspace)
1. **Deadline bar**, 44px, sticky. Phase, hackathon and close time, HH:MM:SS countdown.
   - Calm: pink, ink text. With 2 hours or less: amber `#F59100`, ink text. With 30 minutes or less: red `#C8160C`, white text. Color change animates over 360ms.
2. **Header**, 64px. Wordmark at left. Nav (Home, Discover, Brief, Profile) on desktop; the current item gets a 2px ink underline. Pink "Add a hackathon" pill at right.
3. **Left column** (340px desktop, 280px mid, full width on phone; sticky on desktop):
   - Hackathon name, 64px Arial Regular.
   - **Do next** card: white, 2px pink inner border, 16px radius. Shows the next Gameplan item, its due time, "Mark done" (pink) and "Gameplan" (green).
   - Details list: Dates, Venue (the address is a link to maps, pink underline), Track, Team. Light green blocks, 10px radius.
   - "Submit · N of 7 ready" pill in ink, which jumps to the Submit section.
4. **Right column**: section tabs (Overview, Rules, Toolkit, Gameplan, Submit, Debrief). The current tab is bold with a 2px pink underline. Below, an optional one-line summary, then grouped rows. Group headings are 12px bold uppercase labels in muted `#6B6458`.
5. **Phone** (< 820px): single column, and the main nav moves to a 56px bottom bar.

### Row anatomy
Grid: 180px label · flexible value · action on the right (136px label column at mid widths; two columns on phone). A 10px dot before the label shows state: filled ink = done, ink ring = open, pink = next or needs action, red = risk.

## Contrast (WCAG)
- ink on white: 17.9:1
- muted on white: 5.9:1
- ink on green: 15.4:1
- muted on green: 5.1:1
- ink on pink: 5.9:1
- ink on amber: 7.6:1
- white on red: 5.9:1

All text pairs pass AA. Pink is never used for text on white.

## Motion
Switching sections: the summary and rows fade in and rise 6px over 280ms (60ms apart). With `prefers-reduced-motion`, skip the rise.
