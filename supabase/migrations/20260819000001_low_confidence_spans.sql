alter table notes
  add column low_confidence_spans text[];

comment on column notes.low_confidence_spans is
  'Phrases from the raw transcript that the structuring model flagged as unclear or inaudible.';