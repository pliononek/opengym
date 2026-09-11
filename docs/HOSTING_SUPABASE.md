# Hosting openGym on Cloudflare Pages + Supabase (no server of your own)

This build turns the fork into a **serverless app**: the frontend runs on Cloudflare Pages,
auth is Supabase Auth (email + password), and every user's whole state blob lives in one
`state` row in your Supabase project — synced across their devices. The AI Coach, push
notifications and the admin dashboard need a real server, so they are hidden in this build.

## 1. One-time on the Supabase side

1. Create a project at supabase.com (keep the project ref, e.g. `plswndybbxrtsekkubqs`).
2. Open **SQL Editor → New query**, paste the contents of
   `supabase/migrations/0001_state.sql` and run it. That creates the `state` table with
   Row Level Security — each signed-in user can only touch their own row.
3. In Dashboard → **Authentication → Providers**, make sure **Email** is enabled (default).
4. In Dashboard → **Authentication → URL Configuration**, set **Site URL** to your future
   Pages URL (https://your-project.pages.dev). If you want instant accounts during testing,
   you can also toggle **Confirm email** off — otherwise a confirmation link is emailed.
5. Grab the **anon / publishable** API key: Dashboard → Settings → API keys.

> The anon key is public (it lives in the browser). That is fine for Supabase: the real
> boundary is RLS. Never put the `service_role` key anywhere in this repo or website.

## 2. Build & deploy on Cloudflare Pages

In Cloudflare Dashboard → Workers & Pages → **Create → Pages** → connect the GitHub repo
(or drag-and-drop `frontend/dist`). Build configuration:

- Build command: `cd frontend && npm ci && npm run build`
- Output directory: `frontend/dist`
- Environment variables:
  - `VITE_SUPABASE_URL` = `https://<project-ref>.supabase.co`
  - `VITE_SUPABASE_ANON_KEY` = the anon key from step 1
  - `VITE_IMG_BASE` and `VITE_GIF_BASE` — point at the upstream dataset on a CDN
    (same values as `.github/workflows/pages.yml`), so exercise images/GIFs load
    without the 140 MB media container.

The build is **not** the demo build: no `VITE_DEMO=1`, because this version has accounts.

## 3. Use it from your phone

- Open the Pages URL, **Create profile** with your name/email/password, make sure email
  confirmation worked, and you're in.
- Your data syncs to this profile from every browser you sign in on.
- Add it to your home screen: iOS *Share → Add to Home Screen*; Android ⋮ → *Add to
  home screen*.
- In **Settings → Nutrition** paste your Gemini key for the AI food estimates (works in
  the static build — the macro feature is entirely client-side + Open Food Facts).
- Guest mode still works and never touches Supabase.

## When you want the full server features back

The AI Coach, push notifications and the admin dashboard only exist in the Docker build
(`docker compose up -d` + the requirements in `docs/SELF_HOSTING.md`).