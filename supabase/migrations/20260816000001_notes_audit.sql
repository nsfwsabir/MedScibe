-- MedScribe initial schema: notes + audit_log + RLS
-- Matches TRD §4 (data model) and §11 (audit log).

create table notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete cascade,
  note_type text not null check (note_type in ('dictation','consultation')),
  status text not null default 'draft' check (status in ('draft','finalized')),
  patient_name text,
  patient_age int,
  patient_sex text,
  visit_date date not null default current_date,
  chief_complaint text,
  raw_transcript text,
  subjective text,
  objective text,
  assessment text,
  plan text,
  audio_path text,
  audio_retention_until date,
  duration_seconds int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index notes_author_visit_idx on notes (author_id, visit_date desc);
create index notes_author_status_idx on notes (author_id, status);

-- Row Level Security: the actual access-control boundary (TRD §4).
alter table notes enable row level security;

create policy "authors can CRUD their own notes"
on notes for all
using (author_id = auth.uid())
with check (author_id = auth.uid());

-- Keep updated_at fresh (TRD §4).
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger notes_set_updated_at
before update on notes
for each row execute function set_updated_at();

-- Audit log: who did what to which note, when (TRD §11).
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references notes(id) on delete set null,
  author_id uuid references auth.users(id) on delete cascade,
  action text not null check (action in ('create','view','update','export','soft_delete','permanent_delete')),
  created_at timestamptz default now()
);

create index audit_log_author_idx on audit_log (author_id, created_at desc);

alter table audit_log enable row level security;

create policy "authors can read their own audit log"
on audit_log for select
using (author_id = auth.uid());

create policy "authors can write audit log entries"
on audit_log for insert
with check (author_id = auth.uid());
