# Resident Training & Assessment — v1.0.58

Incremental update after v1.0.57.

## New Owner-only Test-period reset

Go to **Owner → More → Test-period reset**.

You can permanently reset:

1. **ALL reviews**
   - Deletes all clinical/behavioural reviews.
   - Deletes review reconsideration state.
   - Deletes review-related Inbox notifications/messages.

2. **ALL knowledge & skills progress**
   - Clears resident Knowledge completion/checkmarks (`knowledge_progress`).
   - Clears resident selected Skill levels (`skill_levels`).
   - Clears chapter Skill performance logs (`skill_logs`).

3. **RESET BOTH**
   - Performs both resets together.

## Preserved

These reset actions do **not** delete:
- Accounts/profiles
- Chapters
- Knowledge item definitions
- Skill definitions
- Formal assessments
- Assessment schedules
- Resident e-logbook interventions/conferences

The reset page shows the number of records currently present before you reset.

## Safety

The RPCs verify the authenticated account is an active **Program Owner**.
Each destructive action also requires an exact typed phrase:
- `RESET REVIEWS`
- `RESET LEARNING`
- `RESET TEST DATA`

## Install

1. Run `sql/resident_training_v1.0.58.sql` in Supabase SQL Editor.
2. Replace `app.html`, `index.html`, `assets/app.js`, and `assets/style.css` with the v1.0.58 files.
3. Keep your existing `assets/login.js` and `assets/supabase.js`.
4. Hard-refresh the website.
