import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Invoice, Contact, ContactAssignment, Activity } from "@shared/schema";
import type { DashboardStats } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Panel type enum to identify panel types
enum PanelType {
  INVOICE = 'invoice',
  CONTACT = 'contact'
}

// Interface for panel data
interface PanelData {
  type: PanelType;
  data: Invoice | Contact;
}

interface AppContextType {
  // State
  currentInvoice: Invoice | null;
  currentContact: Contact | null;
  isInvoicePanelOpen: boolean;
  isContactPanelOpen: boolean;
  isInvoiceCreatePanelOpen: boolean;
  isContactCreatePanelOpen: boolean;
  shouldAnimatePanel: boolean;
  isInvoiceInEditMode: boolean;
  isContactInEditMode: boolean;
  
  // Queries
  dashboardStats: DashboardStats | undefined;
  isLoadingStats: boolean;
  
  // Actions
  openInvoicePanel: (invoice: Invoice) => void;
  closeInvoicePanel: () => void;
  openContactPanel: (contact: Contact) => void;
  closeContactPanel: () => void;
  openInvoiceCreatePanel: () => void;
  closeInvoiceCreatePanel: () => void;
  openContactCreatePanel: () => void;
  closeContactCreatePanel: () => void;
  closePanel: () => void; // General close method that handles panel navigation
  notifyContact: (assignmentId: number) => Promise<void>;
  assignContact: (invoiceId: number, contactId: number, role: string) => Promise<void>;
  unassignContact: (assignmentId: number) => Promise<void>;
  updateInvoice: (invoiceId: number, invoiceData: Partial<Invoice>) => Promise<void>;
  updateContact: (contactData: Contact) => Promise<void>;
  updateContactStatus: (assignmentId: number, status: string) => Promise<void>;
  setInvoiceEditMode: (isEditing: boolean) => void;
  setContactEditMode: (isEditing: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [isInvoicePanelOpen, setIsInvoicePanelOpen] = useState(false);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [isInvoiceCreatePanelOpen, setIsInvoiceCreatePanelOpen] = useState(false);
  const [isContactCreatePanelOpen, setIsContactCreatePanelOpen] = useState(false);
  const [shouldAnimatePanel, setShouldAnimatePanel] = useState(true);
  const [isInvoiceInEditMode, setIsInvoiceInEditMode] = useState(false);
  const [isContactInEditMode, setIsContactInEditMode] = useState(false);
  
  // Current and previous panel state
  const [currentPanel, setCurrentPanel] = useState<PanelData | null>(null);
  const [previousPanel, setPreviousPanel] = useState<PanelData | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Fetch dashboard stats
  const { 
    data: dashboardStats,
    isLoading: isLoadingStats
  } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });
  
  const openInvoicePanel = (invoice: Invoice) => {
    
    // Determine if we should animate the transition
    const panelWasEmpty = !isInvoicePanelOpen && !isContactPanelOpen;
    setShouldAnimatePanel(panelWasEmpty); // Only animate when opening first panel
    
    // Disable previous panel navigation - we want only one panel at a time
    setPreviousPanel(null);
    
    // Update current panel
    setCurrentPanel({
      type: PanelType.INVOICE,
      data: invoice
    });
    
    // Close any open panels first
    setIsContactPanelOpen(false);
    setIsInvoiceCreatePanelOpen(false);
    setIsContactCreatePanelOpen(false);
    
    // Set a small delay to avoid UI flicker when switching between panels
    setTimeout(() => {
      setCurrentInvoice(invoice);
      setIsInvoicePanelOpen(true);
      document.body.classList.add('overflow-hidden');

    }, 50);
  };
  
  const closeInvoicePanel = () => {
    // Simply close the panel - no navigation to previous panels
    setIsInvoicePanelOpen(false);
    document.body.classList.remove('overflow-hidden');
  };
  
  const openContactPanel = (contact: Contact) => {
    
    // Determine if we should animate the transition
    const panelWasEmpty = !isInvoicePanelOpen && !isContactPanelOpen;
    setShouldAnimatePanel(panelWasEmpty); // Only animate when opening first panel
    
    // Disable previous panel navigation - we want only one panel at a time
    setPreviousPanel(null);
    
    // Update current panel
    setCurrentPanel({
      type: PanelType.CONTACT,
      data: contact
    });
    
    // Close any open panels first
    setIsInvoicePanelOpen(false);
    setIsInvoiceCreatePanelOpen(false);
    setIsContactCreatePanelOpen(false);
    
    // Set contact immediately
    setCurrentContact(contact);
    setIsContactPanelOpen(true);
    document.body.classList.add('overflow-hidden');
  };
  
  const closeContactPanel = () => {
    // Simply close the panel - no navigation to previous panels
    setIsContactPanelOpen(false);
    document.body.classList.remove('overflow-hidden');
  };

  const openInvoiceCreatePanel = () => {
    // Determine if we should animate the transition
    const panelWasEmpty = !isInvoicePanelOpen && !isContactPanelOpen;
    setShouldAnimatePanel(panelWasEmpty);
    
    setPreviousPanel(null);
    
    // Close any open panels first
    setIsInvoicePanelOpen(false);
    setIsContactPanelOpen(false);
    setIsContactCreatePanelOpen(false);
    
    // Open invoice create panel
    setIsInvoiceCreatePanelOpen(true);
    document.body.classList.add('overflow-hidden');
  };
  
  const closeInvoiceCreatePanel = () => {
    setIsInvoiceCreatePanelOpen(false);
    document.body.classList.remove('overflow-hidden');
  };

  const openContactCreatePanel = () => {
    // Determine if we should animate the transition
    const panelWasEmpty = !isInvoicePanelOpen && !isContactPanelOpen;
    setShouldAnimatePanel(panelWasEmpty);
    
    setPreviousPanel(null);
    
    // Close any open panels first
    setIsInvoicePanelOpen(false);
    setIsContactPanelOpen(false);
    setIsInvoiceCreatePanelOpen(false);
    
    // Open contact create panel
    setIsContactCreatePanelOpen(true);
    document.body.classList.add('overflow-hidden');
  };
  
  const closeContactCreatePanel = () => {
    setIsContactCreatePanelOpen(false);
    document.body.classList.remove('overflow-hidden');
  };
  
  // General close panel method - simply closes all panels
  const closePanel = () => {
    // Close all panels
    setIsInvoicePanelOpen(false);
    setIsContactPanelOpen(false);
    setIsInvoiceCreatePanelOpen(false);
    setIsContactCreatePanelOpen(false);
    document.body.classList.remove('overflow-hidden');
  };
  
  const notifyContact = async (assignmentId: number) => {
    try {
      await apiRequest('POST', `/api/assignments/${assignmentId}/notify`);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      if (currentInvoice) {
        queryClient.invalidateQueries({ queryKey: [`/api/invoices/${currentInvoice.id}/assignments`] });
      }
      // Also invalidate the invoices with assignments query to refresh the table
      queryClient.invalidateQueries({ queryKey: ['/api/invoices-with-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      toast({
        title: "Notification sent",
        description: "The contact has been notified",
      });
    } catch (error) {

      toast({
        title: "Notification failed",
        description: "There was a problem sending the notification",
        variant: "destructive",
      });
    }
  };
  
  const assignContact = async (invoiceId: number, contactId: number, role: string) => {
    try {
      await apiRequest('POST', '/api/assignments', {
        invoiceId,
        contactId,
        role,
        status: "NOT_NOTIFIED"
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${invoiceId}/assignments`] });
      // Also invalidate the invoices with assignments query to refresh the invoice table
      queryClient.invalidateQueries({ queryKey: ['/api/invoices-with-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      toast({
        title: "Contact assigned",
        description: "The contact has been assigned to the invoice",
      });
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number; data?: { message?: string } } };

      
      // Check if this is an "already assigned" error - if so, throw it so the calling component can handle it
      if (err?.message?.includes("already assigned") ||
          (err?.response?.status === 400 && err?.response?.data?.message?.includes("already assigned"))) {
        throw err; // Re-throw so the calling component can show the specific alert
      }
      
      // For other errors, show the generic toast
      toast({
        title: "Assignment failed",
        description: "There was a problem assigning the contact",
        variant: "destructive",
      });
      throw err; // Re-throw other errors too
    }
  };
  
  const unassignContact = async (assignmentId: number) => {
    try {
      await apiRequest('DELETE', `/api/assignments/${assignmentId}`);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      if (currentInvoice) {
        queryClient.invalidateQueries({ queryKey: [`/api/invoices/${currentInvoice.id}/assignments`] });
      }
      // Also invalidate the invoices with assignments query to refresh the table
      queryClient.invalidateQueries({ queryKey: ['/api/invoices-with-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      toast({
        title: "Contact unassigned",
        description: "The contact has been removed from the invoice",
      });
    } catch (error) {

      toast({
        title: "Unassignment failed",
        description: "There was a problem removing the contact",
        variant: "destructive",
      });
    }
  };
  
  const updateInvoice = async (invoiceId: number, invoiceData: Partial<Invoice>) => {
    try {
      const updatedInvoice = await apiRequest('PUT', `/api/invoices/${invoiceId}`, invoiceData);
      
      // Invalidate and refetch relevant queries
      await queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      await queryClient.invalidateQueries({ queryKey: [`/api/invoices/${invoiceId}`] });
      await queryClient.invalidateQueries({ queryKey: ['/api/invoices-with-assignments'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      // Force refetch activities to ensure logs update immediately
      await queryClient.refetchQueries({ queryKey: ['/api/activities'] });
      
      // Update the current invoice state if it's the currently selected invoice
      if (currentInvoice && currentInvoice.id === invoiceId) {
        // Use apiRequest to get the updated invoice data for consistency
        const response = await apiRequest('GET', `/api/invoices/${invoiceId}`);
        const updatedInvoiceData: Invoice = await response.json();

        setCurrentInvoice(updatedInvoiceData);
      }
      
      toast({
        title: "Invoice updated",
        description: "The invoice details have been updated",
      });
    } catch (error) {

      toast({
        title: "Update failed",
        description: "There was a problem updating the invoice",
        variant: "destructive",
      });
    }
  };
  
  const updateContact = async (contactData: Contact) => {
    try {
      // Invalidate and refetch relevant queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      await queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactData.id}`] });
      await queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      // Force refetch activities to ensure logs update immediately
      await queryClient.refetchQueries({ queryKey: ['/api/activities'] });
      
      // Update the current contact state if it's the currently selected contact
      if (currentContact && currentContact.id === contactData.id) {
        // Fetch the latest contact data from the server
        const response = await fetch(`/api/contacts/${contactData.id}`);
        if (response.ok) {
          const updatedContactData = await response.json();
          setCurrentContact(updatedContactData);
        } else {
          // Fallback to provided data if fetch fails
          setCurrentContact(contactData);
        }
      }
    } catch (error) {
      console.error("Failed to update contact state:", error);
      // Fallback to provided data if there's an error
      if (currentContact && currentContact.id === contactData.id) {
        setCurrentContact(contactData);
      }
    }
  };
  
  const updateContactStatus = async (assignmentId: number, status: string) => {
    try {
      await apiRequest('PUT', `/api/assignments/${assignmentId}`, { status });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      if (currentInvoice) {
        queryClient.invalidateQueries({ queryKey: [`/api/invoices/${currentInvoice.id}/assignments`] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/invoices-with-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      toast({
        title: "Status updated",
        description: "The contact status has been updated",
      });
    } catch (error) {
      console.error("Failed to update contact status:", error);
      toast({
        title: "Update failed",
        description: "There was a problem updating the contact status",
        variant: "destructive",
      });
    }
  };





  const setInvoiceEditMode = (isEditing: boolean) => {
    setIsInvoiceInEditMode(isEditing);
  };

  const setContactEditMode = (isEditing: boolean) => {
    setIsContactInEditMode(isEditing);
  };

  return (
    <AppContext.Provider
      value={{
        currentInvoice,
        currentContact,
        isInvoicePanelOpen,
        isContactPanelOpen,
        isInvoiceCreatePanelOpen,
        isContactCreatePanelOpen,
        shouldAnimatePanel,
        dashboardStats,
        isLoadingStats,
        openInvoicePanel,
        closeInvoicePanel,
        openContactPanel,
        closeContactPanel,
        openInvoiceCreatePanel,
        closeInvoiceCreatePanel,
        openContactCreatePanel,
        closeContactCreatePanel,
        closePanel,
        notifyContact,
        assignContact,
        unassignContact,
        updateInvoice,
        updateContact,
        updateContactStatus,
        isInvoiceInEditMode,
        isContactInEditMode,
        setInvoiceEditMode,
        setContactEditMode
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
