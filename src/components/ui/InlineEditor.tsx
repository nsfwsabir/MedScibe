import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';
import { colors } from '../../theme/tokens';
import { Macro } from '../../features/macros/macrosApi';
import { markdownToHtml } from '../../features/notes/htmlConvert';

export type InlineEditorHandle = {
  applyFormat: (action: 'bold' | 'italic' | 'underline' | 'h1' | 'h2') => void;
  focus: () => void;
};

export type FormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  h1: boolean;
  h2: boolean;
};

type Props = {
  value: string; // markdown
  onChange: (markdown: string) => void;
  onFormatStateChange?: (state: FormatState) => void;
  macros?: Macro[];
  placeholder?: string;
};

const htmlTemplate = (placeholder: string) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  body { margin:0; padding:0; background: ${colors.surface}; }
  #editor {
    min-height: 160px;
    padding: 12px 16px;
    font-family: 'Manrope', -apple-system, system-ui, sans-serif;
    font-size: 16px;
    line-height: 24px;
    color: ${colors.text};
    outline: none;
    word-wrap: break-word;
    white-space: pre-wrap;
  }
  #editor:empty:before {
    content: attr(data-placeholder);
    color: ${colors.muted};
    pointer-events: none;
  }
  #editor h1 { font-size: 20px; line-height: 28px; color: ${colors.text}; margin: 8px 0 4px 0; font-weight: 800; }
  #editor h2 { font-size: 17px; line-height: 24px; color: ${colors.text}; margin: 8px 0 4px 0; font-weight: 700; }
  #editor b, #editor strong { font-weight: 700; }
  #editor i, #editor em { font-style: italic; }
  #editor u { text-decoration: underline; }
