alter table notes
  add column note_text text;

comment on column notes.note_text is
  'The edited dictation note body (cleaned from raw_transcript, then doctor-edited).';

update notes
set note_text = coalesce(
  nullif(concat_ws(
    ' ',
    nullif(subjective, ''),
    nullif(objective, ''),
    nullif(assessment, ''),
    nullif(plan, '')
  ), ''),
  raw_transcript
)
where note_text is null;

alter table notes
  drop column note_type,
  drop column chief_complaint,
  drop column subjective,
  drop column objective,
  drop column assessment,
  drop column plan;