import React, { useState, useEffect } from "react";
import { ContactList } from "./ContactList";
import { ContactDetails } from "./ContactDetails";
import { ContactForm } from "./ContactForm";
import { useApp } from "@/context/app-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Contact } from "@shared/schema";
import type { ContactFormValues } from "./contactFormSchema";
import { X, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// Helper to flatten contact data for API
const flattenContactData = (contactData: ContactFormValues) => {
  const isPrivate = contactData.contactType === "private";
  const fullName = isPrivate ? contactData.companyName : contactData.fullName;
  const companyName = isPrivate ? "" : contactData.companyName;
  return {
    contactType: contactData.contactType,
    fullName,
    email: contactData.email,
    phone: contactData.phone,
    address: contactData.visitingAddress || "",
    city: contactData.addressCity || "",
    companyName,
    organizationNumber: contactData.organizationNumber,
    vatNumber: contactData.vatNumber,
    fTax: contactData.fTax,
    companyType: contactData.companyType,
    industry: contactData.industry,
    addressType: contactData.addressType,
    visitingAddress: contactData.visitingAddress,
    mailingAddress: contactData.mailingAddress,
    postalCode: contactData.postalCode,
    addressCity: contactData.addressCity,
    region: contactData.region,
    country: contactData.country,
    phoneSwitchboard: contactData.phoneSwitchboard,
    phoneDirect: contactData.phoneDirect,
    emailGeneral: contactData.emailGeneral,
    emailInvoicing: contactData.emailInvoicing,
    emailOrders: contactData.emailOrders,
    website: contactData.website,
    // FIX: Send arrays directly, not JSON strings
    contactPersons: contactData.contactPersons || [],
    additionalAddresses: contactData.additionalAddresses || [],
    invoiceMethod: contactData.invoiceMethod,
    invoiceRequirements: contactData.invoiceRequirements,
    paymentTerms: contactData.paymentTerms,
    vatRate: contactData.vatRate
  };
};

// Content-only component for contact plugin
export function ContactPanel() {
  const {
    currentContact,
    isContactPanelOpen,
    isContactInEditMode,
    openContactPanel,
    closeContactPanel,
    setContactEditMode,
  } = useApp();

  // Local state for mode and selected contact
  const [mode, setMode] = useState<'list' | 'view' | 'edit' | 'create'>('list');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync local state with context
  useEffect(() => {
    if (!isContactPanelOpen) {
      setMode('list');
      setSelectedContact(null);
      return;
    }
    if (isContactInEditMode) {
      setMode('edit');
      setSelectedContact(currentContact);
    } else if (currentContact) {
      setMode('view');
      setSelectedContact(currentContact);
    } else {
      setMode('create');
      setSelectedContact(null);
    }
  }, [isContactPanelOpen, isContactInEditMode, currentContact]);

  // Handlers for child components
  const handleAddContact = () => {
    setMode('create');
    setSelectedContact(null);
    openContactPanel(null as any);
  };
  
  const handleViewContact = (contact: Contact) => {
    setMode('view');
    setSelectedContact(contact);
    openContactPanel(contact);
  };
  
  const handleEditContact = (contact: Contact) => {
    setMode('edit');
    setSelectedContact(contact);
    openContactPanel(contact);
    setContactEditMode(true);
  };
  
  const handleDone = () => {
    setMode('list');
    setSelectedContact(null);
    closeContactPanel();
    setContactEditMode(false);
  };

  // API mutation logic for create/edit
  const handleFormSubmit = async (data: ContactFormValues) => {
    console.log('🔵 Form submitted with data:', data);
    console.log('🔵 Mode:', mode);
    console.log('🔵 Contact ID:', selectedContact?.id);
    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        console.log('🟢 Creating contact with data:', data);
        const flatData = flattenContactData(data);
        console.log('🟢 Flattened data:', flatData);
        const result = await apiRequest("POST", "/api/contacts", flatData);
        console.log('🟢 API result:', result);
      } else if (mode === 'edit' && selectedContact) {
        console.log('🟡 Updating contact with data:', data);
        const flatData = flattenContactData(data);
        console.log('🟡 Flattened data:', flatData);
        const result = await apiRequest("PUT", `/api/contacts/${selectedContact.id}`, flatData);
        console.log('🟡 API result:', result);
      }
      // Invalidate queries to refresh list
      await queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      handleDone();
    } catch (error: unknown) {
      console.error('🔴 Error saving contact:', error);
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      alert('Error saving contact: ' + errorMessage);
    } finally {
      setIsSubmitting(false);
      console.log('🔵 After onSubmit call');
    }
  };

  const renderContent = () => {
    if (mode === 'list') {
      return <ContactList />;
    }
    if (mode === 'view' && selectedContact) {
      return (
        <ContactDetails
          contact={selectedContact}
          onEdit={() => handleEditContact(selectedContact)}
          onClose={handleDone}
        />
      );
    }
    if ((mode === 'edit' || mode === 'create')) {
      return (
        <ContactForm
          contact={mode === 'edit' ? selectedContact : null}
          mode={mode === 'edit' ? 'edit' : 'create'}
          onSubmit={handleFormSubmit}
          onCancel={handleDone}
          isSubmitting={isSubmitting}
          onChange={setHasUnsavedChanges}
        />
      );
    }
    return null;
  };

  const getPanelTitle = () => {
    if (mode === 'create') return 'Create Contact';
    if (mode === 'edit') return 'Edit Contact';
    if (mode === 'view') return selectedContact?.companyName || selectedContact?.fullName || 'Contact Details';
    return 'Contacts';
  };

  const getPanelSubtitle = () => {
    if (mode === 'create') return 'Enter new contact information';
    if (mode === 'edit') return 'Update contact details';
    if (mode === 'view') return 'View full contact details';
    return 'Manage your contacts';
  };

  // CONTENT WITH HEADER AND FOOTER - Better organized structure
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{getPanelTitle()}</h2>
          <p className="text-sm text-gray-500">{getPanelSubtitle()}</p>
        </div>
        <button
          className="p-2 hover:bg-gray-100 rounded-lg"
          onClick={handleDone}
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-6 space-y-6">
          {renderContent()}
        </div>
      </div>

      {/* Footer with Action Buttons */}
      {mode !== 'list' && (
        <div className="px-6 py-4 bg-white border-t border-gray-200">
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              onClick={handleDone}
              disabled={isSubmitting}
              className="inline-flex items-center px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-600 text-sm font-medium rounded-md transition-colors"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              form="contact-form"
              disabled={isSubmitting || !hasUnsavedChanges}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              {mode === "create" ? (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Contact
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}