import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ContactFormValues } from "./contactFormSchema";
import { EnhancedContactForm } from "./EnhancedContactForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { X, Edit, Check, AlertCircle } from "lucide-react";
import { Contact, Activity, ActivityType } from "@/lib/types";
import { formatDistance } from "date-fns";
import { formatTime } from "@/lib/date-utils";
import { useTimeFormat } from "@/context/time-format-context";
import { cn } from "@/lib/utils";

interface ContactPanelProps {
  mode: "create" | "edit" | "view";
  isOpen: boolean;
  onClose: () => void;
  contactId?: number; // Required for edit and view modes
  onModeChange?: (mode: "create" | "edit" | "view") => void;
}

// Helper function to safely parse JSON fields
const parseJsonField = (field: any): any[] => {
  if (typeof field === 'string' && field.trim() !== '') {
    try {
      return JSON.parse(field);
    } catch (e) {
      console.warn('Failed to parse JSON field:', field);
      return [];
    }
  }
  return Array.isArray(field) ? field : [];
};

// Helper function to flatten contact data for API
const flattenContactData = (contactData: ContactFormValues) => {
  const isPrivate = contactData.contactType === "private";
  const fullName = isPrivate ? contactData.companyName : contactData.fullName;
  const companyName = isPrivate ? "" : contactData.companyName;

  return {
    // Persist contact type
    contactType: contactData.contactType,

    // Basic information
    fullName,
    email: contactData.email,
    phone: contactData.phone,
    address: contactData.visitingAddress || "",
    city: contactData.addressCity || "",

    // Company information
    companyName,
    organizationNumber: contactData.organizationNumber,
    vatNumber: contactData.vatNumber,
    fTax: contactData.fTax,
    companyType: contactData.companyType,
    industry: contactData.industry,

  // Address details
  addressType: contactData.addressType,
  visitingAddress: contactData.visitingAddress,
  mailingAddress: contactData.mailingAddress,
  postalCode: contactData.postalCode,
  addressCity: contactData.addressCity,
  region: contactData.region,
  country: contactData.country,

  // Contact details
  phoneSwitchboard: contactData.phoneSwitchboard,
  phoneDirect: contactData.phoneDirect,
  emailGeneral: contactData.emailGeneral,
  emailInvoicing: contactData.emailInvoicing,
  emailOrders: contactData.emailOrders,
  website: contactData.website,

  // JSON fields - stringify arrays/objects
  contactPersons: JSON.stringify(contactData.contactPersons || []),
  additionalAddresses: JSON.stringify(contactData.additionalAddresses || []),


  // Invoice information
  invoiceMethod: contactData.invoiceMethod,
  invoiceRequirements: contactData.invoiceRequirements,
  paymentTerms: contactData.paymentTerms,
  vatRate: contactData.vatRate
  };
};

// Convert contact data to form values for edit mode
const normalizeContactType = (type: any): "company" | "private" => {
  if (!type) return "company";
  const val = String(type).toLowerCase();
  return val === "private" || val === "individual" ? "private" : "company";
};

