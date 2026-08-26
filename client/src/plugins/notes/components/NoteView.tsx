import {
  Copy,
  Download,
  Edit,
  Info,
  Link2,
  Maximize2,
  Minimize2,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_ENTITY_LINK_TRIGGER_CLASS,
  DETAIL_INFO_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import type { ExportFormat } from '@/core/utils/exportUtils';
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
import type { Note } from '@/plugins/notes/types/notes';

import { NoteShareBlock } from './NoteShareBlock';

interface NoteQuickActionsCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDeleteClick: () => void;
  onDuplicate: (note: Note) => void;
  getDuplicateConfig: (
    item: Note | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly?: boolean } | null;
  detailFooterActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Note) => void;
    className?: string;
    disabled?: boolean;
  }>;
}

function getQuickActionIconColorClass(actionId: string): string {
  if (actionId === 'send-message') {
    return 'text-violet-600 dark:text-violet-400';
  }
  if (actionId === 'send-email') {
    return 'text-red-600 dark:text-red-400';
  }
  if (actionId === 'create-task-from-note') {
    return 'text-green-600 dark:text-green-400';
  }
  return '';
}

function getExportShareIconColorClass(actionId: string): string {
  if (actionId === 'view-share') {
    return 'text-blue-600 dark:text-blue-400';
  }
  if (actionId === 'share') {
    return 'text-violet-600 dark:text-violet-400';
  }
  return '';
}

function NoteQuickActionsCard({
  note,
  onEdit,
  onDeleteClick,
  onDuplicate,
  getDuplicateConfig,
  detailFooterActions,
}: NoteQuickActionsCardProps) {
  const { t } = useTranslation();
  const canDuplicate = Boolean(getDuplicateConfig(note));
  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('notes.quickActions')}
        icon={Zap}
        iconPlugin="notes"
        subtleTitle
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={(props) => (
              <Edit
                {...props}
                className={cn(props.className, 'text-blue-600 dark:text-blue-400')}
              />
            )}
            className={DETAIL_QUICK_ACTION_ROW_CLASS}
            onClick={() => onEdit(note)}
          >
            {t('common.edit')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={(props) => (
              <Trash2
                {...props}
                className={cn(props.className, 'text-red-600 dark:text-red-400')}
              />
            )}
            className="h-9 justify-start rounded-md px-3 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors"
            onClick={onDeleteClick}
          >
            {t('common.delete')}
          </Button>
          {canDuplicate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={(props) => (
                <Copy
                  {...props}
                  className={cn(props.className, 'text-green-600 dark:text-green-400')}
                />
              )}
              className={DETAIL_QUICK_ACTION_ROW_CLASS}
              onClick={() => onDuplicate(note)}
            >
              {t('common.duplicate')}
            </Button>
          )}
          {Array.isArray(detailFooterActions) &&
            detailFooterActions.map((action) => {
              const Icon = action.icon;
              const iconTint = getQuickActionIconColorClass(action.id);
              return (
                <Button
                  key={action.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={(props) => <Icon {...props} className={cn(props.className, iconTint)} />}
                  disabled={action.disabled}
                  className={cn(
                    DETAIL_QUICK_ACTION_ROW_CLASS,
                    'disabled:opacity-50',
                    action.className,
                  )}
                  onClick={() => action.onClick(note)}
                >
                  {action.label}
                </Button>
              );
            })}
        </div>
      </DetailSection>
    </Card>
  );
}

interface NoteViewProps {
  note: any;
}

interface NoteExportOptionsCardProps {
  note: Note;
  exportFormats: ExportFormat[];
  onExportItem: (format: ExportFormat, item: Note) => void;
  shareActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Note) => void;
    className?: string;
    disabled?: boolean;
  }>;
}

