import React from 'react';
import { Building, User, StickyNote, Calculator, CheckSquare } from 'lucide-react';

export const createPanelTitles = (
  currentPlugin: any,
  currentMode: string,
  currentItem: any,
  isMobileView: boolean,
  handleEstimateContactClick: (contactId: string) => void
) => {
  
  const getPanelTitle = () => {
    if (!currentPlugin) return '';
    
    if (currentMode === 'view' && currentItem) {
      // Show item-specific info for better UX
      if (currentPlugin.name === 'contacts') {
        const contactNumber = `#${currentItem.contactNumber || currentItem.id}`;
        const name = currentItem.companyName || `${currentItem.firstName || ''} ${currentItem.lastName || ''}`.trim();
        const orgNumber = currentItem.organizationNumber || currentItem.personalNumber || '';
        
        if (isMobileView && orgNumber) {
          // Mobile: Split to multiple lines
          return (
            <div>
              <div>{contactNumber} • {name}</div>
              <div className="text-sm font-normal text-gray-600 mt-1">{orgNumber}</div>
            </div>
          );
        } else {
          // Desktop: Single line
          return `${contactNumber} • ${name}${orgNumber ? ` • ${orgNumber}` : ''}`;
        }
      } else if (currentPlugin.name === 'notes') {
        return currentItem.title || `Note #${currentItem.id}`;
      } else if (currentPlugin.name === 'estimates') {
        const estimateNumber = currentItem.estimateNumber || `#${currentItem.id}`;
        const total = `${currentItem.total?.toFixed(2) || '0.00'}`;
        const currency = currentItem.currency || 'SEK';
        
        if (isMobileView) {
          // Mobile: Split to multiple lines
          return (
            <div>
              <div className="flex items-center gap-2">
                <span>{estimateNumber} • </span>
                <button
                  onClick={() => handleEstimateContactClick(currentItem.contactId)}
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium px-1 rounded"
                >
                  @{currentItem.contactName}
                </button>
              </div>
              <div className="text-sm font-normal text-gray-600 mt-1">{total} {currency}</div>
            </div>
          );
        } else {
          // Desktop: Single line
          return (
            <div className="flex items-center gap-2">
              <span>{estimateNumber} • </span>
              <button
                onClick={() => handleEstimateContactClick(currentItem.contactId)}
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium px-1 rounded"
              >
                @{currentItem.contactName}
              </button>
              <span> • {total} {currency}</span>
            </div>
          );
        }
      } else if (currentPlugin.name === 'tasks') {
        const taskTitle = currentItem.title || `Task #${currentItem.id}`;
        const dueDate = currentItem.dueDate ? new Date(currentItem.dueDate).toLocaleDateString() : null;
        
        if (isMobileView && dueDate) {
          // Mobile: Split to multiple lines
          return (
            <div>
              <div>{taskTitle}</div>
              <div className="text-sm font-normal text-gray-600 mt-1">Due: {dueDate}</div>
            </div>
          );
        } else {
          // Desktop: Single line
          return `${taskTitle}${dueDate ? ` • Due: ${dueDate}` : ''}`;
        }
      }
      return `#${currentItem.id}`; // Fallback for other plugins
    }
    
    // For create/edit modes, keep descriptive titles
    const itemType = currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1, -1); // contacts -> Contact
    switch (currentMode) {
      case 'edit': return `Edit ${itemType}`;
      case 'create': return `Create ${itemType}`;
      default: return itemType;
    }
  };

  const getPanelSubtitle = () => {
    if (!currentPlugin) return '';
    
    if (currentMode === 'view' && currentItem) {
      // Show icon + badge info in subtitle size - return JSX for rich formatting
      if (currentPlugin.name === 'contacts') {
        const isCompany = currentItem.contactType === 'company';
        const contactType = isCompany ? 'Company' : 'Private Person';
        const Icon = isCompany ? Building : User;
        const badgeColor = isCompany ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
        
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" style={{ color: isCompany ? '#2563eb' : '#16a34a' }} />
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}>
              {contactType}
            </span>
          </div>
        );
      } else if (currentPlugin.name === 'notes') {
        const createdDate = new Date(currentItem.createdAt).toLocaleDateString();
        return (
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-yellow-600" />
            <span>Created {createdDate}</span>
          </div>
        );
      } else if (currentPlugin.name === 'estimates') {
        const status = currentItem.status.charAt(0).toUpperCase() + currentItem.status.slice(1);
        const validTo = new Date(currentItem.validTo).toLocaleDateString();
        const statusColors = {
          draft: 'bg-gray-100 text-gray-800',
          sent: 'bg-blue-100 text-blue-800',
          accepted: 'bg-green-100 text-green-800',
          rejected: 'bg-red-100 text-red-800',
        };
        const badgeColor = statusColors[currentItem.status] || statusColors.draft;
        
        return (
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600" />
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}>
              {status}
            </span>
            <span className="text-xs text-gray-600">• Valid to {validTo}</span>
          </div>
        );
      } else if (currentPlugin.name === 'tasks') {
        const status = currentItem.status;
        const priority = currentItem.priority;
        const createdDate = new Date(currentItem.createdAt).toLocaleDateString();
        
        const statusColors = {
          'not started': 'bg-gray-100 text-gray-800',
          'in progress': 'bg-blue-100 text-blue-800',
          'Done': 'bg-green-100 text-green-800',
          'Canceled': 'bg-red-100 text-red-800',
        };
        const priorityColors = {
          'Low': 'bg-gray-100 text-gray-700',
          'Medium': 'bg-yellow-100 text-yellow-800',
          'High': 'bg-red-100 text-red-800',
        };
        
        const statusBadgeColor = statusColors[status] || statusColors['not started'];
        const priorityBadgeColor = priorityColors[priority] || priorityColors['Medium'];
        
        return (
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-600" />
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusBadgeColor}`}>
              {status}
            </span>
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${priorityBadgeColor}`}>
              {priority}
            </span>
            <span className="text-xs text-gray-600">• Created {createdDate}</span>
          </div>
        );
      }
      return 'View details'; // Fallback
    }
    
    // For create/edit modes, keep instructional subtitles
    const itemType = currentPlugin.name.slice(0, -1); // contacts -> contact
    switch (currentMode) {
      case 'edit': return `Update ${itemType} information`;
      case 'create': return `Enter new ${itemType} details`;
      default: return '';
    }
  };

  const getDeleteMessage = () => {
    if (!currentItem || !currentPlugin) return "Are you sure you want to delete this item?";
    
    const itemName = currentItem.companyName || currentItem.title || currentItem.estimateNumber || 'this item';
    return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
  };

  return {
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage
  };
};