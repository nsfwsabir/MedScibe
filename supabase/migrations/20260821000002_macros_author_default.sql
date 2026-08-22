-- Same as notes/audit_log: default author_id to the calling user so RLS
-- `with check` passes on inserts that omit it.
alter table note_macros
  alter column author_id set default auth.uid();
