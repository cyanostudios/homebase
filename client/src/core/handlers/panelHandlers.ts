export const createPanelHandlers = (
    pluginContexts: any[], 
    currentPlugin: any, 
    currentPluginContext: any, 
    currentMode: string, 
    currentItem: any
  ) => {
    
    const handleDeleteItem = (setShowDeleteConfirm: (show: boolean) => void) => {
      setShowDeleteConfirm(true);
    };
  
    const confirmDelete = async (setShowDeleteConfirm: (show: boolean) => void) => {
      if (currentPlugin && currentPluginContext) {
        const deleteFunction = currentPluginContext.deleteContact || 
                             currentPluginContext.deleteNote || 
                             currentPluginContext.deleteEstimate ||
                             currentPluginContext.deleteTask;
        const closeFunction = currentPluginContext.closeContactPanel || 
                             currentPluginContext.closeNotePanel || 
                             currentPluginContext.closeEstimatePanel ||
                             currentPluginContext.closeTaskPanel;
        
        if (deleteFunction && closeFunction && currentItem) {
          await deleteFunction(currentItem.id);
          closeFunction();
        }
      }
      setShowDeleteConfirm(false);
    };
  
    const handleSave = async (data: any) => {
      if (currentPluginContext) {
        const saveFunction = currentPluginContext.saveContact || 
                            currentPluginContext.saveNote || 
                            currentPluginContext.saveEstimate ||
                            currentPluginContext.saveTask;
        return saveFunction ? await saveFunction(data) : false;
      }
      return false;
    };
  
    const handleCancel = () => {
      if (currentPluginContext) {
        const openForViewFunction = currentPluginContext.openContactForView || 
                                   currentPluginContext.openNoteForView || 
                                   currentPluginContext.openEstimateForView ||
                                   currentPluginContext.openTaskForView;
        const closeFunction = currentPluginContext.closeContactPanel || 
                             currentPluginContext.closeNotePanel || 
                             currentPluginContext.closeEstimatePanel ||
                             currentPluginContext.closeTaskPanel;
  
        if (currentMode === 'edit' && currentItem && openForViewFunction) {
          openForViewFunction(currentItem);
        } else if (closeFunction) {
          closeFunction();
        }
      }
    };
  
    const handleSaveClick = () => {
      if (currentPlugin) {
        const submitFunction = window[`submit${currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1)}Form`];
        if (submitFunction) submitFunction();
      }
    };
  
    const handleCancelClick = () => {
      if (currentPlugin) {
        const cancelFunction = window[`cancel${currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1)}Form`];
        if (cancelFunction) cancelFunction();
        else handleCancel();
      }
    };
  
    const handleClosePanel = () => {
      if (currentPluginContext) {
        const closeFunction = currentPluginContext.closeContactPanel || 
                             currentPluginContext.closeNotePanel || 
                             currentPluginContext.closeEstimatePanel ||
                             currentPluginContext.closeTaskPanel;
        if (closeFunction) closeFunction();
      }
    };
  
    // FIXED: Choose correct close handler based on panel mode
    const getCloseHandler = () => {
      if (currentMode === 'view') {
        // In view mode, use direct close function
        return handleClosePanel;
      } else {
        // In form mode (create/edit), use cancel handler which might show unsaved changes warning
        return handleCancelClick;
      }
    };
  
    const handleEstimateContactClick = async (contactId: string) => {
      try {
        const contactsPlugin = pluginContexts.find(p => p.plugin.name === 'contacts');
        const estimatesPlugin = pluginContexts.find(p => p.plugin.name === 'estimates');
        
        if (contactsPlugin?.context && estimatesPlugin?.context) {
          const contacts = contactsPlugin.context.contacts || [];
          const contact = contacts.find((c: any) => c.id === contactId);
          
          if (contact) {
            if (estimatesPlugin.context.closeEstimatePanel) {
              estimatesPlugin.context.closeEstimatePanel();
            }
            
            if (contactsPlugin.context.openContactForView) {
              contactsPlugin.context.openContactForView(contact);
            }
          }
        }
      } catch (error) {
        console.error('Failed to navigate to contact:', error);
      }
    };
  
    return {
      handleDeleteItem,
      confirmDelete,
      handleSave,
      handleCancel,
      handleSaveClick,
      handleCancelClick,
      handleClosePanel,
      getCloseHandler,
      handleEstimateContactClick
    };
  };