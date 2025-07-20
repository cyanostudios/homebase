import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Estimate } from '@/plugins/estimates/types/estimate';
import { Contact } from '@/plugins/contacts/types/contacts';
import { Note } from '@/plugins/notes/types/notes';

interface User {
  id: number;
  email: string;
  role: string;
  plugins: string[];
}

interface AppContextType {
  // Auth State
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  
  // Loading States
  isLoading: boolean;

  // Estimate Panel State
  isEstimatePanelOpen: boolean;
  currentEstimate: Estimate | null;
  estimatePanelMode: 'create' | 'edit' | 'view';
  
  // Estimates Data
  estimates: Estimate[];
  
  // Estimate Actions
  openEstimatePanel: (estimate: Estimate | null) => void;
  openEstimateForEdit: (estimate: Estimate) => void;
  openEstimateForView: (estimate: Estimate) => void;
  closeEstimatePanel: () => void;
  saveEstimate: (estimateData: any) => Promise<boolean>;
  deleteEstimate: (id: string) => Promise<void>;

  // Cross-plugin references (needs contacts and notes data for cross-references)
  getNotesForContact: (contactId: string) => Note[];
  getContactsForNote: (noteId: string) => Contact[];
  getEstimatesForContact: (contactId: string) => Estimate[];
  
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

  // Contacts endpoints (only for cross-plugin references)
  async getContacts() {
    return this.request('/contacts');
  },

  // Notes endpoints (only for cross-plugin references)
  async getNotes() {
    return this.request('/notes');
  },

  // Estimates endpoints
  async getEstimates() {
    return this.request('/estimates');
  },

  async getNextEstimateNumber() {
    return this.request('/estimates/next-number');
  },

  async createEstimate(estimateData: any) {
    return this.request('/estimates', {
      method: 'POST',
      body: JSON.stringify(estimateData),
    });
  },