</style>
</head>
<body>
<div id="editor" contenteditable="true" data-placeholder="${placeholder.replace(/"/g, '&quot;')}"></div>
<script>
  const editor = document.getElementById('editor');
  let lastHtml = '';
  let macros = [];

  function htmlToMarkdown(html) {
    let md = html;
    // Normalize
    md = md.replace(/<div><br><\\/div>/gi, '\\n');
    md = md.replace(/<div>/gi, '\\n');
    md = md.replace(/<\\/div>/gi, '');
    md = md.replace(/<p[^>]*>/gi, '');
    md = md.replace(/<\\/p>/gi, '\\n');
    md = md.replace(/<br\\s*\\/?>/gi, '\\n');
    md = md.replace(/<h1[^>]*>([\\s\\S]*?)<\\/h1>/gi, (m, c) => '# ' + stripTags(c).trim() + '\\n');
    md = md.replace(/<h2[^>]*>([\\s\\S]*?)<\\/h2>/gi, (m, c) => '## ' + stripTags(c).trim() + '\\n');
    md = md.replace(/<strong[^>]*>([\\s\\S]*?)<\\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>([\\s\\S]*?)<\\/b>/gi, '**$1**');
    md = md.replace(/<em[^>]*>([\\s\\S]*?)<\\/em>/gi, '*$1*');
    md = md.replace(/<i[^>]*>([\\s\\S]*?)<\\/i>/gi, '*$1*');
    md = md.replace(/<u[^>]*>([\\s\\S]*?)<\\/u>/gi, '__$1__');
    md = stripTags(md);
    md = md.replace(/\\n{3,}/g, '\\n\\n');
    md = md.replace(/&nbsp;/g, ' ');
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&quot;/g, '"');
    return md.trim();
  }
  function stripTags(s) { return s.replace(/<[^>]*>/g, ''); }

  function postFormatState() {
    try {
      const block = getCurrentBlock();
      const state = {
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        h1: block ? block.tagName === 'H1' : false,
        h2: block ? block.tagName === 'H2' : false,
      };
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'formatState', state: state}));
    } catch {}
  }
  function notifyChange() {
    const html = editor.innerHTML;
    if (html === lastHtml) return;
    lastHtml = html;
    const md = htmlToMarkdown(html);
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'change', markdown: md, html: html}));
    const h = Math.max(180, document.documentElement.scrollHeight);
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'height', height: h}));
    postFormatState();
  }

  editor.addEventListener('input', () => {
    handleMacroOnSpace();
    notifyChange();
  });
  editor.addEventListener('keyup', () => { notifyChange(); postFormatState(); });
  editor.addEventListener('mouseup', postFormatState);
  document.addEventListener('selectionchange', postFormatState);
  editor.addEventListener('paste', () => setTimeout(notifyChange, 50));

  function handleMacroOnSpace() {
    if (!macros.length) return;
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;
    // Get text before caret in current block
    const node = range.startContainer;
    let textBefore = '';
    if (node.nodeType === 3) {
      textBefore = node.textContent.slice(0, range.startOffset);
    } else {
      // element node
      textBefore = node.textContent.slice(0, range.startOffset);
    }
    // Find last word before caret
    const m = textBefore.match(/([A-Za-z0-9_]+)$/);
    if (!m) return;
    const word = m[1];
    const hit = macros.find(x => x.shortcut.toLowerCase() === word.toLowerCase());
    if (!hit) return;
    // Check if next char is space (user just typed space)
    // The input event already inserted the space, so word is before space
    // Actually textBefore includes up to caret before space? On input after typing space, caret is after space
    // So we need to look one char before
    // Simplify: if word is followed by space in the full text, we already have it
    // Instead, detect when textBefore ends with word + we just typed space is tricky
    // Alternative: check if last typed char was space by looking at textBefore ending with word?
    // For now, only expand if word is at end and user typed space will be handled by checking after space insertion
    // We will expand when word is exactly at end before space was typed, and we are now after space
    // So textBefore should be word, and the character before word is boundary
    // Expand by replacing word with expansion
    const text = editor.innerText || editor.textContent;
    // Find word position and replace in DOM - simpler: use execCommand to replace
    // Get current block text
    const block = node.nodeType === 3 ? node.parentElement : node;
    // Replace last occurrence of word with expansion
    // Use selection to replace
    try {
      // Move selection to cover the word
      const wordLen = word.length;
      range.setStart(node, range.startOffset - wordLen);
      range.setEnd(node, range.startOffset);
      range.deleteContents();
      const textNode = document.createTextNode(hit.expansion);
      range.insertNode(textNode);
      // Move caret after expansion
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch(e) {}
  }

  window.setEditorContent = function(html) {
    if (html === lastHtml) return;
    lastHtml = html;
    editor.innerHTML = html;
    const h = Math.max(180, document.documentElement.scrollHeight);
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'height', height: h}));
  };
  window.setEditorMacros = function(list) { macros = list || []; };
  function getCurrentBlock() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let n = sel.getRangeAt(0).startContainer;
    if (n.nodeType === 3) n = n.parentElement;
    while (n && n !== editor && !/^(H1|H2|DIV|P|LI)$/i.test(n.tagName)) n = n.parentElement;
    return (n && n !== editor) ? n : null;
  }
  function currentBlock() { return getCurrentBlock(); }
  function toggleHeading(targetTag) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const tagUpper = targetTag.toUpperCase();
    const tagLower = targetTag.toLowerCase();

    // Highlighted text: make only the highlighted text a heading line (split the original line)
    if (!range.collapsed) {
      const selText = range.toString();
      if (!selText.trim()) return;
      let startBlock = range.startContainer;
      if (startBlock.nodeType === 3) startBlock = startBlock.parentElement;
      while (startBlock && startBlock !== editor && !/^(DIV|P|H1|H2)$/i.test(startBlock.tagName)) startBlock = startBlock.parentElement;
      let endBlock = range.endContainer;
      if (endBlock.nodeType === 3) endBlock = endBlock.parentElement;
      while (endBlock && endBlock !== editor && !/^(DIV|P|H1|H2)$/i.test(endBlock.tagName)) endBlock = endBlock.parentElement;
      if (startBlock && startBlock === endBlock) {
        const blockText = startBlock.textContent || '';
        // If selection is a proper substring, split the line
        if (selText.length > 0 && selText.length < blockText.length) {
          try {
            const beforeRange = document.createRange();
            beforeRange.setStart(startBlock, 0);
            beforeRange.setEnd(range.startContainer, range.startOffset);
            const afterRange = document.createRange();
            afterRange.setStart(range.endContainer, range.endOffset);
            afterRange.setEnd(startBlock, startBlock.childNodes.length);
            const beforeFrag = beforeRange.cloneContents();
            const selectedFrag = range.cloneContents();
            const afterFrag = afterRange.cloneContents();
            const frag = document.createDocumentFragment();
            const hasBefore = beforeFrag.textContent && beforeFrag.textContent.trim().length > 0;
            const hasAfter = afterFrag.textContent && afterFrag.textContent.trim().length > 0;
            if (hasBefore) {
              const beforeDiv = document.createElement('div');
              beforeDiv.appendChild(beforeFrag);
              frag.appendChild(beforeDiv);
            }
            // Toggle off if the original line was already this heading and the selection is inside it
            if (startBlock.tagName === tagUpper) {
              const div = document.createElement('div');
              div.appendChild(selectedFrag);
              frag.appendChild(div);
              if (hasAfter) {
                const afterDiv = document.createElement('div');
                afterDiv.appendChild(afterFrag);
                frag.appendChild(afterDiv);
              }
              startBlock.replaceWith(frag);
              const target = div;
              const r = document.createRange();
              r.selectNodeContents(target);
              sel.removeAllRanges();
              sel.addRange(r);
              return;
            }
            const heading = document.createElement(tagLower);
            heading.appendChild(selectedFrag);
            frag.appendChild(heading);
            if (hasAfter) {
              const afterDiv = document.createElement('div');
              afterDiv.appendChild(afterFrag);
              frag.appendChild(afterDiv);
            }
            startBlock.replaceWith(frag);
            const r = document.createRange();
            r.selectNodeContents(heading);
            sel.removeAllRanges();
            sel.addRange(r);
            setTimeout(() => {
              const nr = document.createRange();
              nr.selectNodeContents(heading);
              sel.removeAllRanges();
              sel.addRange(nr);
            }, 10);
            return;
          } catch {}
        }
      }
    }

    // Collapsed: "text after cursor on this line" becomes heading (per UX request)
    // Highlighted but not handled above (whole line or multi-line): fall through to block-level
    if (range.collapsed) {
      const block = getCurrentBlock();
      if (!block) {
        document.execCommand('formatBlock', false, tagLower);
        setTimeout(() => { notifyChange(); postFormatState(); }, 50);
        return;
      }
      if (!(block.textContent || '').trim()) {
        const newTag = block.tagName === tagUpper ? 'DIV' : tagUpper;
        const repl = document.createElement(newTag.toLowerCase());
        repl.innerHTML = '<br>';
        block.replaceWith(repl);
        const r = document.createRange();
        r.selectNodeContents(repl);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
        setTimeout(() => { notifyChange(); postFormatState(); }, 50);
        return;
      }
      try {
        const beforeRange = document.createRange();
        beforeRange.setStart(block, 0);
        beforeRange.setEnd(range.startContainer, range.startOffset);
        const afterRange = document.createRange();
        afterRange.setStart(range.startContainer, range.startOffset);
        afterRange.setEnd(block, block.childNodes.length);
        const beforeFrag = beforeRange.cloneContents();
        const afterFrag = afterRange.cloneContents();
        const hasBefore = beforeFrag.textContent && beforeFrag.textContent.trim().length > 0;
        const hasAfter = afterFrag.textContent && afterFrag.textContent.trim().length > 0;
        if (!hasAfter) {
          // Caret at end: create new empty heading after
          const isHeading = block.tagName === tagUpper;
          if (isHeading) {
            const normal = document.createElement('div');
            normal.innerHTML = block.innerHTML;
            block.replaceWith(normal);
            const newDiv = document.createElement('div');
            newDiv.innerHTML = '<br>';
            normal.after(newDiv);
            const r = document.createRange();
            r.selectNodeContents(newDiv);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
          } else {
            const heading = document.createElement(tagLower);
            heading.innerHTML = '<br>';
            block.after(heading);
            const r = document.createRange();
            r.selectNodeContents(heading);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
          }
          setTimeout(() => { notifyChange(); postFormatState(); }, 50);
          return;
        }
        const isHeading = block.tagName === tagUpper;
        if (isHeading) {
          const beforeDiv = document.createElement('div');
          beforeDiv.appendChild(beforeFrag);
          const afterDiv = document.createElement('div');
          afterDiv.appendChild(afterFrag);
          const frag = document.createDocumentFragment();
          if (hasBefore) frag.appendChild(beforeDiv);
          frag.appendChild(afterDiv);
          block.replaceWith(frag);
          const target = hasBefore ? afterDiv : frag.firstChild;
          const r = document.createRange();
          r.selectNodeContents(target);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
        } else {
          const beforeDiv = document.createElement('div');
          beforeDiv.appendChild(beforeFrag);
          const heading = document.createElement(tagLower);
          heading.appendChild(afterFrag);
          const frag = document.createDocumentFragment();
          if (hasBefore) frag.appendChild(beforeDiv);
          frag.appendChild(heading);
          block.replaceWith(frag);
          const r = document.createRange();
          r.selectNodeContents(heading);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
        }
        setTimeout(() => { notifyChange(); postFormatState(); }, 50);
        return;
      } catch {}
    }

    // Fallback: whole line(s) toggle
    let blocks = [];
    if (!range.collapsed) {
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT, {
        acceptNode: function(node) {
          return /^(DIV|P|H1|H2)$/i.test(node.tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      });
      let node;
      while (node = walker.nextNode()) {
        if (range.intersectsNode(node)) blocks.push(node);
      }
      if (blocks.length === 0) {
        const b = getCurrentBlock();
        if (b) blocks = [b];
      }
    } else {
      const b = getCurrentBlock();
      if (b) blocks = [b];
      else {
        document.execCommand('formatBlock', false, tagLower);
        setTimeout(() => { notifyChange(); postFormatState(); }, 50);
        return;
      }
    }
    if (blocks.length === 0) return;
    const allAreTarget = blocks.every(b => b.tagName === tagUpper);
    const newTag = allAreTarget ? 'DIV' : tagUpper;
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (block.tagName === newTag) continue;
      const repl = document.createElement(newTag.toLowerCase());
      repl.innerHTML = block.innerHTML || '<br>';
      block.replaceWith(repl);
      blocks[i] = repl;
    }
    try {
      const last = blocks[blocks.length - 1];
      const r = document.createRange();
      r.selectNodeContents(last);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    } catch {}
  }
  window.applyFormat = function(action) {
    editor.focus();
    if (action === 'bold') document.execCommand('bold', false, null);
    else if (action === 'italic') document.execCommand('italic', false, null);
    else if (action === 'underline') document.execCommand('underline', false, null);
    else if (action === 'h1') toggleHeading('H1');
    else if (action === 'h2') toggleHeading('H2');
    setTimeout(() => { notifyChange(); postFormatState(); }, 50);
  };
  window.getEditorContent = function() { return editor.innerHTML; };

  // Handle messages from RN
  window.addEventListener('message', function(e) {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'setContent') {
        window.setEditorContent(data.html);
      } else if (data.type === 'setMacros') {
        window.setEditorMacros(data.macros);
      } else if (data.type === 'applyFormat') {
        window.applyFormat(data.action);
      }
    } catch {}
  });
  document.addEventListener('message', function(e) {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'setContent') window.setEditorContent(data.html);
      else if (data.type === 'setMacros') window.setEditorMacros(data.macros);
      else if (data.type === 'applyFormat') window.applyFormat(data.action);
    } catch {}
  });
