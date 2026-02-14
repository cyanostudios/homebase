import { useSettingsContext } from '../context/SettingsContext';

/**
 * Hook for plugin registry: exposes panel state and current item in the shape
 * expected by App panel handling (panelKey, panelMode, currentSetting).
 */
export function useSettings() {
  const ctx = useSettingsContext();
  return {
    isSettingsPanelOpen: ctx.isSettingsPanelOpen,
    panelMode: ctx.panelMode,
    currentSetting: ctx.currentSetting,
    isSaving: ctx.isSaving,
    openSettingsPanel: ctx.openSettingsPanel,
    closeSettingsPanel: ctx.closeSettingsPanel,
    getPanelTitle: ctx.getPanelTitle,
    getPanelSubtitle: ctx.getPanelSubtitle,
    getDeleteMessage: ctx.getDeleteMessage,
  };
}
