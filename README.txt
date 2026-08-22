CARDIOLOGY RESIDENTS — PERSISTENT SIGN-IN + AUTO-REPAIR PUSH

Replace/add exactly:
- index.html                  (replace)
- app.html                    (replace)
- assets/login-v176.js        (add)
- assets/notifications-v232.js (add)

DO NOT replace assets/app.js with an older copy. This package intentionally does not contain app.js, so your latest logbook fixes stay untouched.

BEHAVIOR
1) Keep me signed in
- Persistence defaults ON.
- A valid saved Supabase session redirects directly to app.html before the sign-in UI is painted.
- The login page is revealed only if no valid active session exists, the session is revoked/expired beyond refresh, the account is inactive, or the user explicitly chose session-only sign-in.
- Explicit Log out still signs the user out.

2) Notifications
- After the user has granted browser/app notification permission once, every authenticated app load silently checks and repairs the push subscription.
- It also re-checks on focus, pageshow, returning online, and when the tab becomes visible.
- Native app tokens are re-registered automatically after a later sign-in if OS permission remains granted.
- No repeated permission popup is generated.

BROWSER LIMIT
A website cannot force notifications ON if the user later blocks them in Chrome/iOS/Android settings. In that case the bell correctly reports that notifications are blocked.
