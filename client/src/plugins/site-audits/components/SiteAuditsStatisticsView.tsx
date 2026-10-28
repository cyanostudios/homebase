/**
 * List empty-detail-pane placeholder — see client/src/plugins/ingest/components/IngestStatisticsView.tsx.
 * No etapp-1 analytics/KPIs — see docs/ai/design/SITE_AUDITS_UX.md "Non-goals".
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';

export function SiteAuditsStatisticsView() {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.site-audits')}</h2>
      <p className="text-sm text-muted-foreground">{t('siteAudits.selectToPreview')}</p>
    </div>
  );
}
