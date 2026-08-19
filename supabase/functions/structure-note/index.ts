export interface StructureRequest {
  transcript: string;
  note_type: 'dictation' | 'consultation';
}

export interface StructureResponse {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  chief_complaint_suggestion: string;
  low_confidence_spans: string[];
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL = 'openai/gpt-oss-120b';

export const SYSTEM_PROMPT = `You are a medical scribe assistant. You convert raw speech-to-text transcripts of doctor-patient encounters into structured SOAP (Subjective, Objective, Assessment, Plan) notes.

STRICT RULES:
1. REORGANIZE AND SUMMARIZE ONLY. Every clinical detail in the output MUST come from the transcript. NEVER add a symptom, sign, drug, dose, diagnosis, lab result, or plan that was not stated in the transcript.
2. If the transcript is ambiguous or unclear about a clinical detail, do NOT guess. Leave the relevant section as a faithful, minimal summary of what was said.
3. Any phrase or span you are unsure about (inaudible, garbled, unclear) goes into "low_confidence_spans" as an array of the exact unclear phrases, verbatim.
4. Write in plain clinical English. Keep each section concise but complete. Use "Patient" as the subject. Do not invent patient names, ages, or identities.
5. If the transcript is empty or contains no clinical content, return all sections as empty strings and an empty low_confidence_spans array.

Respond ONLY with a JSON object, no markdown, no commentary. Shape:
{
  "subjective": "string",
  "objective": "string",
  "assessment": "string",
  "plan": "string",
  "chief_complaint_suggestion": "string",
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

export function validateStructure(data: unknown): StructureResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('LLM output is not an object');
  }
  const obj = data as Record<string, unknown>;
  const spanArray = Array.isArray(obj.low_confidence_spans)
    ? obj.low_confidence_spans.filter((s): s is string => typeof s === 'string')
    : [];
  const out: StructureResponse = {
    subjective: typeof obj.subjective === 'string' ? obj.subjective : '',
    objective: typeof obj.objective === 'string' ? obj.objective : '',
    assessment: typeof obj.assessment === 'string' ? obj.assessment : '',
    plan: typeof obj.plan === 'string' ? obj.plan : '',
    chief_complaint_suggestion:
      typeof obj.chief_complaint_suggestion === 'string' ? obj.chief_complaint_suggestion : '',
    low_confidence_spans: spanArray,
  };
  return out;
}

async function callGroq(apiKey: string, transcript: string, noteType: string): Promise<unknown> {
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
          content: `note_type: ${noteType}\n\nTranscript:\n"""\n${transcript}\n"""`,
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

  const { transcript, note_type } = (body ?? {}) as Partial<StructureRequest>;
  if (typeof transcript !== 'string' || transcript.trim().length === 0) {
    return buildRequestError('"transcript" must be a non-empty string');
  }
  if (note_type !== 'dictation' && note_type !== 'consultation') {
    return buildRequestError('"note_type" must be "dictation" or "consultation"');
  }

  try {
    const raw = await callGroq(apiKey, transcript, note_type);
    const structured = validateStructure(raw);
    return new Response(JSON.stringify(structured), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Structuring failed';
    console.error('[structure-note]', message);
    return buildRequestError(message, 502);
  }
}

if (import.meta.main) {
  Deno.serve(handleRequest);
}