</script>
</body>
</html>`;

export const InlineEditor = forwardRef<InlineEditorHandle, Props>(function InlineEditor(
  { value, onChange, onFormatStateChange, macros, placeholder = 'Your dictation appears here...' },
  ref,
) {
  const webRef = useRef<any>(null);
  const lastSentRef = useRef<string>('');
  const readyRef = useRef(false);
  const [webHeight, setWebHeight] = React.useState(180);

  const sendToWebView = useCallback((data: object) => {
    const js = `window.dispatchEvent(new MessageEvent('message', {data: ${JSON.stringify(JSON.stringify(data))}})); document.dispatchEvent(new MessageEvent('message', {data: ${JSON.stringify(JSON.stringify(data))}})); true;`;
    webRef.current?.injectJavaScript(js);
  }, []);

  useImperativeHandle(ref, () => ({
    applyFormat: (action) => {
      sendToWebView({ type: 'applyFormat', action });
    },
    focus: () => {
      webRef.current?.injectJavaScript(`document.getElementById('editor').focus(); true;`);
    },
  }));

  useEffect(() => {
    if (!readyRef.current) return;
    const html = markdownToHtml(value);
    if (html !== lastSentRef.current) {
      lastSentRef.current = html;
      sendToWebView({ type: 'setContent', html });
    }
  }, [value, sendToWebView]);

  useEffect(() => {
    if (!readyRef.current) return;
    sendToWebView({ type: 'setMacros', macros: macros || [] });
  }, [macros, sendToWebView]);

  const onMessage = useCallback(
    (e: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === 'change') {
          const md = data.markdown as string;
          if (md !== value) {
            onChange(md);
          }
        } else if (data.type === 'height') {
          const h = Number(data.height);
          if (!isNaN(h) && h > 100 && h < 2000) setWebHeight(h);
        } else if (data.type === 'formatState' && onFormatStateChange) {
          onFormatStateChange(data.state as FormatState);
        }
      } catch {}
    },
    [value, onChange, onFormatStateChange],
  );

  const onLoadEnd = useCallback(() => {
    readyRef.current = true;
    const html = markdownToHtml(value);
    lastSentRef.current = html;
    // Delay to ensure JS loaded
    setTimeout(() => {
      sendToWebView({ type: 'setContent', html });
      sendToWebView({ type: 'setMacros', macros: macros || [] });
    }, 100);
  }, [value, macros, sendToWebView]);

  return (
    <View style={[styles.container, { height: webHeight }]}>
      {/* @ts-ignore - WebView types conflict with RN 0.86, runtime works fine */}
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: htmlTemplate(placeholder) }}
        onMessage={onMessage}
        onLoadEnd={onLoadEnd}
        style={styles.webview}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView={false}
        bounces={false}
        overScrollMode="never"
        androidLayerType="hardware"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    minHeight: 180,
    backgroundColor: colors.surface,
  },
});
