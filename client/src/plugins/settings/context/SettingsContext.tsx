import React, { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';

const SETTINGS_CATEGORY_LABELS: Record<string, string> = {
  profile: 'User Profile',
  preferences: 'Preferences',
  'activity-log': 'Activity Log',
  team: 'Team',
};

export interface SettingsContextType {
  isSettingsPanelOpen: boolean;
  currentSetting: { category: string } | null;
  panelMode: 'create' | 'edit' | 'view';
  isSaving: boolean;
  openSettingsPanel: (categoryId: string) => void;
  closeSettingsPanel: () => void;
  registerSaveHandler: (fn: (() => Promise<void>) | null) => void;
  submitSave: () => Promise<void>;
  setIsSaving: (value: boolean) => void;
  getPanelTitle: (mode: string, item: { category: string } | null) => string;
  getPanelSubtitle: () => string | null;
  getDeleteMessage: () => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function SettingsProvider({
  children,
  isAuthenticated: _isAuthenticated,
  onCloseOtherPanels,
}: SettingsProviderProps) {
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const registerSaveHandler = useCallback((fn: (() => Promise<void>) | null) => {
    saveHandlerRef.current = fn;
  }, []);

  const submitSave = useCallback(async () => {
    if (saveHandlerRef.current) {
      await saveHandlerRef.current();
    }
  }, []);

  const openSettingsPanel = useCallback(
    (categoryId: string) => {
      onCloseOtherPanels();
      setSettingsCategory(categoryId);
      setIsSettingsPanelOpen(true);
    },
    [onCloseOtherPanels],
  );

  const closeSettingsPanel = useCallback(() => {
    setIsSettingsPanelOpen(false);
    setSettingsCategory(null);
  }, []);

  const currentSetting =
    isSettingsPanelOpen && settingsCategory ? { category: settingsCategory } : null;

  const getPanelTitle = useCallback(
    (_mode: string, item: { category: string } | null) => {
      const cat = item?.category ?? settingsCategory;
      return cat ? (SETTINGS_CATEGORY_LABELS[cat] ?? cat) : 'Settings';
    },
    [settingsCategory],
  );
  const getPanelSubtitle = useCallback(() => null, []);
  const getDeleteMessage = useCallback(() => '', []);

  const value: SettingsContextType = {
    isSettingsPanelOpen,
    currentSetting,
    panelMode: 'edit',
    isSaving,
    openSettingsPanel,
    closeSettingsPanel,
    registerSaveHandler,
    submitSave,
    setIsSaving,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext() {
  const ctx = useContext(SettingsContext);
  if (ctx === undefined) {
    throw new Error('useSettingsContext must be used within SettingsProvider');
  }
  return ctx;
}
