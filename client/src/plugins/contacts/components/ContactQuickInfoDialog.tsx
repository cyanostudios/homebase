import { Check, Copy, ExternalLink, Mail, Phone, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

import type { Contact } from '../types/contacts';

function ContactDetailRow({
  icon: Icon,
  label,
  value,
  href,
  copyable = false,
  onCopySuccess,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  href?: string;
  copyable?: boolean;
  onCopySuccess?: () => void;
}) {
  const { t } = useTranslation();
  const trimmed = value?.trim() || '';

  const handleCopy = async () => {
    if (!trimmed) {
      return;
    }
    try {
      await navigator.clipboard.writeText(trimmed);
      onCopySuccess?.();
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="flex items-center gap-1">
          {href && trimmed ? (
            <a href={href} className="text-sm text-foreground hover:text-plugin hover:underline">
              {trimmed}
            </a>
          ) : (
            <span className="text-sm text-foreground">{trimmed || '—'}</span>
          )}
          {copyable && trimmed ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 flex-shrink-0 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
              title={t('contacts.quickInfo.copyToClipboard')}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Quick-info popup for a contact (copy email/phone + open contact). Same pattern as teams responsibles. */
export function ContactQuickInfoDialog({
  isOpen,
  contact,
  badges,
  onOpenContact,
  onClose,
}: {
  isOpen: boolean;
  contact: Contact | null;
  badges?: React.ReactNode;
  onOpenContact: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [copyConfirmed, setCopyConfirmed] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCopyConfirmed(false);
    }
  }, [isOpen]);

  const handleCopySuccess = () => {
    setCopyConfirmed(true);
    window.setTimeout(() => setCopyConfirmed(false), 2000);
  };

  if (!contact) {
    return null;
  }

  const isCompany = contact.contactType === 'company';
  const idLabel = isCompany
    ? t('contacts.quickInfo.organizationNumber')
    : t('contacts.quickInfo.personalNumber');
  const idValue = isCompany ? contact.organizationNumber : contact.personalNumber;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <User className="h-6 w-6 flex-shrink-0 text-primary" />
            <AlertDialogTitle>{contact.companyName}</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2">
              {badges ? <div className="flex flex-wrap items-center gap-1.5">{badges}</div> : null}
              <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/30 p-3">
                <ContactDetailRow icon={User} label={idLabel} value={idValue} />
                <ContactDetailRow
                  icon={Mail}
                  label={t('contacts.quickInfo.email')}
                  value={contact.email}
                  href={contact.email?.trim() ? `mailto:${contact.email.trim()}` : undefined}
                  copyable
                  onCopySuccess={handleCopySuccess}
                />
                <ContactDetailRow
                  icon={Phone}
                  label={t('contacts.quickInfo.phone')}
                  value={contact.phone || contact.phone2}
                  href={
                    (contact.phone || contact.phone2)?.trim()
                      ? `tel:${(contact.phone || contact.phone2)!.replace(/\s/g, '')}`
                      : undefined
                  }
                  copyable
                  onCopySuccess={handleCopySuccess}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {copyConfirmed ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              {t('contacts.quickInfo.copiedToClipboard')}
            </span>
          ) : (
            <span className="hidden sm:block sm:flex-1" aria-hidden />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel asChild>
              <Button variant="secondary" onClick={onClose}>
                {t('common.cancel')}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="default" icon={ExternalLink} onClick={onOpenContact}>
                {t('contacts.quickInfo.openContact')}
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
