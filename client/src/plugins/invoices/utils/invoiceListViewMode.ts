import { createPluginListViewMode, type ListViewMode } from '@/core/list/createPluginListViewMode';

export type InvoiceListViewMode = ListViewMode;

const api = createPluginListViewMode('invoices:listViewMode');

export const INVOICES_LIST_VIEW_MODE_STORAGE_KEY = api.STORAGE_KEY;
export const isInvoiceListViewMode = api.isListViewMode;
export const resolveInvoiceListViewMode = api.resolveListViewMode;
export const getInitialInvoiceListViewMode = api.getInitialListViewMode;
export const persistInvoiceListViewModeSession = api.persistListViewModeSession;
