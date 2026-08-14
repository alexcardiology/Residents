# Resident Training v1.0.91 — Ask El Médico + persistent sign-in

## What changed
- Renamed the visible Duty Bot identity everywhere to **Ask El Médico** while keeping the working backend route/Edge Function (`duty-bot`) unchanged.
- Added the approved El Médico logo to the sidebar, dashboard launcher, chat header, chat bubbles and assistant page.
- Redesigned the assistant page into a compact chat + mascot/quick-question layout.
- Removed the visible **Choose any date** control.
- Quick questions are exactly:
  - Who is in Miri CCU today?
  - Who is in Miri ER today?
  - Who is in Smouha today?
- User sessions are persisted in browser local storage, refreshed automatically, and the sign-in page returns an already signed-in user directly to the portal.
- Temporary profile/network loading errors no longer automatically sign out a valid session.

## Install
Replace these files in GitHub:
- `app.html`
- `index.html`
- `assets/app.js`
- `assets/style.css`
- `assets/login.js`
- `assets/supabase.js`
- add `assets/el-medico.png`

Then hard-refresh (Ctrl+Shift+R).

## Database
No SQL migration is required for v1.0.91. Keep the already deployed `duty-bot` Edge Function and existing Supabase secrets.

## Session behavior
A user remains signed in across page refreshes and browser restarts until they use **Log out**, unless their account is suspended/revoked or Supabase invalidates the server-side session.
