-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Organisations (your customers)
create table organisations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  admin_email text not null,
  slug text unique not null,          -- used in extension config e.g. "acme-corp"
  created_at timestamptz default now()
);

-- Ideas — fully anonymous, no user reference ever
create table ideas (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organisations(id) on delete cascade not null,
  body text not null check (char_length(body) between 5 and 1000),
  category text check (category in ('operations','culture','product','management','other')),
  submitted_at timestamptz default now()
);

-- AI-generated weekly digests
create table digests (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organisations(id) on delete cascade not null,
  week_of date not null,
  total_submissions integer not null default 0,
  insights jsonb not null,            -- structured output from Claude
  created_at timestamptz default now(),
  unique(org_id, week_of)
);

-- Indexes
create index ideas_org_submitted on ideas(org_id, submitted_at desc);
create index digests_org_week on digests(org_id, week_of desc);

-- Row Level Security
alter table ideas enable row level security;
alter table digests enable row level security;
alter table organisations enable row level security;

-- Service role bypasses RLS (used in API routes with SUPABASE_SERVICE_ROLE_KEY)
-- Anon key can only insert ideas (for the extension)
create policy "anon can insert ideas"
  on ideas for insert
  with check (true);

-- Block anon reads — ideas are never read publicly
create policy "no anon reads"
  on ideas for select
  using (false);

-- Waitlist (org-independent, public signups)
create table if not exists waitlist (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  signed_up_at timestamptz default now()
);

create index if not exists waitlist_signed_up on waitlist(signed_up_at desc);
