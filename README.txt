REPLACE THESE 2 FILES IN GITHUB ROOT:

1. patient-hub-cath-resident-portal.js
2. patient-hub.html

FIXES:
- A case received by the SAME cath resident is editable, including after refresh/new portal token.
- Report ID is enabled for the resident who received the case.
- Result options are now:
  * Angio only
  * PCI
  * تأجيل
- There is NO permanent 'سبب التأجيل' column.
- The postponement reason field appears ONLY after choosing تأجيل and is mandatory then.
- After saving a postponed case, the reason appears under the result.
- 'ترك الحالة' now sends the resident name correctly.
- Supabase lock/save functions and outcome constraints were already updated directly.
