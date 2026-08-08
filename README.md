# Resident Training v1.0.65

Frontend-only assessment workflow update. No SQL migration is required if v1.0.64 is already installed.

## Changes
- Current/open assessment has a distinct dark-blue/teal theme on Resident and Assessor dashboards.
- Current/open assessment is highlighted separately on the Assessments page.
- Assessor can open the current assessment session from the Assessments page or dashboard.
- Assessment Session lists every assigned resident in that assessment year.
- Each resident has View evidence and Start assessment actions.
- Starting an assessment now loads the resident's evidence above the scoring form:
  - checked Knowledge first
  - unchecked Knowledge below
  - Skills with current Level of Dependence, expected level and log count
  - approved e-logbook
  - clinical/behavioural reviews
  - previous formal assessments
- Evidence remains read-only for the assessor.
- Existing Assessment Portfolio PDF export remains available.

## Install
Replace:
- app.html
- index.html
- assets/app.js
- assets/style.css

Then hard refresh the site.
