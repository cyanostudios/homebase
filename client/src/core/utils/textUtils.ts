/** Strip HTML tags and return plain text (browser DOM). */
export function stripHtml(html: string): string {
  if (!html) {
    return '';
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? tmp.innerText ?? '';
}
