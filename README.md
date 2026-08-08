# Resident Training & Assessment v1.0.62

## Review Inbox threading

Review-related Inbox notifications are now grouped by the underlying review. The original review alert, resident reconsideration request, and later modified/upheld outcome appear as **one Review conversation** rather than separate Inbox rows.

Opening the thread shows a chronological timeline and the current review state. Existing linked messages are backfilled by the SQL migration. The Inbox badge counts unread review conversations as one thread instead of counting every update separately.

## Install after v1.0.61

1. Run `sql/resident_training_v1.0.62.sql` in Supabase SQL Editor.
2. Replace `app.html`, `index.html`, `assets/app.js`, and `assets/style.css`.
3. Hard refresh the site.

No reviews or messages are deleted. This migration only adds/repairs links between existing review notifications and their review topic.
