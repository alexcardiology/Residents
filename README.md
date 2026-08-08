# Resident Training v1.0.55

Adds these manual interventions **at the end** of the resident logbook list:

1. Exercise stress ECG
2. Tilting table
3. Nuclear imaging
4. CT CA
5. CMR

The same order is used in the logbook selector, PDF intervention grouping, and Owner intervention-fairness audit.

## Install

1. Run `sql/resident_training_v1.0.55.sql` in Supabase SQL Editor.
2. Replace `app.html` and `assets/app.js`.
3. Replace `assets/style.css` only if you want to keep the cumulative v1.0.54 password-eye styling in the same package.
4. Replace `index.html` if you also want the login password-eye patch included cumulatively.
5. Hard refresh the site.

No existing resident, assessment, review, curriculum, or logbook records are deleted by this migration.
