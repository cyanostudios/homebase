import { Package, Shirt } from 'lucide-react';

import { PluginNavigationConfig } from '@/core/pluginRegistry';

export const garmentsNavigation: PluginNavigationConfig = {
  category: 'Sport',
  label: 'Garments',
  icon: Shirt,
  order: 2,
  submenu: [
    { label: 'Lists', icon: Shirt, page: 'garments-lists', order: 0 },
    { label: 'Inventory', icon: Package, page: 'garments-inventory', order: 1 },
  ],
};
