import { FileText } from 'lucide-react';

import { PluginNavigationConfig } from '@/core/pluginRegistry';

/** Single list entry — Payments/Stats are content views + chips, not submenu stubs. */
export const invoicesNavigation: PluginNavigationConfig = {
  category: 'Business',
  label: 'Invoices',
  icon: FileText,
  order: 1,
};
