# Setup Guide

1. In Supabase **SQL Editor**, run `supabase/schema.sql`, then `supabase/seed.sql`.
2. In **Authentication → Providers → Email**, keep email/password enabled and disable public sign-up.
3. In **Authentication → URL Configuration**, set Site URL to `https://drmohamedalaa90.github.io/Residents/` and add `https://drmohamedalaa90.github.io/Residents/**` as a redirect URL.
4. Only after running the schema, open **Authentication → Users → Add user**. Create `drmohamedalaa90@gmail.com` with a strong password and **Auto Confirm User** enabled. Confirm its `profiles.role` is `owner`.
5. Deploy the secure account function from this folder:
   ```bash
   npx supabase login
   npx supabase link --project-ref dwkkhqmifmmxubtuaqbd
   npx supabase functions deploy admin-users
   ```
6. Create an Airtable Personal Access Token with read access to the Faculty Duty Bot base. Save it directly as a Supabase secret—never put it in this repository or paste it into the website:
   ```bash
   npx supabase secrets set AIRTABLE_TOKEN=YOUR_AIRTABLE_PERSONAL_ACCESS_TOKEN --project-ref dwkkhqmifmmxubtuaqbd
   npx supabase secrets set AIRTABLE_BASE_ID=appSmzqYTynjlWK9B --project-ref dwkkhqmifmmxubtuaqbd
   npx supabase functions deploy duty-bot --project-ref dwkkhqmifmmxubtuaqbd
   ```
   The token needs `data.records:read` access to the `Bot_Assignments` and `Residents` tables. Only records whose Status is `Approved` are shown in the portal.
   The function also reads the public-view CSV for Google Sheet `185wfhkbv3s7M5gj7J04-zb_6UhCgK1pA1qjN7O9dLBY`, tab `569773954`. Keep that tab available to anyone with the link as Viewer. Google itself enforces editing access; the portal shows the **Modify schedule** button only to `drmohamedalaa90@gmail.com`.
7. Upload/commit all files to `drmohamedalaa90/Residents` on `main`. In **Repository Settings → Pages**, choose **GitHub Actions**.
8. Visit `https://drmohamedalaa90.github.io/Residents/`, sign in, open **Duty Bot**, and test “Who is in Miri ER today?”. Then create one test resident, observer and assessor and verify their normal portal permissions.

Never place a database password, secret key, service-role key, GitHub password, or user password in this repository. The included browser key is intentionally public and protected by Row Level Security.

Accounts are owner-created only. Username, email and role are protected. Residents may change display name, WhatsApp and password. Observers see only their own previous reviews. Assessors see only assigned residents. Curriculum access is cumulative; Years 4–5 share TEE, simple PCI and permanent pacemaker chapters.
