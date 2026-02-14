import { Settings } from 'lucide-react';

import type { PluginNavigationConfig } from '@/core/pluginRegistry';

export const settingsNavigation: PluginNavigationConfig = {
  category: 'Tools',
  label: 'Settings',
  icon: Settings,
  order: 10,
};
