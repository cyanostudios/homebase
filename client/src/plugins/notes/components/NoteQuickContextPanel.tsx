import { Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import {
  QuickContextHeaderActions,
  QuickContextOpenFullFooter,
} from '@/core/ui/QuickContextHeaderActions';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { buildSlug } from '@/core/utils/slugUtils';
import { htmlToPlainTextWithBreaks } from '@/core/utils/textUtils';
import { cn } from '@/lib/utils';
import { ContactQuickInfoDialog } from '@/plugins/contacts/components/ContactQuickInfoDialog';
import {
  CONTACT_TYPE_BADGE_CLASS,
  CONTACT_TYPE_COLORS,
  type Contact,
} from '@/plugins/contacts/types/contacts';

import type { Note } from '../types/notes';

/** Visible plain-text budget in list quick context. Tune: 400 / 800 / 1200 / 1600. */
const LIST_CONTENT_PREVIEW_CHARS = 1200;

function noteInitials(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return title.trim().slice(0, 2).toUpperCase() || '—';
}

/**
 * Truncates HTML by plain-text character budget while keeping markup (walks a DOM tree).
 * Falls back to plain-text ellipsis when DOMParser is unavailable.
 */
function truncateHtmlPreservingFormat(
  content: string,
  maxChars: number,
): { html: string; truncated: boolean } {
  const plain = htmlToPlainTextWithBreaks(content).trim();
  if (!plain) {
    return { html: '', truncated: false };
  }
  if (plain.length <= maxChars) {
    return { html: content, truncated: false };
  }

  if (typeof DOMParser === 'undefined') {
    const slice = plain.slice(0, maxChars);
    const lastSpace = slice.lastIndexOf(' ');
    const cut = lastSpace > maxChars * 0.6 ? lastSpace : maxChars;
    return { html: `${plain.slice(0, cut).trimEnd()}…`, truncated: true };
  }

  const isHtml = content.trimStart().startsWith('<');
  const wrapped = isHtml
    ? content
    : content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
  const doc = new DOMParser().parseFromString(`<div id="root">${wrapped}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) {
    return { html: `${plain.slice(0, maxChars).trimEnd()}…`, truncated: true };
  }

  let count = 0;
  let truncated = false;

  const walk = (node: Node): boolean => {
    if (truncated) {
      return false;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (count + text.length <= maxChars) {
        count += text.length;
        return true;
      }
      const remaining = Math.max(0, maxChars - count);
      const slice = text.slice(0, remaining);
      const lastSpace = slice.lastIndexOf(' ');
      const cut = lastSpace > remaining * 0.6 ? lastSpace : remaining;
      node.textContent = `${slice.slice(0, cut).trimEnd()}…`;
      count = maxChars;
      truncated = true;
      let sibling = node.nextSibling;
      while (sibling) {
        const next = sibling.nextSibling;
        sibling.parentNode?.removeChild(sibling);
        sibling = next;
      }
      return false;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (!walk(child)) {
          let sibling = child.nextSibling;
          while (sibling) {
            const next = sibling.nextSibling;
            node.removeChild(sibling);
            sibling = next;
          }
          return false;
        }
      }
    }
    return true;
  };

  walk(root);
  return { html: root.innerHTML, truncated: true };
}

export function NoteQuickContextPanel({
  note,
  onClose,
  onOpenFullProfile,
  onEdit,
  variant = 'list',
}: {
  note: Note;
  onClose?: () => void;
  onOpenFullProfile?: () => void;
  onEdit: () => void;
  /** `list` = small preview beside the list; `full` = first column in full detail view. */
  variant?: 'list' | 'full';
}) {
  const isFullView = variant === 'full';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { contacts } = useApp();
  const [contentExpanded, setContentExpanded] = useState(false);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);

  useEffect(() => {
    setContentExpanded(false);
    setViewingContact(null);
  }, [note.id]);

  const contactById = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const contact of contacts ?? []) {
      map.set(String(contact.id), contact as Contact);
    }
    return map;
  }, [contacts]);

  const uniqueMentions = useMemo(() => {
    const mentions = Array.isArray(note.mentions) ? note.mentions : [];
    return Array.from(new Map(mentions.map((m) => [m.contactId, m])).values());
  }, [note.mentions]);

  const openMentionContact = (contactId: string) => {
    const contact = contactById.get(String(contactId));
    if (!contact) {
      return;
    }
    setViewingContact(contact);
  };

  const navigateToContact = (contact: Contact) => {
    setViewingContact(null);
    navigate(`/contacts/${buildSlug(contact, contacts ?? [], 'companyName')}`);
  };
  const updatedLabel = note.updatedAt
    ? new Date(note.updatedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const contentPreview = useMemo(() => {
    if (!note.content) {
      return { html: '', truncated: false };
    }
    return truncateHtmlPreservingFormat(note.content, LIST_CONTENT_PREVIEW_CHARS);
  }, [note.content]);

  const displayedContentHtml = contentExpanded ? note.content || '' : contentPreview.html;
  const showReadMoreToggle = contentPreview.truncated && !isFullView;

  const identityHeader = (
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
        aria-hidden
      >
        {noteInitials(note.title)}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h3 className="truncate text-lg font-semibold tracking-tight text-foreground">
          {note.title || '—'}
        </h3>
      </div>
      <QuickContextHeaderActions
        onOpen={!isFullView && onOpenFullProfile ? onOpenFullProfile : undefined}
        onEdit={onEdit}
        onClose={!isFullView && onClose ? onClose : undefined}
        editLabel={t('common.edit')}
        closeLabel={t('common.close')}
      />
    </div>
  );

  return (
    <>
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
        <div className="border-b border-border/50 px-4 py-2.5">{identityHeader}</div>

        <div
          className={cn(
            'min-w-0 overflow-x-hidden px-4 py-4',
            isFullView ? 'space-y-4' : 'space-y-6',
          )}
        >
          {updatedLabel ? (
            <p className="text-xs text-muted-foreground">
              {t('common.updated')} {updatedLabel}
            </p>
          ) : null}

          {displayedContentHtml ? (
            <div className="min-w-0 overflow-x-hidden break-words [overflow-wrap:anywhere] [&_.rich-text-content]:break-words [&_.rich-text-content]:[overflow-wrap:anywhere] [&_.rich-text-content_pre]:whitespace-pre-wrap [&_.rich-text-content_pre]:break-words [&_.rich-text-content_pre]:overflow-x-hidden">
              <RichTextContent
                content={displayedContentHtml}
                mentions={note.mentions || []}
                onMentionClick={openMentionContact}
              />
              {showReadMoreToggle ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                  onClick={() => setContentExpanded((open) => !open)}
                >
                  {contentExpanded
                    ? t('notes.quickContext.showLess')
                    : t('notes.quickContext.readMore')}
                </button>
              ) : null}
            </div>
          ) : null}

          {!isFullView && uniqueMentions.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {t('notes.mentionedContacts')}
              </p>
              <QuickContextLinkTileGrid>
                {uniqueMentions.slice(0, 6).map((mention) => {
                  const contactData = contactById.get(String(mention.contactId));
                  const isDeleted = !contactData;
                  const name =
                    contactData?.companyName ??
                    mention.contactName ??
                    mention.companyName ??
                    mention.contactId;
                  const typeKey = contactData?.contactType === 'private' ? 'private' : 'company';
                  return (
                    <QuickContextLinkTile
                      key={mention.contactId}
                      label={t('nav.contact')}
                      meta={
                        isDeleted ? t('contacts.deletedContact') : t(`contacts.type.${typeKey}`)
                      }
                      metaClassName={
                        isDeleted
                          ? 'border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          : CONTACT_TYPE_COLORS[typeKey]
                      }
                      icon={Users}
                      iconClassName={isDeleted ? 'text-slate-400' : 'text-sky-600'}
                      onClick={
                        contactData
                          ? () => {
                              setViewingContact(contactData);
                            }
                          : undefined
                      }
                      className={isDeleted ? 'opacity-70' : undefined}
                    >
                      {name}
                    </QuickContextLinkTile>
                  );
                })}
              </QuickContextLinkTileGrid>
            </div>
          ) : null}
        </div>

        {!isFullView && onOpenFullProfile ? (
          <QuickContextOpenFullFooter onOpen={onOpenFullProfile} />
        ) : null}
      </Card>

      <ContactQuickInfoDialog
        isOpen={viewingContact !== null}
        contact={viewingContact}
        onClose={() => setViewingContact(null)}
        onOpenContact={() => {
          if (viewingContact) {
            navigateToContact(viewingContact);
          }
        }}
        badges={
          viewingContact ? (
            <span
              className={cn(
                CONTACT_TYPE_BADGE_CLASS,
                CONTACT_TYPE_COLORS[viewingContact.contactType],
              )}
            >
              {t(`contacts.type.${viewingContact.contactType}`)}
            </span>
          ) : null
        }
      />
    </>
  );
}
