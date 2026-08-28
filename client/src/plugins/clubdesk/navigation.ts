import { Store, ListOrdered, Tags, Info } from 'lucide-react';

import { PluginNavigationConfig } from '@/core/pluginRegistry';

export const clubdeskNavigation: PluginNavigationConfig = {
  category: 'Apps',
  label: 'Clubdesk',
  icon: Store,
  order: 1,
  submenu: [
    { label: 'Guides', icon: ListOrdered, page: 'clubdesk-guides', order: 0 },
    { label: 'Price list', icon: Tags, page: 'clubdesk-price-list', order: 1 },
    { label: 'Info', icon: Info, page: 'clubdesk-info', order: 2 },
  ],
};
