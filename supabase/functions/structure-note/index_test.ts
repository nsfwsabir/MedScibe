import { assertEquals, assertThrows } from 'jsr:@std/assert';
import { validateCleanup, parseJsonResponse, SYSTEM_PROMPT } from './index.ts';

Deno.test('parseJsonResponse handles clean JSON', () => {
  const out = parseJsonResponse('{"note_text":"cough"}');
  assertEquals(out, { note_text: 'cough' });
});

Deno.test('parseJsonResponse extracts JSON wrapped in prose', () => {
  const out = parseJsonResponse('Sure! Here you go:\n```json\n{"note_text":"cough"}\n```');
  assertEquals(out, { note_text: 'cough' });
});

Deno.test('parseJsonResponse throws on non-JSON', () => {
  assertThrows(() => parseJsonResponse('not json at all'));
});

Deno.test('validateCleanup accepts a well-formed payload', () => {
  const out = validateCleanup({
    note_text: 'Patient reports a cough.',
    low_confidence_spans: ['inaudible word'],
  });
  assertEquals(out.note_text, 'Patient reports a cough.');
  assertEquals(out.low_confidence_spans, ['inaudible word']);
});

Deno.test('validateCleanup coerces malformed fields instead of throwing', () => {
  const out = validateCleanup({
    note_text: 42,
    low_confidence_spans: ['ok', 7, null],
  });
  assertEquals(out.note_text, '');
  assertEquals(out.low_confidence_spans, ['ok']);
});

Deno.test('validateCleanup throws on non-object', () => {
  assertThrows(() => validateCleanup('nope'));
  assertThrows(() => validateCleanup(null));
});

Deno.test('system prompt forbids fabrication and demands low-confidence flags', () => {
  assertEquals(SYSTEM_PROMPT.includes('NEVER add a symptom, sign, drug, dose, diagnosis'), true);
  assertEquals(SYSTEM_PROMPT.includes('low_confidence_spans'), true);
  assertEquals(SYSTEM_PROMPT.includes('inaudible'), true);
  assertEquals(SYSTEM_PROMPT.includes('"subjective"'), false);
});