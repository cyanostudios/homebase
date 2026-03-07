import type { Mention } from '@/core/types/mention';

/** Strip HTML tags to plain text. Used when displaying HTML content with MentionContent (mentions use plain-text positions). */
export function htmlToPlainText(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract @mentions from HTML content by stripping tags and matching @CompanyName against contacts.
 * Used when RichTextEditor replaces MentionTextarea; mentions are derived from plain text.
 */
export function extractMentionsFromHtml(
  html: string,
  contacts: Array<{ id: string; companyName?: string; contactType?: string }>,
): Mention[] {
  const text = (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const mentions: Mention[] = [];
  const regex = /@([^@\s]+(?:\s+[^@\s]+)*)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const mentionText = match[1];
    const contact = contacts.find(
      (c) => (c.companyName ?? '').toLowerCase() === mentionText.toLowerCase(),
    );
    if (contact) {
      mentions.push({
        contactId: contact.id,
        contactName: contact.companyName ?? mentionText,
        companyName: contact.contactType === 'company' ? contact.companyName : undefined,
        position: match.index,
        length: match[0].length,
      });
    }
  }
  return mentions;
}
