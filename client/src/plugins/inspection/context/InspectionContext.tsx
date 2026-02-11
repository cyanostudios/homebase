import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useApp } from '@/core/api/AppContext';
import { inspectionApi } from '../api/inspectionApi';
import type { InspectionProject } from '../types/inspection';

interface InspectionContextType {
  isInspectionPanelOpen: boolean;
  currentInspectionProject: InspectionProject | null;
  currentInspection?: InspectionProject | null;
  panelMode: 'create' | 'edit' | 'view';
  setPanelMode: (mode: 'create' | 'edit' | 'view') => void;
  inspectionProjects: InspectionProject[];
  projectsLoading: boolean;
  validationErrors: { field: string; message: string }[];
  openInspectionPanel: (project: InspectionProject | null) => void;
  openInspectionForEdit: (project: InspectionProject) => void;
  openInspectionForView: (project: InspectionProject) => void;
  closeInspectionPanel: () => void;
  saveInspection: (data: any) => Promise<boolean>;
  saveInspectionAndClose: (data?: any) => Promise<boolean>;
  saveInspectionAndStay: (data: any) => Promise<InspectionProject | null>;
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
  const [projectsLoading, setProjectsLoading] = useState(false);
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
    if (isAuthenticated) loadProjects();
    else {
      setInspectionProjects([]);
      setProjectsLoading(false);
    }
  }, [isAuthenticated]);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const data = await inspectionApi.getProjects();
      setInspectionProjects(data || []);
    } catch (err: any) {
      setValidationErrors([{ field: 'general', message: err?.message || 'Failed to load projects' }]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const openInspectionPanel = useCallback(
    (project: InspectionProject | null) => {
      onCloseOtherPanels();
      setCurrentInspectionProject(project);
      setPanelMode(project ? 'edit' : 'create');
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
          await inspectionApi.updateProject(currentInspectionProject.id, {
            name: data.name,
            description: data.description,
            adminNotes: data.adminNotes,
          });
        } else {
          const created = await inspectionApi.createProject({
            name: data.name,
            description: data.description,
            adminNotes: data.adminNotes,
          });
          if (created?.id && Array.isArray(data.pendingFileIds) && data.pendingFileIds.length > 0) {
            await inspectionApi.setFiles(created.id, data.pendingFileIds);
          }
        }
        await loadProjects();
        closeInspectionPanel();
        return true;
      } catch (err: any) {
        setValidationErrors([{ field: 'general', message: err?.message || 'Failed to save' }]);
        return false;
      }
    },
    [currentInspectionProject, loadProjects, closeInspectionPanel]
  );

  // Sparar, lägger till listor, laddar fullt projekt och växlar till edit (stänger inte panelen). Returnerar projektet vid lyckat sparande.
  const saveInspectionAndStay = useCallback(
    async (data: any): Promise<InspectionProject | null> => {
      setValidationErrors([]);
      try {
        let projectId: string;
        if (currentInspectionProject?.id) {
          await inspectionApi.updateProject(currentInspectionProject.id, {
            name: data.name,
            description: data.description,
            adminNotes: data.adminNotes,
          });
          projectId = currentInspectionProject.id;
        } else {
          const created = await inspectionApi.createProject({
            name: data.name,
            description: data.description,
            adminNotes: data.adminNotes,
          });
          if (!created?.id) throw new Error('Create project failed');
          projectId = created.id;
          if (Array.isArray(data.pendingFileIds) && data.pendingFileIds.length > 0) {
            await inspectionApi.setFiles(projectId, data.pendingFileIds);
          }
        }
        const pendingListIds = Array.isArray(data.pendingListIds) ? data.pendingListIds : [];
        for (const listId of pendingListIds) {
          await inspectionApi.addFileList(projectId, listId);
        }
        const full = await inspectionApi.getProject(projectId);
        setCurrentInspectionProject(full || null);
        setPanelMode('edit');
        await loadProjects();
        return full || null;
      } catch (err: any) {
        setValidationErrors([{ field: 'general', message: err?.message || 'Failed to save' }]);
        return null;
      }
    },
    [currentInspectionProject, loadProjects]
  );

  // Sparar OCH stänger panelen (används av footer-knappen)
  const saveInspectionAndClose = useCallback(
    async (data?: any): Promise<boolean> => {
      const ok = await saveInspection(
        data ?? {
          name: currentInspectionProject?.name,
          description: currentInspectionProject?.description,
          adminNotes: currentInspectionProject?.adminNotes,
        }
      );
      if (ok) closeInspectionPanel();
      return ok;
    },
    [saveInspection, closeInspectionPanel, currentInspectionProject]
  );

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
    setPanelMode,
    inspectionProjects,
    projectsLoading,
    validationErrors,
    openInspectionPanel,
    openInspectionForEdit,
    openInspectionForView,
    closeInspectionPanel,
    saveInspection,
    saveInspectionAndClose,
    saveInspectionAndStay,
    deleteInspection,
    clearValidationErrors,
    loadProjects,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
  };

  return <InspectionContext.Provider value={value}>{children}</InspectionContext.Provider>;
}

export function useInspectionContext() {
  const ctx = useContext(InspectionContext);
  if (!ctx) throw new Error('useInspectionContext must be used within InspectionProvider');
  return ctx;
}
