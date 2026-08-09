import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useContacts } from '@/plugins/contacts/hooks/useContacts';

import type { Responsible, Team } from '../types/teams';
import {
  RESPONSIBLE_ROLES,
  formatSeriesTeamLabel,
  getDisplaySeriesTeams,
  getSeriesTeamColorForName,
  getSeriesTeamKey,
  responsibleKey,
  type ResponsibleRole,
} from '../types/teams';

import { SeriesTeamBadge } from './ResponsibleRow';

function roleBadgeKey(role: string): ResponsibleRole {
  return RESPONSIBLE_ROLES.includes(role as ResponsibleRole) ? (role as ResponsibleRole) : 'other';
}

export function SeriesTeamsSection({ team }: { team: Team }) {
  const { t } = useTranslation();
  const { contacts } = useContacts();

  const contactById = useMemo(() => {
    const map = new Map<string, (typeof contacts)[number]>();
    for (const contact of contacts) {
      map.set(String(contact.id), contact);
    }
    return map;
  }, [contacts]);

  const seriesTeams = useMemo(
    () => getDisplaySeriesTeams(team.series_teams ?? [], team.series_team_count),
    [team.series_team_count, team.series_teams],
  );

  const { responsiblesBySeriesKey, wholeTeamResponsibles } = useMemo(() => {
    const map = new Map<string, Responsible[]>();
    const wholeTeam: Responsible[] = [];
    for (const responsible of team.responsibles ?? []) {
      const key = responsible.seriesTeam?.trim();
      if (!key) {
        // null / empty seriesTeam = whole team — show on every series-team row
        wholeTeam.push(responsible);
        continue;
      }
      const list = map.get(key) ?? [];
      list.push(responsible);
      map.set(key, list);
    }
    return { responsiblesBySeriesKey: map, wholeTeamResponsibles: wholeTeam };
  }, [team.responsibles]);

  if (seriesTeams.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('teams.view.noSeriesTeams')}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {seriesTeams.map((seriesTeam, index) => {
        const key = getSeriesTeamKey(seriesTeam);
        const badgeLabel = formatSeriesTeamLabel(seriesTeam) || t('teams.form.seriesTeamLabel');
        const seriesResponsibles = key ? (responsiblesBySeriesKey.get(key) ?? []) : [];
        const rowResponsibles = [...wholeTeamResponsibles, ...seriesResponsibles];

        return (
          <li
            key={`${key || 'series'}-${index}`}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-2.5"
          >
            <SeriesTeamBadge label={badgeLabel} color={getSeriesTeamColorForName(team, key)} />
            {rowResponsibles.map((responsible) => {
              const contact = contactById.get(String(responsible.contactId));
              const contactName = contact?.companyName || `Contact ${responsible.contactId}`;
              const roleKey = roleBadgeKey(String(responsible.role || 'other'));
              const isWholeTeam = !responsible.seriesTeam?.trim();
              const scopeLabel = isWholeTeam ? t('teams.form.seriesTeamAll') : badgeLabel;
              return (
                <span
                  key={responsibleKey(responsible)}
                  className="inline-flex max-w-full items-center truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  title={`${contactName} · ${t(`teams.roles.${roleKey}`)} · ${scopeLabel}`}
                >
                  {contactName}
                  <span className="mx-1 opacity-60">·</span>
                  {t(`teams.roles.${roleKey}`)}
                  {isWholeTeam ? (
                    <>
                      <span className="mx-1 opacity-60">·</span>
                      {t('teams.form.seriesTeamAll')}
                    </>
                  ) : null}
                </span>
              );
            })}
          </li>
        );
      })}
    </ul>
  );
}
