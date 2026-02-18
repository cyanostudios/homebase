import { Info, SlidersHorizontal, User, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';

import { useKioskContext } from '../context/KioskContext';
import type { Slot } from '../types/kiosk';

import { CapacityAssignedDots } from './CapacityAssignedDots';

interface KioskViewProps {
  slot?: Slot;
  item?: Slot;
}

function formatDateTime(s: string | null): string {
  if (!s) {
    return '—';
  }
  return new Date(s).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
}

export function KioskView({ slot: slotProp, item }: KioskViewProps) {
  const { t } = useTranslation();
  const slot = slotProp ?? item ?? null;
  const { contacts, openContactForView } = useContacts();
  const { contacts: appContacts } = useApp();
  const assignableContacts = (appContacts ?? contacts).filter(
    (c: { isAssignable?: boolean }) => c.isAssignable !== false,
  );
  const {
    displayMentions,
    addContactToDraft,
    removeContactFromDraft,
    showDiscardQuickEditDialog,
    setShowDiscardQuickEditDialog,
    onDiscardQuickEditAndClose,
  } = useKioskContext();

  const addableContacts = assignableContacts.filter(
    (c: { id: number | string }) =>
      !displayMentions?.some((m) => String(m.contactId) === String(c.id)),
  );

  if (!slot) {
    return null;
  }

  return (
    <div className="plugin-slots">
      <DetailLayout
        sidebar={
          <div className="space-y-6">
            <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
              <DetailSection
                title={t('slots.slotProperties')}
                icon={SlidersHorizontal}
                iconPlugin="slots"
                className="p-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                      {t('common.contacts')}
                    </div>
                    <Select
                      value="__add_contact__"
                      onValueChange={(val) => {
                        if (val && val !== '__add_contact__') {
                          const contact = assignableContacts.find(
                            (c: { id: number | string }) => String(c.id) === val,
                          );
                          if (contact) {
                            addContactToDraft(contact);
                          }
                        }
                      }}
                      disabled={addableContacts.length === 0}
                    >
                      <SelectTrigger className="h-7 w-[140px] bg-background border-border/50 hover:bg-accent/50 transition-colors shadow-none rounded-md px-2 text-[10px] font-medium">
                        <SelectValue placeholder={t('common.addContact')} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/50 shadow-xl min-w-[180px]">
                        <SelectItem
                          value="__add_contact__"
                          className="py-2 focus:bg-accent rounded-md text-muted-foreground"
                        >
                          {addableContacts.length === 0
                            ? t('slots.noMoreToAdd')
                            : t('common.addContact')}
                        </SelectItem>
                        {addableContacts.map(
                          (contact: { id: number | string; companyName?: string }) => (
                            <SelectItem
                              key={contact.id}
                              value={String(contact.id)}
                              className="py-2 focus:bg-accent rounded-md text-[10px]"
                            >
                              {contact.companyName ?? `Contact ${contact.id}`}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {displayMentions && displayMentions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {displayMentions.map((m) => {
                        const contact = contacts.find(
                          (c: { id: number | string }) => String(c.id) === String(m.contactId),
                        ) as { id: number | string; companyName?: string } | undefined;
                        const name = contact?.companyName ?? m.contactName ?? m.contactId;
                        return (
                          <Badge
                            key={m.contactId}
                            variant="secondary"
                            className="flex items-center gap-1 text-[10px] font-medium px-2 h-5 border-transparent plugin-slots"
                          >
                            <User className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[100px]">{name}</span>
                            {contact && (
                              <Button
                                size="sm"
                                variant="link"
                                onClick={() => openContactForView(contact)}
                                className="h-auto p-0 text-[9px] shrink-0 font-medium text-plugin"
                              >
                                {t('common.view')}
                              </Button>
                            )}
                            <button
                              type="button"
                              className="ml-0.5 rounded hover:bg-muted p-0.5 disabled:opacity-50"
                              onClick={() => removeContactFromDraft(m.contactId)}
                              aria-label={`${t('common.removeContact')} ${name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </DetailSection>
            </Card>

            <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
              <DetailSection
                title={t('slots.information')}
                icon={Info}
                iconPlugin="slots"
                className="p-4"
              >
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('common.location')}</span>
                    <span className="font-medium truncate max-w-[150px]">
                      {slot.location || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('common.time')}</span>
                    <span className="font-medium">{formatDateTime(slot.slot_time)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('common.capacity')}</span>
                    <span className="font-medium">{slot.capacity}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('common.visible')}</span>
                    <span className="font-medium">
                      {slot.visible ? t('common.yes') : t('common.no')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('common.notifications')}</span>
                    <span className="font-medium">
                      {slot.notifications_enabled ? t('common.on') : t('common.off')}
                    </span>
                  </div>
                  <div className="pt-2 mt-2 border-t border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t('slots.created')}</span>
                      <span className="font-mono text-[10px] opacity-70">
                        {slot.created_at
                          ? new Date(slot.created_at).toLocaleDateString('sv-SE')
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-muted-foreground">{t('common.updated')}</span>
                      <span className="font-mono text-[10px] opacity-70">
                        {slot.updated_at
                          ? new Date(slot.updated_at).toLocaleDateString('sv-SE')
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </DetailSection>
            </Card>
          </div>
        }
      >
        <div className="space-y-6">
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title={t('slots.sectionTitle')} iconPlugin="slots" className="p-6">
              <div className="text-lg font-semibold">{slot.location || '—'}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {formatDateTime(slot.slot_time)}
              </div>
              <div className="mt-2 flex gap-2 flex-wrap items-center">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('common.capacity')}: {slot.capacity}{' '}
                  <CapacityAssignedDots
                    capacity={slot.capacity}
                    assignedCount={slot.mentions?.length ?? 0}
                  />
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  · {slot.visible ? t('common.visible') : t('common.hidden')}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  · {t('common.notifications')}{' '}
                  {slot.notifications_enabled ? t('common.on') : t('common.off')}
                </span>
              </div>
            </DetailSection>
          </Card>
        </div>
      </DetailLayout>
      <ConfirmDialog
        isOpen={showDiscardQuickEditDialog}
        title={t('dialog.unsavedChanges')}
        message={t('dialog.discardQuickEditMessage')}
        confirmText={t('common.discardChanges')}
        cancelText={t('common.continueEditing')}
        onConfirm={onDiscardQuickEditAndClose}
        onCancel={() => setShowDiscardQuickEditDialog(false)}
        variant="warning"
      />
    </div>
  );
}
