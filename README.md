# Resident Training & Assessment v1.0.69

Incremental update after v1.0.68.

## What is new

### Owner: Prior Experience control
Owner → Logbooks now includes **Prior experience status**.

It shows every active resident as:
- Not started
- Editing (draft)
- Pending senior review
- Pending assessor review
- Action needed / rejected
- Finished / verified

Owner can open any existing Prior Experience Logbook, including finished records, and review the intervention/conference evidence plus every senior and assessor signature.

There is also **Reset ALL Prior Experience**. It deletes retrospective Prior Experience submissions and their verification history/messages only. It does not delete accounts, current e-logbooks, curriculum, reviews or assessments. The assessor-pair assignment matrix is preserved.

### Exactly two assessors per Prior Experience intervention
Owner → Logbooks → **Prior experience assessors** is now a pair matrix rather than broad scopes.

Each intervention/scope has exactly:
1. **Junior assessor**
2. **Older assessor**

They must be two different active assessor accounts. Both signatures are required after the two senior-resident signatures. Each assessor sees only their exact assigned signature request. If one rejects, the resident can request reconsideration from that exact assessor.

If Owner edits a pair later, pending signatures are rerouted to the new assessor. Already-completed signatures remain historical and are not rewritten.

### Automatic 48-hour reminders + Owner Pending Requests
The migration creates a structured pending-request monitor for requests awaiting a senior resident or assessor decision, including:
- current e-logbook senior approval
- current e-logbook assessor approval
- conference approval
- current e-logbook reconsideration
- review reconsideration
- Prior Experience senior verification
- Prior Experience Junior/Older assessor signatures
- Prior Experience reconsideration

After 48 hours without a decision, the original request/thread is marked unread again and receives an **automatic 48-hour reminder**.

Owner → Logbooks → **Pending requests** shows:
- duration since issue
- sender
- topic
- involved senior/assessor
- request type
- whether the 48-hour reminder has been sent

### Scheduling
The SQL tries to enable `pg_cron` and schedules the reminder processor hourly. If the project does not allow automatic `pg_cron` enablement, the portal also calls the same processor when authenticated users are active, so overdue reminders are still caught on portal activity.

For fully time-independent hourly reminders, make sure **pg_cron** is enabled in Supabase Database → Extensions. Re-running the v1.0.69 SQL will then create/update the hourly job.

## Install
1. Run `sql/resident_training_v1.0.69.sql` in Supabase SQL Editor.
2. Replace:
   - `app.html`
   - `index.html`
   - `assets/app.js`
   - `assets/style.css`
3. Keep your existing `assets/supabase.js` and `assets/login.js`.
4. Hard-refresh the site.

## Important first setup
Before residents reach the Prior Experience assessor stage, open:
**Owner → Logbooks → Prior experience assessors**

Assign both a Junior assessor and an Older assessor to every intervention you plan to verify.
