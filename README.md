# Resident Training v1.0.60 — Intervention Audit Reset

This is a frontend update on top of v1.0.58 + the v1.0.59 reset SQL hotfix.

## What changed

### Owner → Intervention audit
The audit now has direct Owner-only reset controls:

- **Reset selected residents**
  - Opens a resident checklist.
  - Type `RESET SELECTED` to confirm.
  - Clears the chosen residents' complete e-logbook test data.

- **Reset ALL logbooks**
  - Type `RESET LOGBOOKS` to confirm.
  - Clears all current resident intervention and conference logbooks.
  - The Intervention Audit therefore returns to zero.

The reset uses the existing owner-protected `owner_bulk_reset_logbooks` RPC, so non-owners cannot invoke it successfully.

### Owner → More → Test-period reset
A third card now appears for **Resident e-logbooks**, linking the same protected `Reset ALL logbooks` action into the test-period cleanup screen.

## Preserved by the logbook reset

- Accounts and residency allocations
- Curriculum definitions
- Reviews
- Formal assessments
- Assessment schedules

## Deleted by the logbook reset

- Resident intervention/conference logbook entries for the chosen residents
- Their logbook approval/reconsideration workflow data handled by the existing reset routine

## Installation

No new SQL is required **if `owner_bulk_reset_logbooks` is already installed** (it has been part of the portal since v1.0.36).

Replace:
- `app.html`
- `index.html`
- `assets/app.js`
- `assets/style.css`

Then hard-refresh the portal.

If you have not yet applied the v1.0.59 reset hotfix for the separate Reviews/Learning reset feature, run that SQL independently.
