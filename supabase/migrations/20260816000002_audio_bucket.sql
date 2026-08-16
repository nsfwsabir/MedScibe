-- Private audio storage bucket (TRD §9).
-- Audio never lives in a public bucket; clients access files via short-lived signed URLs.
-- Path convention: audio/{author_id}/{note_id}.m4a

insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

create policy "authors can read their own audio"
on storage.objects for select
using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "authors can upload their own audio"
on storage.objects for insert
with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "authors can delete their own audio"
on storage.objects for delete
using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
