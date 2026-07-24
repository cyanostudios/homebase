/** Strip HTML tags and return plain text (browser DOM). */
export function stripHtml(html: string): string {
  if (!html) {
    return '';
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? tmp.innerText ?? '';
}

/**
 * Plain text from HTML with line breaks preserved for excerpts/previews.
 * Converts `<br>` and block boundaries to `\n` before reading text content.
 */
export function htmlToPlainTextWithBreaks(html: string): string {
  if (!html) {
    return '';
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  tmp.querySelectorAll('br').forEach((br) => {
    br.replaceWith(document.createTextNode('\n'));
  });
  tmp.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, tr, blockquote').forEach((el) => {
    el.appendChild(document.createTextNode('\n'));
  });
  return (tmp.textContent ?? tmp.innerText ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
