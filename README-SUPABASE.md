# راهنمای اتصال به Supabase

برای راه‌اندازی پایگاه داده، کدهای زیر را در بخش SQL Editor ساب‌بیس خود اجرا کنید:

```sql
create table if not exists public.athletes (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    national_id text unique,
    belt text,
    weight_category text,
    phone text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.athletes enable row level security;

create policy "Enable all access for all users" on public.athletes for all using (true) with check (true);
```
