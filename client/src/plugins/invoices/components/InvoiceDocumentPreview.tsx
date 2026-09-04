import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import {
  EMPTY_ORGANIZATION,
  organizationApi,
  type OrganizationProfile,
} from '@/core/api/organizationApi';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import type { InvoiceLineItem } from '../types/invoices';
import {
  buildInvoiceCustomerBlock,
  displayNameFromEmail,
  fetchLogoAsDataUrl,
} from '../utils/invoiceDocumentIdentity';
import { resolveInvoiceTotals } from '../utils/invoiceTotals';
import { syncInvoicePreviewPageBreakGuides } from '../utils/invoicePreviewPageBreaks';
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
  orderNumber?: string;
  deliveryMethod?: string;
  issueDate?: Date | string | null;
  dueDate?: Date | string | null;
  status?: string;
  invoiceType?: string;
}

/** Intrinsic desktop document width used for width-based scaling (≈ A4 @ 96dpi). */
const PREVIEW_DOC_WIDTH = 794;
/** Fallback height before iframe content is measured. */
const PREVIEW_DOC_HEIGHT_FALLBACK = 1123;

interface InvoiceDocumentPreviewProps {
  formData: InvoicePreviewFormData;
  /** Existing invoice id / number when editing a saved invoice. */
  invoiceId?: string | number | null;
  invoiceNumber?: string | number | null;
  className?: string;
  /**
   * When true (default), scale the desktop document to the available width and
   * size the frame exactly to the scaled invoice content (no taller empty card).
   */
  contain?: boolean;
}

function measurePreviewContentHeight(iframe: HTMLIFrameElement | null): number | null {
  try {
    const doc = iframe?.contentDocument;
    if (!doc) {
      return null;
    }
    const page = doc.querySelector('.page') as HTMLElement | null;
    if (page) {
      const styles = doc.defaultView?.getComputedStyle(page);
      const marginTop = styles ? parseFloat(styles.marginTop) || 0 : 0;
      const marginBottom = styles ? parseFloat(styles.marginBottom) || 0 : 0;
      return Math.ceil(page.offsetHeight + marginTop + marginBottom);
    }
    const body = doc.body;
    if (!body) {
      return null;
    }
    return Math.ceil(Math.max(body.scrollHeight, body.offsetHeight));
  } catch {
    return null;
  }
}

/**
 * Live Facio-style invoice document preview (iframe). Used in edit/create column 2.
 */
export function InvoiceDocumentPreview({
  formData,
  invoiceId,
  invoiceNumber,
  className,
  contain = true,
}: InvoiceDocumentPreviewProps) {
  const { t } = useTranslation();
  const { user, contacts } = useApp();
  const [organization, setOrganization] = useState<OrganizationProfile>(EMPTY_ORGANIZATION);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);
  const referencePerson = displayNameFromEmail(user?.email);
  const deferredFormData = useDeferredValue(formData);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const [docHeight, setDocHeight] = useState(PREVIEW_DOC_HEIGHT_FALLBACK);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!contain) {
      return;
    }
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [contain]);

  const webHTML = useMemo(() => {
    const totals = resolveInvoiceTotals(deferredFormData);
    const numberLabel = invoiceNumber
      ? formatDisplayNumber('invoices', String(invoiceNumber))
      : invoiceId
        ? formatDisplayNumber('invoices', String(invoiceId))
        : t('invoices.previewDraftNumber', { defaultValue: 'DRAFT' });
    const contact =
      deferredFormData.contactId && contacts
        ? contacts.find((c) => String(c.id) === String(deferredFormData.contactId))
        : null;
    const customer = buildInvoiceCustomerBlock({
      contactName: deferredFormData.contactName,
      organizationNumber: deferredFormData.organizationNumber,
      contactId: deferredFormData.contactId,
      contact: contact || null,
    });

    return generateInvoiceWebHTML(
      {
        id: invoiceId || 'draft',
        invoiceNumber: numberLabel,
        contactName: deferredFormData.contactName,
        organizationNumber: deferredFormData.organizationNumber,
        currency: deferredFormData.currency || 'SEK',
        lineItems: deferredFormData.lineItems || [],
        invoiceDiscount: deferredFormData.invoiceDiscount || 0,
        notes: deferredFormData.notes,
        paymentTerms: deferredFormData.paymentTerms,
        orderNumber: deferredFormData.orderNumber,
        deliveryMethod: deferredFormData.deliveryMethod,
        issueDate: deferredFormData.issueDate,
        dueDate: deferredFormData.dueDate,
        status: deferredFormData.status,
        invoiceType: deferredFormData.invoiceType,
        ...totals,
        organization,
        referencePerson,
        customer,
      },
      { forceDesktop: true },
    );
  }, [contacts, deferredFormData, invoiceId, invoiceNumber, organization, referencePerson, t]);

  const refreshDocHeight = () => {
    const measured = measurePreviewContentHeight(iframeRef.current);
    if (measured && measured > 0) {
      setDocHeight(measured);
    }
    syncInvoicePreviewPageBreakGuides(iframeRef.current, {
      label: t('invoices.previewPageBreak', { defaultValue: 'Page break' }),
    });
  };

  useEffect(() => {
    if (!contain) {
      return;
    }
    // Reset tall enough to measure full content, then shrink on load/timeouts.
    setDocHeight(PREVIEW_DOC_HEIGHT_FALLBACK);
    const t1 = window.setTimeout(refreshDocHeight, 50);
    const t2 = window.setTimeout(refreshDocHeight, 250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [contain, webHTML]);

  // Fit to available width; frame height matches the scaled invoice content.
  const scale = contain && width > 0 ? Math.min(width / PREVIEW_DOC_WIDTH, 1) : 1;
  const scaledHeight = docHeight * scale;

  return (
    <div className={cn('min-w-0', className)}>
      <div
        ref={containerRef}
        className={cn(
          'relative w-full overflow-hidden bg-transparent',
          !contain && 'min-h-[640px] rounded-md border border-border bg-white',
        )}
        style={
          contain
            ? {
                height: width > 0 ? scaledHeight : undefined,
                aspectRatio: width > 0 ? undefined : `${PREVIEW_DOC_WIDTH} / ${docHeight}`,
              }
            : undefined
        }
      >
        {loadingOrg ? (
          <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            {t('common.loading', { defaultValue: 'Loading…' })}
          </div>
        ) : contain ? (
          <iframe
            ref={iframeRef}
            srcDoc={webHTML}
            width={PREVIEW_DOC_WIDTH}
            height={docHeight}
            className="block origin-top-left border-none bg-white"
            style={{
              width: PREVIEW_DOC_WIDTH,
              height: docHeight,
              transform: `scale(${scale})`,
            }}
            title={t('invoices.previewTitle', { defaultValue: 'Invoice preview' })}
            sandbox="allow-scripts allow-same-origin"
            onLoad={refreshDocHeight}
          />
        ) : (
          <iframe
            srcDoc={webHTML}
            className="h-full min-h-[640px] w-full border-none bg-white"
            title={t('invoices.previewTitle', { defaultValue: 'Invoice preview' })}
            sandbox="allow-scripts allow-same-origin"
          />
        )}
      </div>
      {orgError ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          {t('invoices.previewOrgWarning', {
            defaultValue:
              'Could not load company details from Settings. Preview may be incomplete.',
          })}
        </p>
      ) : null}
    </div>
  );
}
