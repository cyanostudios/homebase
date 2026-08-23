import { CheckCircle2, FileUp, Tags, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NativeSelect } from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { ImportWizard } from '@/core/ui/ImportWizard';
import { contactsApi } from '@/plugins/contacts/api/contactsApi';
import type { Contact } from '@/plugins/contacts/types/contacts';
import { CONTACTS_SETTINGS_KEY } from '@/plugins/contacts/utils/contactColumnCount';
import {
  collectContactTags,
  contactMatchesTagFilter,
} from '@/plugins/contacts/utils/contactListFilter';

import { getGarmentPersonImportSchema } from '../utils/personImportSchema';

type ImportStep = 'chooser' | 'contacts' | 'result';

function contactDisplayName(contact: Contact): string {
  return String(contact.companyName ?? '').trim();
}

export function GarmentPersonImportDialog({
  isOpen,
  onClose,
  listId,
  onImportRows,
}: {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
  onImportRows: (
    listId: string,
    rows: Record<string, string>[],
  ) => Promise<{ successCount: number; failureCount: number }>;
}) {
  const { t } = useTranslation();
  const { getSettings } = useApp();
  const personImportSchema = useMemo(() => getGarmentPersonImportSchema(t), [t]);

  const [step, setStep] = useState<ImportStep>('chooser');
  const [isFileWizardOpen, setIsFileWizardOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [settingsTags, setSettingsTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [result, setResult] = useState<{ successCount: number; failureCount: number } | null>(null);

  const reset = useCallback(() => {
    setStep('chooser');
    setIsFileWizardOpen(false);
    setSelectedTag('');
    setIsImporting(false);
    setLoadError(false);
    setResult(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const loadContacts = useCallback(async () => {
    setIsLoadingContacts(true);
    setLoadError(false);
    try {
      const [list, settings] = await Promise.all([
        contactsApi.getContacts() as Promise<Contact[]>,
        getSettings(CONTACTS_SETTINGS_KEY),
      ]);
      setContacts(Array.isArray(list) ? list : []);
      const tags = Array.isArray(settings?.tags)
        ? settings.tags.filter(
            (tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0,
          )
        : [];
      setSettingsTags(tags);
    } catch {
      setLoadError(true);
      setContacts([]);
      setSettingsTags([]);
    } finally {
      setIsLoadingContacts(false);
    }
  }, [getSettings]);

  const openContactsStep = () => {
    setStep('contacts');
    void loadContacts();
  };

  const availableTags = useMemo(() => {
    const fromContacts = collectContactTags(contacts);
    const merged = new Set([...settingsTags, ...fromContacts]);
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [contacts, settingsTags]);

  const matchingContacts = useMemo(() => {
    if (!selectedTag) {
      return [];
    }
    return contacts
      .filter((contact) => contactMatchesTagFilter(contact, selectedTag))
      .map((contact) => ({ id: contact.id, name: contactDisplayName(contact) }))
      .filter((row) => row.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, selectedTag]);

  const handleImportFromContacts = async () => {
    if (matchingContacts.length === 0) {
      return;
    }
    setIsImporting(true);
    try {
      const rows = matchingContacts.map((row) => ({ name: row.name, contactId: row.id }));
      const outcome = await onImportRows(listId, rows);
      setResult(outcome);
      setStep('result');
    } catch {
      setResult({ successCount: 0, failureCount: matchingContacts.length });
      setStep('result');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const showChooserOrContacts = isOpen && !isFileWizardOpen;

  return (
    <>
      <AlertDialog
        open={showChooserOrContacts}
        onOpenChange={(open) => {
          if (!open) {
            handleClose();
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {step === 'result'
                ? t('garments.importPersonsResultTitle')
                : step === 'contacts'
                  ? t('garments.importFromContactsTitle')
                  : t('garments.importPersonsTitle')}
            </AlertDialogTitle>
          </AlertDialogHeader>

          {step === 'chooser' ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                {t('garments.importPersonsDescription')}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto flex-col items-start gap-1 px-3 py-3 text-left"
                  onClick={() => setIsFileWizardOpen(true)}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <FileUp className="h-4 w-4" />
                    {t('garments.importFromFile')}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {t('garments.importFromFileHint')}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto flex-col items-start gap-1 px-3 py-3 text-left"
                  onClick={openContactsStep}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <Tags className="h-4 w-4" />
                    {t('garments.importFromContacts')}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {t('garments.importFromContactsHint')}
                  </span>
                </Button>
              </div>
            </div>
          ) : null}

          {step === 'contacts' ? (
            <div className="space-y-3 py-2">
              {isLoadingContacts ? (
                <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
              ) : loadError ? (
                <p className="text-sm text-destructive">{t('garments.importContactsLoadFailed')}</p>
              ) : availableTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('garments.importContactsNoTags')}
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor="garment-import-tag"
                    >
                      {t('garments.importContactsTag')}
                    </label>
                    <NativeSelect
                      id="garment-import-tag"
                      value={selectedTag || '__none__'}
                      onChange={(e) =>
                        setSelectedTag(e.target.value === '__none__' ? '' : e.target.value)
                      }
                      className="h-9 w-full"
                    >
                      <option value="__none__">{t('garments.importContactsTagPlaceholder')}</option>
                      {availableTags.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

                  {selectedTag ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {t('garments.importContactsMatchCount', {
                          count: matchingContacts.length,
                        })}
                      </div>
                      {matchingContacts.length > 0 ? (
                        <ScrollArea className="h-40 rounded-md border border-border px-3 py-2">
                          <ul className="space-y-1 text-sm">
                            {matchingContacts.map((row) => (
                              <li key={row.id} className="truncate">
                                {row.name}
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t('garments.importContactsNoMatches')}
                        </p>
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {step === 'result' && result ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm">
                {t('garments.importPersonsResult', {
                  success: result.successCount,
                  failed: result.failureCount,
                })}
              </p>
            </div>
          ) : null}

          <AlertDialogFooter>
            {step === 'chooser' ? (
              <AlertDialogCancel onClick={handleClose}>{t('common.cancel')}</AlertDialogCancel>
            ) : null}
            {step === 'contacts' ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setStep('chooser')}>
                  {t('common.back')}
                </Button>
                <AlertDialogCancel onClick={handleClose}>{t('common.cancel')}</AlertDialogCancel>
                <Button
                  type="button"
                  onClick={() => void handleImportFromContacts()}
                  disabled={
                    isImporting ||
                    isLoadingContacts ||
                    !selectedTag ||
                    matchingContacts.length === 0
                  }
                >
                  {isImporting
                    ? t('common.importing')
                    : t('garments.importContactsConfirm', { count: matchingContacts.length })}
                </Button>
              </>
            ) : null}
            {step === 'result' ? (
              <Button type="button" onClick={handleClose}>
                {t('common.close')}
              </Button>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportWizard
        isOpen={isFileWizardOpen}
        onClose={() => {
          setIsFileWizardOpen(false);
          handleClose();
        }}
        onBack={() => {
          setIsFileWizardOpen(false);
          setStep('chooser');
        }}
        onImport={(rows) => onImportRows(listId, rows)}
        schema={personImportSchema}
        title={t('garments.importPersonsTitle')}
      />
    </>
  );
}
