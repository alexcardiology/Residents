# Resident Training v1.0.79

Small assessor UI update.

## New
On **Assessor → Logbook requests**, a compact strip now shows:

**You are assigned to supervise**

followed by each assigned manual intervention as a dark-navy chip with yellow text.

Assignments are read from the existing Junior/Older assessor pair configuration. Conferences are intentionally excluded from this manual-intervention strip.

## Install
1. Run `sql/resident_training_v1.0.79.sql` in Supabase SQL Editor.
2. Replace `app.html`, `index.html`, `assets/app.js`, and `assets/style.css`.
3. Hard refresh the portal.
