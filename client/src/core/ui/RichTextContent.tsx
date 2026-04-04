/**
 * RichTextContent renders stored note/task content.
 *
 * Supports two formats transparently:
 *  • HTML  – content written with RichTextEditor (starts with `<`)
 *  • Plain text – legacy content; rendered as-is with newlines preserved
 *
 * Mention spans (<span class="mention" data-id="..." data-label="...">)
 * are made clickable via event delegation when onMentionClick is provided.
 */
import DOMPurify from 'dompurify';
import React, { useEffect, useRef } from 'react';

import { MentionContent } from './MentionContent';

interface RichTextContentProps {
  /** May be missing or non-string at runtime if API data is incomplete. */
  content?: string | null;
  mentions?: any[];
  onMentionClick?: (contactId: string) => void;
}

const PURIFY_ALLOWED_TAGS = [
  'p',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'em',
  'u',
  's',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'blockquote',
  'hr',
  'span',
];
const PURIFY_ALLOWED_ATTR = ['class', 'data-type', 'data-id', 'data-label'];

function isHtml(content: string) {
  return content.trimStart().startsWith('<');
}

function normalizeContent(content: string | null | undefined): string {
  if (content === undefined || content === null) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }
  return String(content);
}

export const RichTextContent: React.FC<RichTextContentProps> = ({
  content,
  mentions = [],
  onMentionClick,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const text = normalizeContent(content);

  // Event delegation: handle clicks on .mention spans
  useEffect(() => {
    const el = ref.current;
    if (!el || !onMentionClick) {
      return;
    }

    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.mention') as HTMLElement | null;
      if (!target) {
        return;
      }
      const id = target.getAttribute('data-id');
      if (id) {
        onMentionClick(id);
      }
    };

    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [onMentionClick]);

  if (!text.trim()) {
    return <span className="text-muted-foreground italic text-sm">No content</span>;
  }

  if (!isHtml(text)) {
    // Legacy plain-text content – use the existing mention renderer
    return <MentionContent content={text} mentions={mentions} onMentionClick={onMentionClick} />;
  }

  const sanitized = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: PURIFY_ALLOWED_TAGS,
    ALLOWED_ATTR: PURIFY_ALLOWED_ATTR,
  } as any) as unknown as string;

  return (
    <div
      ref={ref}
      className="rich-text-content text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};
