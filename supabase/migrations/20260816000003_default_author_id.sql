-- Default author_id to the current authenticated user so inserts don't need
-- to send it explicitly. The RLS `with check (author_id = auth.uid())` would
-- otherwise reject every insert (NULL = auth.uid() is NULL, not true).

alter table notes
  alter column author_id set default auth.uid();

alter table audit_log
  alter column author_id set default auth.uid();
