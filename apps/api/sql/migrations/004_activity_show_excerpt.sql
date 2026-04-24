alter table activities
  add column if not exists show_excerpt boolean not null default true;
