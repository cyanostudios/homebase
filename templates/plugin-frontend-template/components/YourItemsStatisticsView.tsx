/**
 * List empty-state statistics placeholder — title + one line only (no KPIs/charts).
 * See client/src/plugins/contacts/components/ContactsStatisticsView.tsx for production pattern.
 */
import { X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';

interface YourItemsStatisticsViewProps {
  onClose?: () => void;
}

export function YourItemsStatisticsView({ onClose }: YourItemsStatisticsViewProps = {}) {
  const { t } = useTranslation();

  useMobileBarOverride(onClose ? { onClose } : null);

  return (
    <div className="space-y-4">
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>Your items</h2>
        </div>
        {onClose ? (
          <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
            <RoundIconLabelButton
              type="button"
              icon={X}
              label={t('common.close')}
              variant="secondary"
              alwaysExpanded
              onClick={onClose}
            />
          </div>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        Select an item from the list to preview it here, or add a new item.
      </p>
    </div>
  );
}
