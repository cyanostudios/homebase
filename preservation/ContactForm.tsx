import React, { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ContactFormValues, contactFormSchema } from "./contactFormSchema";
import { Button } from "@/components/ui/button";
import { X, Check, Plus, Trash2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Contact } from "@shared/schema";

interface ContactFormProps {
  contact?: Contact | null;
  onSubmit: (data: ContactFormValues) => void;
  onCancel: () => void;
  onChange?: (dirty: boolean) => void;
  isSubmitting?: boolean;
  mode: "create" | "edit";
}

// Helper function to normalize contact type
const normalizeContactType = (type: unknown): "company" | "private" => {
  if (!type) return "company";
  const val = String(type).toLowerCase();
  return val === "private" || val === "individual" ? "private" : "company";
};

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

// Convert contact data to form values
const getContactFormValues = (contact: Contact | null): Partial<ContactFormValues> => {
  if (!contact) {
    return {
      contactType: "company" as const,
      fullName: "",
      email: "",
      phone: "",
      companyName: "",
      contactPersons: [{
        firstName: "",
        lastName: "",
        title: "",
        directPhone: "",
        mobile: "",
        email: ""
      }],
      additionalAddresses: []
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
    vatRate: (contact as any)?.vatRate || "25",
    email: contact.email || "",
    phone: contact.phone || "",
  };
};

export function ContactForm({ 
  contact, 
  onSubmit, 
  onCancel, 
  onChange, 
  isSubmitting = false,
  mode 
}: ContactFormProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const formDefaultValues = useMemo(() => getContactFormValues(contact || null), [contact]);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: formDefaultValues,
  });

  // Reset form when contact changes
  useEffect(() => {
    form.reset(formDefaultValues);
    setHasUnsavedChanges(false);
    onChange?.(false);
  }, [contact, form, formDefaultValues, onChange]);

  // Notify parent when form values change
  useEffect(() => {
    if (!onChange) return;
    const subscription = form.watch(() => {
      const dirty = form.formState.isDirty;
      setHasUnsavedChanges(dirty);
      onChange(dirty);
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  const {
    fields: contactPersonFields,
    append: appendContactPerson,
    remove: removeContactPerson,
  } = useFieldArray({
    control: form.control,
    name: "contactPersons",
  });

  const {
    fields: additionalAddressFields,
    append: appendAdditionalAddress,
    remove: removeAdditionalAddress,
  } = useFieldArray({
    control: form.control,
    name: "additionalAddresses",
  });

  const handleSubmit = (data: ContactFormValues) => {
    console.log('🔵 Form submitted with data:', data);
    console.log('🔵 Mode:', mode);
    console.log('🔵 Contact ID:', contact?.id);
    onSubmit(data);
    console.log('🔵 After onSubmit call');
  };

  const handleCancel = () => {
    form.reset();
    setHasUnsavedChanges(false);
    onCancel();
  };

  // Options
  const companyTypeOptions = [
    "AB (Aktiebolag)",
    "HB (Handelsbolag)", 
    "KB (Kommanditbolag)",
    "Enskild firma",
    "Ekonomisk förening",
    "Ideell förening",
    "Stiftelse",
    "Kommunal verksamhet",
    "Statlig verksamhet"
  ];

  const addressTypeOptions = [
    { value: "delivery", label: "Delivery Address" },
    { value: "billing", label: "Billing Address" },
    { value: "warehouse", label: "Warehouse Address" },
    { value: "office", label: "Office Address" },
    { value: "postal", label: "Postal Address" },
    { value: "other", label: "Other" }
  ];

  const invoiceMethodOptions = [
    "Paper",
    "EDI",
    "E-invoice",
    "Mail",
    "Email"
  ];

  const paymentTermsOptions = [
    { value: "net_14", label: "14 dagar netto / Net 14" },
    { value: "net_30", label: "30 dagar netto / Net 30" },
    { value: "net_45", label: "45 dagar netto / Net 45" },
    { value: "net_60", label: "60 dagar netto / Net 60" },
    { value: "prepayment", label: "Förskottsbetalning / Prepayment" },
    { value: "due_immediately", label: "Omgående betalning / Due immediately" },
  ];

  const vatRateOptions = [
    { value: "25", label: "25% - Normalskattesats" },
    { value: "12", label: "12% - Reducerad skattesats" },
    { value: "6", label: "6% - Låg skattesats" },
    { value: "0", label: "0% - Nollmoms" }
  ];

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form 
          id="contact-form" 
          onSubmit={form.handleSubmit(handleSubmit)} 
          className="space-y-6 max-h-[70vh] overflow-y-auto px-1"
        >
          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Contact Information</h3>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="contactType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Contact Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Company name or full name" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="organizationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Organization Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="556123-4567" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">VAT Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="SE556123456701" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="companyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Company Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <SelectValue placeholder="Select company type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companyTypeOptions.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Industry</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Construction, Healthcare, Technology" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
          
          <hr className="border-neutral-200" />

          {/* Address Information */}
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Address Information</h3>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="addressType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Address Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <SelectValue placeholder="Select address type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {addressTypeOptions.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="visitingAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Street name and number" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="mailingAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Apartment, suite, unit (optional)" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Postal Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="12345" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="addressCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">City</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Stockholm" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Region</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Stockholm County" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Country</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Sweden" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
          
          <hr className="border-neutral-200" />

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Contact Information</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phoneSwitchboard"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Phone (Switchboard)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+46 8 123 45 67" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phoneDirect"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Phone (Direct)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+46 70 123 45 67" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="emailGeneral"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Email (General)</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="info@company.com" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="emailInvoicing"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Email (Invoicing)</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="billing@company.com" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="emailOrders"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Email (Orders)</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="orders@company.com" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Website</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://www.company.com" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
          
          <hr className="border-neutral-200" />

          {/* Contact Persons */}
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Contact Persons</h3>
            <div className="space-y-4">
              {contactPersonFields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Contact Person {index + 1}</h4>
                    {contactPersonFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeContactPerson(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`contactPersons.${index}.firstName`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="block text-sm font-medium text-gray-700 mb-1">First Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Anna" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name={`contactPersons.${index}.lastName`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Andersson" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name={`contactPersons.${index}.title`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Title</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Project Manager" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name={`contactPersons.${index}.directPhone`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Direct Phone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+46 8 123 45 67" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name={`contactPersons.${index}.mobile`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Mobile</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+46 70 123 45 67" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name={`contactPersons.${index}.email`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} placeholder="anna.andersson@company.com" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendContactPerson({
                  firstName: "",
                  lastName: "",
                  title: "",
                  directPhone: "",
                  mobile: "",
                  email: ""
                })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Contact Person
              </Button>
            </div>
          </div>
          
          <hr className="border-neutral-200" />

          {/* Invoicing Information */}
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Invoicing Information</h3>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="fTax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-sm font-medium text-gray-700 mb-1">F-Tax Registration</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "true")}
                      value={field.value ? "true" : "false"}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vatRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">VAT Rate</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <SelectValue placeholder="Select VAT rate" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vatRateOptions.map((rate) => (
                            <SelectItem key={rate.value} value={rate.value}>
                              {rate.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <SelectValue placeholder="Select payment terms" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {paymentTermsOptions.map((term) => (
                            <SelectItem key={term.value} value={term.value}>
                              {term.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="invoiceMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Invoice Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <SelectValue placeholder="Select invoice method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {invoiceMethodOptions.map((method) => (
                            <SelectItem key={method} value={method}>
                              {method}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="invoiceRequirements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Invoice Requirements</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Special requirements for invoicing, reference numbers, etc." className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}