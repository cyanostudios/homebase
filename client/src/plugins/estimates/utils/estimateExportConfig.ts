import type { ExportFormatConfig } from '@/core/utils/exportUtils';
import type { Estimate } from '../types/estimate';
import { calculateEstimateTotals } from '../types/estimate';

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('sv-SE');
  } catch {
    return '';
  }
}

export function estimateToCsvRow(estimate: Estimate): Record<string, unknown> {
  const totals = calculateEstimateTotals(
    estimate.lineItems || [],
    estimate.estimateDiscount || 0,
  );
  return {
    estimateNumber: estimate.estimateNumber ?? '',
    contactName: estimate.contactName ?? '',
    currency: estimate.currency ?? '',
    total: totals.total,
    status: estimate.status ?? '',
    validTo: estimate.validTo
      ? estimate.validTo instanceof Date
        ? estimate.validTo.toISOString()
        : String(estimate.validTo)
      : '',
    createdAt: estimate.createdAt
      ? estimate.createdAt instanceof Date
        ? estimate.createdAt.toISOString()
        : String(estimate.createdAt)
      : '',
  };
}

export function estimateToPdfRow(estimate: Estimate): Record<string, unknown> {
  const totals = calculateEstimateTotals(
    estimate.lineItems || [],
    estimate.estimateDiscount || 0,
  );
  return {
    estimateNumber: estimate.estimateNumber ?? '',
    contactName: estimate.contactName ?? '',
    currency: estimate.currency ?? '',
    total: totals.total,
    status: estimate.status ?? '',
    validTo: formatDate(estimate.validTo),
    createdAt: formatDate(estimate.createdAt),
  };
}

export function getEstimateExportBaseFilename(estimate: Estimate): string {
  const name = (estimate.estimateNumber || 'estimate').replace(/[^a-z0-9]/gi, '_');
  return name.toLowerCase();
}

export const estimateExportConfig: ExportFormatConfig = {
  csv: {
    headers: [
      'estimateNumber',
      'contactName',
      'currency',
      'total',
      'status',
      'validTo',
      'createdAt',
    ],
    mapItemToRow: estimateToCsvRow,
  },
  pdf: {
    columns: [
      { key: 'estimateNumber', label: 'Estimate #' },
      { key: 'contactName', label: 'Contact' },
      { key: 'currency', label: 'Currency' },
      { key: 'total', label: 'Total' },
      { key: 'status', label: 'Status' },
      { key: 'validTo', label: 'Valid To' },
      { key: 'createdAt', label: 'Created' },
    ],
    mapItemToRow: estimateToPdfRow,
    title: 'Estimates Export',
  },
};
