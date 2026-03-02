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

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';

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
  currentTenantUserId: number | null;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<boolean | { requiresMfa: true; mfaToken: string }>;
  verifyMfa: (mfaToken: string, code: string) => Promise<boolean>;
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;

  // Loading States
  isLoading: boolean;

  // Cross-plugin data (read-only for cross-references)
  contacts: Contact[];
  notes: Note[];
  tasks: Task[];

  // Cross-plugin references
  getNotesForContact: (contactId: string) => Promise<Note[]>;
  getContactsForNote: (noteId: string) => Contact[];
  getEstimatesForContact: (contactId: string) => Promise<Estimate[]>;
  getTasksForContact: (contactId: string) => Promise<Task[]>;
  getTasksWithMentionsForContact: (contactId: string) => Promise<Task[]>;

  // Close other panels function (typesafe across all registered plugins)
  closeOtherPanels: (except?: PluginNameUnion) => void;

  // Registry for plugin close functions
  registerPanelCloseFunction: (pluginName: string, closeFunction: () => void) => void;
  unregisterPanelCloseFunction: (pluginName: string) => void;

  // Cross-plugin: open "Create task from note" dialog (Notes → Tasks)
  openToTaskDialog: ((note: Note) => void) | null;
  registerOpenToTaskDialog: (fn: ((note: Note) => void) | null) => void;

  // Data refresh
  refreshData: () => Promise<void>;

  // Settings
  getSettings: (category?: string) => Promise<any>;
  updateSettings: (category: string, settings: any) => Promise<any>;
  settingsVersion: number;

  // MFA (two-factor authentication)
  getMfaStatus: () => Promise<{ mfaEnabled: boolean; mfaDisabledInEnvironment?: boolean }>;
  mfaSetup: () => Promise<{ otpauthUrl: string; qrCodeDataUrl: string; secret: string }>;
  mfaVerify: (code: string) => Promise<{ success: boolean }>;
  mfaDisable: (password: string) => Promise<{ success: boolean }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  const response = await fetch('/api/csrf-token', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }
  const data = await response.json();
  const token = String(data?.csrfToken || '').trim();
  if (!token) {
    throw new Error('CSRF token not found in response');
  }
  csrfToken = token;
  return csrfToken;
}

