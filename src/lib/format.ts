/** Shared string/date/error helpers (single home for triplicated logic). */

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "dr.sharma" / "dr.sharma@clinic.org" -> "Dr Sharma". */
export function displayNameFromEmail(email: string): string {
  const handle = email.split('@')[0] ?? 'Doctor';
  const spaced = handle.replace(/[._-]+/g, ' ').trim();
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Doctor';
}

export function getGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Relative day + time: "Today, 12:37 pm" / "Yesterday, 4:05 pm" / "9 Sept, 10:00 am". */
export function formatRelativeDateTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const time = formatTime(iso);
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}

/**
 * visit_date is date-only ("YYYY-MM-DD"): parse as a LOCAL date, otherwise
 * new Date() treats it as UTC midnight and the day shifts by timezone.
 */
export function parseLocalDate(iso: string): Date {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(iso);
}

/** Local calendar date "YYYY-MM-DD" (not UTC: toISOString() can shift the day). */
export function todayLocalISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Normalize unknown throws (incl. Supabase FunctionsHttpError) to a readable message. */
export function formatSupabaseError(e: unknown, fallback: string): string {
  let raw: string;
  if (e instanceof Error) raw = e.message;
  else if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string')
    raw = (e as any).message;
  else if (e && typeof e === 'object' && 'error' in e && typeof (e as any).error === 'string')
    raw = (e as any).error;
  else if (typeof e === 'string') raw = e;
  else {
    try {
      raw = JSON.stringify(e);
      if (raw === '{}' || raw === '[]') raw = String(e);
    } catch {
      raw = String(e ?? fallback);
    }
  }
  if (!raw || raw === '[object Object]') {
    const anyE = e as any;
    const detail = anyE?.context?.error || anyE?.cause?.message || anyE?.details || '';
    raw = typeof detail === 'string' && detail ? detail : fallback;
  }
  if (!raw || raw === fallback) return fallback;
  // Map cryptic PostgREST RLS errors (almost always a dead session) to
  // something actionable instead of "row-level security policy".
  if (/row-level security|RLS|policy for table|permission denied|JWT|token/i.test(raw)) {
    return 'Permission denied — your session likely expired. Sign out and sign in again, then retry.';
  }
  return raw.length > 600 ? raw.slice(0, 600) + '…' : raw;
}
