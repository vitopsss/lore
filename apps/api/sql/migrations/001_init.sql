create extension if not exists pgcrypto;
create extension if not exists citext;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'activity_type') then
    create type activity_type as enum ('lendo', 'lido', 'abandonado', 'quero_ler');
  end if;
end $$;

create table if not exists users (
  id uuid primary key,
  username citext not null unique,
  email citext,
  bio text,
  avatar text,
  premium_status boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_users_email_unique on users (email) where email is not null;

create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  google_id text not null unique,
  title text not null,
  author text not null,
  cover_url text,
  isbn text,
  page_count integer,
  categories text[] not null default '{}',
  amazon_affiliate_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  type activity_type not null,
  rating smallint check (rating between 1 and 5),
  review_text text,
  read_at date,
  card_theme text not null default 'classic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists follows (
  follower_id uuid not null references users(id) on delete cascade,
  following_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

create index if not exists idx_activities_user_created_at on activities (user_id, created_at desc);
create index if not exists idx_activities_book_created_at on activities (book_id, created_at desc);
create index if not exists idx_follows_follower on follows (follower_id);
create index if not exists idx_follows_following on follows (following_id);
