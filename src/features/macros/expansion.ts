import { Macro } from './macrosApi';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type MacroLike = Pick<Macro, 'shortcut' | 'expansion'>;

/**
 * Replace every macro shortcut in `text` with its expansion.
 * Whole-word, case-insensitive; longer shortcuts are applied first
 * so "fup2w" is never partially consumed by a "fup" macro.
 */
export function expandMacros(text: string, macros: MacroLike[]): string {
  if (macros.length === 0 || text.length === 0) return text;
  const sorted = [...macros].sort((a, b) => b.shortcut.length - a.shortcut.length);
  let out = text;
  for (const m of sorted) {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeRegExp(m.shortcut)})(?=[^\\p{L}\\p{N}_]|$)`, 'giu');
    out = out.replace(pattern, (_match, prefix: string) => `${prefix}${m.expansion}`);
  }
  return out;
}

/**
 * Live editor expansion: if the word just completed immediately before the
 * caret matches a macro shortcut, replace it with the expansion.
 * Returns null when nothing matched (caller keeps the text as typed).
 */
export function tryExpandAtCaret(
  text: string,
  caret: number,
  macros: MacroLike[],
): { text: string; caret: number } | null {
  if (macros.length === 0 || caret <= 0 || caret > text.length) return null;

  const before = text.slice(0, caret);
  const after = text.slice(caret);
  // The trigger is completing the word — the caret must sit right after it,
  // with only whitespace (or end of text) following.
  if (after.length > 0 && !/^\s/.test(after)) return null;

  const match = /([\p{L}\p{N}_]+)$/u.exec(before);
  if (!match) return null;

  const token = match[1];
  const start = caret - token.length;
  const hit = macros.find((m) => m.shortcut.toLowerCase() === token.toLowerCase());
  if (!hit) return null;

  const nextText = text.slice(0, start) + hit.expansion + after;
  const nextCaret = start + hit.expansion.length;
  return { text: nextText, caret: nextCaret };
}
