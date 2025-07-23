import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Contact } from '@/plugins/contacts/types/contacts';
import { Note } from '@/plugins/notes/types/notes';
import { Estimate } from '@/plugins/estimates/types/estimates';

interface User {
  id: number;
  email: string;
  role: string;
  plugins: string[];
}

interface AppContextType {
  // Auth State (Core responsibility)
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  
  // Loading States
  isLoading: boolean;

  // Cross-plugin data (read-only for cross-references)
  contacts: Contact[];
  notes: Note[];

  // Cross-plugin references (read-only data for cross-references)
  getNotesForContact: (contactId: string) => Promise<Note[]>;
  getContactsForNote: (noteId: string) => Contact[];
  getEstimatesForContact: (contactId: string) => Promise<Estimate[]>;
  
  // Close other panels function (for plugin coordination)
  closeOtherPanels: (except?: 'contacts' | 'notes' | 'estimates') => void;
  
  // Data refresh
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// API helper functions
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

  // Auth endpoints
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

  // Cross-plugin data endpoints (read-only for references)
  async getContacts() {
    return this.request('/contacts');
  },

  async getNotes() {
    return this.request('/notes');
  },

  // CHANGED: Estimates API calls only for cross-plugin references
  async getEstimates() {
    return this.request('/estimates');
  },
};

export function AppProvider({ children }: { children: ReactNode }) {
  // Auth state (core responsibility)
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Cross-plugin data (read-only for references)
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  
  // REMOVED: estimates state - now managed by EstimateContext

  // Check authentication on app start
  useEffect(() => {
    checkAuth();
  }, []);

  // Load data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    } else {
      setContacts([]);
      setNotes([]);
      // REMOVED: setEstimates([]);
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
      // CHANGED: Only load contacts and notes for cross-plugin references
      const [contactsData, notesData] = await Promise.all([
        api.getContacts(), // Only for cross-plugin references
        api.getNotes(), // Only for cross-plugin references
        // REMOVED: api.getEstimates() - now managed by EstimateContext
      ]);
      
      // Transform API data to match interface
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

      // REMOVED: estimate transformation - now in EstimateContext

      setContacts(transformedContacts);
      setNotes(transformedNotes);
      // REMOVED: setEstimates(transformedEstimates);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const refreshData = async () => {
    if (isAuthenticated) {
      await loadData();
    }
  };

  // Auth functions
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
      // REMOVED: setEstimates([]);
    }
  };

  // Close other panels coordination function
  const closeOtherPanels = (except?: 'contacts' | 'notes' | 'estimates') => {
    // Panel closing is now handled by individual plugin contexts
    // This function exists for plugin coordination only
  };

  // Cross-plugin reference functions
  const getNotesForContact = async (contactId: string): Promise<Note[]> => {
    // CHANGED: Use current notes state for cross-plugin references
    return notes.filter(note => 
      note.mentions && note.mentions.some(mention => mention.contactId === contactId)
    );
  };

  const getContactsForNote = (noteId: string): Contact[] => {
    const note = notes.find(n => n.id === noteId);
    if (!note || !note.mentions) return [];
    
    return note.mentions.map(mention => 
      contacts.find(contact => contact.id === mention.contactId)
    ).filter(Boolean) as Contact[];
  };

  // CHANGED: getEstimatesForContact now fetches fresh data via API
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

  return (
    <AppContext.Provider value={{
      // Auth state
      user,
      isAuthenticated,
      login,
      logout,
      isLoading,
      
      // Cross-plugin data (read-only)
      contacts,
      notes,
      // REMOVED: estimates - now managed by EstimateContext
      
      // Cross-plugin references
      getNotesForContact,
      getContactsForNote,
      getEstimatesForContact, // CHANGED: Now async API call
      
      // Panel coordination
      closeOtherPanels,
      
      // Data refresh
      refreshData,
    }}>
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