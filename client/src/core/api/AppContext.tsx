/**
 * ⚠️  CRITICAL SYSTEM FILE - HANDLE WITH EXTREME CARE ⚠️
 *
 * This is the core AppContext that manages global state for all plugins.
 * It provides authentication, cross-plugin data, and panel coordination.
 *
 * 🚨 BEFORE MAKING ANY CHANGES:
 * 1. Read COLLABORATION_GUIDE.md and AI_AGENT_INSTRUCTIONS.md
 * 2. Understand that changes here affect ALL plugins
 * 3. Test thoroughly with all existing plugins (contacts, notes, estimates, tasks, invoices, files)
 * 4. Verify cross-plugin features still work (@mentions, references)
 * 5. Check that panel coordination system works
 * 6. Ensure authentication flow remains secure
 *
 * 📋 WHAT THIS FILE MANAGES:
 * - Authentication state and login/logout functions
 * - Cross-plugin data (contacts, notes) for references
 * - Panel coordination system (registerPanelCloseFunction)
 * - Cross-plugin API functions (getNotesForContact, etc.)
 * - Global data refresh functionality
 *
 * ❌ NEVER CHANGE WITHOUT EXPLICIT NEED:
 * - Authentication interface or state management
 * - Panel registration system (registerPanelCloseFunction)
 * - Cross-plugin data structure (contacts, notes arrays)
 * - API request wrapper or error handling
 * - Provider component structure
 *
 * ✅ SAFE TO MODIFY (with care):
 * - Adding new cross-plugin reference functions
 * - Adding new API endpoints (following existing patterns)
 * - Adding new shared data types (with backward compatibility)
 *
 * 🔧 FOR NEW PLUGINS:
 * - Add cross-plugin functions if needed (getXForContact pattern)
 * - Register panel close functions in plugin contexts
 * - NO changes to core authentication or data loading
 *
 * Last Modified: August 2025 - Critical Rules Added
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

import { Contact } from '@/plugins/contacts/types/contacts';
import { Estimate } from '@/plugins/estimates/types/estimate';
import { Note } from '@/plugins/notes/types/notes';
import { Task } from '@/plugins/tasks/types/tasks';

interface User {
  id: number;
  email: string;
  role: string;
  plugins: string[];
}

type PluginNameUnion = 'contacts' | 'notes' | 'estimates' | 'tasks' | 'invoices' | 'files';

interface AppContextType {
  // Auth State
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;

  // Loading States
  isLoading: boolean;

  // Cross-plugin data (read-only for cross-references)
  contacts: Contact[];
  notes: Note[];

  // Cross-plugin references
  getNotesForContact: (contactId: string) => Promise<Note[]>;
  getContactsForNote: (noteId: string) => Contact[];
  getEstimatesForContact: (contactId: string) => Promise<Estimate[]>;
  getTasksForContact: (contactId: string) => Promise<Task[]>;
  getTasksWithMentionsForContact: (contactId: string) => Promise<Task[]>;

  // Optional plugin navigation (set by plugins when mounted; used by e.g. ContactView)
  openNoteForView: ((note: Note) => void) | undefined;
  openTaskForView: ((task: Task) => void) | undefined;
  openEstimateForView: ((estimate: Estimate) => void) | undefined;
  registerNotesNavigation: (fn: ((note: Note) => void) | null) => void;
  registerTasksNavigation: (fn: ((task: Task) => void) | null) => void;
  registerEstimatesNavigation: (fn: ((estimate: Estimate) => void) | null) => void;

  /** Open "Create task from note" dialog (set by AppContent so note detail footer can trigger it). */
  openToTaskDialog: ((note: Note) => void) | null;
  registerOpenToTaskDialog: (fn: ((note: Note) => void) | null) => void;

  // Close other panels function (typesafe across all registered plugins)
  closeOtherPanels: (except?: PluginNameUnion) => void;

  // Registry for plugin close functions
  registerPanelCloseFunction: (pluginName: string, closeFunction: () => void) => void;
  unregisterPanelCloseFunction: (pluginName: string) => void;

  // Data refresh
  refreshData: () => Promise<void>;

  // Settings
  getSettings: (category?: string) => Promise<any>;
  updateSettings: (category: string, settings: any) => Promise<any>;
  settingsVersion: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const api = {
  async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // Add CSRF token for mutations (but not for login - it's before authentication)
    // CSRF is temporarily disabled, so we skip this
    // if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method) && !endpoint.includes('/auth/login')) {
    //   headers['X-CSRF-Token'] = await getCsrfToken();
    // }

    const response = await fetch(`/api${endpoint}`, {
      headers,
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));

      // Handle standardized error format from backend
      const errorMessage = error.error || error.message || 'Request failed';
      const errorCode = error.code;
      const errorDetails = error.details;

      const err: any = new Error(errorMessage);
      err.status = response.status;
      err.code = errorCode;
      err.details = errorDetails;

      throw err;
    }

    return response.json();
  },

  async login(email: string, password: string) {
    // Login doesn't need CSRF token (it's before authentication)
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async signup(email: string, password: string) {
    // Signup doesn't need CSRF token (it's before authentication)
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async logout() {
    // Logout needs CSRF token (user is authenticated)
    return this.request('/auth/logout', { method: 'POST' });
  },

  async getMe() {
    return this.request('/auth/me');
  },

  async getContacts() {
    return this.request('/contacts');
  },

  async getNotes() {
    return this.request('/notes');
  },

  async getEstimates() {
    return this.request('/estimates');
  },

  async getTasks() {
    return this.request('/tasks');
  },

  async getSettings(category?: string) {
    if (category) {
      return this.request(`/settings/${category}`);
    }
    return this.request('/settings');
  },

  async updateSettings(category: string, settings: any) {
    return this.request(`/settings/${category}`, {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
  },
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [panelCloseFunctions, setPanelCloseFunctions] = useState<Map<string, () => void>>(
    new Map(),
  );

  const [openNoteForView, setOpenNoteForView] = useState<((note: Note) => void) | undefined>(
    undefined,
  );
  const [openTaskForView, setOpenTaskForView] = useState<((task: Task) => void) | undefined>(
    undefined,
  );
  const [openEstimateForView, setOpenEstimateForView] = useState<
    ((estimate: Estimate) => void) | undefined
  >(undefined);

  const registerNotesNavigation = useCallback((fn: ((note: Note) => void) | null) => {
    queueMicrotask(() => setOpenNoteForView(() => fn ?? undefined));
  }, []);
  const registerTasksNavigation = useCallback((fn: ((task: Task) => void) | null) => {
    queueMicrotask(() => setOpenTaskForView(() => fn ?? undefined));
  }, []);
  const registerEstimatesNavigation = useCallback((fn: ((estimate: Estimate) => void) | null) => {
    queueMicrotask(() => setOpenEstimateForView(() => fn ?? undefined));
  }, []);

  const [openToTaskDialog, setOpenToTaskDialog] = useState<((note: Note) => void) | null>(null);
  const registerOpenToTaskDialog = useCallback((fn: ((note: Note) => void) | null) => {
    queueMicrotask(() => setOpenToTaskDialog(() => fn ?? null));
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await api.getMe();
      setUser(response.user);
      setIsAuthenticated(true);
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    const plugins = user?.plugins ?? [];
    const hasContacts = plugins.includes('contacts');
    const hasNotes = plugins.includes('notes');
    const hasTasks = plugins.includes('tasks');

    try {
      const [contactsData, notesData, tasksData] = await Promise.all([
        hasContacts ? api.getContacts() : Promise.resolve([]),
        hasNotes ? api.getNotes() : Promise.resolve([]),
        hasTasks ? api.getTasks() : Promise.resolve([]),
      ]);

      const transformedContacts = (contactsData || []).map((contact: any) => ({
        ...contact,
        createdAt: new Date(contact.createdAt),
        updatedAt: new Date(contact.updatedAt),
      }));

      const transformedNotes = (notesData || []).map((note: any) => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt),
      }));

      const transformedTasks = (tasksData || []).map((task: any) => ({
        ...task,
        assignedTo: task.assigned_to,
        createdFromNote: task.created_from_note,
        dueDate: task.due_date ? new Date(task.due_date) : null,
        createdAt: new Date(task.created_at),
        updatedAt: new Date(task.updated_at),
      }));

      setContacts(transformedContacts);
      setNotes(transformedNotes);
      setTasks(transformedTasks);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, [user?.plugins]);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadData();
    } else {
      setContacts([]);
      setNotes([]);
      setTasks([]);
    }
  }, [isAuthenticated, user, loadData]);

  const refreshData = useCallback(async () => {
    if (isAuthenticated) {
      await loadData();
    }
  }, [isAuthenticated, loadData]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await api.login(email, password);
      setUser(response.user);
      setIsAuthenticated(true);
      return true;
    } catch (error: any) {
      console.error('Login failed:', {
        message: error.message,
        status: error.status,
        code: error.code,
        details: error.details,
        fullError: error,
      });
      return false;
    }
  };

  const signup = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.signup(email, password);
      // Auto-login after successful signup
      setUser(response.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error: any) {
      console.error('Signup failed:', error);
      const errorMessage = error.message || 'Failed to create account. Please try again.';
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setContacts([]);
      setNotes([]);
      setTasks([]);
    }
  };

  const registerPanelCloseFunction = useCallback(
    (pluginName: string, closeFunction: () => void) => {
      setPanelCloseFunctions((prev) => {
        const newMap = new Map(prev);
        newMap.set(pluginName, closeFunction);
        return newMap;
      });
    },
    [],
  );

  const unregisterPanelCloseFunction = useCallback((pluginName: string) => {
    setPanelCloseFunctions((prev) => {
      const newMap = new Map(prev);
      newMap.delete(pluginName);
      return newMap;
    });
  }, []);

  const closeOtherPanels = (except?: PluginNameUnion) => {
    panelCloseFunctions.forEach((closeFunction, pluginName) => {
      if (pluginName !== except) {
        closeFunction();
      }
    });
  };

  const getNotesForContact = useCallback(
    async (contactId: string): Promise<Note[]> => {
      if (!user?.plugins?.includes('notes')) {
        return [];
      }
      const id = String(contactId);
      return notes.filter(
        (note) =>
          note.mentions && note.mentions.some((mention: any) => String(mention.contactId) === id),
      );
    },
    [user?.plugins, notes],
  );

  const getContactsForNote = useCallback(
    (noteId: string): Contact[] => {
      if (!user?.plugins?.includes('notes')) {
        return [];
      }
      const note = notes.find((n) => String(n.id) === String(noteId));
      if (!note || !note.mentions) {
        return [];
      }
      return note.mentions
        .map((mention: any) => contacts.find((c) => String(c.id) === String(mention.contactId)))
        .filter(Boolean) as Contact[];
    },
    [user?.plugins, notes, contacts],
  );

  const getEstimatesForContact = useCallback(
    async (contactId: string): Promise<Estimate[]> => {
      if (!user?.plugins?.includes('estimates')) {
        return [];
      }
      try {
        const estimatesData = await api.getEstimates();
        const transformedEstimates = (estimatesData || []).map((estimate: any) => ({
          ...estimate,
          validTo: new Date(estimate.validTo),
          createdAt: new Date(estimate.createdAt),
          updatedAt: new Date(estimate.updatedAt),
        }));
        return transformedEstimates.filter(
          (estimate: Estimate) => String(estimate.contactId) === String(contactId),
        );
      } catch (error) {
        console.error('Failed to fetch estimates for contact:', error);
        return [];
      }
    },
    [user?.plugins],
  );

  const getTasksForContact = useCallback(
    async (contactId: string): Promise<Task[]> => {
      if (!user?.plugins?.includes('tasks')) {
        return [];
      }
      const id = String(contactId);
      return tasks.filter((task: Task) => String(task.assignedTo ?? '') === id);
    },
    [user?.plugins, tasks],
  );

  const getTasksWithMentionsForContact = useCallback(
    async (contactId: string): Promise<Task[]> => {
      if (!user?.plugins?.includes('tasks')) {
        return [];
      }
      const id = String(contactId);
      return tasks.filter(
        (task: Task) =>
          task.mentions && task.mentions.some((mention: any) => String(mention.contactId) === id),
      );
    },
    [user?.plugins, tasks],
  );

  const getSettings = async (category?: string) => {
    try {
      const response = await api.getSettings(category);
      return response.settings;
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      return {};
    }
  };

  const [settingsVersion, setSettingsVersion] = useState(0);

  const updateSettings = async (category: string, settings: any) => {
    try {
      const response = await api.updateSettings(category, settings);
      // Trigger re-render of components listening to settings
      setSettingsVersion((prev) => prev + 1);
      return response.settings;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        signup,
        logout,
        isLoading,

        contacts,
        notes,

        getNotesForContact,
        getContactsForNote,
        getEstimatesForContact,
        getTasksForContact,
        getTasksWithMentionsForContact,

        openNoteForView,
        openTaskForView,
        openEstimateForView,
        registerNotesNavigation,
        registerTasksNavigation,
        registerEstimatesNavigation,

        openToTaskDialog,
        registerOpenToTaskDialog,

        closeOtherPanels,
        registerPanelCloseFunction,
        unregisterPanelCloseFunction,

        refreshData,

        getSettings,
        updateSettings,
        settingsVersion,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
