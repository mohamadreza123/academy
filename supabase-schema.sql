-- نسخه کامل دیتابیس آکادمی
create extension if not exists pgcrypto;

create table if not exists public.athletes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid unique,
  name text not null,
  email text unique,
  national_id text unique,
  belt text,
  weight_category text,
  phone text,
  tuition_total numeric(14,2) not null default 0,
  tuition_paid numeric(14,2) not null default 0,
  last_payment_date text,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  athlete_user_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_date text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id integer primary key,
  academy_name text not null default 'آکادمی ورزشکاران',
  logo_url text default ''
);

insert into public.site_settings(id, academy_name, logo_url)
values (1, 'آکادمی ورزشکاران', '')
on conflict (id) do nothing;

alter table public.athletes enable row level security;
alter table public.payments enable row level security;
alter table public.site_settings enable row level security;

-- دسترسی عمومی مستقیم از مرورگر بسته است؛ عملیات حساس از سرور با service-role انجام می‌شود.
drop policy if exists "old_public_athletes" on public.athletes;
drop policy if exists "old_public_payments" on public.payments;
drop policy if exists "old_public_settings" on public.site_settings;

-- ورزشکار فقط اطلاعات خودش را می‌بیند.
create policy "athlete reads own profile" on public.athletes
for select to authenticated
using (auth.uid() = user_id);

create policy "athlete reads own payments" on public.payments
for select to authenticated
using (auth.uid() = athlete_user_id);

-- تنظیمات سایت برای نمایش عمومی قابل خواندن است.
create policy "public reads settings" on public.site_settings
for select to anon, authenticated
using (true);

-- INSERT/UPDATE/DELETE حساس از backend با service role انجام می‌شود و policy عمومی برای آن تعریف نشده است.
