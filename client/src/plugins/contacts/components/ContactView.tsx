import {
  Globe,
  Hash,
  History,
  Info,
  Link2,
  Mail,
  MapPin,
  Phone,
  SlidersHorizontal,
  Tag,
  User,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { BulkEmailDialog } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { CHECKBOX_SM_CLASS } from '@/core/ui/checkboxStyles';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_FIELD_LABEL_CLASS as FIELD_LABEL_CLASS,
  DETAIL_FIELD_VALUE_CLASS as FIELD_VALUE_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_PROP_ROW_CLASS as PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS as CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import { ContactCopyableLink, mailtoHref, telHref, websiteHref } from './ContactCopyableLink';
import { ContactLinkedItemsSectionLazy as ContactLinkedItemsSection } from './ContactLinkedItemsSectionLazy';
import { ContactQuickContextPanel } from './ContactQuickContextPanel';
import { useContacts } from '../hooks/useContacts';
import type { Contact } from '../types/contacts';
import { formatCompanyTypeLabel } from '../types/contacts';
import { CONTACTS_SETTINGS_KEY } from '../utils/contactColumnCount';
import { isContactPersonInvoiceReference } from '../utils/contactInvoiceReference';

interface ContactViewProps {
  contact: Contact;
  /** Single-column card stack (e.g. list detail column). Default is two-column full panel. */
  stacked?: boolean;
}

type ContactViewTab =
  | 'information'
  | 'properties'
  | 'addresses'
  | 'persons'
  | 'linked'
  | 'activity';

const CONTACT_VIEW_TABS: ContactViewTab[] = [
  'information',
  'properties',
  'addresses',
  'persons',
  'linked',
  'activity',
];

function parseContactViewTab(value: string | null): ContactViewTab {
  if (value && CONTACT_VIEW_TABS.includes(value as ContactViewTab)) {
    return value as ContactViewTab;
  }
  return 'information';
}

export const ContactView = React.memo(function ContactView({
  contact,
  stacked: _stacked = false,
}: ContactViewProps) {
  const { t } = useTranslation();
  const { getSettings, settingsVersion } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseContactViewTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: ContactViewTab) => {
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

  const {
    showSendMessageDialog,
    sendMessageRecipients,
    closeSendMessageDialog,
    showSendEmailDialog,
    sendEmailRecipients,
    closeSendEmailDialog,
    currentContact,
    isContactPanelOpen,
    displayTags,
    addTagToDraft,
    removeTagFromDraft,
    applyTagToContact,
    removeTagFromContact,
    tagError,
    showDiscardTagsDialog,
    setShowDiscardTagsDialog,
    onDiscardTagsAndClose,
    setContactAssignable,
    setContactPersonInvoiceReference,
  } = useContacts();

  // Inline list detail reuses ContactView without opening the global panel — use contact.tags
  // and immediate tag APIs; panel view keeps the draft/apply flow.
  const isPanelContact =
    isContactPanelOpen &&
    currentContact != null &&
    String(currentContact.id) === String(contact.id);
  const tagsShown = isPanelContact ? displayTags : Array.isArray(contact.tags) ? contact.tags : [];

  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagToAdd, setTagToAdd] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadTags = async () => {
      try {
        const settings = await getSettings(CONTACTS_SETTINGS_KEY);
        if (cancelled) {
          return;
        }
        const list = Array.isArray(settings?.tags) ? settings.tags : [];
        setAvailableTags(
          list
            .filter((item: unknown): item is string => typeof item === 'string')
            .map((item: string) => item.trim())
            .filter(Boolean),
        );
      } catch {
        if (!cancelled) {
          setAvailableTags([]);
        }
      }
    };
    void loadTags();
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const addableTags = useMemo(
    () =>
      availableTags.filter(
        (item) =>
          !tagsShown.some((tag) => String(tag).toLowerCase() === String(item).toLowerCase()),
      ),
    [availableTags, tagsShown],
  );

  const addressCount = Array.isArray(contact.addresses) ? contact.addresses.length : 0;
  const personCount = Array.isArray(contact.contactPersons) ? contact.contactPersons.length : 0;

  const tabs = useMemo(
    () => [
      {
        id: 'information' as const,
        label: t('contacts.tabs.information'),
        icon: Info,
        count: null as number | null,
      },
      {
        id: 'properties' as const,
        label: t('contacts.tabs.properties'),
        icon: SlidersHorizontal,
        count: null as number | null,
      },
      {
        id: 'addresses' as const,
        label: t('contacts.tabs.addresses'),
        icon: MapPin,
        count: addressCount > 0 ? addressCount : null,
      },
      {
        id: 'persons' as const,
        label: t('contacts.tabs.persons'),
        icon: Users,
        count: personCount > 0 ? personCount : null,
      },
      {
        id: 'linked' as const,
        label: t('contacts.tabs.linked'),
        icon: Link2,
        count: null as number | null,
      },
      {
        id: 'activity' as const,
        label: t('contacts.tabs.activity'),
        icon: History,
        count: null as number | null,
      },
    ],
    [t, addressCount, personCount],
  );

  if (!contact) {
    return null;
  }

  const isCompany = contact.contactType === 'company';
  const contactNotes = contact.notes?.trim() || '';

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

  const addressesCard = (
    <Card padding="none" className={CARD_CLASS}>
      <DetailSection
        title={t('contacts.addresses', { defaultValue: 'Addresses' })}
        icon={MapPin}
        subtleTitle
        className="p-6"
      >
        {Array.isArray(contact.addresses) && contact.addresses.length > 0 ? (
          <div className="space-y-6">
            {contact.addresses.map((address: any, idx: number) => (
              <div
                key={address.id}
                className={cn('space-y-4', idx > 0 && 'border-t border-border/50 pt-6')}
              >
                <Badge
                  className={cn(
                    BADGE_CHIP_CLASS,
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                  )}
                >
                  {address.type || t('contacts.addressFallback', { defaultValue: 'Address' })}
                </Badge>
                <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-4">
                  {address.addressLine1 ? (
                    <div className="col-span-2">
                      <div className={FIELD_LABEL_CLASS}>Address</div>
                      <div className={FIELD_VALUE_CLASS}>
                        {[address.addressLine1, address.addressLine2].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  ) : null}
                  {address.postalCode || address.city ? (
                    <div>
                      <div className={FIELD_LABEL_CLASS}>Postal Code / City</div>
                      <div className={FIELD_VALUE_CLASS}>
                        {[address.postalCode, address.city].filter(Boolean).join(' ')}
                      </div>
                    </div>
                  ) : null}
                  {address.region ? (
                    <div>
                      <div className={FIELD_LABEL_CLASS}>Region</div>
                      <div className={FIELD_VALUE_CLASS}>{address.region}</div>
                    </div>
                  ) : null}
                  {address.country ? (
                    <div>
                      <div className={FIELD_LABEL_CLASS}>Country</div>
                      <div className={FIELD_VALUE_CLASS}>{address.country}</div>
                    </div>
                  ) : null}
                  {address.email ? (
                    <div>
                      <div className={FIELD_LABEL_CLASS}>Email</div>
                      <ContactCopyableLink value={address.email} href={mailtoHref(address.email)} />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={DETAIL_EMPTY_STATE_CLASS}>
            {t('contacts.noAddresses', { defaultValue: 'No addresses yet.' })}
          </p>
        )}
      </DetailSection>
    </Card>
  );

  const personsCard = (
    <Card padding="none" className={CARD_CLASS}>
      <DetailSection title={t('contacts.contactPersons')} icon={Users} subtleTitle className="p-6">
        {Array.isArray(contact.contactPersons) && contact.contactPersons.length > 0 ? (
          <div className="space-y-6">
            {contact.contactPersons.map((person: any, idx: number) => {
              const personInitials = (person.name || '')
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((n: string) => n[0].toUpperCase())
                .join('');
              const isInvoiceRef = isContactPersonInvoiceReference(
                contact.contactPersons,
                person.id,
              );
              return (
                <div
                  key={person.id}
                  className={cn('space-y-4', idx > 0 && 'border-t border-border/50 pt-6')}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-sm font-extrabold text-slate-700 dark:from-slate-700 dark:to-slate-600 dark:text-slate-300">
                      {personInitials || <User className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold tracking-tight text-foreground leading-tight">
                        {person.name || '—'}
                      </div>
                      {person.title ? (
                        <div className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                          {person.title}
                        </div>
                      ) : null}
                    </div>
                    <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={isInvoiceRef}
                        className={CHECKBOX_SM_CLASS}
                        onChange={(e) => {
                          void setContactPersonInvoiceReference(
                            contact,
                            String(person.id),
                            e.target.checked,
                          );
                        }}
                        aria-label={t('contacts.invoiceReferenceCheckbox', {
                          name: person.name || t('contacts.personFallback'),
                        })}
                      />
                      <span>{t('contacts.invoiceReferenceCheckboxLabel')}</span>
                    </label>
                  </div>
                  {person.email || person.phone ? (
                    <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8">
                      {person.email ? (
                        <div>
                          <div className={FIELD_LABEL_CLASS}>Email</div>
                          <ContactCopyableLink
                            value={person.email}
                            href={mailtoHref(person.email)}
                          />
                        </div>
                      ) : null}
                      {person.phone ? (
                        <div>
                          <div className={FIELD_LABEL_CLASS}>Phone</div>
                          <ContactCopyableLink value={person.phone} href={telHref(person.phone)} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('contacts.noContactPersons')}</p>
        )}
      </DetailSection>
    </Card>
  );

  const informationCard = (
    <Card padding="none" className={CARD_CLASS}>
      <DetailSection title={t('contacts.information')} icon={Info} subtleTitle className="p-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-4">
            <div>
              <div className={FIELD_LABEL_CLASS}>
                <span className="inline-flex items-center gap-1.5">
                  <Hash className="h-3 w-3" />
                  Contact #
                </span>
              </div>
              <div className={FIELD_VALUE_CLASS}>{contact.contactNumber || '—'}</div>
            </div>
            {isCompany ? (
              <div>
                <div className={FIELD_LABEL_CLASS}>Company type</div>
                <div className={FIELD_VALUE_CLASS}>
                  {formatCompanyTypeLabel(contact.companyType)}
                </div>
              </div>
            ) : (
              <div>
                <div className={FIELD_LABEL_CLASS}>{t('contacts.quickInfo.personalNumber')}</div>
                <div className={FIELD_VALUE_CLASS}>{contact.personalNumber || '—'}</div>
              </div>
            )}
            {isCompany ? (
              <>
                <div>
                  <div className={FIELD_LABEL_CLASS}>
                    {t('contacts.quickInfo.organizationNumber')}
                  </div>
                  <ContactCopyableLink value={contact.organizationNumber} />
                </div>
                <div>
                  <div className={FIELD_LABEL_CLASS}>VAT Number</div>
                  <div className={FIELD_VALUE_CLASS}>{contact.vatNumber || '—'}</div>
                </div>
              </>
            ) : null}
            <div>
              <div className={FIELD_LABEL_CLASS}>
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3 w-3" />
                  {t('contacts.quickInfo.email')}
                </span>
              </div>
              <ContactCopyableLink value={contact.email} href={mailtoHref(contact.email)} />
            </div>
            <div>
              <div className={FIELD_LABEL_CLASS}>
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-3 w-3" />
                  Website
                </span>
              </div>
              <ContactCopyableLink
                value={contact.website}
                href={websiteHref(contact.website)}
                openInNewTab
              />
            </div>
            <div>
              <div className={FIELD_LABEL_CLASS}>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />
                  Phone 1
                </span>
              </div>
              <ContactCopyableLink value={contact.phone} href={telHref(contact.phone)} />
            </div>
            <div>
              <div className={FIELD_LABEL_CLASS}>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />
                  Phone 2
                </span>
              </div>
              <ContactCopyableLink value={contact.phone2} href={telHref(contact.phone2)} />
            </div>
          </div>
          {contactNotes ? (
            <div>
              <div className={FIELD_LABEL_CLASS}>{t('contacts.relatedNotes')}</div>
              <div className={DETAIL_NOTE_CALLOUT_CLASS}>
                <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                  {contactNotes}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </DetailSection>
    </Card>
  );

  const propertiesCard = (
    <Card padding="none" className={CARD_CLASS}>
      <DetailSection
        title={t('contacts.contactProperties')}
        icon={SlidersHorizontal}
        subtleTitle
        className="p-6"
      >
        <div>
          <div className={PROP_ROW_CLASS}>
            <span className="text-sm text-slate-500 dark:text-slate-400">Tax rate</span>
            <span className={cn(FIELD_VALUE_CLASS, 'text-right')}>
              {isCompany ? (contact.taxRate ? `${contact.taxRate}%` : '—') : '0%'}
            </span>
          </div>
          <div className={PROP_ROW_CLASS}>
            <span className="text-sm text-slate-500 dark:text-slate-400">Payment terms</span>
            <span className={cn(FIELD_VALUE_CLASS, 'text-right')}>
              {contact.paymentTerms ? `${contact.paymentTerms} days` : '—'}
            </span>
          </div>
          <div className={PROP_ROW_CLASS}>
            <span className="text-sm text-slate-500 dark:text-slate-400">Currency</span>
            <span className={cn(FIELD_VALUE_CLASS, 'text-right')}>{contact.currency || '—'}</span>
          </div>
          {isCompany ? (
            <div className={PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">F-tax</span>
              <span className={cn(FIELD_VALUE_CLASS, 'text-right')}>
                {contact.fTax === 'yes' ? 'Registered' : 'No'}
              </span>
            </div>
          ) : null}
          <div className={PROP_ROW_CLASS}>
            <span className="text-sm text-slate-500 dark:text-slate-400">Assignable</span>
            <Select
              value={contact.isAssignable ? 'yes' : 'no'}
              onValueChange={(value) => {
                void setContactAssignable(contact, value === 'yes');
              }}
            >
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">{t('contacts.assignableYes')}</SelectItem>
                <SelectItem value="no">{t('contacts.assignableNo')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className={cn(PROP_ROW_CLASS, 'items-start')}>
            <span className="text-sm text-slate-500 dark:text-slate-400">Tags</span>
            <div className="flex min-w-0 max-w-[70%] flex-col items-end gap-1.5">
              <Select
                value={tagToAdd || '__add_tag__'}
                onValueChange={(value) => {
                  if (value && value !== '__add_tag__') {
                    if (isPanelContact) {
                      addTagToDraft(value);
                    } else {
                      void applyTagToContact(contact, value);
                    }
                    setTagToAdd('');
                  }
                }}
                disabled={addableTags.length === 0}
              >
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="Add a tag..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__add_tag__">
                    {addableTags.length === 0 ? 'No more tags to add' : 'Add a tag...'}
                  </SelectItem>
                  {addableTags.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isPanelContact && tagError ? (
                <p className="text-xs text-destructive">{tagError}</p>
              ) : null}
              {tagsShown.length > 0 ? (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {tagsShown.map((item: string) => (
                    <Badge
                      key={item}
                      variant="outline"
                      className="flex items-center gap-1 rounded-md border-border/60 bg-transparent text-xs font-medium text-foreground"
                    >
                      <Tag className="h-3 w-3" />
                      {item}
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-muted"
                        onClick={() => {
                          if (isPanelContact) {
                            removeTagFromDraft(item);
                          } else {
                            void removeTagFromContact(contact, item);
                          }
                        }}
                        aria-label={`Remove tag ${item}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">No tags</span>
              )}
            </div>
          </div>
        </div>
      </DetailSection>
    </Card>
  );

  const linkedCard = (
    <Card padding="none" className={CARD_CLASS}>
      <DetailSection
        title={
          <span className="inline-flex items-baseline gap-2">
            <span>{t('contacts.quickContext.linked')}</span>
            <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
              {t('contacts.quickContext.linkedHint')}
            </span>
          </span>
        }
        icon={Link2}
        subtleTitle
        className="p-6"
      >
        <ContactLinkedItemsSection
          contact={contact}
          previewLimit={null}
          showHeading={false}
          showHint={false}
        />
      </DetailSection>
    </Card>
  );

  return (
    <>
      <DetailLayout gridClassName="grid-cols-1">
        <div className="space-y-4">
          <ContactQuickContextPanel contact={contact} headerBelow={tabChips} />

          {activeTab === 'information' ? informationCard : null}
          {activeTab === 'properties' ? propertiesCard : null}
          {activeTab === 'addresses' ? addressesCard : null}
          {activeTab === 'persons' ? personsCard : null}
          {activeTab === 'linked' ? linkedCard : null}
          {activeTab === 'activity' ? (
            <DetailActivityLog
              entityType="contact"
              entityId={contact.id}
              limit={30}
              title={t('contacts.activity')}
              showClearButton
              refreshKey={String(contact.updatedAt ?? contact.id)}
              systemId={formatDisplayNumber('contacts', contact.id)}
            />
          ) : null}
        </div>
      </DetailLayout>

      <ConfirmDialog
        isOpen={showDiscardTagsDialog}
        title={t('dialog.unsavedChanges')}
        message={t('contacts.discardTagsMessage')}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
        onConfirm={onDiscardTagsAndClose}
        onCancel={() => setShowDiscardTagsDialog(false)}
        variant="warning"
      />

      <BulkMessageDialog
        isOpen={showSendMessageDialog}
        onClose={closeSendMessageDialog}
        recipients={sendMessageRecipients}
        pluginSource="contacts"
      />

      <BulkEmailDialog
        isOpen={showSendEmailDialog}
        onClose={closeSendEmailDialog}
        recipients={sendEmailRecipients}
        pluginSource="contacts"
      />
    </>
  );
});