const getContactFormValues = (contact: Contact | null): Partial<ContactFormValues> => {
  if (!contact) {
    return {
      contactType: "company" as const,
      fullName: "",
      email: "",
      phone: "",
      companyName: "",
      address: "",
      city: ""
    };
  }

  // Determine contact type based on available data
  const hasCompanyName = !!(contact as any)?.companyName;
  const hasFullName = !!contact?.fullName;
  const inferredContactType = hasCompanyName ? "company" : (hasFullName ? "private" : "company");

  const contactType = normalizeContactType((contact as any)?.contactType) || inferredContactType;
  const name = contact.fullName || (contact as any)?.companyName || "";

  return {
    contactType,
    fullName: contact.fullName || "",
    // use a single input field for the name
    companyName: name,
    organizationNumber: (contact as any)?.organizationNumber || "",
    vatNumber: (contact as any)?.vatNumber || "",
    fTax: (contact as any)?.fTax || false,
    companyType: (contact as any)?.companyType || "",
    industry: (contact as any)?.industry || "",
    addressType: (contact as any)?.addressType || "",
    visitingAddress: (contact as any)?.visitingAddress || "",
    mailingAddress: (contact as any)?.mailingAddress || "",
    postalCode: (contact as any)?.postalCode || "",
    addressCity: (contact as any)?.addressCity || "",
    region: (contact as any)?.region || "",
    country: (contact as any)?.country || "",
    phoneSwitchboard: (contact as any)?.phoneSwitchboard || "",
    phoneDirect: (contact as any)?.phoneDirect || "",
    emailGeneral: (contact as any)?.emailGeneral || "",
    emailInvoicing: (contact as any)?.emailInvoicing || "",
    emailOrders: (contact as any)?.emailOrders || "",
    website: (contact as any)?.website || "",
    contactPersons: parseJsonField((contact as any)?.contactPersons),
    additionalAddresses: parseJsonField((contact as any)?.additionalAddresses),
    invoiceMethod: (contact as any)?.invoiceMethod || "Email",
    invoiceRequirements: (contact as any)?.invoiceRequirements || "",
    paymentTerms: (contact as any)?.paymentTerms || "net_14",
    vatRate: (contact as any)?.vatRate || "25%",
    email: contact.email || "",
    phone: contact.phone || "",
  };
};

