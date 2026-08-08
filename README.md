# Resident Training v1.0.56

Small cumulative update on top of v1.0.55.

## Change
- Renamed **PCI** to **Elective PCI** in the resident logbook intervention list.
- Added **Primary PCI** immediately below Elective PCI.
- Updated logbook PDF ordering and Owner intervention fairness audit ordering.
- Existing historical logbook rows stored as `PCI` are migrated to `Elective PCI`.

## Install
1. Run `sql/resident_training_v1.0.56.sql` in Supabase SQL Editor.
2. Replace `app.html`, `index.html`, `assets/app.js`, and `assets/style.css`.
3. Hard-refresh the browser.

No logbook rows are deleted.
