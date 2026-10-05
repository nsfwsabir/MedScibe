import React from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import { colors } from '../../theme/tokens';
import { fonts, typography } from '../../theme/typography';

/**
 * note_text stores lightweight inline markers so the doctor can format
 * the note without a full rich-text engine:
 *   bold       **text**
 *   underline  __text__
 *   italic     *text*
 *   strike     ~~text~~
 *   code       `text`
 *   link       [text](url)
 *   heading 1  line starts with "# "
 *   heading 2  line starts with "## " ("### " renders the same)
 *   bullet     line starts with "- "
 *   ordered    line starts with "1. "
 *   quote      line starts with "> "
 *
 * Editing happens in TenTapEditor (10tap/Tiptap) — see
 * src/components/ui/TenTapEditor.tsx. This module only renders/strips.
 */

/** Strip all markers — used where only plain prose matters (search snippets). */
export function plainText(rich: string): string {
  return rich
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^(\s*)-\s+/gm, '$1')
    .replace(/^(\s*)\d+\.\s+/gm, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/(\*\*|__)([^*\n]+)\1/g, '$2')
    .replace(/\*([^*\n]+)\*/g, '$1');
}

type Segment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
};
type Line = { segments: Segment[]; level: 0 | 1 | 2; prefix?: string; quote?: boolean };

function parseInline(line: string): Segment[] {
  const segments: Segment[] = [];
  const re = /(\[([^\]]+)\]\(([^)\s]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(~~([^~]+)~~)|(__([^_]+)__)|(\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) segments.push({ text: line.slice(last, m.index) });
    if (m[2] !== undefined) segments.push({ text: m[2], link: m[3] });
    else if (m[5] !== undefined) segments.push({ text: m[5], code: true });
    else if (m[7] !== undefined) segments.push({ text: m[7], bold: true });
    else if (m[9] !== undefined) segments.push({ text: m[9], strike: true });
    else if (m[11] !== undefined) segments.push({ text: m[11], underline: true });
    else if (m[13] !== undefined) segments.push({ text: m[13], italic: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) segments.push({ text: line.slice(last) });
  return segments;
}

export function parseRichText(value: string): Line[] {
  return value.split('\n').map((line) => {
    let level: 0 | 1 | 2 = 0;
    let rest = line;
    let prefix: string | undefined;
    let quote = false;
    if (rest.startsWith('### ')) {
      level = 2;
      rest = rest.slice(4);
    } else if (rest.startsWith('## ')) {
      level = 2;
      rest = rest.slice(3);
    } else if (rest.startsWith('# ')) {
      level = 1;
      rest = rest.slice(2);
    } else if (rest.startsWith('> ')) {
      quote = true;
      rest = rest.slice(2);
    } else if (rest.startsWith('- ')) {
      prefix = '• ';
      rest = rest.slice(2);
    } else {
      const ol = rest.match(/^(\d+)\.\s+/);
      if (ol) {
        prefix = `${ol[1]}. `;
        rest = rest.slice(ol[0].length);
      }
    }
    return { level, segments: parseInline(rest), prefix, quote };
  });
}

function segmentStyle(seg: Segment): TextStyle | undefined {
  if (!seg.bold && !seg.italic && !seg.underline && !seg.strike && !seg.code && !seg.link) return undefined;
  const style: TextStyle = {};
  if (seg.bold) style.fontFamily = fonts.bold;
  const decorations: string[] = [];
  if (seg.underline) decorations.push('underline');
  if (seg.strike) decorations.push('line-through');
  if (decorations.length > 0) style.textDecorationLine = decorations.join(' ') as TextStyle['textDecorationLine'];
  if (seg.italic) style.fontStyle = 'italic';
  if (seg.link) {
    style.color = colors.primary;
    if (!decorations.includes('underline')) {
      style.textDecorationLine = ([decorations[0], 'underline'].filter(Boolean).join(' ') || 'underline') as TextStyle['textDecorationLine'];
    }
  }
  if (seg.code) style.backgroundColor = colors.surfaceSubtle;
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
  // Android truncates very long single-Text layouts — chunk lines into
  // separate Text blocks so long reports never get cut off.
  const CHUNK = 40;
  const chunks: Line[][] = [];
  for (let i = 0; i < lines.length; i += CHUNK) chunks.push(lines.slice(i, i + CHUNK));
  return (
    <View>
      {chunks.map((chunk, ci) => (
        <Text key={ci} style={base}>
          {chunk.map((line, li) => (
            <React.Fragment key={li}>
              {line.prefix ? <Text style={line.level > 0 ? styles.heading : undefined}>{line.prefix}</Text> : null}
              {line.segments.map((seg, si) => (
                <Text
                  key={si}
                  style={[
                    line.level > 0 ? styles.heading : undefined,
                    line.quote ? styles.quote : undefined,
                    segmentStyle(seg),
                  ]}
                >
                  {seg.text}
                </Text>
              ))}
              {li < chunk.length - 1 ? '\n' : null}
            </React.Fragment>
          ))}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: typography.bodySemibold.fontFamily,
    fontWeight: '600',
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
  },
  quote: {
    color: colors.muted,
    fontStyle: 'italic',
  },
});