const api = {
  async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // Add CSRF token for authenticated mutations.
    if (
      options.method &&
      ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method) &&
      !endpoint.includes('/auth/login') &&
      !endpoint.includes('/auth/signup') &&
      !endpoint.includes('/auth/verify-mfa')
    ) {
      headers['X-CSRF-Token'] = await getCsrfToken();
    }

    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
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

  async verifyMfa(mfaToken: string, code: string) {
    return this.request('/auth/verify-mfa', {
      method: 'POST',
      body: JSON.stringify({ mfaToken, code }),
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

  async getMfaStatus() {
    return this.request('/auth/mfa/status');
  },

  async mfaSetup() {
    return this.request('/auth/mfa/setup', { method: 'POST' });
  },

  async mfaVerify(code: string) {
    return this.request('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async mfaDisable(password: string) {
    return this.request('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentTenantUserId, setCurrentTenantUserId] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [panelCloseFunctions, setPanelCloseFunctions] = useState<Map<string, () => void>>(
    new Map(),
  );

  // Prevents parallel checkAuth calls (e.g. rapid F5) from racing and overwriting auth state
  const isCheckingAuth = useRef(false);

  const [openToTaskDialog, setOpenToTaskDialog] = useState<((note: Note) => void) | null>(null);
  const registerOpenToTaskDialog = useCallback((fn: ((note: Note) => void) | null) => {
    queueMicrotask(() => setOpenToTaskDialog(() => fn));
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    } else {
      setContacts([]);
      setNotes([]);
      setTasks([]);
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    // Guard: if a check is already in flight, ignore this call
    if (isCheckingAuth.current) {
      return;
    }
    isCheckingAuth.current = true;

    const debugLog = (message: string) => {
      fetch('/api/debug-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message }),
      }).catch(() => {});
    };
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    try {
      debugLog('CHECK_AUTH: Calling getMe...');
      const response = await api.getMe();
      debugLog(`CHECK_AUTH: getMe OK userId: ${response?.user?.id ?? '—'}`);
      setUser(response.user);
      setCurrentTenantUserId(response.currentTenantUserId ?? response.user?.id ?? null);
      setIsAuthenticated(true);
    } catch (err: any) {
      debugLog(
        `CHECK_AUTH: getMe failed status: ${err?.status ?? '—'} message: ${err?.message ?? '—'} code: ${err?.code ?? '—'}`,
      );
      const status = Number(err?.status || 0);

      // Best-effort resilience: a short retry helps with transient cookie/proxy races on startup.
      if (status === 401) {
        try {
          await sleep(250);
          debugLog('CHECK_AUTH: Retrying getMe after 401...');
          const retryResponse = await api.getMe();
          debugLog(`CHECK_AUTH: retry OK userId: ${retryResponse?.user?.id ?? '—'}`);
          setUser(retryResponse.user);
          setCurrentTenantUserId(
            retryResponse.currentTenantUserId ?? retryResponse.user?.id ?? null,
          );
          setIsAuthenticated(true);
          return;
        } catch (retryErr: any) {
          debugLog(
            `CHECK_AUTH: retry failed status: ${retryErr?.status ?? '—'} message: ${retryErr?.message ?? '—'}`,
          );
        }
      }

      // Only clear auth state when we are certain it's an authentication failure.
      if (status === 401 || status === 403) {
        setUser(null);
        setCurrentTenantUserId(null);
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
      isCheckingAuth.current = false;
    }
  };

  const loadData = async () => {
    try {
      // Priority 1: contacts (critical for first screen / lists)
      const contactsData = await api.getContacts();
      const transformedContacts = contactsData.map((contact: any) => ({
        ...contact,
        createdAt: new Date(contact.createdAt),
        updatedAt: new Date(contact.updatedAt),
      }));
      setContacts(transformedContacts);

      // Priority 2: notes and tasks in background
      const [notesData, tasksData] = await Promise.all([api.getNotes(), api.getTasks()]);
      const transformedNotes = notesData.map((note: any) => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt),
      }));
      const transformedTasks = tasksData.map((task: any) => ({
        ...task,
        assignedTo: task.assigned_to,
        createdFromNote: task.created_from_note,
        dueDate: task.due_date ? new Date(task.due_date) : null,
        createdAt: new Date(task.created_at),
        updatedAt: new Date(task.updated_at),
      }));
      setNotes(transformedNotes);
      setTasks(transformedTasks);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const refreshData = async () => {
    if (isAuthenticated) {
      await loadData();
    }
  };

  const login = async (
    email: string,
    password: string,
  ): Promise<boolean | { requiresMfa: true; mfaToken: string }> => {
    try {
      const response = await api.login(email, password);
      if (response.requiresMfa === true && response.mfaToken) {
        return { requiresMfa: true, mfaToken: response.mfaToken };
      }
      setUser(response.user);
      setCurrentTenantUserId(response.user?.id ?? null);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const verifyMfa = async (mfaToken: string, code: string): Promise<boolean> => {
    try {
      const response = await api.verifyMfa(mfaToken, code);
      setUser(response.user);
      setCurrentTenantUserId(response.user?.id ?? null);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('MFA verify failed:', error);
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
      setCurrentTenantUserId(response.user?.id ?? null);
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
      // Close all panels before logout so no overlay persists on next login
      panelCloseFunctions.forEach((closeFn) => {
        try {
          closeFn();
        } catch {
          /* ignore */
        }
      });
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setCurrentTenantUserId(null);
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

  const getNotesForContact = async (contactId: string): Promise<Note[]> => {
    return notes.filter(
      (note) =>
        note.mentions && note.mentions.some((mention: any) => mention.contactId === contactId),
    );
  };

  const getContactsForNote = (noteId: string): Contact[] => {
    const note = notes.find((n) => n.id === noteId);
    if (!note || !note.mentions) {
      return [];
    }

    return note.mentions
      .map((mention: any) => contacts.find((contact) => contact.id === mention.contactId))
      .filter(Boolean) as Contact[];
  };

  const getEstimatesForContact = async (contactId: string): Promise<Estimate[]> => {
    try {
      const estimatesData = await api.getEstimates();
      const transformedEstimates = estimatesData.map((estimate: any) => ({
        ...estimate,
        validTo: new Date(estimate.validTo),
        createdAt: new Date(estimate.createdAt),
        updatedAt: new Date(estimate.updatedAt),
      }));
      return transformedEstimates.filter((estimate: Estimate) => estimate.contactId === contactId);
    } catch (error) {
      console.error('Failed to fetch estimates for contact:', error);
      return [];
    }
  };

  const getTasksForContact = async (contactId: string): Promise<Task[]> => {
    try {
      return tasks.filter((task: Task) => String(task.assignedTo ?? '') === String(contactId));
    } catch (error) {
      console.error('Failed to fetch tasks for contact:', error);
      return [];
    }
  };

  const getTasksWithMentionsForContact = async (contactId: string): Promise<Task[]> => {
    try {
      return tasks.filter(
        (task: Task) =>
          task.mentions && task.mentions.some((mention: any) => mention.contactId === contactId),
      );
    } catch (error) {
      console.error('Failed to fetch task mentions for contact:', error);
      return [];
    }
  };

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

  const getMfaStatus = async () => api.getMfaStatus();
  const mfaSetup = async () => api.mfaSetup();
  const mfaVerify = async (code: string) => api.mfaVerify(code);
  const mfaDisable = async (password: string) => api.mfaDisable(password);

  return (
    <AppContext.Provider
      value={{
        user,
        currentTenantUserId,
        isAuthenticated,
        login,
        verifyMfa,
        signup,
        logout,
        isLoading,

        contacts,
        notes,
        tasks,

        getNotesForContact,
        getContactsForNote,
        getEstimatesForContact,
        getTasksForContact,
        getTasksWithMentionsForContact,

        closeOtherPanels,
        registerPanelCloseFunction,
        unregisterPanelCloseFunction,

        openToTaskDialog,
        registerOpenToTaskDialog,

        refreshData,

        getSettings,
        updateSettings,
        settingsVersion,

        getMfaStatus,
        mfaSetup,
        mfaVerify,
        mfaDisable,
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
