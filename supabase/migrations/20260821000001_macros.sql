create table note_macros (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  shortcut text not null,
  expansion text not null,
  created_at timestamptz default now(),
  unique (author_id, shortcut),
  check (char_length(shortcut) between 2 and 32),
  check (shortcut = lower(shortcut)),
  check (shortcut !~ '\s'),
  check (char_length(expansion) > 0)
);

comment on table note_macros is
  'Per-doctor quick macros: typing/dictating the shortcut expands to the full text.';

alter table note_macros enable row level security;

create policy "authors can CRUD their own macros"
  on note_macros for all
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
