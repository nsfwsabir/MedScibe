import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  RichText,
  useEditorBridge,
  useEditorContent,
  TenTapStartKit,
  PlaceholderBridge,
} from '@10play/tentap-editor';
import type { EditorBridge } from '@10play/tentap-editor';
import { colors } from '../../theme/tokens';
import { markdownToHtml, htmlToMarkdown } from '../../features/notes/htmlConvert';
import { tryExpandAtCaret } from '../../features/macros/expansion';
import type { Macro } from '../../features/macros/macrosApi';

export type TenTapEditorHandle = {
  focus: () => void;
  blur: () => void;
  editor: EditorBridge | null;
  /** Pull the latest content straight from the bridge (bypasses debounce/state lag). */
  getMarkdown: () => Promise<string>;
};

type Props = {
  value: string;
  placeholder?: string;
  onChange: (markdown: string) => void;
  macros?: Pick<Macro, 'shortcut' | 'expansion'>[];
};

/**
 * Tiptap keeps the space the user just typed in the HTML
 * (`<p>fup2w </p>`), but htmlToMarkdown() trims it — so detect the
 * trailing space from raw HTML to trigger macro expansion.
 */
function htmlHasTrailingSpace(html: string): boolean {
  return /( |&nbsp;| )(<\/[^>]+>\s*)*$/i.test(html);
}

// Keep only the tools we had before: B/I/U/H1/H2 + undo/redo
const EDITOR_BRIDGES = [
  ...TenTapStartKit,
  PlaceholderBridge.configureExtension({
    placeholder: 'Your report appears here...',
  }),
];

