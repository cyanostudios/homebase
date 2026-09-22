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
import {
  buildInvoiceCustomerBlock,
  displayNameFromEmail,
  fetchLogoAsDataUrl,
} from '@/plugins/invoices/utils/invoiceDocumentIdentity';
import { syncInvoicePreviewPageBreakGuides } from '@/plugins/invoices/utils/invoicePreviewPageBreaks';

import { calculateEstimateTotals, type LineItem } from '../types/estimate';
import { generateWebHTML } from '../webTemplate';

export interface EstimatePreviewFormData {
  contactId?: string;
  contactName?: string;
  organizationNumber?: string;
  currency?: string;
  lineItems: LineItem[];
  estimateDiscount?: number;
  notes?: string;
  orderNumber?: string;
  deliveryMethod?: string;
  validTo?: Date | string | null;
  status?: string;
}

const PREVIEW_DOC_WIDTH = 794;
const PREVIEW_DOC_HEIGHT_FALLBACK = 1123;

function measurePreviewContentHeight(iframe: HTMLIFrameElement | null): number | null {
  try {
    const doc = iframe?.contentDocument;
    if (!doc) {
      return null;
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

export function EstimateDocumentPreview({
  formData,
  estimateId,
  estimateNumber,
  className,
  contain = true,
}: {
  formData: EstimatePreviewFormData;
  estimateId?: string | number | null;
  estimateNumber?: string | number | null;
  className?: string;
  contain?: boolean;
}) {
  const { t } = useTranslation();
  const { user, contacts } = useApp();
  const [organization, setOrganization] = useState<OrganizationProfile>(EMPTY_ORGANIZATION);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const deferredFormData = useDeferredValue(formData);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const [docHeight, setDocHeight] = useState(PREVIEW_DOC_HEIGHT_FALLBACK);

  useEffect(() => {
    let cancelled = false;
    setLoadingOrg(true);
    organizationApi
      .getOrganization()
      .then(async (org) => {
        const logoUrl = org.logoUrl ? await fetchLogoAsDataUrl(org.logoUrl) : '';
        if (!cancelled) {
          setOrganization({ ...org, logoUrl: logoUrl || org.logoUrl || '' });
        }
      })
      .catch(() => {
        if (!cancelled) {
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
      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [contain]);

  const webHTML = useMemo(() => {
    const totals = calculateEstimateTotals(
      deferredFormData.lineItems || [],
      deferredFormData.estimateDiscount ?? 0,
    );
    const numberLabel = estimateNumber
      ? formatDisplayNumber('estimates', String(estimateNumber))
      : estimateId
        ? formatDisplayNumber('estimates', String(estimateId))
        : t('estimates.previewDraftNumber', { defaultValue: 'DRAFT' });
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

    return generateWebHTML(
      {
        id: estimateId || 'draft',
        estimateNumber: numberLabel,
        contactName: deferredFormData.contactName,
        organizationNumber: deferredFormData.organizationNumber,
        currency: deferredFormData.currency || 'SEK',
        lineItems: deferredFormData.lineItems || [],
        estimateDiscount: deferredFormData.estimateDiscount || 0,
        notes: deferredFormData.notes,
        orderNumber: deferredFormData.orderNumber,
        deliveryMethod: deferredFormData.deliveryMethod,
        validTo: deferredFormData.validTo,
        status: deferredFormData.status,
        createdAt: new Date(),
        ...totals,
        organization,
        referencePerson: displayNameFromEmail(user?.email),
        customer,
      },
      { forceDesktop: true },
    );
  }, [contacts, deferredFormData, estimateId, estimateNumber, organization, user?.email, t]);

  const refreshDocHeight = () => {
    const measured = measurePreviewContentHeight(iframeRef.current);
    if (measured && measured > 0) {
      setDocHeight(measured);
    }
    syncInvoicePreviewPageBreakGuides(iframeRef.current, {
      label: t('estimates.previewPageBreak', { defaultValue: 'Page break' }),
    });
  };

  useEffect(() => {
    if (!contain) {
      return;
    }
    setDocHeight(PREVIEW_DOC_HEIGHT_FALLBACK);
    const t1 = window.setTimeout(refreshDocHeight, 50);
    const t2 = window.setTimeout(refreshDocHeight, 250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [contain, webHTML]);

  const scale = contain && width > 0 ? Math.min(width / PREVIEW_DOC_WIDTH, 1) : 1;
  const scaledWidth = PREVIEW_DOC_WIDTH * scale;
  const scaledHeight = docHeight * scale;
  const offsetX = contain && width > 0 ? Math.max(0, (width - scaledWidth) / 2) : 0;

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
        ) : (
          <iframe
            ref={iframeRef}
            srcDoc={webHTML}
            width={PREVIEW_DOC_WIDTH}
            height={docHeight}
            scrolling="no"
            className="block origin-top-left border-none bg-white"
            style={{
              width: PREVIEW_DOC_WIDTH,
              height: docHeight,
              transform: contain ? `translateX(${offsetX}px) scale(${scale})` : undefined,
              overflow: 'hidden',
            }}
            title={t('estimates.previewTitle', { defaultValue: 'Estimate preview' })}
            sandbox="allow-scripts allow-same-origin"
            onLoad={refreshDocHeight}
          />
        )}
      </div>
    </div>
  );
}
