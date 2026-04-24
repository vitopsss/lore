alter table users
  add column if not exists current_streak integer not null default 0,
  add column if not exists last_read_date timestamptz;
