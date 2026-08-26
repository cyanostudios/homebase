import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { ContactQuickInfoDialog } from '@/plugins/contacts/components/ContactQuickInfoDialog';
import type { Contact } from '@/plugins/contacts/types/contacts';

import {
  getSeriesTeamColorForName,
  getSeriesTeamDisplayLabel,
  RESPONSIBLE_ROLES,
  RESPONSIBLE_ROLE_BADGES,
} from '../types/teams';
import type { SeriesTeam } from '../types/teams';

import { SeriesTeamBadge } from './ResponsibleRow';

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
  const roleKey = role && RESPONSIBLE_ROLES.includes(role as any) ? role : 'other';
  const seriesTeamBadgeLabel =
    getSeriesTeamDisplayLabel({ series_teams: seriesTeams }, seriesTeam) ??
    (hasSeriesTeams ? t('teams.form.seriesTeamAll') : null);
  const seriesTeamBadgeColor = getSeriesTeamColorForName({ series_teams: seriesTeams }, seriesTeam);

  return (
    <ContactQuickInfoDialog
      isOpen={isOpen}
      contact={contact}
      onOpenContact={onOpenContact}
      onClose={onClose}
      badges={
        <>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold',
              RESPONSIBLE_ROLE_BADGES[roleKey as keyof typeof RESPONSIBLE_ROLE_BADGES],
            )}
          >
            {t(`teams.roles.${roleKey}`)}
          </span>
          {seriesTeamBadgeLabel ? (
            <SeriesTeamBadge label={seriesTeamBadgeLabel} color={seriesTeamBadgeColor} />
          ) : null}
        </>
      }
    />
  );
}
