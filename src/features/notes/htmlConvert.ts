export function markdownToHtml(md: string): string {
  if (!md.trim()) return '';
  // Escape HTML first
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings must be done before inline to avoid # inside ** etc.
  // Process line by line for headings
  const lines = html.split('\n');
  const processedLines = lines.map((line) => {
    if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
    if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
    if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
    if (line.startsWith('> ')) return `<blockquote>${line.slice(2)}</blockquote>`;
    return line;
  });
  html = processedLines.join('\n');

  // Inline code first, via placeholders, so * [ ] etc. inside code is untouched
  const codeSpans: string[] = [];
  html = html.replace(/`([^`\n]+)`/g, (_, c: string) => {
    codeSpans.push(`<code>${c}</code>`);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });
  // Links next so markers inside link text survive
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  // Inline: bold **, strike ~~, underline __, italic *
  // Bold first, then strike/underline, then italic (to avoid ** being parsed as two * )
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  html = html.replace(/__([^_]+)__/g, '<u>$1</u>');
  // Italic: single * not part of **
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<i>$1</i>');
  // Restore code spans
  html = html.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codeSpans[Number(i)] ?? '');

  // Newlines to <br> or divs - use <div> per line for better editing.
  // Group list lines into real <ul>/<ol> so Tiptap keeps them as lists.
  // Keep <h*> and <blockquote> as is, wrap other lines
  const parts = html.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < parts.length) {
    const p = parts[i];
    if (p.startsWith('<h') || p.startsWith('<blockquote>')) {
      out.push(p);
      i++;
      continue;
    }
    if (p.trim() === '') {
      out.push('<div><br></div>');
      i++;
      continue;
    }
    if (/^-\s+/.test(p)) {
      const items: string[] = [];
      while (i < parts.length && /^-\s+/.test(parts[i])) {
        items.push(`<li>${parts[i].replace(/^-\s+/, '')}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(p)) {
      const items: string[] = [];
      while (i < parts.length && /^\d+\.\s+/.test(parts[i])) {
        items.push(`<li>${parts[i].replace(/^\d+\.\s+/, '')}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    out.push(`<div>${p}</div>`);
    i++;
  }
  return out.join('');
}

export function htmlToMarkdown(html: string): string {
  let md = html;
  // Lists first: <li> may wrap content in <p> which generic rules would split
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner: string) => {
    const items: string[] = [];
    inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__: string, c: string) => {
      items.push(`${items.length + 1}. ${stripTags(c).trim()}`);
      return '';
    });
    return items.length > 0 ? '\n' + items.join('\n') + '\n' : '';
  });
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner: string) => {
    const items: string[] = [];
    inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__: string, c: string) => {
      items.push(`- ${stripTags(c).trim()}`);
      return '';
    });
    return items.length > 0 ? '\n' + items.join('\n') + '\n' : '';
  });
  // Blockquote before generic block rules (it wraps <p>)
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner: string) => {
    const t = stripTags(inner).trim().replace(/\n/g, '\n> ');
    return t ? '\n> ' + t + '\n' : '';
  });
  md = md.replace(/<div><br><\/div>/gi, '\n');
  md = md.replace(/<div>/gi, '\n');
  md = md.replace(/<\/div>/gi, '');
  md = md.replace(/<p[^>]*>/gi, '');
  md = md.replace(/<\/p>/gi, '\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => '# ' + stripTags(c).trim() + '\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => '## ' + stripTags(c).trim() + '\n');
  md = md.replace(/<h[3-6][^>]*>([\s\S]*?)<\/h[3-6]>/gi, (_, c) => '### ' + stripTags(c).trim() + '\n');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, u: string, c: string) => `[${stripTags(c).trim()}](${u})`);
  md = md.replace(/<(pre|code)[^>]*>([\s\S]*?)<\/(pre|code)>/gi, (_, __: string, c: string) => '`' + stripTags(c).trim() + '`');
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<(s|strike|del)(?=[\s>])[^>]*>([\s\S]*?)<\/(s|strike|del)>/gi, (_, __: string, c: string) => `~~${c}~~`);
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  md = md.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '__$1__');
  md = md.replace(/<[^>]*>/g, '');
  // Clean empty markers left by editor edge cases.
  // NOTE: \s+ (not \s*) — zero-width would eat real markers like **bold**.
  md = md.replace(/\*\*\*\*/g, '');
  md = md.replace(/\*\*\s+\*\*/g, '');
  md = md.replace(/____/g, '');
  md = md.replace(/__\s+__/g, '');
  md = md.replace(/\*\s+\*/g, '');
  md = md.replace(/~~\s*~~/g, '');
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  return md.trim();
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

export function isHtml(s: string): boolean {
  return /<(b|i|u|h1|h2|div|p|br)[\s>]/i.test(s);
}
