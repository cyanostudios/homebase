// client/src/core/ui/PanelTitles.tsx
import { Upload } from 'lucide-react';
import React from 'react';

import { formatDisplayNumber } from '@/core/utils/displayNumber';

// Reduced PLUGIN_CONFIGS - only for plugins not yet migrated
const PLUGIN_CONFIGS: Record<string, any> = {
  import: {
    icon: Upload,
    getTitle: (item: any) => ({
      title: item?.fileName ? `Import: ${item.fileName}` : 'Import Data',
    }),
    getSubtitle: (item: any) => {
      if (item?.status) {
        const statusColors: Record<string, string> = {
          pending:
            'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
          processing:
            'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          success:
            'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800',
          error:
            'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
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
  pluginContext?: any, // ADDED: Accept plugin context as parameter
) => {
  const getPanelTitle = () => {
    if (!currentPlugin) {
      return '';
    }

    // Only Estimates uses custom title (JSX with contact link + amount); all others use central fallback.
    if (currentPlugin.name === 'estimates' && pluginContext?.getPanelTitle) {
      return pluginContext.getPanelTitle(
        currentMode,
        currentItem,
        isMobileView,
        handleEstimateContactClick,
      );
    }

    // Central title from current item: order title → companyName/name → plugin display numbers → id.
    if (currentMode === 'view' && currentItem) {
      const cfg = PLUGIN_CONFIGS[currentPlugin.name];
      if (cfg?.getTitle) {
        const titleData = cfg.getTitle(currentItem);
        if (currentPlugin.name === 'import') {
          return titleData.title;
        }
      }

      if (currentItem.title) {
        return currentItem.title;
      }
      if (currentItem.name) {
        return currentItem.name;
      }
      if (currentPlugin.name === 'contacts') {
        const name = currentItem.companyName?.trim();
        if (name) {
          return name;
        }
        return formatDisplayNumber('contacts', currentItem.contactNumber ?? currentItem.id);
      }
      if (currentItem.companyName) {
        return currentItem.companyName;
      }
      if (currentItem.estimateNumber) {
        return formatDisplayNumber(currentPlugin.name, currentItem.estimateNumber);
      }
      if (currentItem.invoiceNumber) {
        return formatDisplayNumber(currentPlugin.name, currentItem.invoiceNumber);
      }
      if (currentItem.fileName) {
        return `Import: ${currentItem.fileName}`;
      }
      return formatDisplayNumber(currentPlugin.name, currentItem.id);
    }

    // Non-view modes for non-migrated plugins
    if (currentPlugin.name === 'import') {
      switch (currentMode) {
        case 'select':
          return 'Import Data';
        case 'preview':
          return 'Preview Import';
        case 'import':
          return 'Importing...';
        case 'results':
          return 'Import Results';
        default:
          return 'Import';
      }
    }

    // Generic fallback for unmigrated plugins
    const itemType = currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1, -1);
    switch (currentMode) {
      case 'edit':
        return `Edit ${itemType}`;
      case 'create':
        return `Create ${itemType}`;
      case 'settings':
        return `${itemType} Settings`;
      default:
        return itemType;
    }
  };

  const getPanelSubtitle = () => {
    if (!currentPlugin) {
      return null;
    }

    // Only plugins with rich subtitle (Contacts, Tasks, Estimates) implement getPanelSubtitle.
    if (pluginContext && typeof pluginContext.getPanelSubtitle === 'function') {
      return pluginContext.getPanelSubtitle(currentMode, currentItem);
    }

    // Legacy PLUGIN_CONFIGS (e.g. import)
    if (currentMode === 'view' && currentItem) {
      const cfg = PLUGIN_CONFIGS[currentPlugin.name];
      if (cfg?.getSubtitle) {
        const subtitleData = cfg.getSubtitle(currentItem);
        const Icon = subtitleData.icon;
        if (subtitleData.badge) {
          return (
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4" style={{ color: subtitleData.iconColor }} />
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${subtitleData.badge.color}`}
              >
                {subtitleData.badge.text}
              </span>
              {subtitleData.text && (
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  • {subtitleData.text}
                </span>
              )}
            </div>
          );
        }
        if (subtitleData.text) {
          return (
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4" style={{ color: subtitleData.iconColor }} />
              <span className="text-xs text-gray-600 dark:text-gray-400">{subtitleData.text}</span>
            </div>
          );
        }
      }
    }

    if (currentPlugin.name === 'import') {
      switch (currentMode) {
        case 'select':
          return 'Choose file and plugin type to import';
        case 'preview':
          return 'Review data before importing';
        case 'import':
          return 'Processing your data...';
        case 'results':
          return 'Import operation completed';
        default:
          return 'Import data from CSV files';
      }
    }

    return null;
  };

  const getDeleteMessage = () => {
    if (!currentPlugin || !currentItem) {
      return 'Are you sure you want to delete this item?';
    }

    // Check if plugin has its own delete message function
    if (pluginContext && pluginContext.getDeleteMessage) {
      return pluginContext.getDeleteMessage(currentItem);
    }

    // Generic fallback (format display numbers with plugin prefix)
    const itemName =
      currentItem.companyName ||
      currentItem.title ||
      (currentItem.estimateNumber
        ? formatDisplayNumber(currentPlugin.name, currentItem.estimateNumber)
        : undefined) ||
      (currentItem.invoiceNumber
        ? formatDisplayNumber(currentPlugin.name, currentItem.invoiceNumber)
        : undefined) ||
      currentItem.fileName ||
      currentItem.name ||
      (currentItem.id ? formatDisplayNumber(currentPlugin.name, currentItem.id) : undefined) ||
      'this item';

    return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
  };

  return { getPanelTitle, getPanelSubtitle, getDeleteMessage };
};
