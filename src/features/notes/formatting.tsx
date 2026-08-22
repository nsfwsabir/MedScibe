import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { fonts, typography } from '../../theme/typography';

/**
 * note_text stores lightweight inline markers so the doctor can format
 * the note without a full rich-text engine:
 *   bold       **text**
 *   underline  __text__
 *   italic     *text*
 *   heading 1  line starts with "# "
 *   heading 2  line starts with "## "
 */

export type FormatAction = 'bold' | 'italic' | 'underline' | 'h1' | 'h2';

const MARKERS = { bold: '**', italic: '*', underline: '__' } as const;
type WrapAction = keyof typeof MARKERS;

const HEADING_PREFIX = { h1: '# ', h2: '## ' } as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type EditResult = { text: string; selection: { start: number; end: number } };

/** Inner span of the **…** / __…__ / *…* run containing [start, end], if any. */
function enclosingRun(text: string, start: number, end: number, marker: string) {
  const ch = escapeRegExp(marker[0]);
  const re = new RegExp(`${escapeRegExp(marker)}([^\\n${ch}]+)${escapeRegExp(marker)}`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const innerStart = m.index + marker.length;
    const innerEnd = innerStart + m[1].length;
    const contains =
      start === end
        ? start >= innerStart && start <= innerEnd
        : start >= innerStart && end <= innerEnd;
    if (contains) return { open: m.index, close: innerEnd + marker.length, inner: m[1] };
  }
  return null;
}

/** Toggle **bold** / *italic* / __underline__ around the selection or at the caret. */
export function toggleWrap(
  text: string,
  rawSelection: { start: number; end: number },
  action: WrapAction,
): EditResult {
  const marker = MARKERS[action];
  let { start, end } = rawSelection;
  if (end < start) [start, end] = [end, start];

  // Already wrapped directly around the selection -> unwrap.
  if (
    text.slice(Math.max(0, start - marker.length), start) === marker &&
    text.slice(end, end + marker.length) === marker
  ) {
    const unwrapped =
      text.slice(0, start - marker.length) + text.slice(start, end) + text.slice(end + marker.length);
    return {
      text: unwrapped,
      selection: { start: start - marker.length, end: end - marker.length },
    };
  }

  // Caret/selection sits inside a formatted run -> unwrap it.
  const run = enclosingRun(text, start, end, marker);
  if (run) {
    const unwrapped = text.slice(0, run.open) + run.inner + text.slice(run.close);
    return {
      text: unwrapped,
      selection: { start: run.open, end: run.open + run.inner.length },
    };
  }

  if (start === end) {
    const next = text.slice(0, start) + marker + marker + text.slice(end);
    return { text: next, selection: { start: start + marker.length, end: start + marker.length } };
  }
  const next = text.slice(0, start) + marker + text.slice(start, end) + marker + text.slice(end);
  return { text: next, selection: { start: start + marker.length, end: end + marker.length } };
}

/** Toggle "# " (H1) / "## " (H2) on every line touched by the selection. */
export function toggleHeading(
  text: string,
  rawSelection: { start: number; end: number },
  level: 'h1' | 'h2',
): EditResult {
  const prefix = HEADING_PREFIX[level];
  const otherPrefix = level === 'h1' ? HEADING_PREFIX.h2 : HEADING_PREFIX.h1;

  let { start, end } = rawSelection;
  if (end < start) [start, end] = [end, start];
  start = Math.max(0, text.lastIndexOf('\n', start - 1) + 1);

  const lineStarts: number[] = [];
  for (let i = start; ; ) {
    lineStarts.push(i);
    const nl = text.indexOf('\n', i);
    if (nl === -1 || nl >= end) break;
    i = nl + 1;
  }

  const allHave = lineStarts.every((idx) => text.startsWith(prefix, idx));
  let out = text;
  for (let k = lineStarts.length - 1; k >= 0; k--) {
    const idx = lineStarts[k];
    if (allHave) out = out.slice(0, idx) + out.slice(idx + prefix.length);
    else if (out.startsWith(otherPrefix, idx)) out = out.slice(0, idx) + prefix + out.slice(idx + otherPrefix.length);
    else out = out.slice(0, idx) + prefix + out.slice(idx);
  }

  const delta = allHave ? -prefix.length : prefix.length;
  return {
    text: out,
    selection: {
      start: Math.max(0, rawSelection.start + delta),
      end: Math.max(0, rawSelection.end + delta),
    },
  };
}

export function applyFormat(
  text: string,
  selection: { start: number; end: number },
  action: FormatAction,
): EditResult {
  if (action === 'h1' || action === 'h2') return toggleHeading(text, selection, action);
  return toggleWrap(text, selection, action);
}

/** Strip all markers — used where only plain prose matters (search snippets). */
export function plainText(rich: string): string {
  return rich
    .replace(/^#{1,2}\s+/gm, '')
    .replace(/(\*\*|__)([^*\n]+)\1/g, '$2')
    .replace(/\*([^*\n]+)\*/g, '$1');
}

type Segment = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };
type Line = { segments: Segment[]; level: 0 | 1 | 2 };

function parseInline(line: string): Segment[] {
  const segments: Segment[] = [];
  const re = /(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) segments.push({ text: line.slice(last, m.index) });
    if (m[2] !== undefined) segments.push({ text: m[2], bold: true });
    else if (m[4] !== undefined) segments.push({ text: m[4], underline: true });
    else if (m[6] !== undefined) segments.push({ text: m[6], italic: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) segments.push({ text: line.slice(last) });
  return segments;
}

export function parseRichText(value: string): Line[] {
  return value.split('\n').map((line) => {
    let level: 0 | 1 | 2 = 0;
    let rest = line;
    if (rest.startsWith('## ')) {
      level = 2;
      rest = rest.slice(3);
    } else if (rest.startsWith('# ')) {
      level = 1;
      rest = rest.slice(2);
    }
    return { level, segments: parseInline(rest) };
  });
}

function segmentStyle(seg: Segment): TextStyle | undefined {
  if (!seg.bold && !seg.italic && !seg.underline) return undefined;
  const style: TextStyle = {};
  if (seg.bold) style.fontFamily = fonts.bold;
  if (seg.underline) style.textDecorationLine = 'underline';
  if (seg.italic) style.fontStyle = 'italic';
  return style;
}

export function RichText({
  value,
  baseStyle,
}: {
  value: string;
  baseStyle?: TextStyle;
}) {
  const base: TextStyle = { ...typography.body, ...baseStyle };
  const lines = parseRichText(value);
  return (
    <Text style={base}>
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {line.segments.map((seg, si) => (
            <Text key={si} style={line.level > 0 ? [styles.heading, segmentStyle(seg)] : segmentStyle(seg)}>
              {seg.text}
            </Text>
          ))}
          {li < lines.length - 1 ? '\n' : null}
        </React.Fragment>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: typography.bodySemibold.fontFamily,
    fontWeight: '600',
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
  },
});