export const TenTapEditor = forwardRef<TenTapEditorHandle, Props>(function TenTapEditor(
  { value, placeholder, onChange, macros = [] },
  ref,
) {
  const initialHtml = React.useMemo(() => markdownToHtml(value || ''), []);
  // We use a ref to track the last markdown we sent to avoid echo loops
  const lastMarkdownRef = useRef(value || '');
  const isApplyingMacroRef = useRef(false);
  const hadTrailingSpaceRef = useRef(false);

  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    // Grow with content so long reports scroll via the parent ScrollView
    dynamicHeight: true,
    initialContent: initialHtml || '<p></p>',
    bridgeExtensions: EDITOR_BRIDGES,
    theme: {
      webview: {
        backgroundColor: colors.surface,
        // Tiptap content styling
      },
      // Toolbar theming to match app.
      // NOTE: default toolbarBody has flex:1 which collapses the FlatList
      // to ~3px inside an auto-height parent (measured via uiautomator).
      // Override with flex:0 + explicit height so items are visible.
      // Same for the link EditLinkBar (flex:1 row squeezes the Insert
      // button off-screen) — flex:0 + fixed height + minWidth:0 on input.
      toolbar: {
        toolbarBody: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderBottomWidth: 0,
          flex: 0,
          height: 48,
          minWidth: '100%',
        },
        linkBarTheme: {
          addLinkContainer: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderBottomWidth: 0,
            flex: 0,
            height: 52,
            minWidth: '100%',
            paddingHorizontal: 12,
          },
          linkInput: {
            flex: 1,
            minWidth: 0,
            color: colors.text,
          },
          doneButton: {
            flexShrink: 0,
            marginLeft: 8,
          },
          placeholderTextColor: colors.muted,
        },
      } as any,
    },
  });

  // Update placeholder if provided after mount
  useEffect(() => {
    if (placeholder) {
      // PlaceholderBridge is configured at init; dynamic update via inject
      // For now, placeholder is static from initial config
    }
  }, [placeholder]);

  // Sync external value -> editor (e.g., when note loads or is saved externally)
  // Only update if the markdown derived from editor is different from incoming value
  useEffect(() => {
    // Avoid loop: if the incoming value equals what we last emitted, do nothing
    if (value === lastMarkdownRef.current) return;
    const html = markdownToHtml(value || '');
    // 10tap setContent is sync via bridge
    if (editor && (editor as any).setContent) {
      (editor as any).setContent(html || '<p></p>');
      lastMarkdownRef.current = value || '';
    }
  }, [value, editor]);

  // Subscribe to editor content changes as HTML, convert to markdown, handle macros
  const htmlContent = useEditorContent(editor, { type: 'html' } as any) as unknown as string | undefined;

  useEffect(() => {
    if (htmlContent === undefined || htmlContent === null) return;
    if (typeof htmlContent !== 'string') return;
    // Cap runaway trailing empty paragraphs: every Enter at the end of the
    // doc appends an empty <p>, and dynamicHeight grows the box for each one
    // (dead white space below the text). Keep max 1 trailing empty so the
    // cursor always has a home but space can't accumulate.
    // NOTE: single trailing empty is untouched (normal typing state).
    if (!isApplyingMacroRef.current && /(?:<(p|div)>(<br\s*\/?>)?<\/\1>\s*){2,}\s*$/i.test(htmlContent)) {
      isApplyingMacroRef.current = true;
      const base = htmlToMarkdown(htmlContent);
      const cappedMarkdown = base + '\n';
      lastMarkdownRef.current = cappedMarkdown;
      if ((editor as any).setContent) {
        (editor as any).setContent(markdownToHtml(cappedMarkdown));
      }
      setTimeout(() => {
        isApplyingMacroRef.current = false;
      }, 50);
      return;
    }
    // htmlContent is a string like "<p>hello</p><h1>title</h1>"
    // NOTE: htmlToMarkdown() trims, so a just-typed trailing space never
    // appears in `markdown` — detect it from the raw HTML instead.
    const markdown = htmlToMarkdown(htmlContent);
    const changed = markdown !== lastMarkdownRef.current;
    const hasSpace = htmlHasTrailingSpace(htmlContent);
    const spaceJustAppeared = hasSpace && !hadTrailingSpaceRef.current;
    hadTrailingSpaceRef.current = hasSpace;

    // Live macro expansion: user just typed a space completing a shortcut.
    // Caret approximated at end of text (covers the common typing-at-end case).
    if (!isApplyingMacroRef.current && macros.length > 0 && hasSpace && (spaceJustAppeared || changed)) {
      const expanded = tryExpandAtCaret(markdown, markdown.length, macros);
      if (expanded && expanded.text !== markdown) {
        isApplyingMacroRef.current = true;
        // Re-append the user's trailing space so typing flow continues
        const newMarkdown = expanded.text + ' ';
        const newHtml = markdownToHtml(newMarkdown);
        lastMarkdownRef.current = newMarkdown;
        // Push back to editor
        if ((editor as any).setContent) {
          (editor as any).setContent(newHtml);
        }
        // Notify parent with expanded text (without needing another round-trip)
        onChange(newMarkdown);
        // Reset flag after a tick
        setTimeout(() => {
          isApplyingMacroRef.current = false;
        }, 50);
        return;
      }
    }

    if (changed) {
      lastMarkdownRef.current = markdown;
      onChange(markdown);
    }
  }, [htmlContent, macros, onChange, editor]);

  const getMarkdown = React.useCallback(async (): Promise<string> => {
    try {
      const html = await (editor as any)?.getHTML?.();
      if (typeof html === 'string' && html.length > 0) {
        const md = htmlToMarkdown(html);
        lastMarkdownRef.current = md;
        return md;
      }
    } catch (e) {
      console.warn('[TenTapEditor] getMarkdown from bridge failed, using last state', e);
    }
    return lastMarkdownRef.current;
  }, [editor]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        editor?.focus?.();
      },
      blur: () => {
        editor?.blur?.();
      },
      editor,
      getMarkdown,
    }),
    [editor, getMarkdown],
  );

  return (
    <View style={styles.container}>
      <RichText
        editor={editor}
        style={styles.richText}
        // Content styling via theme/webview background; placeholder handled by bridge
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    // Breathing room between the border and the editor text
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  // NOTE: no flex/minHeight here — with dynamicHeight the WebView sizes
  // itself to the content. Forced min-heights stacked (container 180 +
  // webview 160) left a tall dead box under short reports.
  richText: {
    backgroundColor: colors.surface,
  } as any,
});

export default TenTapEditor;
