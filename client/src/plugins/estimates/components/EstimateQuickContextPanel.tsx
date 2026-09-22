import { User, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import {
  DETAIL_HEADER_BELOW_MENUS_CLASS,
  DETAIL_HEADER_CHIP_GAP_CLASS,
} from '@/core/ui/DetailHeaderMenus';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { formatInvoiceMoney } from '@/plugins/invoices/utils/formatInvoiceAmount';
import { CONTACT_TYPE_ICON_SHELL_CLASS } from '@/plugins/contacts/types/contacts';
import { cn } from '@/lib/utils';

import {
  ESTIMATE_STATUS_COLORS,
  formatEstimateStatusForDisplay,
  type Estimate,
} from '../types/estimate';
import { resolveEstimateTotals } from '../utils/estimateTotals';

import { EstimateDetailHeaderMenus } from './EstimateDetailHeaderMenus';
import { ESTIMATE_STATUS_BADGE_CLASS } from './EstimateStatusSelect';

/**
 * Contacts-class header card only (title + menus + optional tab chips).
 * Estimate facts live on the Information tab in EstimateView — not here.
 */
export function EstimateQuickContextPanel({
  estimate,
  headerBelow = null,
}: {
  estimate: Estimate;
  headerBelow?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { contacts } = useApp();
  const status = estimate.status || 'draft';
  const numberLabel = formatDisplayNumber('estimates', estimate.estimateNumber || estimate.id);
  const currency = estimate.currency || 'SEK';
  const totals = resolveEstimateTotals(estimate);
  const totalLabel = formatInvoiceMoney(totals.total, currency);
  const contactName = estimate.contactName?.trim() || '';
  const updatedLabel = estimate.updatedAt ? formatDateTimeShort(estimate.updatedAt) : null;

  const contactType = (() => {
    if (estimate.contactId == null) {
      return undefined;
    }
    const contact = contacts?.find((c) => String(c.id) === String(estimate.contactId));
    if (!contact?.contactType) {
      return undefined;
    }
    return contact.contactType === 'private' ? 'private' : 'company';
  })();
  const ContactTypeIcon =
    contactType === 'private' ? User : contactType === 'company' ? Users : null;
  const contactTypeLabel = contactType
    ? t(`contacts.type.${contactType}`, {
        defaultValue: contactType === 'private' ? 'Private' : 'Company',
      })
    : null;

  const titleLeading = (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 font-mono')}>{numberLabel}</h3>
        <Badge
          className={cn(
            'shrink-0',
            ESTIMATE_STATUS_BADGE_CLASS,
            ESTIMATE_STATUS_COLORS[status as keyof typeof ESTIMATE_STATUS_COLORS] ||
              ESTIMATE_STATUS_COLORS.draft,
          )}
        >
          {formatEstimateStatusForDisplay(status)}
        </Badge>
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        {ContactTypeIcon ? (
          <span title={contactTypeLabel ?? undefined} className="inline-flex shrink-0">
            <SectionCategoryIcon
              icon={ContactTypeIcon}
              className={contactType ? CONTACT_TYPE_ICON_SHELL_CLASS[contactType] : undefined}
            />
          </span>
        ) : null}
        <span className="min-w-0 truncate text-sm font-normal leading-tight text-slate-400 dark:text-slate-500">
          {contactName || t('estimates.noCustomer', { defaultValue: 'No customer' })}
        </span>
        {totalLabel ? (
          <span className="shrink-0 tabular-nums text-sm font-normal leading-tight text-slate-400 dark:text-slate-500">
            {totalLabel}
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <Card
      padding="none"
      className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-estimates flex flex-col')}
      data-plugin-name="estimates"
    >
      <div className="px-4 py-5">
        <EstimateDetailHeaderMenus estimate={estimate} leading={titleLeading} />
        {updatedLabel ? (
          <div
            className={cn(
              DETAIL_HEADER_BELOW_MENUS_CLASS,
              'flex min-w-0 flex-wrap items-center',
              DETAIL_HEADER_CHIP_GAP_CLASS,
            )}
          >
            <p className="min-w-0 text-xs text-muted-foreground">
              {t('common.updated')} {updatedLabel}
            </p>
          </div>
        ) : null}
        {headerBelow ? <div className="mt-4">{headerBelow}</div> : null}
      </div>
    </Card>
  );
}
