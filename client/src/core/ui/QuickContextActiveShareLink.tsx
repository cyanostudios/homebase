import { Check, Copy, ExternalLink } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';

/**
 * Compact active-share row for list quick context: URL + Copy / View only.
 * Create / revoke / expiry stay in full view.
 */
export function QuickContextActiveShareLink({
  shareUrl,
  activeLabel,
}: {
  shareUrl: string;
  activeLabel: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
      <div className="mb-2 text-xs font-medium text-blue-900 dark:text-blue-400">{activeLabel}</div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate rounded border border-gray-200 bg-white px-2 py-1.5 font-mono text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          {shareUrl}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <RoundIconLabelButton
            type="button"
            icon={copied ? Check : Copy}
            label={copied ? t('common.copied') : t('common.copy')}
            variant={copied ? 'success' : 'soft'}
            onClick={handleCopy}
          />
          <RoundIconLabelButton
            type="button"
            icon={ExternalLink}
            label={t('common.view')}
            variant="soft"
            onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}
          />
        </div>
      </div>
    </div>
  );
}
