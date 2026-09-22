-- Supabase Complete Schema
create table if not exists public.athletes (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    national_id text unique,
    belt text,
    weight_category text,
    phone text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.messages (
    id uuid default gen_random_uuid() primary key,
    sender text not null,
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.athletes enable row level security;
alter table public.messages enable row level security;

create policy "Enable all access for athletes" on public.athletes for all using (true) with check (true);
create policy "Enable all access for messages" on public.messages for all using (true) with check (true);
