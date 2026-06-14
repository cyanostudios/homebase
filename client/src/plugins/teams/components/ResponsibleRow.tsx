import { Mail, Phone, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Contact } from '@/plugins/contacts/types/contacts';

import type { Responsible, TeamColor } from '../types/teams';
import {
  RESPONSIBLE_ROLES,
  RESPONSIBLE_ROLE_BADGES,
  SERIES_TEAM_BADGE_NEUTRAL_STYLE,
  SERIES_TEAM_BADGE_STYLES,
  TEAM_HEADER_BADGE_CLASS,
} from '../types/teams';

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function SeriesTeamBadge({
  label,
  color = null,
  size = 'default',
}: {
  label: string;
  color?: TeamColor | null;
  size?: 'default' | 'header';
}) {
  return (
    <span
      className={cn(
        'inline-flex flex-shrink-0 items-center rounded-full font-medium',
        size === 'header' ? TEAM_HEADER_BADGE_CLASS : 'px-2 py-0.5 text-[10px]',
        color ? SERIES_TEAM_BADGE_STYLES[color] : SERIES_TEAM_BADGE_NEUTRAL_STYLE,
      )}
    >
      {label}
    </span>
  );
}

export function ResponsibleRow({
  responsible,
  contact,
  onOpenContact,
  onRemove,
  hasSeriesTeams = false,
  seriesTeamDisplayLabel,
  seriesTeamColor = null,
}: {
  responsible: Responsible;
  contact: Contact | null;
  onOpenContact?: () => void;
  onRemove?: () => void;
  /** When true, show a series-team badge next to the role (e.g. Vit, or whole team). */
  hasSeriesTeams?: boolean;
  /** Formatted series team label including level, when linked to a series team. */
  seriesTeamDisplayLabel?: string | null;
  seriesTeamColor?: TeamColor | null;
}) {
  const { t } = useTranslation();
  const name = contact?.companyName || `Contact ${responsible.contactId}`;
  const roleKey = RESPONSIBLE_ROLES.includes(responsible.role as any) ? responsible.role : 'other';
  const seriesTeamBadgeLabel = seriesTeamDisplayLabel?.trim()
    ? seriesTeamDisplayLabel.trim()
    : hasSeriesTeams
      ? t('teams.form.seriesTeamAll')
      : null;

  const phone = contact?.phone || contact?.phone2;
  const email = contact?.email?.trim();

  const phoneRow = phone ? (
    <a
      href={`tel:${phone.replace(/\s/g, '')}`}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-plugin hover:underline"
    >
      <Phone className="h-3 w-3" />
      {phone}
    </a>
  ) : null;

  const emailRow = email ? (
    <a
      href={`mailto:${email}`}
      className="inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-plugin hover:underline sm:max-w-[240px]"
    >
      <Mail className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">{email}</span>
    </a>
  ) : null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5">
      <button
        type="button"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
        onClick={onOpenContact}
        title={name}
      >
        {getInitials(name) || '?'}
      </button>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          className={cn(
            'truncate text-sm font-semibold',
            onOpenContact && 'hover:text-plugin hover:underline',
          )}
          onClick={onOpenContact}
        >
          {name}
        </button>
        <span
          className={cn(
            'inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
            RESPONSIBLE_ROLE_BADGES[roleKey as keyof typeof RESPONSIBLE_ROLE_BADGES],
          )}
        >
          {t(`teams.roles.${roleKey}`)}
        </span>
        {seriesTeamBadgeLabel ? (
          <SeriesTeamBadge label={seriesTeamBadgeLabel} color={seriesTeamColor} />
        ) : null}
        {phoneRow}
        {emailRow}
      </div>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 flex-shrink-0 px-2 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          title={t('teams.view.removeResponsible')}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
