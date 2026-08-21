import { ChevronRight } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { LIST_FILTER_CHIP_CLASS } from '@/core/ui/detailViewCardStyles';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';

export function ContactsDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { t } = useTranslation();
  const { contacts } = useContacts();

  const stats = useMemo(() => {
    const companies = contacts.filter((c) => c.contactType === 'company').length;
    const privateCount = contacts.filter((c) => c.contactType === 'private').length;
    const withTags = contacts.filter((c) => Array.isArray(c.tags) && c.tags.length > 0).length;
    return { companies, privateCount, withTags };
  }, [contacts]);

  return (
    <div className="flex h-full flex-col justify-between gap-3">
      <div>
        <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
          {contacts.length}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          {t('contacts.stats.total')}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            {stats.companies} {t('contacts.stats.companies')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            {stats.privateCount} {t('contacts.stats.private')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-50 px-2 py-1 text-[10px] font-medium text-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" aria-hidden />
            {stats.withTags} {t('contacts.stats.withTags')}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className={LIST_FILTER_CHIP_CLASS}
        onClick={(e) => {
          e.stopPropagation();
          onOpenPlugin();
        }}
      >
        {t('contacts.dashboardWidget.open')}
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
