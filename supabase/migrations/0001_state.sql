-- openGym × Supabase wall ✲ state sync
-- One row per user: the whole client state blob (plan, workouts, weigh-ins, settings, food diary).
-- Access is locked to the row's owner (RLS), so the app can run on static hosting with an
-- anonymous key in the browser; nobody can read anyone else's row.

create table if not exists public.state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.state enable row level security;

-- Same-shape helpers: LAST row wins (upsert on conflict keyed by user_id — see supabase-js
-- `.upsert(..., { onConflict: 'user_id' })`). No merge: the client keeps the newer `_ts`.
create policy "state_select_own" on public.state
  for select to authenticated
  using (user_id = auth.uid());

create policy "state_insert_own" on public.state
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "state_update_own" on public.state
  for update to authenticated
  using (user_id = auth.uid());

-- Data API permissions (explicit GRANTs required by Supabase from Oct 30)
grant select, insert, update, delete on public.state to authenticated;
grant select, insert, update, delete on public.state to service_role;