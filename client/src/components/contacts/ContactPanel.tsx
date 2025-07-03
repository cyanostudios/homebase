import React, { useState, useEffect } from "react";
import { ContactList } from "./ContactList";
import { ContactDetails } from "./ContactDetails";
import { ContactForm } from "./ContactForm";
import { useApp } from "@/context/app-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Contact } from "@shared/schema";
import type { ContactFormValues } from "./contactFormSchema";

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

// Main orchestrator for contact plugin
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
    openContactPanel(null as any); // null = create mode
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
    } catch (error) {
      console.error('🔴 Error saving contact:', error);
      alert('Error saving contact: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
      console.log('🔵 After onSubmit call');
    }
  };

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
      />
    );
  }
  return null;
}