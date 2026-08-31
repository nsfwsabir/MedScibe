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
    if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
    if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
    return line;
  });
  html = processedLines.join('\n');

  // Inline: bold **, underline __, italic *
  // Bold first, then underline, then italic (to avoid ** being parsed as two * )
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  html = html.replace(/__([^_]+)__/g, '<u>$1</u>');
  // Italic: single * not part of **
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<i>$1</i>');

  // Newlines to <br> or divs - use <div> per line for better editing
  // Keep <h1>/<h2> as is, wrap other lines
  const parts = html.split('\n');
  const wrapped = parts.map((p) => {
    if (p.startsWith('<h')) return p;
    if (p.trim() === '') return '<div><br></div>';
    return `<div>${p}</div>`;
  });
  return wrapped.join('');
}

export function htmlToMarkdown(html: string): string {
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
  md = md.replace(/<[^>]*>/g, '');
  // Clean empty markers left by execCommand edge cases (mirrors DomEditor htmlToMarkdown)
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
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

export function isHtml(s: string): boolean {
  return /<(b|i|u|h1|h2|div|p|br)[\s>]/i.test(s);
}
