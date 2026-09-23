import {
  Copy,
  Download,
  Edit,
  ExternalLink,
  Mail,
  Receipt,
  Send,
  Share,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { BulkEmailDialog, type BulkEmailRecipient } from '@/core/ui/BulkEmailDialog';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';

import { estimateShareApi, estimatesApi } from '../api/estimatesApi';
import { useEstimates } from '../hooks/useEstimates';
import type { Estimate } from '../types/estimate';
import {
  buildEstimateShareUrl,
  formatEstimateShareEmailHtml,
  formatEstimateShareEmailText,
} from '../utils/estimateShareEmail';

import { ShareDialog } from './ShareDialog';

export function EstimateDetailHeaderMenus({
  estimate,
  leading,
}: {
  estimate: Estimate;
  /** Optional leading content on the Actions/Export trigger row (e.g. estimate number). */
  leading?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { user, contacts } = useApp();
  const enabledPlugins = useEnabledPlugins();
  const {
    openEstimateForEdit,
    deleteEstimate,
    closeEstimatePanel,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedEstimateId,
    getDeleteMessage,
    convertEstimateToInvoice,
    isConvertingEstimateToInvoice,
    estimateShareExistingShare,
    estimateShareShowDialog,
    setEstimateShareShowDialog,
    estimateShareIsCreatingShare,
    syncEstimateShareForEstimate,
    openEstimateShareForItem,
    ensureEstimateShareForItem,
    requestStatusChange,
  } = useEstimates();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  const [sendEmailRecipients, setSendEmailRecipients] = useState<BulkEmailRecipient[]>([]);
  const [emailShareUrl, setEmailShareUrl] = useState<string | null>(null);
  const [isPreparingEmail, setIsPreparingEmail] = useState(false);

  const duplicateConfig = getDuplicateConfig(estimate);
  const canDuplicate = Boolean(duplicateConfig);
  const isInvoiced = estimate.status === 'invoiced';
  const invoicesEnabled = enabledPlugins.has('invoices');
  const canConvert = estimate.status === 'accepted' && invoicesEnabled && !isInvoiced;
  const canSend = (estimate.status || 'draft') === 'draft';
  const canSendEmail =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('mail'));
  const shareLinkLabel = t('estimates.emailEstimateLinkLabel', {
    defaultValue: 'Estimate link',
  });

  const shareMatchesEstimate =
    estimateShareExistingShare != null &&
    String(estimateShareExistingShare.estimateId) === String(estimate.id);
  const hasActiveShare =
    shareMatchesEstimate && new Date(estimateShareExistingShare.validUntil) > new Date();
  const shareUrl = shareMatchesEstimate
    ? estimateShareApi.generateShareUrl(estimateShareExistingShare.shareToken)
    : '';

  useEffect(() => {
    void syncEstimateShareForEstimate(estimate.id);
  }, [estimate.id, syncEstimateShareForEstimate]);

  const convertDisabledReason = (() => {
    if (isInvoiced) {
      return t('estimates.convertDisabledInvoiced', {
        defaultValue: 'This estimate has already been converted to an invoice.',
      });
    }
    if (!invoicesEnabled) {
      return t('estimates.convertDisabledInvoicesOff', {
        defaultValue: 'Enable the Invoices plugin to convert estimates.',
      });
    }
    if (estimate.status !== 'accepted') {
      return t('estimates.convertDisabledNotAccepted', {
        defaultValue: 'Only accepted estimates can be converted to an invoice.',
      });
    }
    return undefined;
  })();

  const handleDownloadPDF = async () => {
    setIsDownloadingPDF(true);
    try {
      await estimatesApi.downloadPDF(estimate.id);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const handleEmailEstimate = async () => {
    if (!canSendEmail || isPreparingEmail || estimateShareIsCreatingShare) {
      return;
    }
    setIsPreparingEmail(true);
    try {
      const share = await ensureEstimateShareForItem(estimate);
      if (!share) {
        return;
      }
      const url = buildEstimateShareUrl(share.shareToken);
      const contact =
        estimate.contactId != null
          ? contacts?.find((c) => String(c.id) === String(estimate.contactId))
          : undefined;
      const email = contact?.email ? String(contact.email).trim() : '';
      setSendEmailRecipients([
        {
          id: String(estimate.contactId || estimate.id),
          name: estimate.contactName || contact?.companyName || '',
          email,
        },
      ]);
      setEmailShareUrl(url);
      setShowSendEmailDialog(true);
    } finally {
      setIsPreparingEmail(false);
    }
  };

  const closeSendEmailDialog = () => {
    setShowSendEmailDialog(false);
    setSendEmailRecipients([]);
    setEmailShareUrl(null);
  };

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        disabled: isInvoiced,
        onClick: () => openEstimateForEdit(estimate),
      },
      {
        id: 'delete',
        icon: Trash2,
        label: t('common.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        onClick: () => setShowDeleteConfirm(true),
      },
    ];

    if (canDuplicate) {
      buttons.push({
        id: 'duplicate',
        icon: Copy,
        label: t('common.duplicate'),
        variant: 'secondary',
        contentClassName: 'text-green-600 dark:text-green-400',
        onClick: () => setShowDuplicateDialog(true),
      });
    }

    if (invoicesEnabled) {
      buttons.push({
        id: 'convert-to-invoice',
        icon: Receipt,
        label:
          !canConvert && convertDisabledReason
            ? convertDisabledReason
            : t('estimates.convertToInvoice', { defaultValue: 'Convert to invoice' }),
        variant: 'secondary',
        contentClassName: 'text-amber-700 dark:text-amber-400',
        disabled: !canConvert || isConvertingEstimateToInvoice,
        onClick: () => setShowConvertConfirm(true),
      });
    }

    return buttons;
  }, [
    canConvert,
    canDuplicate,
    convertDisabledReason,
    estimate,
    invoicesEnabled,
    isConvertingEstimateToInvoice,
    isInvoiced,
    openEstimateForEdit,
    t,
  ]);

  const exportActions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'export-pdf',
        icon: Download,
        label: isDownloadingPDF
          ? t('estimates.generatingPdf', { defaultValue: 'Generating PDF…' })
          : t('estimates.downloadPdf', { defaultValue: 'Download PDF' }),
        variant: 'successSoft',
        disabled: isDownloadingPDF,
        onClick: () => void handleDownloadPDF(),
      },
    ];

    if (canSendEmail) {
      buttons.push({
        id: 'email-estimate',
        icon: Mail,
        label:
          isPreparingEmail || estimateShareIsCreatingShare
            ? t('common.creating')
            : t('estimates.emailEstimate', { defaultValue: 'Email estimate' }),
        variant: 'soft',
        disabled: isPreparingEmail || estimateShareIsCreatingShare,
        onClick: () => void handleEmailEstimate(),
      });
    }

    buttons.push(
      hasActiveShare && estimateShareExistingShare
        ? {
            id: 'view-share',
            icon: ExternalLink,
            label: t('estimates.viewShare', { defaultValue: 'View share' }),
            variant: 'soft',
            onClick: () => {
              window.open(
                buildEstimateShareUrl(estimateShareExistingShare.shareToken),
                '_blank',
                'noopener,noreferrer',
              );
            },
          }
        : {
            id: 'share',
            icon: Share,
            label: estimateShareIsCreatingShare
              ? t('common.creating', { defaultValue: 'Creating…' })
              : t('estimates.shareEstimate', { defaultValue: 'Share estimate' }),
            variant: 'soft',
            disabled: estimateShareIsCreatingShare,
            onClick: () => void openEstimateShareForItem(estimate),
          },
    );

    return buttons;
  }, [
    canSendEmail,
    contacts,
    ensureEstimateShareForItem,
    estimate,
    estimateShareExistingShare,
    estimateShareIsCreatingShare,
    hasActiveShare,
    isDownloadingPDF,
    isPreparingEmail,
    openEstimateShareForItem,
    t,
  ]);

  const entityLabel = formatDisplayNumber('estimates', estimate.estimateNumber || estimate.id);
  return (
    <DetailHeaderMenus
      leading={leading}
      actions={actions}
      exportActions={exportActions}
      actionsLabel={t('common.headerActions')}
      exportLabel={t('common.headerExport')}
      beforeActions={
        canSend ? (
          <RoundIconLabelButton
            type="button"
            icon={Send}
            label={t('estimates.send', { defaultValue: 'Send' })}
            variant="soft"
            alwaysExpanded
            onClick={() => requestStatusChange('sent', estimate)}
          />
        ) : null
      }
    >
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('estimates.deleteTitle')}
        message={getDeleteMessage(estimate)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await deleteEstimate(estimate.id);
          closeEstimatePanel();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showConvertConfirm}
        title={t('estimates.convertToInvoiceTitle', { defaultValue: 'Convert to invoice?' })}
        message={t('estimates.convertToInvoiceMessage', {
          defaultValue:
            'Create a draft invoice from this estimate? The estimate will be marked as invoiced and can no longer be edited.',
          number: estimate.estimateNumber,
        })}
        confirmText={t('estimates.convertToInvoice', { defaultValue: 'Convert to invoice' })}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          setShowConvertConfirm(false);
          void convertEstimateToInvoice(estimate);
        }}
        onCancel={() => setShowConvertConfirm(false)}
        variant="warning"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(estimate, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedEstimateId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={duplicateConfig?.defaultName ?? ''}
        nameLabel={duplicateConfig?.nameLabel ?? t('nav.estimate')}
        confirmOnly={Boolean(duplicateConfig?.confirmOnly)}
      />

      <ShareDialog
        isOpen={estimateShareShowDialog}
        onClose={() => setEstimateShareShowDialog(false)}
        shareUrl={shareUrl}
        entityLabel={entityLabel}
        variant="estimate"
      />

      <BulkEmailDialog
        isOpen={showSendEmailDialog}
        onClose={closeSendEmailDialog}
        recipients={sendEmailRecipients}
        pluginSource="estimates"
        additionalText={
          emailShareUrl ? formatEstimateShareEmailText(emailShareUrl, shareLinkLabel) : undefined
        }
        additionalHtml={
          emailShareUrl ? formatEstimateShareEmailHtml(emailShareUrl, shareLinkLabel) : undefined
        }
        additionalPreview={
          emailShareUrl ? (
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                <span className="font-medium">{shareLinkLabel}:</span>
              </div>
              <div className="break-all font-mono">{emailShareUrl}</div>
            </div>
          ) : undefined
        }
      />
    </DetailHeaderMenus>
  );
}
