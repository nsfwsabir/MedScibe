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
  value: string;
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
    const node = range.startContainer;
    let textBefore = '';
    if (node.nodeType === 3) {
      textBefore = node.textContent.slice(0, range.startOffset);
    } else {
      textBefore = node.textContent.slice(0, range.startOffset);
    }
    const m = textBefore.match(/([A-Za-z0-9_]+)$/);
    if (!m) return;
    const word = m[1];
    const hit = macros.find(x => x.shortcut.toLowerCase() === word.toLowerCase());
    if (!hit) return;
    try {
      const wordLen = word.length;
      range.setStart(node, range.startOffset - wordLen);
      range.setEnd(node, range.startOffset);
      range.deleteContents();
      const textNode = document.createTextNode(hit.expansion);
      range.insertNode(textNode);
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

  // Heading: simple block-level toggle. For collapsed caret, split at caret so
  // "text after cursor on this line" becomes heading (or back to normal if already heading).
  // For highlighted text, the whole line(s) containing the selection become heading.
  function toggleHeading(targetTag) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const tagUpper = targetTag.toUpperCase();
    const tagLower = targetTag.toLowerCase();

    // Highlighted: if selection is inside a single block and is a proper substring,
    // split that block so only the highlighted text becomes a heading line.
    if (!range.collapsed) {
      const selectedText = range.toString();
      if (selectedText && selectedText.trim()) {
        let startBlock = range.startContainer;
        if (startBlock.nodeType === 3) startBlock = startBlock.parentElement;
        while (startBlock && startBlock !== editor && !/^(DIV|P|H1|H2)$/i.test(startBlock.tagName)) startBlock = startBlock.parentElement;
        let endBlock = range.endContainer;
        if (endBlock.nodeType === 3) endBlock = endBlock.parentElement;
        while (endBlock && endBlock !== editor && !/^(DIV|P|H1|H2)$/i.test(endBlock.tagName)) endBlock = endBlock.parentElement;
        if (startBlock && startBlock === endBlock) {
          const blockText = startBlock.textContent || '';
          if (selectedText.length > 0 && selectedText.length < blockText.length) {
            try {
              // Use ranges to split accurately, preserving inline formatting
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
              // If the original line was already this heading, turn the selection back to normal
              if (startBlock.tagName === tagUpper) {
                const div = document.createElement('div');
                div.appendChild(selectedFrag);
                frag.appendChild(div);
              } else {
                const heading = document.createElement(tagLower);
                heading.appendChild(selectedFrag);
                frag.appendChild(heading);
              }
              if (hasAfter) {
                const afterDiv = document.createElement('div');
                afterDiv.appendChild(afterFrag);
                frag.appendChild(afterDiv);
              }
              startBlock.replaceWith(frag);
              const target = (startBlock.tagName === tagUpper) ? frag.childNodes[hasBefore ? 1 : 0] : frag.childNodes[hasBefore ? 1 : 0];
              const r = document.createRange();
              r.selectNodeContents(target);
              sel.removeAllRanges();
              sel.addRange(r);
              setTimeout(() => { notifyChange(); postFormatState(); }, 50);
              return;
            } catch {}
          }
        }
      }
    }

    // Collapsed or whole-block selection: work on the current block(s)
    // For collapsed, "after cursor on this line" becomes heading
    if (range.collapsed) {
      const block = getCurrentBlock();
      if (!block) {
        document.execCommand('formatBlock', false, tagLower);
        setTimeout(() => { notifyChange(); postFormatState(); }, 50);
        return;
      }
      if (!(block.textContent || '').trim()) {
        // Empty line: just toggle the block
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
      // Split at caret: before stays, after becomes heading (or normal if already heading)
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
          // Caret at end: create new empty block after
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
          const r = document.createRange();
          r.selectNodeContents(afterDiv);
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

    // Fallback: toggle whole block(s)
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
    setTimeout(() => { notifyChange(); postFormatState(); }, 50);
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

  window.addEventListener('message', function(e) {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'setContent') window.setEditorContent(data.html);
      else if (data.type === 'setMacros') window.setEditorMacros(data.macros);
      else if (data.type === 'applyFormat') window.applyFormat(data.action);
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