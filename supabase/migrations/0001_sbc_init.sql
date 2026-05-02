-- ─────────────────────────────────────────────────────────────────────────────
-- StrongBody Coach — initial migration (ISOLATED)
--
-- Every object in this file is prefixed with `sbc_`. This migration NEVER
-- touches, references, or alters any existing application tables.
--
-- Safe to run multiple times:
--   - all CREATE statements are guarded with IF NOT EXISTS or DO blocks
--   - all policies are dropped + recreated (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'sbc_sex') then
    create type public.sbc_sex as enum ('female','male','other');
  end if;
  if not exists (select 1 from pg_type where typname = 'sbc_goal') then
    create type public.sbc_goal as enum ('fat_loss','strength','recomp','meet_prep');
  end if;
  if not exists (select 1 from pg_type where typname = 'sbc_cardio_pref') then
    create type public.sbc_cardio_pref as enum ('none','low','moderate','high');
  end if;
  if not exists (select 1 from pg_type where typname = 'sbc_workout_day') then
    create type public.sbc_workout_day as enum ('squat','bench','deadlift','upper_accessory','lower_glute');
  end if;
  if not exists (select 1 from pg_type where typname = 'sbc_training_phase') then
    create type public.sbc_training_phase as enum ('hypertrophy','strength','peak','deload');
  end if;
end$$;

-- ─── Helper trigger fn (prefixed) ────────────────────────────────────────────
create or replace function public.sbc_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.sbc_profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  name                 text not null,
  sex                  public.sbc_sex not null default 'female',
  age                  int  not null check (age between 10 and 100),
  height_inches        numeric(4,1) not null,
  weight_lbs           numeric(5,1) not null,
  goal_weight_lbs      numeric(5,1) not null,
  training_days_per_week int not null check (training_days_per_week between 1 and 7),
  goal                 public.sbc_goal not null,
  squat_1rm            numeric(5,1) not null default 0,
  bench_1rm            numeric(5,1) not null default 0,
  deadlift_1rm         numeric(5,1) not null default 0,
  problem_areas        text[] not null default '{}',
  food_dislikes        text[] not null default '{}',
  food_sensitivities   text[] not null default '{}',
  meal_count           int  not null default 4 check (meal_count between 2 and 8),
  cardio_pref          public.sbc_cardio_pref not null default 'low',
  on_wegovy            boolean not null default false,
  protein_target_g     int,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists sbc_profiles_set_updated_at on public.sbc_profiles;
create trigger sbc_profiles_set_updated_at
  before update on public.sbc_profiles
  for each row execute function public.sbc_set_updated_at();

-- ─── Weekly plans ────────────────────────────────────────────────────────────
create table if not exists public.sbc_weekly_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  week_number  int  not null,
  phase        public.sbc_training_phase not null,
  sessions     jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, week_number)
);
create index if not exists sbc_weekly_plans_user_week_idx
  on public.sbc_weekly_plans(user_id, week_number desc);

drop trigger if exists sbc_weekly_plans_set_updated_at on public.sbc_weekly_plans;
create trigger sbc_weekly_plans_set_updated_at
  before update on public.sbc_weekly_plans
  for each row execute function public.sbc_set_updated_at();

-- ─── Workout logs ────────────────────────────────────────────────────────────
create table if not exists public.sbc_workout_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  session_id      text not null,
  day             public.sbc_workout_day not null,
  week_number     int  not null,
  log_date        date not null default current_date,
  body_weight_lbs numeric(5,1),
  soreness_areas  text[] not null default '{}',
  recovery_score  int check (recovery_score between 1 and 10),
  hunger_after    int check (hunger_after between 1 and 10),
  exercises       jsonb not null,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists sbc_workout_logs_user_date_idx
  on public.sbc_workout_logs(user_id, log_date desc);
create index if not exists sbc_workout_logs_user_week_idx
  on public.sbc_workout_logs(user_id, week_number);

