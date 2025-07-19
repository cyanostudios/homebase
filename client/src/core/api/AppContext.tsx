import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Note } from '@/plugins/notes/types/notes';
import { Estimate } from '@/plugins/estimates/types/estimate';

interface Contact {
  id: string;
  contactNumber: string;
  contactType: 'company' | 'private';
  companyName: string;
  companyType?: string;
  organizationNumber?: string;
  vatNumber?: string;
  personalNumber?: string;
  contactPersons: any[];
  addresses: any[];
  email: string;
  phone: string;
  phone2: string;
  website: string;
  taxRate: string;
  paymentTerms: string;
  currency: string;
  fTax: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ValidationError {
  field: string;
  message: string;
}

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
  
  // Contact Panel State
  isContactPanelOpen: boolean;
  currentContact: Contact | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];
  
  // Contacts Data
  contacts: Contact[];
  
  // Contact Actions
  openContactPanel: (contact: Contact | null) => void;
  openContactForEdit: (contact: Contact) => void;
  openContactForView: (contact: Contact) => void;
  closeContactPanel: () => void;
  saveContact: (contactData: any) => Promise<boolean>;
  deleteContact: (id: string) => Promise<void>;
  clearValidationErrors: () => void;

  // Note Panel State
  isNotePanelOpen: boolean;
  currentNote: Note | null;
  notePanelMode: 'create' | 'edit' | 'view';
  
  // Notes Data
  notes: Note[];
  
  // Note Actions
  openNotePanel: (note: Note | null) => void;
  openNoteForEdit: (note: Note) => void;
  openNoteForView: (note: Note) => void;
  closeNotePanel: () => void;
  saveNote: (noteData: any) => Promise<boolean>;
  deleteNote: (id: string) => Promise<void>;

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

  // Cross-plugin references
  getNotesForContact: (contactId: string) => Note[];
  getContactsForNote: (noteId: string) => Contact[];
  getEstimatesForContact: (contactId: string) => Estimate[];
  
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

  // Contacts endpoints
  async getContacts() {
    return this.request('/contacts');
  },

  async createContact(contactData: any) {
    return this.request('/contacts', {
      method: 'POST',
      body: JSON.stringify(contactData),
    });
  },

  async updateContact(id: string, contactData: any) {
    return this.request(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(contactData),
    });
  },

  async deleteContact(id: string) {
    return this.request(`/contacts/${id}`, { method: 'DELETE' });
  },

  // Notes endpoints
  async getNotes() {
    return this.request('/notes');
  },

  async createNote(noteData: any) {
    return this.request('/notes', {
      method: 'POST',
      body: JSON.stringify(noteData),
    });
  },

  async updateNote(id: string, noteData: any) {
    return this.request(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(noteData),
    });
  },

  async deleteNote(id: string) {
    return this.request(`/notes/${id}`, { method: 'DELETE' });
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

  // Panel states
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  
  // Notes state
  const [isNotePanelOpen, setIsNotePanelOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [notePanelMode, setNotePanelMode] = useState<'create' | 'edit' | 'view'>('create');
  
  // Estimates state
  const [isEstimatePanelOpen, setIsEstimatePanelOpen] = useState(false);
  const [currentEstimate, setCurrentEstimate] = useState<Estimate | null>(null);
  const [estimatePanelMode, setEstimatePanelMode] = useState<'create' | 'edit' | 'view'>('create');
  
  // Data state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
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
        api.getContacts(),
        api.getNotes(),
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

  // Helper function to generate next contact number
  const generateNextContactNumber = (): string => {
    const existingNumbers = contacts.map(contact => parseInt(contact.contactNumber) || 0);
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    return nextNumber.toString().padStart(2, '0');
  };

  const validateContact = (contactData: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    // Contact number validation
    if (!contactData.contactNumber?.trim()) {
      errors.push({
        field: 'contactNumber',
        message: 'Contact number is required'
      });
    } else {
      // Check for duplicate contact numbers
      const existingContact = contacts.find(contact => 
        contact.id !== currentContact?.id && 
        contact.contactNumber === contactData.contactNumber.trim()
      );
      
      if (existingContact) {
        errors.push({
          field: 'contactNumber',
          message: `Contact number "${contactData.contactNumber}" already exists for "${existingContact.companyName}"`
        });
      }
    }
    
    // Required fields
    if (!contactData.companyName?.trim()) {
      errors.push({
        field: 'companyName',
        message: contactData.contactType === 'company' ? 'Company name is required' : 'Full name is required'
      });
    }
    
    // Company validations
    if (contactData.contactType === 'company') {
      if (contactData.organizationNumber?.trim()) {
        const existingContact = contacts.find(contact => 
          contact.id !== currentContact?.id && 
          contact.contactType === 'company' &&
          contact.organizationNumber === contactData.organizationNumber.trim()
        );
        
        if (existingContact) {
          errors.push({
            field: 'organizationNumber',
            message: `Organization number already exists for "${existingContact.companyName}"`
          });
        }
      }
    }
    
    // Private person validations
    if (contactData.contactType === 'private') {
      if (contactData.personalNumber?.trim()) {
        const existingContact = contacts.find(contact => 
          contact.id !== currentContact?.id && 
          contact.contactType === 'private' &&
          contact.personalNumber === contactData.personalNumber.trim()
        );
        
        if (existingContact) {
          errors.push({
            field: 'personalNumber',
            message: `Personal number already exists for "${existingContact.companyName}"`
          });
        }
      }
    }
    
    // Email validation (warning, not blocking)
    if (contactData.email?.trim()) {
      const existingContact = contacts.find(contact => 
        contact.id !== currentContact?.id && 
        contact.email === contactData.email.trim()
      );
      
      if (existingContact) {
        errors.push({
          field: 'email',
          message: `Email already exists for "${existingContact.companyName}" (Warning)`
        });
      }
    }
    
    return errors;
  };

  const validateNote = (noteData: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    if (!noteData.title?.trim()) {
      errors.push({
        field: 'title',
        message: 'Note title is required'
      });
    }
    
    if (!noteData.content?.trim()) {
      errors.push({
        field: 'content',
        message: 'Note content is required'
      });
    }
    
    return errors;
  };

  const validateEstimate = (estimateData: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    
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

  // Contact functions
  const openContactPanel = (contact: Contact | null) => {
    setCurrentContact(contact);
    setPanelMode(contact ? 'edit' : 'create');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
    setIsNotePanelOpen(false);
    setIsEstimatePanelOpen(false);
  };

  const openContactForEdit = (contact: Contact) => {
    setCurrentContact(contact);
    setPanelMode('edit');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
    setIsNotePanelOpen(false);
    setIsEstimatePanelOpen(false);
  };

  const openContactForView = (contact: Contact) => {
    setCurrentContact(contact);
    setPanelMode('view');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
    setIsNotePanelOpen(false);
    setIsEstimatePanelOpen(false);
  };

  const closeContactPanel = () => {
    setIsContactPanelOpen(false);
    setCurrentContact(null);
    setPanelMode('create');
    setValidationErrors([]);
  };

  const clearValidationErrors = () => {
    setValidationErrors([]);
  };

  const saveContact = async (contactData: any): Promise<boolean> => {
    console.log('Validating contact data:', contactData);
    
    // Auto-generate contact number for new contacts if not provided
    if (!currentContact && !contactData.contactNumber?.trim()) {
      contactData.contactNumber = generateNextContactNumber();
    }
    
    // Run validation
    const errors = validateContact(contactData);
    setValidationErrors(errors);
    
    // If there are blocking errors, don't save
    const blockingErrors = errors.filter(error => !error.message.includes('Warning'));
    if (blockingErrors.length > 0) {
      console.log('Validation failed:', blockingErrors);
      return false;
    }
    
    try {
      let savedContact: Contact;
      
      if (currentContact) {
        // Update existing contact
        savedContact = await api.updateContact(currentContact.id, contactData);
        setContacts(prev => prev.map(contact => 
          contact.id === currentContact.id ? {
            ...savedContact,
            createdAt: new Date(savedContact.createdAt),
            updatedAt: new Date(savedContact.updatedAt),
          } : contact
        ));
        setCurrentContact({
          ...savedContact,
          createdAt: new Date(savedContact.createdAt),
          updatedAt: new Date(savedContact.updatedAt),
        });
        setPanelMode('view');
        setValidationErrors([]);
      } else {
        // Create new contact
        savedContact = await api.createContact(contactData);
        setContacts(prev => [...prev, {
          ...savedContact,
          createdAt: new Date(savedContact.createdAt),
          updatedAt: new Date(savedContact.updatedAt),
        }]);
        closeContactPanel();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save contact:', error);
      setValidationErrors([{ field: 'general', message: 'Failed to save contact. Please try again.' }]);
      return false;
    }
  };

  const deleteContact = async (id: string) => {
    console.log("Deleting contact with id:", id);
    try {
      await api.deleteContact(id);
      setContacts(prev => {
        const newContacts = prev.filter(contact => contact.id !== id);
        console.log("Contacts after delete:", newContacts);
        return newContacts;
      });
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  };

  // Note functions
  const openNotePanel = (note: Note | null) => {
    setCurrentNote(note);
    setNotePanelMode(note ? 'edit' : 'create');
    setIsNotePanelOpen(true);
    setValidationErrors([]);
    setIsContactPanelOpen(false);
    setIsEstimatePanelOpen(false);
  };

  const openNoteForEdit = (note: Note) => {
    setCurrentNote(note);
    setNotePanelMode('edit');
    setIsNotePanelOpen(true);
    setValidationErrors([]);
    setIsContactPanelOpen(false);
    setIsEstimatePanelOpen(false);
  };

  const openNoteForView = (note: Note) => {
    setCurrentNote(note);
    setNotePanelMode('view');
    setIsNotePanelOpen(true);
    setValidationErrors([]);
    setIsContactPanelOpen(false);
    setIsEstimatePanelOpen(false);
  };

  const closeNotePanel = () => {
    setIsNotePanelOpen(false);
    setCurrentNote(null);
    setNotePanelMode('create');
    setValidationErrors([]);
  };

  const saveNote = async (noteData: any): Promise<boolean> => {
    console.log('Validating note data:', noteData);
    
    // Run validation
    const errors = validateNote(noteData);
    setValidationErrors(errors);
    
    if (errors.length > 0) {
      console.log('Validation failed:', errors);
      return false;
    }
    
    try {
      let savedNote: Note;
      
      if (currentNote) {
        // Update existing note
        savedNote = await api.updateNote(currentNote.id, noteData);
        setNotes(prev => prev.map(note => 
          note.id === currentNote.id ? {
            ...savedNote,
            createdAt: new Date(savedNote.createdAt),
            updatedAt: new Date(savedNote.updatedAt),
          } : note
        ));
        setCurrentNote({
          ...savedNote,
          createdAt: new Date(savedNote.createdAt),
          updatedAt: new Date(savedNote.updatedAt),
        });
        setNotePanelMode('view');
        setValidationErrors([]);
      } else {
        // Create new note
        savedNote = await api.createNote(noteData);
        setNotes(prev => [...prev, {
          ...savedNote,
          createdAt: new Date(savedNote.createdAt),
          updatedAt: new Date(savedNote.updatedAt),
        }]);
        closeNotePanel();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save note:', error);
      setValidationErrors([{ field: 'general', message: 'Failed to save note. Please try again.' }]);
      return false;
    }
  };

  const deleteNote = async (id: string) => {
    console.log("Deleting note with id:", id);
    try {
      await api.deleteNote(id);
      setNotes(prev => {
        const newNotes = prev.filter(note => note.id !== id);
        console.log("Notes after delete:", newNotes);
        return newNotes;
      });
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  // Estimate functions
  const openEstimatePanel = (estimate: Estimate | null) => {
    setCurrentEstimate(estimate);
    setEstimatePanelMode(estimate ? 'edit' : 'create');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    setIsContactPanelOpen(false);
    setIsNotePanelOpen(false);
  };

  const openEstimateForEdit = (estimate: Estimate) => {
    setCurrentEstimate(estimate);
    setEstimatePanelMode('edit');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    setIsContactPanelOpen(false);
    setIsNotePanelOpen(false);
  };

  const openEstimateForView = (estimate: Estimate) => {
    setCurrentEstimate(estimate);
    setEstimatePanelMode('view');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    setIsContactPanelOpen(false);
    setIsNotePanelOpen(false);
  };

  const closeEstimatePanel = () => {
    setIsEstimatePanelOpen(false);
    setCurrentEstimate(null);
    setEstimatePanelMode('create');
    setValidationErrors([]);
  };

  const saveEstimate = async (estimateData: any): Promise<boolean> => {
    console.log('Validating estimate data:', estimateData);
    
    // Run validation
    const errors = validateEstimate(estimateData);
    setValidationErrors(errors);
    
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
        setValidationErrors([]);
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
      setValidationErrors([{ field: 'general', message: 'Failed to save estimate. Please try again.' }]);
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
      
      // Contact state
      isContactPanelOpen,
      currentContact,
      panelMode,
      validationErrors,
      contacts,
      
      // Contact actions
      openContactPanel,
      openContactForEdit,
      openContactForView,
      closeContactPanel,
      saveContact,
      deleteContact,
      clearValidationErrors,
      
      // Note state
      isNotePanelOpen,
      currentNote,
      notePanelMode,
      notes,
      
      // Note actions
      openNotePanel,
      openNoteForEdit,
      openNoteForView,
      closeNotePanel,
      saveNote,
      deleteNote,
      
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