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
import { cn } from '@/lib/utils';
import type { Contact } from '@/plugins/contacts/types/contacts';

import {
  getSeriesTeamColorForName,
  getSeriesTeamDisplayLabel,
  RESPONSIBLE_ROLES,
  RESPONSIBLE_ROLE_BADGES,
} from '../types/teams';
import type { SeriesTeam } from '../types/teams';

import { SeriesTeamBadge } from './ResponsibleRow';

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
              title={t('teams.view.copyToClipboard')}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ResponsibleContactDialog({
  isOpen,
  contact,
  role,
  seriesTeam,
  seriesTeams = [],
  hasSeriesTeams = false,
  onOpenContact,
  onClose,
}: {
  isOpen: boolean;
  contact: Contact | null;
  role?: string;
  seriesTeam?: string | null;
  seriesTeams?: SeriesTeam[];
  hasSeriesTeams?: boolean;
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

  const roleKey = role && RESPONSIBLE_ROLES.includes(role as any) ? role : 'other';
  const isCompany = contact.contactType === 'company';
  const idLabel = isCompany
    ? t('teams.view.responsibleOrganizationNumber')
    : t('teams.view.responsiblePersonalNumber');
  const idValue = isCompany ? contact.organizationNumber : contact.personalNumber;
  const seriesTeamBadgeLabel =
    getSeriesTeamDisplayLabel({ series_teams: seriesTeams }, seriesTeam) ??
    (hasSeriesTeams ? t('teams.form.seriesTeamAll') : null);
  const seriesTeamBadgeColor = getSeriesTeamColorForName({ series_teams: seriesTeams }, seriesTeam);

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
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                    RESPONSIBLE_ROLE_BADGES[roleKey as keyof typeof RESPONSIBLE_ROLE_BADGES],
                  )}
                >
                  {t(`teams.roles.${roleKey}`)}
                </span>
                {seriesTeamBadgeLabel ? (
                  <SeriesTeamBadge label={seriesTeamBadgeLabel} color={seriesTeamBadgeColor} />
                ) : null}
              </div>
              <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/30 p-3">
                <ContactDetailRow icon={User} label={idLabel} value={idValue} />
                <ContactDetailRow
                  icon={Mail}
                  label={t('teams.view.responsibleEmail')}
                  value={contact.email}
                  href={contact.email?.trim() ? `mailto:${contact.email.trim()}` : undefined}
                  copyable
                  onCopySuccess={handleCopySuccess}
                />
                <ContactDetailRow
                  icon={Phone}
                  label={t('teams.view.responsiblePhone')}
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
              {t('teams.view.copiedToClipboard')}
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
                {t('teams.view.openContact')}
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