function NoteExportOptionsCard({
  note,
  exportFormats,
  onExportItem,
  shareActions,
}: NoteExportOptionsCardProps) {
  const { t } = useTranslation();
  const hasShareButtons = Array.isArray(shareActions) && shareActions.length > 0;
  if (exportFormats.length === 0 && !hasShareButtons) {
    return null;
  }

  const exportLabelByFormat: Record<ExportFormat, string> = {
    txt: t('common.exportTxt'),
    csv: t('common.exportCsv'),
    pdf: t('common.exportPdf'),
  };

  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('notes.exportOptions')}
        icon={Download}
        iconPlugin="notes"
        subtleTitle
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1">
          {exportFormats.map((format) => (
            <Button
              key={format}
              type="button"
              variant="ghost"
              size="sm"
              icon={Download}
              className={DETAIL_QUICK_ACTION_ROW_CLASS}
              onClick={() => onExportItem(format, note)}
            >
              {exportLabelByFormat[format]}
            </Button>
          ))}
          {hasShareButtons ? (
            <>
              {exportFormats.length > 0 ? (
                <div className="w-full border-t border-border/60 pt-2 mt-0.5" />
              ) : null}
              {shareActions!.map((action) => {
                const Icon = action.icon;
                const iconTint = getExportShareIconColorClass(action.id);
                return (
                  <Button
                    key={action.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={(props) => <Icon {...props} className={cn(props.className, iconTint)} />}
                    disabled={action.disabled}
                    className={cn(
                      DETAIL_QUICK_ACTION_ROW_CLASS,
                      'disabled:opacity-50',
                      action.className,
                    )}
                    onClick={() => action.onClick(note)}
                  >
                    {action.label}
                  </Button>
                );
              })}
            </>
          ) : null}
        </div>
      </DetailSection>
    </Card>
  );
}

