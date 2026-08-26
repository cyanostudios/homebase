/**
 * Due-date urgency formatting for invoices (mirrors Tasks formatDueDate).
 * Payment terms (days) drive due date from issue date.
 */

export type InvoiceDueDateDisplay = {
  text: string;
  className: string;
  badgeClassName: string;
};

const BADGE_SHELL = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';

/** Extract day count from contact-style ("30") or free-text ("30 dagar netto") payment terms. */
export function parsePaymentTermsDays(
  paymentTerms: string | number | null | undefined,
): number | null {
  if (paymentTerms === null || paymentTerms === undefined) {
    return null;
  }
  if (typeof paymentTerms === 'number' && Number.isFinite(paymentTerms)) {
    return Math.max(0, Math.floor(paymentTerms));
  }
  const raw = String(paymentTerms).trim();
  if (!raw) {
    return null;
  }
  if (/^\d+$/.test(raw)) {
    return Math.max(0, parseInt(raw, 10));
  }
  const match = raw.match(/(\d+)/);
  if (!match) {
    return null;
  }
  return Math.max(0, parseInt(match[1], 10));
}

/** dueDate = issueDate + payment-term days (noon local to avoid DST edge cases). */
export function computeDueDateFromPaymentTerms(
  issueDate: Date | string | null | undefined,
  paymentTerms: string | number | null | undefined,
): Date | null {
  if (!issueDate) {
    return null;
  }
  const issue = issueDate instanceof Date ? new Date(issueDate) : new Date(issueDate);
  if (Number.isNaN(issue.getTime())) {
    return null;
  }
  const days = parsePaymentTermsDays(paymentTerms);
  if (days === null) {
    return null;
  }
  const due = new Date(issue);
  due.setHours(12, 0, 0, 0);
  due.setDate(due.getDate() + days);
  return due;
}

export function formatPaymentTermsLabel(paymentTerms: string | number | null | undefined): string {
  const days = parsePaymentTermsDays(paymentTerms);
  if (days === null) {
    const raw =
      paymentTerms !== null && paymentTerms !== undefined ? String(paymentTerms).trim() : '';
    return raw || '—';
  }
  if (days === 0) {
    return 'Immediate';
  }
  return `${days} days`;
}

export function formatInvoiceDueDate(
  dueDate: Date | string | null | undefined,
): InvoiceDueDateDisplay | null {
  if (!dueDate) {
    return null;
  }
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: `${Math.abs(diffDays)} days overdue`,
      className: 'text-destructive font-medium',
      badgeClassName: `${BADGE_SHELL} bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300`,
    };
  }
  if (diffDays === 0) {
    return {
      text: 'Due today',
      className: 'text-orange-600 dark:text-orange-400 font-medium',
      badgeClassName: `${BADGE_SHELL} bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300`,
    };
  }
  if (diffDays === 1) {
    return {
      text: 'Due tomorrow',
      className: 'text-yellow-600 dark:text-yellow-400',
      badgeClassName: `${BADGE_SHELL} bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300`,
    };
  }
  return {
    text: due.toLocaleDateString(),
    className: 'text-muted-foreground',
    badgeClassName: `${BADGE_SHELL} bg-muted text-muted-foreground`,
  };
}
