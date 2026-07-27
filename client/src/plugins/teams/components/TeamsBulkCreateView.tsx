import { ListPlus, Loader2, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { teamsApi } from '../api/teamsApi';
import { useTeams } from '../hooks/useTeams';
import type { Team } from '../types/teams';
import { TEAM_GENDERS, TEAM_PLAYING_FORMATS, TEAM_STATUSES } from '../types/teams';
import { EXTERNAL_TEAM_NONE_VALUE } from '../utils/externalTeamOptions';
import { getNamedBulkRows, retainFailedOrEmptyBulkRows } from '../utils/teamsBulkCreate';

type BulkRow = {
  id: string;
  name: string;
  age_group: string;
  gender: Team['gender'] | '';
  playing_format: Team['playing_format'] | '';
  status: Team['status'];
  error?: string;
};

function createEmptyRow(): BulkRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: '',
    age_group: '',
    gender: '',
    playing_format: '',
    status: 'active',
  };
}

interface TeamsBulkCreateViewProps {
  inlineTrailing?: React.ReactNode;
}

export function TeamsBulkCreateView({ inlineTrailing }: TeamsBulkCreateViewProps = {}) {
  const { t } = useTranslation();
  const { refreshTeams, closeTeamBulkCreate } = useTeams();
  const [rows, setRows] = useState<BulkRow[]>(() =>
    Array.from({ length: 5 }, () => createEmptyRow()),
  );
  const [isCreating, setIsCreating] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const validCount = useMemo(() => getNamedBulkRows(rows).length, [rows]);

  const updateRow = useCallback((id: string, patch: Partial<BulkRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch, error: undefined } : row)),
    );
    setDoneMessage(null);
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow()]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)));
  }, []);

  const handleCreateAll = useCallback(async () => {
    const pending = getNamedBulkRows(rows);
    if (!pending.length || isCreating) {
      return;
    }

    setIsCreating(true);
    setDoneMessage(null);
    let createdCount = 0;
    const failedIds = new Set<string>();
    const errorsById = new Map<string, string>();

    for (const row of pending) {
      try {
        await teamsApi.createTeam({
          name: row.name.trim(),
          age_group: row.age_group.trim() || null,
          gender: row.gender || undefined,
          playing_format: row.playing_format || null,
          status: row.status,
        });
        createdCount += 1;
      } catch (error: unknown) {
        failedIds.add(row.id);
        const message =
          error instanceof Error && error.message ? error.message : t('teams.bulkCreateRowError');
        errorsById.set(row.id, message);
      }
    }

    await refreshTeams();

    if (failedIds.size === 0) {
      setDoneMessage(t('teams.bulkCreateDone', { count: createdCount }));
      setIsCreating(false);
      closeTeamBulkCreate();
      return;
    }

    setRows((prev) =>
      retainFailedOrEmptyBulkRows(prev, failedIds).map((row) =>
        failedIds.has(row.id)
          ? { ...row, error: errorsById.get(row.id) || t('teams.bulkCreateRowError') }
          : row,
      ),
    );
    if (createdCount > 0) {
      setDoneMessage(t('teams.bulkCreateDone', { count: createdCount }));
    }
    setIsCreating(false);
  }, [closeTeamBulkCreate, isCreating, refreshTeams, rows, t]);

  return (
    <div className="space-y-4">
      <div className="flex flex-shrink-0 items-center justify-between gap-4">
        <div className="mr-4 flex min-w-0 flex-1 items-center gap-3">
          <ListPlus className="h-5 w-5 shrink-0 text-plugin" />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {t('teams.bulkCreateTitle')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('teams.bulkCreateDescription')}</p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">{inlineTrailing}</div>
      </div>

      <Card padding="none" className="overflow-hidden border border-border/70 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40">
                <th className="px-3 py-2 font-medium text-muted-foreground">
                  {t('teams.form.nameLabel')} *
                </th>
                <th className="px-3 py-2 font-medium text-muted-foreground">
                  {t('teams.form.ageGroupLabel')}
                </th>
                <th className="w-36 px-3 py-2 font-medium text-muted-foreground">
                  {t('teams.form.genderLabel')}
                </th>
                <th className="w-32 px-3 py-2 font-medium text-muted-foreground">
                  {t('teams.form.playingFormatLabel')}
                </th>
                <th className="w-32 px-3 py-2 font-medium text-muted-foreground">
                  {t('teams.form.statusLabel')}
                </th>
                <th className="w-10 px-2 py-2" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-border/50 last:border-b-0',
                    row.error && 'bg-destructive/5',
                  )}
                >
                  <td className="px-3 py-1.5 align-top">
                    <Input
                      value={row.name}
                      onChange={(event) => updateRow(row.id, { name: event.target.value })}
                      placeholder={t('teams.bulkNamePlaceholder')}
                      className="h-8 text-xs"
                      disabled={isCreating}
                    />
                    {row.error ? (
                      <p className="mt-1 text-[10px] text-destructive">{row.error}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    <Input
                      value={row.age_group}
                      onChange={(event) => updateRow(row.id, { age_group: event.target.value })}
                      placeholder={t('teams.bulkAgeGroupPlaceholder')}
                      className="h-8 text-xs"
                      disabled={isCreating}
                    />
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    <Select
                      value={row.gender || EXTERNAL_TEAM_NONE_VALUE}
                      onValueChange={(value) =>
                        updateRow(row.id, {
                          gender:
                            value === EXTERNAL_TEAM_NONE_VALUE ? '' : (value as Team['gender']),
                        })
                      }
                      disabled={isCreating}
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue placeholder={t('teams.form.genderPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EXTERNAL_TEAM_NONE_VALUE}>
                          {t('teams.form.genderNone')}
                        </SelectItem>
                        {TEAM_GENDERS.map((gender) => (
                          <SelectItem key={gender} value={gender}>
                            {t(`teams.gender.${gender}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    <Select
                      value={row.playing_format || EXTERNAL_TEAM_NONE_VALUE}
                      onValueChange={(value) =>
                        updateRow(row.id, {
                          playing_format:
                            value === EXTERNAL_TEAM_NONE_VALUE
                              ? ''
                              : (value as Team['playing_format']),
                        })
                      }
                      disabled={isCreating}
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue placeholder={t('teams.form.playingFormatPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EXTERNAL_TEAM_NONE_VALUE}>
                          {t('teams.form.playingFormatNone')}
                        </SelectItem>
                        {TEAM_PLAYING_FORMATS.map((format) => (
                          <SelectItem key={format} value={format}>
                            {format}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    <Select
                      value={row.status}
                      onValueChange={(value) =>
                        updateRow(row.id, { status: value as Team['status'] })
                      }
                      disabled={isCreating}
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEAM_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {t(`teams.status.${status}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="h-8 w-8 px-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(row.id)}
                      disabled={isCreating || rows.length <= 1}
                      title={t('common.delete')}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={Plus}
          className="h-9 px-3 text-xs"
          onClick={addRow}
          disabled={isCreating}
        >
          {t('teams.bulkCreateAddRow')}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {doneMessage ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">{doneMessage}</p>
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="h-9 px-3 text-xs"
            onClick={() => void handleCreateAll()}
            disabled={isCreating || validCount === 0}
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                {t('teams.bulkCreateAdding')}
              </>
            ) : (
              `${t('teams.bulkCreateFinish')} (${validCount})`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
