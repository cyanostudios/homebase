/**
 * ⚠️  CRITICAL SYSTEM FILE - HANDLE WITH EXTREME CARE ⚠️
 *
 * This is the core AppContext that manages global state for all plugins.
 * It provides authentication, cross-plugin data, and panel coordination.
 *
 * 🚨 BEFORE MAKING ANY CHANGES:
 * 1. Read docs/LESSONS_LEARNED.md, docs/PLUGIN_ARCHITECTURE_V3.md, docs/PLUGIN_RUNTIME_CONVENTIONS.md
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

import i18n from '@/i18n';
import { Contact } from '@/plugins/contacts/types/contacts';
import { Estimate } from '@/plugins/estimates/types/estimate';
import { Match } from '@/plugins/matches/types/match';
import { Note } from '@/plugins/notes/types/notes';
import { Slot } from '@/plugins/slots/types/slots';
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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
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
  getSlotsForContact: (contactId: string) => Promise<Slot[]>;
  getMatchesForContact: (contactId: string) => Promise<Match[]>;

  // Optional plugin navigation (set by plugins when mounted; used by e.g. ContactView)
  openNoteForView: ((note: Note) => void) | undefined;
  openTaskForView: ((task: Task) => void) | undefined;
  openEstimateForView: ((estimate: Estimate) => void) | undefined;
  openSlotForView: ((slot: Slot) => void) | undefined;
  openMatchForView: ((match: Match) => void) | undefined;
  registerNotesNavigation: (fn: ((note: Note) => void) | null) => void;
  registerTasksNavigation: (fn: ((task: Task) => void) | null) => void;
  registerEstimatesNavigation: (fn: ((estimate: Estimate) => void) | null) => void;
  registerSlotsNavigation: (fn: ((slot: Slot) => void) | null) => void;
  registerMatchesNavigation: (fn: ((match: Match) => void) | null) => void;

  /** Open "Create task from note" dialog (set by AppContent so note detail footer can trigger it). */
  openToTaskDialog: ((note: Note) => void) | null;
  registerOpenToTaskDialog: (fn: ((note: Note) => void) | null) => void;

  /** Open "Create slot from match" dialog (set by App so match detail footer can trigger it). */
  openToSlotDialog:
    | ((match: {
        id: string;
        home_team: string;
        away_team: string;
        location?: string | null;
        start_time: string;
      }) => void)
    | null;
  registerOpenToSlotDialog: (
    fn:
      | ((match: {
          id: string;
          home_team: string;
          away_team: string;
          location?: string | null;
          start_time: string;
        }) => void)
      | null,
  ) => void;

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
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async signup(email: string, password: string) {
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async logout() {
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
  const [openSlotForView, setOpenSlotForView] = useState<((slot: Slot) => void) | undefined>(
    undefined,
  );
  const [openMatchForView, setOpenMatchForView] = useState<((match: Match) => void) | undefined>(
    undefined,
  );

  const registerNotesNavigation = useCallback((fn: ((note: Note) => void) | null) => {
    queueMicrotask(() => setOpenNoteForView(() => fn ?? undefined));
  }, []);
  const registerTasksNavigation = useCallback((fn: ((task: Task) => void) | null) => {
    queueMicrotask(() => setOpenTaskForView(() => fn ?? undefined));
  }, []);
  const registerEstimatesNavigation = useCallback((fn: ((estimate: Estimate) => void) | null) => {
    queueMicrotask(() => setOpenEstimateForView(() => fn ?? undefined));
  }, []);
  const registerSlotsNavigation = useCallback((fn: ((slot: Slot) => void) | null) => {
    queueMicrotask(() => setOpenSlotForView(() => fn ?? undefined));
  }, []);
  const registerMatchesNavigation = useCallback((fn: ((match: Match) => void) | null) => {
    queueMicrotask(() => setOpenMatchForView(() => fn ?? undefined));
  }, []);

  const [openToTaskDialog, setOpenToTaskDialog] = useState<((note: Note) => void) | null>(null);
  const registerOpenToTaskDialog = useCallback((fn: ((note: Note) => void) | null) => {
    queueMicrotask(() => setOpenToTaskDialog(() => fn ?? null));
  }, []);

  const [openToSlotDialog, setOpenToSlotDialog] = useState<
    | ((match: {
        id: string;
        home_team: string;
        away_team: string;
        location?: string | null;
        start_time: string;
      }) => void)
    | null
  >(null);
  const registerOpenToSlotDialog = useCallback(
    (
      fn:
        | ((match: {
            id: string;
            home_team: string;
            away_team: string;
            location?: string | null;
            start_time: string;
          }) => void)
        | null,
    ) => {
      queueMicrotask(() => setOpenToSlotDialog(() => fn ?? null));
    },
    [],
  );

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

  const login = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.login(email, password);
      const me = await api.getMe();
      setUser(me.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error: any) {
      console.error('Login failed:', error.message || 'Unknown error');
      const errorMessage =
        error?.message || (error?.status === 401 ? 'Invalid email or password' : 'Login failed');
      return { success: false, error: errorMessage };
    }
  };

  const signup = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.signup(email, password);
      const me = await api.getMe();
      setUser(me.user);
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

  const getSlotsForContact = useCallback(
    async (contactId: string): Promise<Slot[]> => {
      if (!user?.plugins?.includes('slots')) {
        return [];
      }
      try {
        const rows = await api.request('/slots');
        const id = String(contactId);
        return (rows || []).filter(
          (row: { contact_id?: number | string | null; mentions?: { contactId: string }[] }) =>
            (row.contact_id !== null &&
              row.contact_id !== undefined &&
              String(row.contact_id) === id) ||
            (Array.isArray(row.mentions) && row.mentions.some((m) => String(m.contactId) === id)),
        );
      } catch {
        return [];
      }
    },
    [user?.plugins],
  );

  const getMatchesForContact = useCallback(
    async (contactId: string): Promise<Match[]> => {
      if (!user?.plugins?.includes('matches')) {
        return [];
      }
      try {
        const rows = await api.request('/matches');
        const id = String(contactId);
        return (rows || []).filter(
          (row: { contact_id?: number | string | null; mentions?: { contactId: string }[] }) =>
            (row.contact_id !== null &&
              row.contact_id !== undefined &&
              String(row.contact_id) === id) ||
            (Array.isArray(row.mentions) &&
              row.mentions.some((m: { contactId: string }) => String(m.contactId) === id)),
        ) as Match[];
      } catch {
        return [];
      }
    },
    [user?.plugins],
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
      setSettingsVersion((prev) => prev + 1);
      if (category === 'preferences' && settings?.language) {
        i18n.changeLanguage(settings.language);
      }
      return response.settings;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    getSettings('preferences')
      .then((prefs: { language?: string } | undefined) => {
        if (prefs?.language) {
          i18n.changeLanguage(prefs.language);
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

  /**
   * AppContext scope (guardrail): keep **global**, **cross-plugin**, or **shell** concerns here.
   * Prefer plugin modules or small helpers for plugin-specific behavior; do not use this as a
   * default dumping ground. See guides/core-architecture-review-for-cursor.md.
   */
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
        getSlotsForContact,
        getMatchesForContact,

        openNoteForView,
        openTaskForView,
        openEstimateForView,
        openSlotForView,
        openMatchForView,
        registerNotesNavigation,
        registerTasksNavigation,
        registerEstimatesNavigation,
        registerSlotsNavigation,
        registerMatchesNavigation,

        openToTaskDialog,
        registerOpenToTaskDialog,
        openToSlotDialog,
        registerOpenToSlotDialog,

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
