import type { InvoiceCreatePrefill } from '../context/InvoicesContext';

/**
 * Cross-plugin create intent for invoices.
 * Module-level so:
 * - React Strict Mode remounts do not drop pending before deferred take
 * - ContactProvider (outer in PluginProviders) can request create without useInvoices()
 *
 * `undefined` = nothing pending; `null` = open create with empty customer;
 * object = open create with contact prefill.
 */
let pending: InvoiceCreatePrefill | null | undefined = undefined;

type PendingListener = () => void;
const listeners = new Set<PendingListener>();

export function setPendingInvoiceCreate(prefill?: InvoiceCreatePrefill | null): void {
  pending = prefill ?? null;
}

export function hasPendingInvoiceCreate(): boolean {
  return pending !== undefined;
}

export function peekPendingInvoiceCreate(): InvoiceCreatePrefill | null | undefined {
  return pending;
}

/** Consume pending intent (once). Returns `undefined` if nothing was pending. */
export function takePendingInvoiceCreate(): InvoiceCreatePrefill | null | undefined {
  if (pending === undefined) {
    return undefined;
  }
  const next = pending;
  pending = undefined;
  return next;
}

export function clearPendingInvoiceCreate(): void {
  pending = undefined;
}

/** InvoicesProvider registers to open create when contacts (or others) request it. */
export function subscribeInvoiceCreateRequests(listener: PendingListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Safe from ContactProvider (outside InvoicesProvider): set prefill and notify subscribers.
 * Subscriber navigates to /invoices and/or opens the create panel.
 */
export function requestInvoiceCreateFromContact(prefill?: InvoiceCreatePrefill | null): void {
  setPendingInvoiceCreate(prefill);
  listeners.forEach((listener) => {
    listener();
  });
}