export const NoteView: React.FC<NoteViewProps> = ({ note }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { contacts } = useContacts();
  const {
    closeNotePanel,
    deleteNote,
    openNoteForEdit,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedNoteId,
    detailFooterActions,
    exportShareActions,
    exportFormats,
    onExportItem,
    getDeleteMessage,
  } = useNotes();

  const handleConfirmDelete = async () => {
    if (note) {
      await deleteNote(note.id);
      setShowDeleteNoteConfirm(false);
      closeNotePanel();
    }
  };
  const { user } = useApp();
  const hasFilesPlugin = (user?.plugins ?? []).includes('files');

  const [showDeleteNoteConfirm, setShowDeleteNoteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    setFocusMode(false);
  }, [note?.id]);

  useEffect(() => {
    if (!focusMode) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode]);

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

  if (!note) {
    return null;
  }

  const focusModeToggle = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      icon={focusMode ? Minimize2 : Maximize2}
      className={DETAIL_ENTITY_LINK_TRIGGER_CLASS}
      aria-pressed={focusMode}
      title={t('notes.focusModeHint')}
      onClick={() => setFocusMode((open) => !open)}
    >
      {focusMode ? t('notes.exitFocusMode') : t('notes.focusMode')}
    </Button>
  );

  const contentHeaderActions = (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={Edit}
        className="h-8 w-8 shrink-0 p-0 hidden md:inline-flex"
        onClick={() => openNoteForEdit(note)}
        aria-label={t('common.edit')}
        title={t('common.edit')}
      />
      {focusModeToggle}
    </div>
  );

  const noteContent = (
    <RichTextContent
      content={note.content}
      mentions={note.mentions || []}
      onMentionClick={handleContactClick}
    />
  );

  const updatedLabel = note.updatedAt
    ? new Date(note.updatedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const contentColumn = (
    <Card
      padding="none"
      className={cn(
        DETAIL_VIEW_CARD_CLASS,
        'min-w-0 overflow-x-hidden',
        focusMode && 'relative z-50 mx-auto w-full max-w-[1080px] shadow-lg',
      )}
    >
      {note.showTitleInContent !== false ? (
        <DetailSection
          title={(note.title || '').trim() || '—'}
          iconPlugin="notes"
          className="min-w-0 overflow-x-hidden p-6"
          prominentTitle
          action={contentHeaderActions}
        >
          {updatedLabel ? (
            <p className="mb-3 text-xs text-muted-foreground">
              {t('common.updated')} {updatedLabel}
            </p>
          ) : null}
          <div
            className={cn(
              'min-w-0 overflow-x-hidden break-words [overflow-wrap:anywhere] [&_.rich-text-content]:break-words [&_.rich-text-content]:[overflow-wrap:anywhere] [&_.rich-text-content_pre]:whitespace-pre-wrap [&_.rich-text-content_pre]:break-words [&_.rich-text-content_pre]:overflow-x-hidden',
              focusMode && 'min-h-[min(70vh,560px)]',
            )}
          >
            {noteContent}
          </div>
        </DetailSection>
      ) : (
        <div className="min-w-0 overflow-x-hidden p-6">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              {updatedLabel ? (
                <p className="text-xs text-muted-foreground">
                  {t('common.updated')} {updatedLabel}
                </p>
              ) : null}
            </div>
            {contentHeaderActions}
          </div>
          <div
            className={cn(
              'min-w-0 overflow-x-hidden break-words [overflow-wrap:anywhere] [&_.rich-text-content]:break-words [&_.rich-text-content]:[overflow-wrap:anywhere] [&_.rich-text-content_pre]:whitespace-pre-wrap [&_.rich-text-content_pre]:break-words [&_.rich-text-content_pre]:overflow-x-hidden',
              focusMode && 'min-h-[min(70vh,560px)]',
            )}
          >
            {noteContent}
          </div>
        </div>
      )}
    </Card>
  );

  const mentionsCard =
    uniqueMentions.length > 0 ? (
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={
            <span className="inline-flex items-baseline gap-2">
              <span>{t('notes.mentionedContacts')}</span>
              <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
                {t('notes.quickContext.mentionsHint')}
              </span>
            </span>
          }
          icon={Link2}
          iconPlugin="contacts"
          subtleTitle
          className="p-6"
        >
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
        </DetailSection>
      </Card>
    ) : null;

  const sidebar = (
    <div className="space-y-4">
      <NoteQuickActionsCard
        note={note}
        onEdit={openNoteForEdit}
        onDeleteClick={() => setShowDeleteNoteConfirm(true)}
        onDuplicate={() => setShowDuplicateDialog(true)}
        getDuplicateConfig={getDuplicateConfig}
        detailFooterActions={detailFooterActions}
      />
      <NoteExportOptionsCard
        note={note}
        exportFormats={exportFormats}
        onExportItem={onExportItem}
        shareActions={exportShareActions}
      />

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('notes.information')}
          icon={Info}
          iconPlugin="notes"
          subtleTitle
          className="p-4"
          collapsible
        >
          <div>
            <div className={DETAIL_INFO_ROW_CLASS}>
              <span className="text-slate-500 dark:text-slate-400">ID</span>
              <span className="font-mono font-extrabold text-foreground">
                {formatDisplayNumber('notes', note.id)}
              </span>
            </div>
            <div className={DETAIL_INFO_ROW_CLASS}>
              <span className="text-slate-500 dark:text-slate-400">Created</span>
              <span className="font-mono font-extrabold text-foreground">
                {new Date(note.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className={DETAIL_INFO_ROW_CLASS}>
              <span className="text-slate-500 dark:text-slate-400">Updated</span>
              <span className="font-mono font-extrabold text-foreground">
                {new Date(note.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </DetailSection>
      </Card>

      <DetailActivityLog
        entityType="note"
        entityId={note.id}
        limit={30}
        title={t('notes.activity')}
        showClearButton
        refreshKey={String(note.updatedAt ?? note.id)}
      />
    </div>
  );

  return (
    <>
      {focusMode ? (
        <button
          type="button"
          aria-label={t('notes.exitFocusMode')}
          className="fixed inset-0 z-40 cursor-default border-0 bg-slate-950/55 p-0"
          onClick={() => setFocusMode(false)}
        />
      ) : null}

      <DetailLayout sidebar={focusMode ? undefined : sidebar}>
        <div className="min-w-0 space-y-4 overflow-x-hidden">
          {contentColumn}
          {!focusMode ? (
            <>
              {hasFilesPlugin ? (
                <FileAttachmentsSection pluginName="notes" entityId={note.id} readOnly />
              ) : null}
              {mentionsCard}
              <NoteShareBlock note={note} />
            </>
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

      <ConfirmDialog
        isOpen={showDeleteNoteConfirm}
        title={t('dialog.deleteItem', { label: t('nav.note') })}
        message={note ? getDeleteMessage(note) : ''}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteNoteConfirm(false)}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(note, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedNoteId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={getDuplicateConfig(note)?.defaultName ?? ''}
        nameLabel={getDuplicateConfig(note)?.nameLabel ?? t('notes.title')}
        confirmOnly={Boolean(getDuplicateConfig(note)?.confirmOnly)}
      />
    </>
  );
};
