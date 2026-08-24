'use dom';

import { useEffect, useRef, useState } from 'react';
import { useDOMImperativeHandle } from 'expo/dom';

type FormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  h1: boolean;
  h2: boolean;
};

export type DomEditorHandle = {
  applyFormat: (...args: any[]) => void;
  focus: () => void;
};

import { forwardRef } from 'react';

const DomEditorBase = forwardRef<DomEditorHandle, {
  value: string;
  placeholder?: string;
  onChange: (markdown: string) => void;
  onFormatStateChange?: (state: FormatState) => void;
  onHeightChange?: (height: number) => void;
  macros?: { shortcut: string; expansion: string }[];
  dom?: import('expo/dom').DOMProps;
}>(function DomEditor(
  { value, placeholder, onChange, onFormatStateChange, onHeightChange, macros, dom },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef('');
  const macrosRef = useRef(macros);

  macrosRef.current = macros;

  // Convert markdown to HTML for initial render and updates
  const markdownToHtml = (md: string): string => {
    if (!md.trim()) return '';
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const lines = html.split('\n');
    const processed = lines.map((line) => {
      if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
      return line;
    });
    html = processed.join('\n');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    html = html.replace(/__([^_]+)__/g, '<u>$1</u>');
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<i>$1</i>');
    const parts = html.split('\n');
    const wrapped = parts.map((p) => {
      if (p.startsWith('<h')) return p;
      if (p.trim() === '') return '<div><br></div>';
      return `<div>${p}</div>`;
    });
    return wrapped.join('');
  };

  const htmlToMarkdown = (html: string): string => {
    let md = html;
    md = md.replace(/<div><br><\/div>/gi, '\n');
    md = md.replace(/<div>/gi, '\n');
    md = md.replace(/<\/div>/gi, '');
    md = md.replace(/<p[^>]*>/gi, '');
    md = md.replace(/<\/p>/gi, '\n');
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => '# ' + stripTags(c).trim() + '\n');
    md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => '## ' + stripTags(c).trim() + '\n');
    md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
    md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
    md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
    md = md.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '__$1__');
    md = stripTags(md);
    md = md.replace(/^\*\*\*\*\s*\n?/, '');
    md = md.replace(/\n\*\*\*\*\s*\n?/g, '\n');
    md = md.replace(/\*\*\s*\*\*/g, '');
    md = md.replace(/__\s*__/g, '');
    md = md.replace(/\*\s*\*/g, '');
    md = md.replace(/\n{3,}/g, '\n\n');
    md = md.replace(/&nbsp;/g, ' ');
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&quot;/g, '"');
    return md.trim();
  };

  const stripTags = (s: string) => s.replace(/<[^>]*>/g, '');

  const postFormatState = () => {
    try {
      const block = getCurrentBlock();
      const state = {
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        h1: block ? block.tagName === 'H1' : false,
        h2: block ? block.tagName === 'H2' : false,
      };
      onFormatStateChange?.(state);
    } catch {}
  };

  const notifyChange = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    if (html === lastHtmlRef.current) return;
    lastHtmlRef.current = html;
    const md = htmlToMarkdown(html);
    onChange(md);
    // Report height
    const h = Math.max(180, document.documentElement.scrollHeight || editorRef.current.scrollHeight);
    onHeightChange?.(h);
    postFormatState();
  };

  const getCurrentBlock = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let n: Node | null = sel.getRangeAt(0).startContainer;
    if (n.nodeType === 3) n = (n as Text).parentElement;
    while (n && n !== editorRef.current && !/^(H1|H2|DIV|P|LI)$/i.test((n as Element).tagName)) {
      n = (n as Element).parentElement;
    }
    return n && n !== editorRef.current ? (n as Element) : null;
  };

  const toggleHeading = (targetTag: string) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const tagUpper = targetTag.toUpperCase();
    const tagLower = targetTag.toLowerCase();

    // Highlighted text: split so only that text becomes heading
    if (!range.collapsed) {
      const selectedText = range.toString();
      if (selectedText && selectedText.trim()) {
        const startBlock = (() => {
          let n: Node | null = range.startContainer;
          if (n.nodeType === 3) n = (n as Text).parentElement;
          while (n && n !== editorRef.current && !/^(DIV|P|H1|H2)$/i.test((n as Element).tagName)) n = (n as Element).parentElement;
          return n && n !== editorRef.current ? (n as Element) : null;
        })();
        const endBlock = (() => {
          let n: Node | null = range.endContainer;
          if (n.nodeType === 3) n = (n as Text).parentElement;
          while (n && n !== editorRef.current && !/^(DIV|P|H1|H2)$/i.test((n as Element).tagName)) n = (n as Element).parentElement;
          return n && n !== editorRef.current ? (n as Element) : null;
        })();
        if (startBlock && startBlock === endBlock) {
          const blockText = startBlock.textContent || '';
          if (selectedText.length > 0 && selectedText.length < blockText.length) {
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
              const target = startBlock.tagName === tagUpper ? frag.childNodes[hasBefore ? 1 : 0] : frag.childNodes[hasBefore ? 1 : 0];
              const r = document.createRange();
              r.selectNodeContents(target as Node);
              sel.removeAllRanges();
              sel.addRange(r);
              return;
            } catch {}
          }
        }
      }
    }

    // Collapsed or whole-block: "after cursor" becomes heading
    if (range.collapsed) {
      const block = getCurrentBlock();
      if (!block) {
        document.execCommand('formatBlock', false, tagLower);
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
          const target = hasBefore ? frag.childNodes[1] : frag.firstChild;
          const r = document.createRange();
          r.selectNodeContents(target as Node);
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
        return;
      } catch {}
    }

    // Fallback: whole block(s)
    let blocks: Element[] = [];
    if (!range.collapsed) {
      const walker = document.createTreeWalker(editorRef.current!, NodeFilter.SHOW_ELEMENT, {
        acceptNode: (node) => (/^(DIV|P|H1|H2)$/i.test((node as Element).tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) as unknown as number,
      });
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (range.intersectsNode(node)) blocks.push(node as Element);
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
        return;
      }
    }
    if (blocks.length === 0) return;
    const allAreTarget = blocks.every((b) => b.tagName === tagUpper);
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
  };

  const handleMacroOnSpace = () => {
    const macrosList = macrosRef.current;
    if (!macrosList || macrosList.length === 0) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;
    let textBefore = '';
    const node = range.startContainer;
    if (node.nodeType === 3) {
      textBefore = (node.textContent || '').slice(0, range.startOffset);
    } else {
      textBefore = (node.textContent || '').slice(0, range.startOffset);
    }
    const m = textBefore.match(/([A-Za-z0-9_]+)$/);
    if (!m) return;
    const word = m[1];
    const hit = macrosList.find((x) => x.shortcut.toLowerCase() === word.toLowerCase());
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
    } catch {}
  };

  useDOMImperativeHandle(
    ref as any,
    () => ({
      applyFormat: (...args: any[]) => {
        const action = args[0] as string;
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        if (action === 'bold') document.execCommand('bold', false);
        else if (action === 'italic') document.execCommand('italic', false);
        else if (action === 'underline') document.execCommand('underline', false);
        else if (action === 'h1' || action === 'h2') toggleHeading(action.toUpperCase());
        setTimeout(() => {
          notifyChange();
          postFormatState();
        }, 50);
      },
      focus: () => editorRef.current?.focus(),
    }),
    []
  );

  useEffect(() => {
    if (!editorRef.current) return;
    const html = markdownToHtml(value);
    if (html !== lastHtmlRef.current) {
      lastHtmlRef.current = html;
      editorRef.current.innerHTML = html;
    }
  }, [value]);

  useEffect(() => {
    const onSelectionChange = () => postFormatState();
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  const handleInput = () => {
    handleMacroOnSpace();
    notifyChange();
  };

  return (
    <div
      ref={editorRef}
      contentEditable
      data-placeholder={placeholder}
      onInput={handleInput}
      onKeyUp={() => {
        notifyChange();
        postFormatState();
      }}
      onMouseUp={postFormatState}
      onPaste={() => setTimeout(notifyChange, 50)}
      style={{
        minHeight: 160,
        padding: '12px 16px',
        fontFamily: 'Manrope, -apple-system, system-ui, sans-serif',
        fontSize: 16,
        lineHeight: '24px',
        color: '#24211E',
        outline: 'none',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        backgroundColor: '#FDFBF7',
        borderWidth: 1,
        borderColor: '#F5E6E1',
        borderStyle: 'solid',
        borderRadius: 8,
      }}
    />
  );
});

export default DomEditorBase;
