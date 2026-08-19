import { assertEquals, assertThrows } from 'jsr:@std/assert';
import { validateStructure, parseJsonResponse, SYSTEM_PROMPT } from './index.ts';

Deno.test('parseJsonResponse handles clean JSON', () => {
  const out = parseJsonResponse('{"subjective":"cough"}');
  assertEquals(out, { subjective: 'cough' });
});

Deno.test('parseJsonResponse extracts JSON wrapped in prose', () => {
  const out = parseJsonResponse('Sure! Here you go:\n```json\n{"subjective":"cough"}\n```');
  assertEquals(out, { subjective: 'cough' });
});

Deno.test('parseJsonResponse throws on non-JSON', () => {
  assertThrows(() => parseJsonResponse('not json at all'));
});

Deno.test('validateStructure accepts a well-formed payload', () => {
  const out = validateStructure({
    subjective: 'S',
    objective: 'O',
    assessment: 'A',
    plan: 'P',
    chief_complaint_suggestion: 'cough',
    low_confidence_spans: ['inaudible word'],
  });
  assertEquals(out.subjective, 'S');
  assertEquals(out.low_confidence_spans, ['inaudible word']);
});

Deno.test('validateStructure coerces malformed fields instead of throwing', () => {
  const out = validateStructure({
    subjective: 42,
    objective: null,
    assessment: undefined,
    low_confidence_spans: ['ok', 7, null],
  });
  assertEquals(out.subjective, '');
  assertEquals(out.objective, '');
  assertEquals(out.assessment, '');
  assertEquals(out.low_confidence_spans, ['ok']);
});

Deno.test('validateStructure throws on non-object', () => {
  assertThrows(() => validateStructure('nope'));
  assertThrows(() => validateStructure(null));
});

Deno.test('system prompt forbids fabrication and demands low-confidence flags', () => {
  assertEquals(SYSTEM_PROMPT.includes('NEVER add a symptom, sign, drug, dose, diagnosis'), true);
  assertEquals(SYSTEM_PROMPT.includes('low_confidence_spans'), true);
  assertEquals(SYSTEM_PROMPT.includes('inaudible'), true);
});