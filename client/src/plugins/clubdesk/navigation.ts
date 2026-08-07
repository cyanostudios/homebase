import { Store, ListOrdered, Tags } from 'lucide-react';

import { PluginNavigationConfig } from '@/core/pluginRegistry';

export const clubdeskNavigation: PluginNavigationConfig = {
  category: 'Content',
  label: 'Clubdesk',
  icon: Store,
  order: 2,
  submenu: [
    { label: 'Guides', icon: ListOrdered, page: 'clubdesk-guides', order: 0 },
    { label: 'Price list', icon: Tags, page: 'clubdesk-price-list', order: 1 },
  ],
};
