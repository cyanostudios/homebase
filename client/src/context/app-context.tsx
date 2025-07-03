import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Invoice, Contact, ContactAssignment, Activity } from "@shared/schema";
import type { DashboardStats } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Panel type enum to identify panel types
enum PanelType {
  INVOICE = 'invoice',
}

// Interface for panel data
interface PanelData {
  type: PanelType;
  data: Invoice;
}

interface AppContextType {
  // Invoice state
  currentInvoice: Invoice | null;
  isInvoicePanelOpen: boolean;
  isInvoiceCreatePanelOpen: boolean;
  shouldAnimatePanel: boolean;
  isInvoiceInEditMode: boolean;
  
  // Contact panel state
  currentContact: Contact | null;
  isContactPanelOpen: boolean;
  isContactInEditMode: boolean;
  
  // Queries
  dashboardStats: DashboardStats | undefined;
  isLoadingStats: boolean;
  
  // Invoice actions
  openInvoicePanel: (invoice: Invoice) => void;
  closeInvoicePanel: () => void;
  openInvoiceCreatePanel: () => void;
  closeInvoiceCreatePanel: () => void;
  closePanel: () => void; // General close method that handles panel navigation
  notifyContact: (assignmentId: number) => Promise<void>;
  assignContact: (invoiceId: number, contactId: number, role: string) => Promise<void>;
  unassignContact: (assignmentId: number) => Promise<void>;
  updateInvoice: (invoiceId: number, invoiceData: Partial<Invoice>) => Promise<void>;
  updateContactStatus: (assignmentId: number, status: string) => Promise<void>;
  setInvoiceEditMode: (isEditing: boolean) => void;
  
  // Contact actions
  openContactPanel: (contact: Contact) => void;
  closeContactPanel: () => void;
  setContactEditMode: (isEditing: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  // Invoice state
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [isInvoicePanelOpen, setIsInvoicePanelOpen] = useState(false);
  const [isInvoiceCreatePanelOpen, setIsInvoiceCreatePanelOpen] = useState(false);
  const [shouldAnimatePanel, setShouldAnimatePanel] = useState(true);
  const [isInvoiceInEditMode, setIsInvoiceInEditMode] = useState(false);
  
  // Contact state
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [isContactInEditMode, setIsContactInEditMode] = useState(false);
  
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
    const panelWasEmpty = !isInvoicePanelOpen && !isInvoiceCreatePanelOpen;
    setShouldAnimatePanel(panelWasEmpty);
    
    setCurrentInvoice(invoice);
    setIsInvoicePanelOpen(true);
    document.body.classList.add('overflow-hidden');
  };
  
  const closeInvoicePanel = () => {
    setIsInvoicePanelOpen(false);
    document.body.classList.remove('overflow-hidden');
  };
  
  const openInvoiceCreatePanel = () => {
    const panelWasEmpty = !isInvoicePanelOpen && !isInvoiceCreatePanelOpen;
    setShouldAnimatePanel(panelWasEmpty);
    
    setIsInvoicePanelOpen(false);
    setIsInvoiceCreatePanelOpen(true);
    document.body.classList.add('overflow-hidden');
  };
  
  const closeInvoiceCreatePanel = () => {
    setIsInvoiceCreatePanelOpen(false);
    document.body.classList.remove('overflow-hidden');
  };
  
  const closePanel = () => {
    setIsInvoicePanelOpen(false);
    setIsInvoiceCreatePanelOpen(false);
    document.body.classList.remove('overflow-hidden');
  };
  
  const notifyContact = async (assignmentId: number) => {
    try {
      await apiRequest('POST', `/api/assignments/${assignmentId}/notify`);
      
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      if (currentInvoice) {
        queryClient.invalidateQueries({ queryKey: [`/api/invoices/${currentInvoice.id}/assignments`] });
      }
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
      
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${invoiceId}/assignments`] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices-with-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      toast({
        title: "Contact assigned",
        description: "The contact has been assigned to the invoice",
      });
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number; data?: { message?: string } } };

      if (err?.message?.includes("already assigned") ||
          (err?.response?.status === 400 && err?.response?.data?.message?.includes("already assigned"))) {
        throw err;
      }
      
      toast({
        title: "Assignment failed",
        description: "There was a problem assigning the contact",
        variant: "destructive",
      });
      throw err;
    }
  };
  
  const unassignContact = async (assignmentId: number) => {
    try {
      await apiRequest('DELETE', `/api/assignments/${assignmentId}`);
      
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      if (currentInvoice) {
        queryClient.invalidateQueries({ queryKey: [`/api/invoices/${currentInvoice.id}/assignments`] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/invoices-with-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      toast({
        title: "Contact unassigned",
        description: "The contact has been unassigned from the invoice",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unassign contact",
        variant: "destructive",
      });
    }
  };
  
  const updateInvoice = async (invoiceId: number, invoiceData: Partial<Invoice>) => {
    try {
      await apiRequest('PUT', `/api/invoices/${invoiceId}`, invoiceData);
      
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${invoiceId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices-with-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      toast({
        title: "Invoice updated",
        description: "The invoice has been updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update invoice",
        variant: "destructive",
      });
    }
  };
  
  const updateContactStatus = async (assignmentId: number, status: string) => {
    try {
      await apiRequest('PUT', `/api/assignments/${assignmentId}/status`, { status });
      
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      if (currentInvoice) {
        queryClient.invalidateQueries({ queryKey: [`/api/invoices/${currentInvoice.id}/assignments`] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/invoices-with-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      toast({
        title: "Assignment status updated",
        description: "The contact assignment status has been updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update assignment status",
        variant: "destructive",
      });
    }
  };
  
  const setInvoiceEditMode = (isEditing: boolean) => {
    setIsInvoiceInEditMode(isEditing);
  };

  // Contact panel functions
  const openContactPanel = (contact: Contact | null) => {
    setCurrentContact(contact);
    setIsContactPanelOpen(true);
    document.body.classList.add('overflow-hidden');
  };

  const closeContactPanel = () => {
    setIsContactPanelOpen(false);
    document.body.classList.remove('overflow-hidden');
  };

  const setContactEditMode = (isEditing: boolean) => {
    setIsContactInEditMode(isEditing);
  };

  return (
    <AppContext.Provider 
      value={{ 
        // Invoice state
        currentInvoice,
        isInvoicePanelOpen,
        isInvoiceCreatePanelOpen,
        shouldAnimatePanel,
        isInvoiceInEditMode,
        
        // Contact state
        currentContact,
        isContactPanelOpen,
        isContactInEditMode,
        
        // Queries
        dashboardStats,
        isLoadingStats,
        
        // Invoice actions
        openInvoicePanel,
        closeInvoicePanel,
        openInvoiceCreatePanel,
        closeInvoiceCreatePanel,
        closePanel,
        notifyContact,
        assignContact,
        unassignContact,
        updateInvoice,
        updateContactStatus,
        setInvoiceEditMode,
        
        // Contact actions
        openContactPanel,
        closeContactPanel,
        setContactEditMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}