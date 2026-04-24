alter table users
  alter column id drop default;

alter table users
  add column if not exists email citext;

create unique index if not exists idx_users_email_unique on users (email) where email is not null;
