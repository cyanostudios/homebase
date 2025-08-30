// client/src/core/ui/PanelTitles.tsx
import React from 'react';
import { Upload, ShoppingCart } from 'lucide-react';

// Reduced PLUGIN_CONFIGS - only for plugins not yet migrated
const PLUGIN_CONFIGS: Record<string, any> = {
  import: {
    icon: Upload,
    getTitle: (item: any) => ({ title: item?.fileName ? `Import: ${item.fileName}` : 'Import Data' }),
    getSubtitle: (item: any) => {
      if (item?.status) {
        const statusColors: Record<string, string> = {
          pending: 'bg-yellow-100 text-yellow-800',
          processing: 'bg-blue-100 text-blue-800',
          success: 'bg-green-100 text-green-800',
          error: 'bg-red-100 text-red-800',
        };
        return {
          icon: Upload,
          iconColor: '#2563eb',
          badge: {
            text: item.status.charAt(0).toUpperCase() + item.status.slice(1),
            color: statusColors[item.status] || statusColors.pending,
          },
          text: item.pluginType ? `Target: ${item.pluginType}` : '',
        };
      }
      return { icon: Upload, iconColor: '#2563eb', text: 'Import data from CSV files' };
    },
  },
};

export const createPanelTitles = (
  currentPlugin: any,
  currentMode: string,
  currentItem: any,
  isMobileView: boolean,
  handleEstimateContactClick: (contactId: string) => void,
  pluginContext?: any  // ADDED: Accept plugin context as parameter
) => {

  const getPanelTitle = () => {
    if (!currentPlugin) return '';

    // Check if plugin has its own title functions
    if (pluginContext && pluginContext.getPanelTitle) {
      if (currentPlugin.name === 'estimates') {
        // Estimates needs the handleEstimateContactClick function
        return pluginContext.getPanelTitle(currentMode, currentItem, isMobileView, handleEstimateContactClick);
      } else {
        return pluginContext.getPanelTitle(currentMode, currentItem, isMobileView);
      }
    }

    // Fallback to legacy PLUGIN_CONFIGS for non-migrated plugins
    if (currentMode === 'view' && currentItem) {
      const cfg = PLUGIN_CONFIGS[currentPlugin.name];
      if (cfg?.getTitle) {
        const titleData = cfg.getTitle(currentItem);
        
        if (currentPlugin.name === 'import') return titleData.title;
      }

      // Generic fallback fields
      if (currentItem.title) return currentItem.title;
      if (currentItem.name) return currentItem.name;
      if (currentItem.companyName) return currentItem.companyName;
      if (currentItem.estimateNumber) return currentItem.estimateNumber;
      if (currentItem.fileName) return `Import: ${currentItem.fileName}`;
      return `${currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1, -1)} #${currentItem.id}`;
    }

    // Non-view modes for non-migrated plugins
    if (currentPlugin.name === 'import') {
      switch (currentMode) {
        case 'select': return 'Import Data';
        case 'preview': return 'Preview Import';
        case 'import': return 'Importing...';
        case 'results': return 'Import Results';
        default: return 'Import';
      }
    }

    // Generic fallback for unmigrated plugins
    const itemType = currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1, -1);
    switch (currentMode) {
      case 'edit': return `Edit ${itemType}`;
      case 'create': return `Create ${itemType}`;
      default: return itemType;
    }
  };

  const getPanelSubtitle = () => {
    if (!currentPlugin) return '';

    // Check if plugin has its own subtitle functions
    if (pluginContext && pluginContext.getPanelSubtitle) {
      return pluginContext.getPanelSubtitle(currentMode, currentItem);
    }

    // Fallback to legacy PLUGIN_CONFIGS for non-migrated plugins
    if (currentMode === 'view' && currentItem) {
      const cfg = PLUGIN_CONFIGS[currentPlugin.name];
      if (cfg?.getSubtitle) {
        const subtitleData = cfg.getSubtitle(currentItem);
        const Icon = subtitleData.icon;

        if (subtitleData.badge) {
          return (
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4" style={{ color: subtitleData.iconColor }} />
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${subtitleData.badge.color}`}>
                {subtitleData.badge.text}
              </span>
              {subtitleData.text && <span className="text-xs text-gray-600">• {subtitleData.text}</span>}
            </div>
          );
        } else if (subtitleData.text) {
          return (
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4" style={{ color: subtitleData.iconColor }} />
              <span className="text-xs text-gray-600">{subtitleData.text}</span>
            </div>
          );
        }
      }
      return 'View details';
    }

    // Non-view modes for non-migrated plugins
    if (currentPlugin.name === 'import') {
      switch (currentMode) {
        case 'select': return 'Choose file and plugin type to import';
        case 'preview': return 'Review data before importing';
        case 'import': return 'Processing your data...';
        case 'results': return 'Import operation completed';
        default: return 'Import data from CSV files';
      }
    }

    if (currentPlugin.name === 'woocommerce-products') {
      return currentMode === 'edit'
        ? 'Update WooCommerce connection'
        : 'Configure WooCommerce connection';
    }

    // Generic fallback for unmigrated plugins
    const itemType = currentPlugin.name.slice(0, -1);
    switch (currentMode) {
      case 'edit': return `Update ${itemType} information`;
      case 'create': return `Enter new ${itemType} details`;
      default: return '';
    }
  };

  const getDeleteMessage = () => {
    if (!currentPlugin || !currentItem) return 'Are you sure you want to delete this item?';

    // Check if plugin has its own delete message function
    if (pluginContext && pluginContext.getDeleteMessage) {
      return pluginContext.getDeleteMessage(currentItem);
    }

    // Generic fallback
    const itemName =
      currentItem.companyName ||
      currentItem.title ||
      currentItem.estimateNumber ||
      currentItem.fileName ||
      currentItem.name ||
      'this item';

    return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
  };

  return { getPanelTitle, getPanelSubtitle, getDeleteMessage };
};