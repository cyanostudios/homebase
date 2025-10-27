/**
 * ⚠️  CRITICAL SYSTEM FILE - HANDLE WITH EXTREME CARE ⚠️
 *
 * This is the core AppContext that manages global state for all plugins.
 * It provides authentication, cross-plugin data, and panel coordination.
 *
 * 🚨 BEFORE MAKING ANY CHANGES:
 * 1. Read COLLABORATION_GUIDE.md and AI_AGENT_INSTRUCTIONS.md
 * 2. Understand that changes here affect ALL plugins
 * 3. Test thoroughly with all existing plugins (contacts, notes, estimates, tasks, products, channels)
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

type PluginNameUnion =
  | 'contacts'
  | 'notes'
  | 'estimates'
  | 'tasks'
  | 'products'
  | 'rails'
  | 'woocommerce-products'
  | 'channels'
  | 'invoices'
  | 'files';

interface AppContextType {
  // Auth State
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
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

  // Close other panels function (typesafe across all registered plugins)
  closeOtherPanels: (except?: PluginNameUnion) => void;

  // Registry for plugin close functions
  registerPanelCloseFunction: (pluginName: string, closeFunction: () => void) => void;
  unregisterPanelCloseFunction: (pluginName: string) => void;

  // Data refresh
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const api = {
  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`/api${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  },

  async login(email: string, password: string) {
    return this.request('/auth/login', {
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
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  const [panelCloseFunctions, setPanelCloseFunctions] = useState<Map<string, () => void>>(
    new Map(),
  );

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    } else {
      setContacts([]);
      setNotes([]);
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    try {
      const response = await api.getMe();
      setUser(response.user);
      setIsAuthenticated(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [contactsData, notesData] = await Promise.all([api.getContacts(), api.getNotes()]);

      const transformedContacts = contactsData.map((contact: any) => ({
        ...contact,
        createdAt: new Date(contact.createdAt),
        updatedAt: new Date(contact.updatedAt),
      }));

      const transformedNotes = notesData.map((note: any) => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt),
      }));

      setContacts(transformedContacts);
      setNotes(transformedNotes);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const refreshData = async () => {
    if (isAuthenticated) {
      await loadData();
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await api.login(email, password);
      setUser(response.user);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
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
    console.log('closeOtherPanels called, except:', except);
    console.log('Available close functions:', Array.from(panelCloseFunctions.keys()));

    panelCloseFunctions.forEach((closeFunction, pluginName) => {
      if (pluginName !== except) {
        console.log(`Closing panel for plugin: ${pluginName}`);
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
      const tasksData = await api.getTasks();
      const transformedTasks = tasksData.map((task: any) => ({
        ...task,
        assignedTo: task.assigned_to,
        createdFromNote: task.created_from_note,
        dueDate: task.due_date ? new Date(task.due_date) : null,
        createdAt: new Date(task.created_at),
        updatedAt: new Date(task.updated_at),
      }));
      return transformedTasks.filter((task: Task) => task.assignedTo === contactId);
    } catch (error) {
      console.error('Failed to fetch tasks for contact:', error);
      return [];
    }
  };

  const getTasksWithMentionsForContact = async (contactId: string): Promise<Task[]> => {
    try {
      const tasksData = await api.getTasks();
      const transformedTasks = tasksData.map((task: any) => ({
        ...task,
        assignedTo: task.assigned_to,
        createdFromNote: task.created_from_note,
        dueDate: task.due_date ? new Date(task.due_date) : null,
        createdAt: new Date(task.created_at),
        updatedAt: new Date(task.updated_at),
      }));
      return transformedTasks.filter(
        (task: Task) =>
          task.mentions && task.mentions.some((mention: any) => mention.contactId === contactId),
      );
    } catch (error) {
      console.error('Failed to fetch task mentions for contact:', error);
      return [];
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        logout,
        isLoading,

        contacts,
        notes,

        getNotesForContact,
        getContactsForNote,
        getEstimatesForContact,
        getTasksForContact,
        getTasksWithMentionsForContact,

        closeOtherPanels,
        registerPanelCloseFunction,
        unregisterPanelCloseFunction,

        refreshData,
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