-- ─── Body metrics ────────────────────────────────────────────────────────────
create table if not exists public.sbc_body_metrics (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  metric_date  date not null default current_date,
  weight_lbs   numeric(5,1),
  waist_in     numeric(4,2),
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists sbc_body_metrics_user_date_idx
  on public.sbc_body_metrics(user_id, metric_date desc);

-- ─── Meal plans (cached) ─────────────────────────────────────────────────────
create table if not exists public.sbc_meal_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  plan_date       date not null default current_date,
  is_training_day boolean not null,
  totals          jsonb not null,
  meals           jsonb not null,
  grocery_list    text[] not null default '{}',
  coach_note      text,
  created_at      timestamptz not null default now()
);
create index if not exists sbc_meal_plans_user_date_idx
  on public.sbc_meal_plans(user_id, plan_date desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.sbc_profiles      enable row level security;
alter table public.sbc_weekly_plans  enable row level security;
alter table public.sbc_workout_logs  enable row level security;
alter table public.sbc_body_metrics  enable row level security;
alter table public.sbc_meal_plans    enable row level security;

-- profiles
drop policy if exists sbc_profiles_select on public.sbc_profiles;
drop policy if exists sbc_profiles_insert on public.sbc_profiles;
drop policy if exists sbc_profiles_update on public.sbc_profiles;
drop policy if exists sbc_profiles_delete on public.sbc_profiles;
create policy sbc_profiles_select on public.sbc_profiles
  for select to authenticated using (auth.uid() = user_id);
create policy sbc_profiles_insert on public.sbc_profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy sbc_profiles_update on public.sbc_profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sbc_profiles_delete on public.sbc_profiles
  for delete to authenticated using (auth.uid() = user_id);

-- weekly_plans
drop policy if exists sbc_weekly_plans_select on public.sbc_weekly_plans;
drop policy if exists sbc_weekly_plans_insert on public.sbc_weekly_plans;
drop policy if exists sbc_weekly_plans_update on public.sbc_weekly_plans;
drop policy if exists sbc_weekly_plans_delete on public.sbc_weekly_plans;
create policy sbc_weekly_plans_select on public.sbc_weekly_plans
  for select to authenticated using (auth.uid() = user_id);
create policy sbc_weekly_plans_insert on public.sbc_weekly_plans
  for insert to authenticated with check (auth.uid() = user_id);
create policy sbc_weekly_plans_update on public.sbc_weekly_plans
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sbc_weekly_plans_delete on public.sbc_weekly_plans
  for delete to authenticated using (auth.uid() = user_id);

-- workout_logs
drop policy if exists sbc_workout_logs_select on public.sbc_workout_logs;
drop policy if exists sbc_workout_logs_insert on public.sbc_workout_logs;
drop policy if exists sbc_workout_logs_update on public.sbc_workout_logs;
drop policy if exists sbc_workout_logs_delete on public.sbc_workout_logs;
create policy sbc_workout_logs_select on public.sbc_workout_logs
  for select to authenticated using (auth.uid() = user_id);
create policy sbc_workout_logs_insert on public.sbc_workout_logs
  for insert to authenticated with check (auth.uid() = user_id);
create policy sbc_workout_logs_update on public.sbc_workout_logs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sbc_workout_logs_delete on public.sbc_workout_logs
  for delete to authenticated using (auth.uid() = user_id);

-- body_metrics
drop policy if exists sbc_body_metrics_select on public.sbc_body_metrics;
drop policy if exists sbc_body_metrics_insert on public.sbc_body_metrics;
drop policy if exists sbc_body_metrics_update on public.sbc_body_metrics;
drop policy if exists sbc_body_metrics_delete on public.sbc_body_metrics;
create policy sbc_body_metrics_select on public.sbc_body_metrics
  for select to authenticated using (auth.uid() = user_id);
create policy sbc_body_metrics_insert on public.sbc_body_metrics
  for insert to authenticated with check (auth.uid() = user_id);
create policy sbc_body_metrics_update on public.sbc_body_metrics
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sbc_body_metrics_delete on public.sbc_body_metrics
  for delete to authenticated using (auth.uid() = user_id);

-- meal_plans
drop policy if exists sbc_meal_plans_select on public.sbc_meal_plans;
drop policy if exists sbc_meal_plans_insert on public.sbc_meal_plans;
drop policy if exists sbc_meal_plans_update on public.sbc_meal_plans;
drop policy if exists sbc_meal_plans_delete on public.sbc_meal_plans;
create policy sbc_meal_plans_select on public.sbc_meal_plans
  for select to authenticated using (auth.uid() = user_id);
create policy sbc_meal_plans_insert on public.sbc_meal_plans
  for insert to authenticated with check (auth.uid() = user_id);
create policy sbc_meal_plans_update on public.sbc_meal_plans
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sbc_meal_plans_delete on public.sbc_meal_plans
  for delete to authenticated using (auth.uid() = user_id);

-- ─── Storage: private bucket for progress photos ─────────────────────────────
-- Files must be stored under a folder named with the user's UUID so RLS works,
-- e.g. uploads(`${auth.uid()}/2026-05-02-front.jpg`, ...)
insert into storage.buckets (id, name, public)
values ('sbc_progress_photos', 'sbc_progress_photos', false)
on conflict (id) do nothing;

drop policy if exists sbc_storage_select on storage.objects;
drop policy if exists sbc_storage_insert on storage.objects;
drop policy if exists sbc_storage_update on storage.objects;
drop policy if exists sbc_storage_delete on storage.objects;

create policy sbc_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'sbc_progress_photos'
         and (storage.foldername(name))[1] = auth.uid()::text);

create policy sbc_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sbc_progress_photos'
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy sbc_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'sbc_progress_photos'
         and (storage.foldername(name))[1] = auth.uid()::text);

create policy sbc_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'sbc_progress_photos'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── End of migration ────────────────────────────────────────────────────────
