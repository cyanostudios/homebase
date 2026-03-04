/**
 * Extract Sello API documentation from saved HTML.
 * - Removes outer viewer wrapper (line numbers, table)
 * - Strips <style>, <script>, layout chrome
 * - Preserves ALL API documentation: headings, text, code blocks, tables, examples
 * Output: docs/API-DOCS/SELLO-API.md
 */
const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '../docs/API-DOCS/SELLO-API.html');
const OUTPUT = path.join(__dirname, '../docs/API-DOCS/SELLO-API.md');

function decodeEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractText(html) {
  return html.replace(/<[^>]+>/g, '').trim();
}

function htmlToMarkdown(html) {
  let md = html;
  // Remove script and style blocks entirely (zero risk to API docs)
  md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Remove head (title etc. - we'll add a header)
  md = md.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  // Extract body content
  const bodyMatch = md.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  md = bodyMatch ? bodyMatch[1] : md;
  // Convert headings - be careful with order (h3 before h2 before h1 for correct replacement)
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => '\n# ' + extractText(c) + '\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => '\n## ' + extractText(c) + '\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => '\n### ' + extractText(c) + '\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, c) => '\n#### ' + extractText(c) + '\n');
  // Preserve code blocks - pre/code often contain API examples
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => {
    const code = c
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
    return '\n```\n' + code + '\n```\n';
  });
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => {
    const code = c
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
    return code.includes('\n') ? '```\n' + code + '\n```' : '`' + code + '`';
  });
  // Tables - convert to markdown (simplified)
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, content) => {
    const rows = content.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    const lines = rows.map((tr) => {
      const cells = (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).map((cell) => {
        const m = cell.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/i);
        return m ? extractText(m[1]).replace(/\|/g, '\\|').trim() : '';
      });
      return '| ' + cells.join(' | ') + ' |';
    });
    if (lines.length === 0) return '';
    return '\n' + lines.join('\n') + '\n';
  });
  // Paragraphs and divs - extract text, preserve line breaks
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, c) => '\n' + extractText(c) + '\n');
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => '- ' + extractText(c) + '\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  // Links
  md = md.replace(
    /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, text) => '[' + extractText(text) + '](' + href + ')',
  );
  // Strong/em
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  // Strip remaining tags but keep text
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  md = md.replace(/\n{3,}/g, '\n\n').trim();
  return md;
}

const raw = fs.readFileSync(INPUT, 'utf8');

// Extract line-content cells (the inner document, line by line)
const lineContentRe = /<td\s+class="line-content"\s*(?:value="[^"]*")?>([\s\S]*?)<\/td>/gi;
const lines = [];
let m;
while ((m = lineContentRe.exec(raw)) !== null) {
  const content = m[1];
  const text = content
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  lines.push(text);
}

const innerHtml = lines.join('\n');

// Convert to markdown, preserving all API doc content
let markdown = '# Sello API v5 Reference\n\nSource: https://docs.sello.io\n\n';
markdown += htmlToMarkdown(innerHtml);

fs.writeFileSync(OUTPUT, markdown, 'utf8');
console.log('Created', OUTPUT, '(' + Math.round(markdown.length / 1024) + ' KB)');
