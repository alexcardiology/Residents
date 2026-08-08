# Resident Training & Assessment — v1.0.63

Frontend-only update after v1.0.62.

## Review Inbox thread redesign

Review conversations now open as a compact chat-style thread instead of a wide report modal.

- Narrow centered modal (maximum ~620 px).
- Messages are shown as left/right chat bubbles.
- Each bubble contains sender, time, short event title and message text.
- The current review is shown only as a compact two-line summary.
- No large metadata grid and no horizontal scrolling.
- Review actions remain available at the bottom.
- Mobile uses the same chat layout with wider bubbles.

## Installation

No SQL migration is required. Replace `app.html`, `index.html`, `assets/app.js`, and `assets/style.css`, then hard-refresh.