  async updateEstimate(id: string, estimateData: any) {
    return this.request(`/estimates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(estimateData),
    });
  },

  async deleteEstimate(id: string) {
    return this.request(`/estimates/${id}`, { method: 'DELETE' });
  },
};

export function AppProvider({ children }: { children: ReactNode }) {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estimates state
  const [isEstimatePanelOpen, setIsEstimatePanelOpen] = useState(false);
  const [currentEstimate, setCurrentEstimate] = useState<Estimate | null>(null);
  const [estimatePanelMode, setEstimatePanelMode] = useState<'create' | 'edit' | 'view'>('create');
  
  // Cross-plugin data (read-only for references)
  const [contacts, setContacts] = useState<Contact[]>([]); // Only for cross-plugin references
  const [notes, setNotes] = useState<Note[]>([]); // Only for cross-plugin references
  const [estimates, setEstimates] = useState<Estimate[]>([]);

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
      setEstimates([]);
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
      const [contactsData, notesData, estimatesData] = await Promise.all([
        api.getContacts(), // Only for cross-plugin references
        api.getNotes(), // Only for cross-plugin references
        api.getEstimates(),
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

      const transformedEstimates = estimatesData.map((estimate: any) => ({
        ...estimate,
        validTo: new Date(estimate.validTo),
        createdAt: new Date(estimate.createdAt),
        updatedAt: new Date(estimate.updatedAt),
      }));

      setContacts(transformedContacts);
      setNotes(transformedNotes);
      setEstimates(transformedEstimates);
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
      setEstimates([]);
    }
  };

  // Close other panels coordination function
  const closeOtherPanels = (except?: 'contacts' | 'notes' | 'estimates') => {
    if (except !== 'estimates') {
      setIsEstimatePanelOpen(false);
    }
    // Contact and note panel closing is handled by their respective contexts
  };

  const validateEstimate = (estimateData: any) => {
    const errors: any[] = [];
    
    if (!estimateData.contactId?.trim()) {
      errors.push({
        field: 'contactId',
        message: 'Customer is required'
      });
    }
    
    if (!estimateData.lineItems || estimateData.lineItems.length === 0) {
      errors.push({
        field: 'lineItems',
        message: 'At least one line item is required'
      });
    } else {
      // Validate each line item
      estimateData.lineItems.forEach((item: any, index: number) => {
        if (!item.description?.trim()) {
          errors.push({
            field: `lineItems.${index}.description`,
            message: `Line item ${index + 1}: Description is required`
          });
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push({
            field: `lineItems.${index}.quantity`,
            message: `Line item ${index + 1}: Quantity must be greater than 0`
          });
        }
        if (!item.unitPrice || item.unitPrice < 0) {
          errors.push({
            field: `lineItems.${index}.unitPrice`,
            message: `Line item ${index + 1}: Unit price must be 0 or greater`
          });
        }
      });
    }
    
    if (!estimateData.validTo) {
      errors.push({
        field: 'validTo',
        message: 'Valid to date is required'
      });
    }
    
    return errors;
  };

  // Estimate functions
  const openEstimatePanel = (estimate: Estimate | null) => {
    setCurrentEstimate(estimate);
    setEstimatePanelMode(estimate ? 'edit' : 'create');
    setIsEstimatePanelOpen(true);
    closeOtherPanels('estimates');
  };

  const openEstimateForEdit = (estimate: Estimate) => {
    setCurrentEstimate(estimate);
    setEstimatePanelMode('edit');
    setIsEstimatePanelOpen(true);
    closeOtherPanels('estimates');
  };

  const openEstimateForView = (estimate: Estimate) => {
    setCurrentEstimate(estimate);
    setEstimatePanelMode('view');
    setIsEstimatePanelOpen(true);
    closeOtherPanels('estimates');
  };

  const closeEstimatePanel = () => {
    setIsEstimatePanelOpen(false);
    setCurrentEstimate(null);
    setEstimatePanelMode('create');
  };

  const saveEstimate = async (estimateData: any): Promise<boolean> => {
    console.log('Validating estimate data:', estimateData);
    
    // Run validation
    const errors = validateEstimate(estimateData);
    
    if (errors.length > 0) {
      console.log('Validation failed:', errors);
      return false;
    }
    
    try {
      let savedEstimate: Estimate;
      
      if (currentEstimate) {
        // Update existing estimate
        savedEstimate = await api.updateEstimate(currentEstimate.id, estimateData);
        setEstimates(prev => prev.map(estimate => 
          estimate.id === currentEstimate.id ? {
            ...savedEstimate,
            validTo: new Date(savedEstimate.validTo),
            createdAt: new Date(savedEstimate.createdAt),
            updatedAt: new Date(savedEstimate.updatedAt),
          } : estimate
        ));
        setCurrentEstimate({
          ...savedEstimate,
          validTo: new Date(savedEstimate.validTo),
          createdAt: new Date(savedEstimate.createdAt),
          updatedAt: new Date(savedEstimate.updatedAt),
        });
        setEstimatePanelMode('view');
      } else {
        // Create new estimate
        savedEstimate = await api.createEstimate(estimateData);
        setEstimates(prev => [...prev, {
          ...savedEstimate,
          validTo: new Date(savedEstimate.validTo),
          createdAt: new Date(savedEstimate.createdAt),
          updatedAt: new Date(savedEstimate.updatedAt),
        }]);
        closeEstimatePanel();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save estimate:', error);
      return false;
    }
  };

  const deleteEstimate = async (id: string) => {
    console.log("Deleting estimate with id:", id);
    try {
      await api.deleteEstimate(id);
      setEstimates(prev => {
        const newEstimates = prev.filter(estimate => estimate.id !== id);
        console.log("Estimates after delete:", newEstimates);
        return newEstimates;
      });
    } catch (error) {
      console.error('Failed to delete estimate:', error);
    }
  };

  // Cross-plugin reference functions
  const getNotesForContact = (contactId: string): Note[] => {
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

  const getEstimatesForContact = (contactId: string): Estimate[] => {
    return estimates.filter(estimate => estimate.contactId === contactId);
  };

  return (
    <AppContext.Provider value={{
      // Auth state
      user,
      isAuthenticated,
      login,
      logout,
      isLoading,
      
      // Estimate state
      isEstimatePanelOpen,
      currentEstimate,
      estimatePanelMode,
      estimates,
      
      // Estimate actions
      openEstimatePanel,
      openEstimateForEdit,
      openEstimateForView,
      closeEstimatePanel,
      saveEstimate,
      deleteEstimate,
      
      // Cross-plugin references
      getNotesForContact,
      getContactsForNote,
      getEstimatesForContact,
      
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