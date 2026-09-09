// Supabase Edge Function: transcribe-audio
// Proxies audio to Groq Whisper so the Android m4a (which whisper.rn can't decode —
// see RNWhisperJSI.cpp:parseWaveAudioData) can still be transcribed in the cloud.
// Client sends { audioBase64, mimeType, filename } and gets { text, language }.

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function b64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const audioBase64: string | undefined = body?.audioBase64;
  const mimeType: string = body?.mimeType ?? 'audio/m4a';
  const filename: string = body?.filename ?? 'audio.m4a';

  if (!audioBase64 || typeof audioBase64 !== 'string' || audioBase64.length < 100) {
    return jsonError('audioBase64 is required (non-empty base64 string)');
  }

  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) {
    console.error('[transcribe-audio] GROQ_API_KEY missing');
    return jsonError('Server not configured: GROQ_API_KEY missing', 500);
  }

  let audioBytes: Uint8Array;
  try {
    // Strip data: URL prefix if client sent it
    const clean = audioBase64.includes(',') ? audioBase64.split(',').pop()! : audioBase64;
    audioBytes = b64ToUint8(clean);
  } catch {
    return jsonError('Invalid base64 audio');
  }

  if (audioBytes.length === 0) return jsonError('Decoded audio is empty');
  if (audioBytes.length > 25 * 1024 * 1024) return jsonError('Audio too large (>25 MB)', 413);

  // Groq supports whisper-large-v3-turbo and distil-whisper-large-v3-en.
  // Use turbo for multilingual; it's cheaper/faster than large-v3.
  const model = Deno.env.get('GROQ_WHISPER_MODEL') ?? 'whisper-large-v3-turbo';

  const form = new FormData();
  const blob = new Blob([audioBytes as BlobPart], { type: mimeType });
  form.append('file', blob, filename);
  form.append('model', model);
  // Optional: language auto, response json
  form.append('response_format', 'json');
  // form.append('language', 'en'); // leave auto

  console.log(`[transcribe-audio] -> Groq ${model} ${mimeType} ${Math.round(audioBytes.length / 1024)} KB`);

  const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!groqRes.ok) {
    const bodyText = await groqRes.text().catch(() => '');
    console.error('[transcribe-audio] Groq error', groqRes.status, bodyText.slice(0, 800));
    // Try to surface Groq's error message, but don't leak key
    return jsonError(`Groq transcription failed (${groqRes.status}): ${bodyText.slice(0, 400)}`, 502);
  }

  const groqJson: any = await groqRes.json().catch(() => null);
  const text: string | undefined = groqJson?.text ?? groqJson?.data?.text;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return jsonError('Groq returned empty transcription', 502);
  }

  return new Response(JSON.stringify({ text: text.trim(), language: groqJson?.language ?? 'en' }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

if (import.meta.main) Deno.serve(handleRequest);
