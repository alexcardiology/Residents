# Resident Training & Assessment v1.0.80

## What changed

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
1. Run `sql/resident_training_v1.0.80.sql` in Supabase SQL Editor.
2. Replace `app.html`, `index.html`, `assets/app.js`, and `assets/style.css` with this package.
3. Keep your existing `assets/supabase.js` and `assets/login.js`.
4. Hard refresh the website (Ctrl+Shift+R).

## Data safety
- Existing Prior Experience submissions and completed assessor signatures are preserved.
- Existing two-assessor assignments are migrated into the new 2–5 assessor matrix.
- No resident accounts, curriculum, assessments, reviews, or normal E-logbook records are deleted.
