import { UserCheck } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/select';
import { Heading } from '@/core/ui/Typography';

import type { Contact } from '../types/contacts';

type Phase = 'idle' | 'applying' | 'done';
type AssignableValue = 'yes' | 'no';

export interface ContactBulkAssignableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedContacts: Contact[];
  setContactAssignable: (contact: Contact, isAssignable: boolean) => Promise<boolean>;
  onSuccess?: () => void;
}

export function ContactBulkAssignableDialog({
  isOpen,
  onClose,
  selectedContacts,
  setContactAssignable,
  onSuccess,
}: ContactBulkAssignableDialogProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState<AssignableValue>('yes');
  const [phase, setPhase] = useState<Phase>('idle');
  const [updatedCount, setUpdatedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setValue('yes');
    setPhase('idle');
    setUpdatedCount(0);
    setFailedCount(0);
  }, [isOpen]);

  const handleApply = useCallback(async () => {
    if (selectedContacts.length === 0) {
      return;
    }

    const isAssignable = value === 'yes';
    setPhase('applying');
    setUpdatedCount(0);
    setFailedCount(0);

    let updated = 0;
    let failed = 0;
    for (const contact of selectedContacts) {
      try {
        const ok = await setContactAssignable(contact, isAssignable);
        if (ok) {
          updated += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
      setUpdatedCount(updated);
      setFailedCount(failed);
    }

    setPhase('done');
  }, [selectedContacts, setContactAssignable, value]);

  const handleClose = useCallback(() => {
    setPhase('idle');
    setUpdatedCount(0);
    setFailedCount(0);
    onClose();
  }, [onClose]);

  const handleDoneClose = useCallback(() => {
    onSuccess?.();
    handleClose();
  }, [handleClose, onSuccess]);

  if (!isOpen) {
    return null;
  }

  const count = selectedContacts.length;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={phase === 'applying' ? undefined : handleClose}
        aria-hidden="true"
      />
      <div className="absolute left-1/2 top-1/2 flex w-[92vw] max-w-lg max-h-[90vh] -translate-x-1/2 -translate-y-1/2 flex-col">
        <div className="flex max-h-full flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
          <div className="shrink-0 border-b p-4">
            <Heading level={3} className="mb-0 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-muted-foreground" />
              {t('contacts.bulkAssignableTitle')}
            </Heading>
            <div className="mt-1 text-xs text-muted-foreground">
              {t('contacts.bulkAssignableSubtitle', { count })}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-4 overflow-auto p-4">
            {phase === 'idle' && (
              <div className="space-y-2">
                <label
                  htmlFor="contacts-bulk-assignable"
                  className="text-sm font-medium text-foreground"
                >
                  {t('contacts.bulkAssignableLabel')}
                </label>
                <NativeSelect
                  id="contacts-bulk-assignable"
                  value={value}
                  onChange={(e) => setValue(e.target.value as AssignableValue)}
                >
                  <option value="yes">{t('contacts.bulkAssignableYes')}</option>
                  <option value="no">{t('contacts.bulkAssignableNo')}</option>
                </NativeSelect>
              </div>
            )}

            {phase === 'applying' && (
              <p className="text-sm text-muted-foreground">
                {t('contacts.bulkAssignableApplying', {
                  current: updatedCount + failedCount,
                  total: count,
                })}
              </p>
            )}

            {phase === 'done' && (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">{t('contacts.bulkAssignableDone')}</p>
                <p
                  className={
                    failedCount === 0
                      ? 'font-medium text-green-600 dark:text-green-400'
                      : updatedCount === 0
                        ? 'font-medium text-red-600 dark:text-red-400'
                        : 'font-medium text-yellow-600 dark:text-yellow-500'
                  }
                >
                  {t('contacts.bulkAssignableResult', {
                    updated: updatedCount,
                    failed: failedCount,
                  })}
                </p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t p-4">
            {phase === 'done' ? (
              <Button variant="secondary" size="sm" onClick={handleDoneClose}>
                {t('common.close')}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  disabled={phase === 'applying'}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleApply()}
                  disabled={phase === 'applying' || count === 0}
                >
                  {phase === 'applying'
                    ? t('contacts.bulkAssignableApplyingShort')
                    : t('contacts.bulkAssignableApply')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
