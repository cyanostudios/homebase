import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useApp } from '@/core/api/AppContext';
import { inspectionApi } from '../api/inspectionApi';
import type { InspectionProject } from '../types/inspection';

interface InspectionContextType {
  isInspectionPanelOpen: boolean;
  currentInspectionProject: InspectionProject | null;
  currentInspection?: InspectionProject | null; // alias for findCurrentItem
  panelMode: 'create' | 'edit' | 'view';
  inspectionProjects: InspectionProject[];
  validationErrors: { field: string; message: string }[];
  openInspectionPanel: (project: InspectionProject | null) => void;
  openInspectionForEdit: (project: InspectionProject) => void;
  openInspectionForView: (project: InspectionProject) => void;
  closeInspectionPanel: () => void;
  saveInspection: (data: any) => Promise<boolean>;
  saveInspectionAndClose: () => Promise<void>;
  deleteInspection: (id: string) => Promise<void>;
  clearValidationErrors: () => void;
  loadProjects: () => Promise<void>;
  getPanelTitle: (mode: string, item: InspectionProject | null) => string;
  getPanelSubtitle: (mode: string, item: InspectionProject | null) => string;
  getDeleteMessage: (item: InspectionProject | null) => string;
}

const InspectionContext = createContext<InspectionContextType | undefined>(undefined);

interface InspectionProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function InspectionProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: InspectionProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  const [isInspectionPanelOpen, setIsInspectionPanelOpen] = useState(false);
  const [currentInspectionProject, setCurrentInspectionProject] = useState<InspectionProject | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [inspectionProjects, setInspectionProjects] = useState<InspectionProject[]>([]);
  const [validationErrors, setValidationErrors] = useState<{ field: string; message: string }[]>([]);

  useEffect(() => {
    registerPanelCloseFunction('inspection', closeInspectionPanel);
    return () => unregisterPanelCloseFunction('inspection');
  }, []);

  useEffect(() => {
    (window as any).submitInspectionForm = () => {
      window.dispatchEvent(new CustomEvent('submitInspectionForm'));
    };
    (window as any).cancelInspectionForm = () => {
      window.dispatchEvent(new CustomEvent('cancelInspectionForm'));
    };
    return () => {
      delete (window as any).submitInspectionForm;
      delete (window as any).cancelInspectionForm;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
    } else {
      setInspectionProjects([]);
    }
  }, [isAuthenticated]);

  const loadProjects = useCallback(async () => {
    try {
      const data = await inspectionApi.getProjects();
      setInspectionProjects(data || []);
    } catch (err: any) {
      console.error('Failed to load inspection projects:', err);
      setValidationErrors([{ field: 'general', message: err?.message || 'Failed to load projects' }]);
    }
  }, []);

  const openInspectionPanel = useCallback(
    (project: InspectionProject | null) => {
      onCloseOtherPanels();
      setCurrentInspectionProject(project);
      setPanelMode(project ? 'view' : 'create');
      setIsInspectionPanelOpen(true);
    },
    [onCloseOtherPanels]
  );

  const openInspectionForEdit = useCallback((project: InspectionProject) => {
    setCurrentInspectionProject(project);
    setPanelMode('edit');
    setIsInspectionPanelOpen(true);
  }, []);

  const openInspectionForView = useCallback((project: InspectionProject) => {
    setCurrentInspectionProject(project);
    setPanelMode('view');
    setIsInspectionPanelOpen(true);
  }, []);

  const closeInspectionPanel = useCallback(() => {
    setIsInspectionPanelOpen(false);
    setCurrentInspectionProject(null);
    setPanelMode('create');
    setValidationErrors([]);
  }, []);

  const saveInspection = useCallback(
    async (data: any): Promise<boolean> => {
      setValidationErrors([]);
      try {
        if (currentInspectionProject?.id) {
          const updated = await inspectionApi.updateProject(currentInspectionProject.id, {
            name: data.name,
            description: data.description,
            adminNotes: data.adminNotes,
          });
          await loadProjects();
          // Stay in project – switch to view mode instead of closing
          setCurrentInspectionProject(updated || { ...currentInspectionProject, ...data });
          setPanelMode('view');
        } else {
          const created = await inspectionApi.createProject({
            name: data.name,
            description: data.description,
            adminNotes: data.adminNotes,
          });
          await loadProjects();
          // Open the new project so user can add files etc.
          if (created?.id) {
            setCurrentInspectionProject(created);
            setPanelMode('view');
          } else {
            closeInspectionPanel();
          }
        }
        return true;
      } catch (err: any) {
        const msg = err?.message || 'Failed to save';
        setValidationErrors([{ field: 'general', message: msg }]);
        return false;
      }
    },
    [currentInspectionProject, loadProjects, closeInspectionPanel]
  );

  const saveInspectionAndClose = useCallback(async () => {
    if (!currentInspectionProject?.id) return;
    setValidationErrors([]);
    try {
      await inspectionApi.updateProject(currentInspectionProject.id, {
        name: currentInspectionProject.name || '',
        description: currentInspectionProject.description || '',
        adminNotes: currentInspectionProject.adminNotes || '',
      });
      await loadProjects();
      closeInspectionPanel();
    } catch (err: any) {
      setValidationErrors([{ field: 'general', message: err?.message || 'Failed to save' }]);
    }
  }, [currentInspectionProject, loadProjects, closeInspectionPanel]);

  const deleteInspection = useCallback(async (id: string) => {
    try {
      await inspectionApi.deleteProject(id);
      await loadProjects();
      closeInspectionPanel();
    } catch (err: any) {
      setValidationErrors([{ field: 'general', message: err?.message || 'Failed to delete' }]);
    }
  }, [loadProjects, closeInspectionPanel]);

  const clearValidationErrors = useCallback(() => setValidationErrors([]), []);

  const getPanelTitle = useCallback((mode: string, item: InspectionProject | null) => {
    if (mode === 'create') return 'Nytt besiktningsprojekt';
    if (mode === 'edit') return 'Redigera projekt';
    return item?.name || 'Besiktningsprojekt';
  }, []);

  const getPanelSubtitle = useCallback((_mode: string, item: InspectionProject | null) => {
    return item ? `Skapad ${item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}` : '';
  }, []);

  const getDeleteMessage = useCallback((item: InspectionProject | null) => {
    return item ? `Är du säker på att du vill radera projektet "${item.name}"?` : 'Är du säker?';
  }, []);

  const value: InspectionContextType = {
    isInspectionPanelOpen,
    currentInspectionProject,
    currentInspection: currentInspectionProject,
    panelMode,
    inspectionProjects,
    validationErrors,
    openInspectionPanel,
    openInspectionForEdit,
    openInspectionForView,
    closeInspectionPanel,
    saveInspection,
    saveInspectionAndClose,
    deleteInspection,
    clearValidationErrors,
    loadProjects,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
  };

  return (
    <InspectionContext.Provider value={value}>{children}</InspectionContext.Provider>
  );
}

export function useInspectionContext() {
  const ctx = useContext(InspectionContext);
  if (!ctx) throw new Error('useInspectionContext must be used within InspectionProvider');
  return ctx;
}
