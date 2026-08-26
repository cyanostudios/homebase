import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useApp } from '@/core/api/AppContext';
import {
  EMPTY_ORGANIZATION,
  organizationApi,
  type OrganizationProfile,
} from '@/core/api/organizationApi';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import type { InvoiceLineItem } from '../types/invoices';
import { calculateInvoiceTotals } from '../types/invoices';
import { displayNameFromEmail, fetchLogoAsDataUrl } from '../utils/invoiceDocumentIdentity';
import { generateInvoiceWebHTML } from '../webTemplate';

export interface InvoicePreviewFormData {
  contactId?: string;
  contactName?: string;
  organizationNumber?: string;
  currency?: string;
  lineItems: InvoiceLineItem[];
  invoiceDiscount?: number;
  notes?: string;
  paymentTerms?: string;
  issueDate?: Date | string | null;
  dueDate?: Date | string | null;
  status?: string;
  invoiceType?: string;
}

interface InvoicePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  formData: InvoicePreviewFormData;
  /** Existing invoice id / number when editing a saved invoice. */
  invoiceId?: string | number | null;
  invoiceNumber?: string | number | null;
}

export function InvoicePreviewDialog({
  isOpen,
  onClose,
  formData,
  invoiceId,
  invoiceNumber,
}: InvoicePreviewDialogProps) {
  const { t } = useTranslation();
  const { user } = useApp();
  const [organization, setOrganization] = useState<OrganizationProfile>(EMPTY_ORGANIZATION);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const referencePerson = displayNameFromEmail(user?.email);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let cancelled = false;
    setLoadingOrg(true);
    setOrgError(null);
    organizationApi
      .getOrganization()
      .then(async (org) => {
        const logoUrl = org.logoUrl ? await fetchLogoAsDataUrl(org.logoUrl) : '';
        if (!cancelled) {
          setOrganization({ ...org, logoUrl: logoUrl || org.logoUrl || '' });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setOrgError(err instanceof Error ? err.message : 'Failed to load organization');
          setOrganization(EMPTY_ORGANIZATION);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingOrg(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const webHTML = useMemo(() => {
    const totals = calculateInvoiceTotals(formData.lineItems || [], formData.invoiceDiscount || 0);
    const numberLabel = invoiceNumber
      ? formatDisplayNumber('invoices', String(invoiceNumber))
      : invoiceId
        ? formatDisplayNumber('invoices', String(invoiceId))
        : t('invoices.previewDraftNumber', { defaultValue: 'DRAFT' });

    return generateInvoiceWebHTML({
      id: invoiceId || 'draft',
      invoiceNumber: numberLabel,
      contactName: formData.contactName,
      organizationNumber: formData.organizationNumber,
      currency: formData.currency || 'SEK',
      lineItems: formData.lineItems || [],
      invoiceDiscount: formData.invoiceDiscount || 0,
      notes: formData.notes,
      paymentTerms: formData.paymentTerms,
      issueDate: formData.issueDate,
      dueDate: formData.dueDate,
      status: formData.status,
      invoiceType: formData.invoiceType,
      ...totals,
      organization,
      referencePerson,
    });
  }, [formData, invoiceId, invoiceNumber, organization, referencePerson, t]);

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="flex h-[90vh] max-h-[90vh] w-[min(960px,95vw)] max-w-[960px] flex-col gap-3 overflow-hidden p-4 sm:rounded-lg">
        <AlertDialogHeader className="shrink-0 space-y-1 text-left">
          <AlertDialogTitle>
            {t('invoices.previewTitle', { defaultValue: 'Invoice preview' })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('invoices.previewHelp', {
              defaultValue: 'This is how the invoice will look when shared or exported as PDF.',
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-muted/30">
          {loadingOrg ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t('common.loading', { defaultValue: 'Loading…' })}
            </div>
          ) : (
            <iframe
              srcDoc={webHTML}
              className="h-full w-full border-none bg-white"
              title={t('invoices.previewTitle', { defaultValue: 'Invoice preview' })}
              sandbox="allow-scripts allow-same-origin"
            />
          )}
        </div>

        {orgError ? (
          <p className="shrink-0 text-xs text-amber-700 dark:text-amber-400">
            {t('invoices.previewOrgWarning', {
              defaultValue:
                'Could not load company details from Settings. Preview may be incomplete.',
            })}
          </p>
        ) : null}

        <AlertDialogFooter className="shrink-0">
          <AlertDialogCancel asChild>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.close')}
            </Button>
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