export function ContactPanel({ 
  mode, 
  isOpen, 
  onClose, 
  contactId, 
  onModeChange 
}: ContactPanelProps) {
  const { toast } = useToast();
  const { timeFormat } = useTimeFormat();

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Validation: contactId is required for edit and view modes
  useEffect(() => {
    if ((mode === "edit" || mode === "view") && !contactId) {
      console.error("ContactPanel: contactId is required for edit and view modes");
    }
  }, [mode, contactId]);

  // Reset change state when contact data changes
  useEffect(() => {
    setHasUnsavedChanges(false);
  }, [contactData]);

  useEffect(() => {
    if (mode !== "edit") {
      setHasUnsavedChanges(false);
    }
  }, [mode]);

  // Fetch contact data for edit and view modes
  const {
    data: contactData,
    isLoading: isLoadingContact,
    error: contactError
  } = useQuery<Contact>({
    queryKey: [`/api/contacts/${contactId}`],
    enabled: (mode === "edit" || mode === "view") && !!contactId,
    retry: false,
  });

  // Get recent activities for this contact
  const { data: activities } = useQuery<Activity[]>({
    queryKey: ['/api/activities'],
    enabled: !!contactId,
  });

  // Invalidate queries helper
  const invalidateContactQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    if (contactId) {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}`] });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
  };

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (contactData: ContactFormValues) => {
      const flatData = flattenContactData(contactData);
      return await apiRequest("POST", "/api/contacts", flatData);
    },
    onSuccess: () => {
      invalidateContactQueries();
      toast({
        title: "Contact created",
        description: "The contact has been created successfully.",
      });
      onClose();
    },
    onError: (error: any) => {
      console.error("Create contact error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create contact. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async (contactData: ContactFormValues) => {
      if (!contactId) {
        throw new Error("Contact ID is required for updates");
      }

      const flatData = flattenContactData(contactData);
      return await apiRequest("PUT", `/api/contacts/${contactId}`, flatData);
    },
    onSuccess: () => {
      invalidateContactQueries();
      toast({
        title: "Contact updated",
        description: "The contact has been updated successfully.",
      });
      setHasUnsavedChanges(false);
    },
    onError: (error: any) => {
      console.error("Update contact error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update contact. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const handleSubmit = (data: ContactFormValues) => {
    if (mode === "create") {
      createContactMutation.mutate(data);
    } else if (mode === "edit") {
      updateContactMutation.mutate(data);
    }
  };

  // Mode change handlers
  const handleEdit = () => onModeChange?.("edit");
  const handleCancelEdit = () => {
    setHasUnsavedChanges(false);
    onModeChange?.("view");
  };
  const handleFormChange = (dirty: boolean) => setHasUnsavedChanges(dirty);


  // Get panel title based on mode
  const getPanelTitle = () => {
    switch (mode) {
      case "create":
        return "Add New Contact";
      case "edit":
        return "Edit Contact";
      case "view":
        if (contactData) {
          const hasCompanyName = !!(contactData as any)?.companyName;
          const displayName = hasCompanyName 
            ? (contactData as any).companyName 
            : (contactData as Contact).fullName || "Contact";
          return displayName;
        }
        return "Contact Details";
      default:
        return "Contact";
    }
  };

  // Get panel subtitle based on mode
  const getPanelSubtitle = () => {
    switch (mode) {
      case "create":
        return "Enter comprehensive company information";
      case "edit":
        return "Update contact information";
      case "view":
        if (contactData && (contactData as any)?.organizationNumber) {
          return `Org. Nr: ${(contactData as any).organizationNumber}`;
        }
        return "Contact Information";
      default:
        return "";
    }
  };

  const renderContactDetails = (data: Contact) => {
    const basicFields = [
      { label: 'Type', value: normalizeContactType((data as any).contactType) === 'private' ? 'Private' : 'Company' },
      { label: 'Full Name', value: data.fullName },
      { label: 'Company Name', value: (data as any).companyName },
      { label: 'Email', value: data.email },
      { label: 'Phone', value: data.phone },
      { label: 'Organization Number', value: (data as any).organizationNumber },
      { label: 'VAT Number', value: (data as any).vatNumber },
      { label: 'Visiting Address', value: (data as any).visitingAddress },
      { label: 'Mailing Address', value: (data as any).mailingAddress },
      { label: 'City', value: (data as any).addressCity },
      { label: 'Region', value: (data as any).region },
      { label: 'Country', value: (data as any).country },
      { label: 'Website', value: (data as any).website },
      { label: 'Phone Switchboard', value: (data as any).phoneSwitchboard },
      { label: 'Phone Direct', value: (data as any).phoneDirect },
      { label: 'Email General', value: (data as any).emailGeneral },
      { label: 'Email Invoicing', value: (data as any).emailInvoicing },
      { label: 'Email Orders', value: (data as any).emailOrders },
      { label: 'F-tax', value: (data as any).fTax ? 'Yes' : 'No' },
      { label: 'Invoice Method', value: (data as any).invoiceMethod },
      { label: 'Invoice Requirements', value: (data as any).invoiceRequirements },
      { label: 'Payment Terms', value: (data as any).paymentTerms },
      { label: 'VAT Rate', value: (data as any).vatRate },
    ];

    const contactPersons = parseJsonField((data as any).contactPersons);
    const additionalAddresses = parseJsonField((data as any).additionalAddresses);

    return (
      <Card className="mb-4 border-none shadow-none">
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {basicFields
              .filter((f) => f.value && f.value !== '')
              .map((f) => (
                <div key={f.label} className="space-y-1">
                  <p className="text-xs text-neutral-500">{f.label}</p>
                  <p className="text-sm font-medium text-neutral-900 break-words">
                    {String(f.value)}
                  </p>
                </div>
              ))}
          </div>
          {contactPersons.length > 0 && (
            <div className="pt-4">
              <p className="text-xs font-medium text-neutral-500 mb-1">
                Contact Persons
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {contactPersons.map((p: any, idx: number) => (
                  <li key={idx} className="text-sm text-neutral-900">
                    {p.firstName} {p.lastName} {p.title && `- ${p.title}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {additionalAddresses.length > 0 && (
            <div className="pt-4">
              <p className="text-xs font-medium text-neutral-500 mb-1">
                Additional Addresses
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {additionalAddresses.map((a: any, idx: number) => (
                  <li key={idx} className="text-sm text-neutral-900">
                    {a.visitingAddress} {a.addressCity}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderViewMode = () => {
    if (!contactData) return null;

    if (Array.isArray(contactData)) {
      return (
        <div className="p-6 space-y-4">
          <Accordion type="multiple" className="w-full">
            {contactData.map((c) => {
              const name = (c as any).companyName || c.fullName || 'Contact';
              return (
                <AccordionItem key={c.id} value={String(c.id)}>
                  <AccordionTrigger>{name}</AccordionTrigger>
                  <AccordionContent>{renderContactDetails(c)}</AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      );
    }

    return (
      <div className="p-6 space-y-6">
        {renderContactDetails(contactData as Contact)}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={handleEdit}
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </Button>
        </div>
      </div>
    );
  };

const renderEditMode = () => (
  <div className="p-6 space-y-4">
    <EnhancedContactForm
      onSubmit={handleSubmit}
      isSubmitting={updateContactMutation.isPending}
      showButtons={false}
      defaultValues={getContactFormValues(contactData as Contact)}
      onChange={handleFormChange}
    />
    <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleCancelEdit}
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={updateContactMutation.isPending}
          className={cn(
            "flex items-center space-x-2 px-3 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white",
            !hasUnsavedChanges && "opacity-50"
          )}
          form="contact-form"
        >
      <Check className="w-4 h-4" />
      <span>Save</span>
    </Button>
    </div>
    {activities && activities.length > 0 && (
      <div className="mt-6 border-t border-neutral-200 pt-4">
        <h4 className="font-medium mb-3 flex items-center">
          <AlertCircle className="w-4 h-4 mr-2 text-green-500" />
          Latest Changes
        </h4>
        <div className="space-y-2">
          {activities
            .filter(
              (activity) =>
                activity.contactId === contactId &&
                [ActivityType.CONTACT_UPDATED, ActivityType.CONTACT_CREATED].includes(
                  activity.activityType
                )
            )
            .sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
            .slice(0, 5)
            .map((activity) => (
              <div key={activity.id} className="text-xs text-neutral-600">
                <p>{activity.description}</p>
                <p className="text-xs text-neutral-400 mt-1">
                  {formatDistance(new Date(activity.createdAt), new Date(), { addSuffix: true })}
                  {" "}
                  • {formatTime(activity.createdAt, timeFormat)}
                </p>
              </div>
            ))}
          {activities.filter(
            (activity) =>
              activity.contactId === contactId &&
              [ActivityType.CONTACT_UPDATED, ActivityType.CONTACT_CREATED].includes(
                activity.activityType
              )
          ).length === 0 && (
            <div className="text-sm text-neutral-500 italic">No recent changes to display</div>
          )}
        </div>
      </div>
    )}
  </div>
);

  const renderCreateMode = () => (
    <div className="p-6 space-y-4">
      <EnhancedContactForm
        onSubmit={handleSubmit}
        isSubmitting={createContactMutation.isPending}
        showButtons={false}
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={createContactMutation.isPending}
          className="flex items-center space-x-2 px-3 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white"
          form="contact-form"
        >
          <Check className="w-4 h-4" />
          <span>Save</span>
        </Button>
      </div>
    </div>
  );

  // Show loading state for edit/view modes
  if ((mode === "edit" || mode === "view") && isLoadingContact) {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto mb-4"></div>
            <p className="text-neutral-500">Loading contact...</p>
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if ((mode === "edit" || mode === "view") && contactError) {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">
              {contactError?.message || "Failed to load contact"}
            </p>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Don't render form for edit/view modes if no contact data is available
  if ((mode === "edit" || mode === "view") && !contactData) {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-neutral-500 mb-4">Contact not found</p>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <div style={{backgroundColor: 'red', height: '2px', width: '100%'}}></div>
      <div className="flex-shrink-0 border-b border-neutral-200 bg-white">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900">{getPanelTitle()}</h2>
          <p className="text-sm text-neutral-500">{getPanelSubtitle()}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {mode === 'view' && renderViewMode()}
        {mode === 'edit' && renderEditMode()}
        {mode === 'create' && renderCreateMode()}
      </div>
    </div>
  );
}