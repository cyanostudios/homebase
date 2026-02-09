import { ShoppingCart, Store } from 'lucide-react';

import { PluginNavigationConfig } from '@/core/pluginRegistry';

export const channelsNavigation: PluginNavigationConfig = {
  category: 'E-Commerce',
  label: 'Channels',
  icon: ShoppingCart,
  order: 2,
  submenu: [
    { label: 'Channels', icon: ShoppingCart, page: 'channels', order: 0 },
    { label: 'WooCommerce', icon: Store, page: 'woocommerce-products', order: 1 },
    { label: 'CDON', icon: Store, page: 'cdon-products', order: 2 },
    { label: 'Fyndiq', icon: Store, page: 'fyndiq-products', order: 3 },
  ],
};
