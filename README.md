# Resident Training & Assessment — v1.0.68

## New: Prior Experience Logbook

This version adds a separate **Prior Experience Logbook** for retrospective clinical experience completed before routine use of the current e-logbook.

### Resident workflow

- A high-priority `🚨 Prior Experience Logbook` alert is shown at the top of **My logbook**.
- It opens a separate page.
- The resident can keep the record as an editable **Draft** until final submission.
- Previous interventions are entered as summary counts:
  - Attended
  - Performed with assistance
  - Performed solo under guidance
  - Performed solo without guidance
- `Failed trial` is intentionally not used in Prior Experience.
- Previous conferences are entered individually as:
  - Attended
  - Speaker / Presenter
- Two different senior residents must be selected.
- Senior reviewers are normally from a higher residency year. Year 5 may use other Year 5 senior peers because no higher cohort exists.
- **Final submission locks editing.**

### Verification sequence

1. Resident finally submits.
2. Both selected senior residents must approve.
3. Only after both senior approvals are complete are assessor verification scopes created.
4. Each intervention is routed only to assessors assigned by the Program Owner to that intervention.
5. Conferences use the separate `Conferences` assessor scope.
6. Assessors may write a comment before approval or rejection.
7. A rejected senior or assessor decision can be sent for reconsideration.
8. Accepted reconsideration changes that rejection to approval and the overall Prior Experience status is recalculated.
9. The final status is **Verified Prior Experience** only after both senior approvals and every required assessor scope is approved.

### Owner intervention-assessor assignment

Open:

**Owner → Logbooks → Prior experience assessors**

Each active assessor has an editable checklist of interventions plus `Conferences`.

Multiple assessors may be assigned to the same intervention. A pending scope is visible to the relevant assigned assessors; the first completed assessor decision resolves that scope.

## Installation

1. Run:
   `sql/resident_training_v1.0.68.sql`
   in **Supabase → SQL Editor**.
2. Replace:
   - `app.html`
   - `index.html`
   - `assets/app.js`
   - `assets/style.css`
3. Keep your existing `assets/supabase.js` and existing Edge Functions.
4. Hard-refresh the deployed site.

## Data safety

This migration creates new Prior Experience tables and RPC functions. It does not delete or reset existing:

- accounts
- curriculum
- current e-logbook entries
- formal assessments
- reviews
- messages
