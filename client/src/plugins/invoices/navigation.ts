import { FileText, Receipt, CreditCard, DollarSign } from 'lucide-react';

import { PluginNavigationConfig } from '@/core/pluginRegistry';

export const invoicesNavigation: PluginNavigationConfig = {
  category: 'Business',
  label: 'Invoices',
  icon: FileText,
  order: 1,
  submenu: [
    {
      label: 'All Invoices',
      icon: FileText,
      page: 'invoices',
      order: 0,
    },
    {
      label: 'Recurring',
      icon: Receipt,
      page: 'invoices-recurring',
      order: 1,
    },
    {
      label: 'Payments',
      icon: CreditCard,
      page: 'invoices-payments',
      order: 2,
    },
    {
      label: 'Reports',
      icon: DollarSign,
      page: 'invoices-reports',
      order: 3,
    },
  ],
};
