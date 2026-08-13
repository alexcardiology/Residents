# Resident Training & Assessment v1.0.82

## What changed

### Faculty Duty & Rotation Bot
- Added a protected **Duty Bot** page for every signed-in portal role.
- Added a prominent dashboard shortcut without increasing the compact dashboard card count.
- Combines approved Airtable 24-hour duties with the live Google Sheet for daytime ward, cath, echo, EP and clinic assignments.
- Supports Arabic and English questions about today, explicit past/future dates, tomorrow/yesterday and previous/coming weekdays.
- Understands the 24-hour shift rule: duty starts at **08:00** and ends at **08:00 the next day**.
- Can find a resident's next/previous assignment or the next seven days when aliases are configured in Airtable.
- Adds a date picker and an owner-only **Modify schedule** button for `drmohamedalaa90@gmail.com`.
- Reads approved assignments through a Supabase Edge Function; the Airtable token is never exposed in browser code.

### Prior Experience Logbook assessor scopes
- Each intervention/scope can now have **2 to 5 assigned assessors**.
- The Owner chooses the assessor group in **Owner → Logbooks → Prior experience assessors**.
- After the two senior-resident approvals are complete, all assigned assessors can review that scope.
- **Any 2 assessor approvals are sufficient** to verify the scope.
- Once the second approval is received, the remaining pending assessor requests are automatically closed as **Not required after 2 approvals** and stop generating reminder alerts.
- Rejections remain historically visible. A rejection only blocks verification when fewer than two possible approvals remain; the resident can still request reconsideration from the exact rejecting assessor.
- Existing Junior/Older assessor pairs are migrated automatically into slots 1 and 2.

### TTE
- Added **TTE** immediately before **TEE** in the normal E-logbook manual intervention list.
- Added TTE to Prior Experience Logbook interventions.
- Added TTE to Owner intervention fairness audit.
- Added TTE to assessor supervision scope display and Prior Experience assessor assignment matrix.

## Installation
1. No database migration is required when upgrading from v1.0.80.
2. Configure and deploy the `duty-bot` Supabase Edge Function as described in `SETUP_GUIDE.md`.
3. Replace `app.html`, `assets/app.js`, and `assets/style.css` with this package.
4. Keep your existing `assets/supabase.js` and `assets/login.js`.
5. Hard refresh the website (Ctrl+Shift+R).

## Data safety
- Existing Prior Experience submissions and completed assessor signatures are preserved.
- Existing two-assessor assignments are migrated into the new 2–5 assessor matrix.
- No resident accounts, curriculum, assessments, reviews, or normal E-logbook records are deleted.
