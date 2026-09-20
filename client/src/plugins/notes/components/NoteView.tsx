import { FileText, History, Info, Link2, Paperclip, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { buildSlug } from '@/core/utils/slugUtils';
import { cn } from '@/lib/utils';
import { ContactQuickInfoDialog } from '@/plugins/contacts/components/ContactQuickInfoDialog';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import {
  CONTACT_TYPE_BADGE_CLASS,
  CONTACT_TYPE_COLORS,
  type Contact,
} from '@/plugins/contacts/types/contacts';
import { FileAttachmentsSection } from '@/plugins/files/components/FileAttachmentsSection';
import { useNotes } from '@/plugins/notes/hooks/useNotes';

import { NoteQuickContextPanel } from './NoteQuickContextPanel';
import { NoteShareBlock } from './NoteShareBlock';

interface NoteViewProps {
  note: any;
  /** Single-column card stack (e.g. list detail column). Default is two-column full panel. */
  stacked?: boolean;
}

type NoteViewTab = 'information' | 'linked' | 'files' | 'activity';

const NOTE_VIEW_TABS: NoteViewTab[] = ['information', 'linked', 'files', 'activity'];

function parseNoteViewTab(value: string | null): NoteViewTab {
  if (value && NOTE_VIEW_TABS.includes(value as NoteViewTab)) {
    return value as NoteViewTab;
  }
  return 'information';
}

export const NoteView = React.memo(function NoteView({
  note,
  stacked: _stacked = false,
}: NoteViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { contacts } = useContacts();
  const { closeNotePanel } = useNotes();
  const { user } = useApp();
  const hasFilesPlugin = (user?.plugins ?? []).includes('files');

  const [viewingContact, setViewingContact] = useState<Contact | null>(null);

  const activeTab = parseNoteViewTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: NoteViewTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'information') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (activeTab === 'files' && !hasFilesPlugin) {
      setActiveTab('information');
    }
  }, [activeTab, hasFilesPlugin, setActiveTab]);

  const contactById = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const contact of contacts) {
      map.set(String(contact.id), contact);
    }
    return map;
  }, [contacts]);

  const navigateToContact = (contact: Contact) => {
    closeNotePanel();
    setViewingContact(null);
    navigate(`/contacts/${buildSlug(contact, contacts, 'companyName')}`);
  };

  const handleContactClick = (contactId: string) => {
    const contact = contactById.get(String(contactId));
    if (!contact) {
      return;
    }
    setViewingContact(contact);
  };

  const uniqueMentions = useMemo((): Array<{ contactId: string; contactName?: string }> => {
    const raw = (note?.mentions || []) as Array<{ contactId: string; contactName?: string }>;
    return Array.from(new Map(raw.map((m) => [m.contactId, m])).values());
  }, [note?.mentions]);

  const tabs = useMemo(() => {
    const next: Array<{
      id: NoteViewTab;
      label: string;
      icon: typeof Info;
      count: number | null;
    }> = [
      {
        id: 'information',
        label: t('notes.tabs.information'),
        icon: Info,
        count: null,
      },
      {
        id: 'linked',
        label: t('notes.tabs.linked'),
        icon: Link2,
        count: uniqueMentions.length > 0 ? uniqueMentions.length : null,
      },
    ];
    if (hasFilesPlugin) {
      next.push({
        id: 'files',
        label: t('notes.tabs.files'),
        icon: Paperclip,
        count: null,
      });
    }
    next.push({
      id: 'activity',
      label: t('notes.tabs.activity'),
      icon: History,
      count: null,
    });
    return next;
  }, [hasFilesPlugin, t, uniqueMentions.length]);

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span>
              {tab.label}
              {tab.count != null ? (
                <>
                  {' '}
                  <span className="tabular-nums font-semibold">({tab.count})</span>
                </>
              ) : null}
            </span>
          </Button>
        );
      })}
    </div>
  );

  if (!note) {
    return null;
  }

  const informationCard = (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection title={t('notes.noteContent')} icon={FileText} subtleTitle className="p-6">
          <div className="min-w-0 overflow-x-hidden break-words [overflow-wrap:anywhere] [&_.rich-text-content]:break-words [&_.rich-text-content]:[overflow-wrap:anywhere] [&_.rich-text-content_pre]:whitespace-pre-wrap [&_.rich-text-content_pre]:break-words [&_.rich-text-content_pre]:overflow-x-hidden">
            <RichTextContent
              content={note.content}
              mentions={note.mentions || []}
              onMentionClick={handleContactClick}
            />
          </div>
        </DetailSection>
      </Card>
      <NoteShareBlock note={note} />
    </div>
  );

  const linkedCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('notes.mentionedContacts')}
        icon={Link2}
        iconPlugin="contacts"
        subtleTitle
        className="p-6"
      >
        {uniqueMentions.length > 0 ? (
          <QuickContextLinkTileGrid>
            {uniqueMentions.map((mention) => {
              const contactData = contactById.get(String(mention.contactId));
              const isDeleted = !contactData;
              const name = contactData?.companyName ?? mention.contactName ?? mention.contactId;
              const typeKey = contactData?.contactType === 'private' ? 'private' : 'company';
              return (
                <QuickContextLinkTile
                  key={`mention-${mention.contactId}`}
                  label={t('nav.contact')}
                  meta={isDeleted ? t('contacts.deletedContact') : t(`contacts.type.${typeKey}`)}
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
        ) : (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('notes.tabs.linkedEmpty')}</p>
        )}
      </DetailSection>
    </Card>
  );

  const filesCard = hasFilesPlugin ? (
    <FileAttachmentsSection pluginName="notes" entityId={note.id} readOnly />
  ) : null;

  return (
    <>
      <DetailLayout gridClassName="grid-cols-1">
        <div className="min-w-0 space-y-4 overflow-x-hidden">
          <NoteQuickContextPanel note={note} headerBelow={tabChips} />

          {activeTab === 'information' ? informationCard : null}
          {activeTab === 'linked' ? linkedCard : null}
          {activeTab === 'files' ? filesCard : null}
          {activeTab === 'activity' ? (
            <DetailActivityLog
              entityType="note"
              entityId={note.id}
              limit={30}
              title={t('notes.activity')}
              showClearButton
              refreshKey={String(note.updatedAt ?? note.id)}
              systemId={formatDisplayNumber('notes', note.id)}
            />
          ) : null}
        </div>
      </DetailLayout>

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
});
