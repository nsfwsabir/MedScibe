export interface CleanupRequest {
  transcript: string;
}

export interface CleanupResponse {
  note_text: string;
  low_confidence_spans: string[];
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL = 'openai/gpt-oss-120b';

export const SYSTEM_PROMPT = `You are a medical dictation cleanup assistant. A doctor dictated a clinical note and it was transcribed by speech-to-text. Your job is to turn the raw transcript into a clean, well-written clinical note.

STRICT RULES:
1. REORGANIZE AND CLEAN ONLY. Every clinical detail in the output MUST come from the transcript. NEVER add a symptom, sign, drug, dose, diagnosis, lab result, or plan that was not stated in the transcript.
2. Keep the doctor's clinical wording and structure. Fix transcription artifacts: run-on sentences, filler words ("um", "uh", "okay so", "so yeah"), missing punctuation, and obvious mis-transcriptions you are confident about (e.g. "amoxicillin" vs "a mocks a sylin").
3. Remove conversational filler and instructions to the machine (e.g. "new paragraph", "period", "comma", "next line").
4. Do NOT reorganize into sections or headings (no "Subjective:", "Assessment:", "Plan:" labels). Return a single flowing clinical note.
5. If a phrase is inaudible or you are NOT confident what was said, do NOT guess — keep it verbatim as it appears and add the exact phrase to "low_confidence_spans".
6. If a dose, frequency, or other clinical detail is stated with uncertainty (e.g. "I think", "not sure"), never present it as a fact — either omit it or hedge it with the same uncertainty (e.g. "as indicated on the bottle", "reportedly").
7. If the transcript is empty or contains no clinical content, return an empty note_text and an empty low_confidence_spans array.

Respond ONLY with a JSON object, no markdown, no commentary. Shape:
{
  "note_text": "string",
  "low_confidence_spans": ["string"]
}`;

export function parseJsonResponse(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('LLM returned non-JSON output');
  }
}

export function validateCleanup(data: unknown): CleanupResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('LLM output is not an object');
  }
  const obj = data as Record<string, unknown>;
  const spanArray = Array.isArray(obj.low_confidence_spans)
    ? obj.low_confidence_spans.filter((s): s is string => typeof s === 'string')
    : [];
  return {
    note_text: typeof obj.note_text === 'string' ? obj.note_text : '',
    low_confidence_spans: spanArray,
  };
}

async function callGroq(apiKey: string, transcript: string): Promise<unknown> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Transcript:\n"""\n${transcript}\n"""`,
        },
      ],
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API error ${res.status}: ${body.slice(0, 500)}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('Groq API returned no message content');
  }
  return parseJsonResponse(content);
}

export function buildRequestError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return buildRequestError('Method not allowed', 405);
  }

  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) {
    return buildRequestError('GROQ_API_KEY is not configured', 500);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return buildRequestError('Invalid JSON body');
  }

  const { transcript } = (body ?? {}) as Partial<CleanupRequest>;
  if (typeof transcript !== 'string' || transcript.trim().length === 0) {
    return buildRequestError('"transcript" must be a non-empty string');
  }

  try {
    const raw = await callGroq(apiKey, transcript);
    const cleaned = validateCleanup(raw);
    return new Response(JSON.stringify(cleaned), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cleanup failed';
    console.error('[cleanup-note]', message);
    return buildRequestError(message, 502);
  }
}

if (import.meta.main) {
  Deno.serve(handleRequest);
}