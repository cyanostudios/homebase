/** Grow a textarea to fit its content (no inner scroll). */
export function syncTextareaHeight(el: HTMLTextAreaElement | null | undefined): void {
  if (!el) {
    return;
  }
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}
