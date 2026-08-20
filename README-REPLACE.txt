REPLACE / ADD THESE FILES IN THE ROOT OF GITHUB:

REPLACE:
1. patient-hub.html
2. patient-hub-cath-resident-portal.js

ADD:
3. patient-hub-postponed.js
4. patient-hub-esc-close.js

Database:
The required Supabase migration has ALREADY BEEN APPLIED directly to project:
dwkkhqmifmmxubtuaqbd

NEW BEHAVIOR:
- ESC closes any Patient Hub popup/modal.
- Cath resident must enter Report ID.
- Resident checks whether CD copy was received.
- Resident MUST choose CA / PCI / تأجيل.
- If تأجيل is selected, reason is mandatory.
- Saved row shows CD status, outcome and postponed reason.
- Secretary/Admin/Head Nurse gets a new sidebar item: الحالات المؤجلة.
- It opens a separate popup with patient, date, Miri/Smouha, consultant, report ID, CD, reason and resident.
