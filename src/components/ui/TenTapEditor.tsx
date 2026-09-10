import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
};

type Props = {
  value: string;
  placeholder?: string;
  onChange: (markdown: string) => void;
  macros?: Pick<Macro, 'shortcut' | 'expansion'>[];
};

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

  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    initialContent: initialHtml || '<p></p>',
    bridgeExtensions: EDITOR_BRIDGES,
    theme: {
      webview: {
        backgroundColor: colors.surface,
        // Tiptap content styling
      },
      // Toolbar theming to match app
      toolbar: {
        toolbarBody: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
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
    // htmlContent is a string like "<p>hello</p><h1>title</h1>"
    const markdown = htmlToMarkdown(htmlContent);
    // Avoid echo if the markdown is what we already have (prevents cursor jump)
    if (markdown === lastMarkdownRef.current) return;

    // Live macro expansion: check if the change ends with a shortcut + space
    // We use tryExpandAtCaret which checks the character before caret is space
    // Since we only have full-text htmlContent, we approximate by checking if the
    // last typed char was a space and the word before it matches a macro.
    // This mirrors the old DomEditor's handleMacroOnSpace but at the markdown level.
    if (!isApplyingMacroRef.current && macros.length > 0) {
      // Detect if the user just typed a space that completes a macro
      // Compare previous markdown vs new markdown; if new ends with " " and word before space is a shortcut
      const prev = lastMarkdownRef.current;
      // Only attempt if the new markdown is longer and ends with space
      // and the previous didn't already have that word expanded
      if (markdown.length > prev.length && markdown.endsWith(' ')) {
        // Find caret position - approximate as end of text (since useEditorContent gives whole doc)
        // For long reports, this is a heuristic but works for the common case of typing at the end
        const caret = markdown.length;
        const expanded = tryExpandAtCaret(markdown, caret, macros);
        if (expanded && expanded.text !== markdown) {
          isApplyingMacroRef.current = true;
          const newMarkdown = expanded.text;
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
          }, 0);
          return;
        }
      }
    }

    lastMarkdownRef.current = markdown;
    onChange(markdown);
  }, [htmlContent, macros, onChange]);

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
    }),
    [editor],
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
    flex: 1,
    minHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  richText: {
    flex: 1,
    minHeight: 160,
    // On Android, ensure the WebView doesn't need extra padding for keyboard
    ...(Platform.OS === 'android' ? { flexGrow: 1 } : {}),
  } as any,
});

export default TenTapEditor;
