import React, { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ContactFormValues, contactFormSchema, ContactPersonFormValues } from "./contactFormSchema";
import { useQualificationLevels } from "@/context/qualification-levels-context";
import { useCity } from "@/context/city-context";

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

import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Save } from "lucide-react";

interface EnhancedContactFormProps {
  contact?: any;
  onSubmit: (data: ContactFormValues) => void;
  onDraft?: (data: ContactFormValues) => void;
  onChange?: (dirty: boolean) => void;
  isSubmitting?: boolean;
  showButtons?: boolean;
  formId?: string;
  readOnly?: boolean;
  defaultValues?: Partial<ContactFormValues>;
}

export function EnhancedContactForm({
  contact,
  onSubmit,
  onDraft,
  onChange,
  isSubmitting = false,
  showButtons = true,
  formId = "contact-form",
  readOnly = false,
  defaultValues
}: EnhancedContactFormProps) {
  const { qualificationLevels } = useQualificationLevels();
  const { defaultCity } = useCity();

  const paymentTermsOptions = [
    { value: "prepayment", label: "Förskottsbetalning / Prepayment", description: "Betalning ska ske innan varor/tjänster levereras" },
    { value: "payment_upon_order", label: "Betalning vid beställning / Payment upon order", description: "Kunden betalar i samband med att beställningen görs" },
    { value: "due_immediately", label: "Omgående betalning / Due immediately", description: "Betalning ska ske direkt vid mottagande av faktura" },
    { value: "net_7", label: "7 dagar netto / Net 7", description: "Betalning inom 7 dagar från fakturadatum" },
    { value: "net_10", label: "10 dagar netto / Net 10", description: "Betalning inom 10 dagar från fakturadatum" },
    { value: "net_14", label: "14 dagar netto / Net 14", description: "Betalning inom 14 dagar från fakturadatum" },
    { value: "net_20", label: "20 dagar netto / Net 20", description: "Betalning inom 20 dagar från fakturadatum" },
    { value: "net_30", label: "30 dagar netto / Net 30", description: "Betalning inom 30 dagar från fakturadatum (vanligt standardvillkor)" },
    { value: "net_45", label: "45 dagar netto / Net 45", description: "Betalning inom 45 dagar från fakturadatum" },
    { value: "net_60", label: "60 dagar netto / Net 60", description: "Betalning inom 60 dagar från fakturadatum" },
    { value: "net_90", label: "90 dagar netto / Net 90", description: "Betalning inom 90 dagar från fakturadatum" },
    { value: "as_per_agreement", label: "Betalning enligt avtal / As per agreement", description: "Betalningsvillkoren är specificerade i separat avtal" },
    { value: "partial_payment", label: "Delbetalning / Partial payment terms", description: "Betalning sker i förbestämda delbelopp enligt schema" },
    { value: "upon_completion", label: "Efter slutfört arbete / Upon completion", description: "Betalning sker efter att tjänsten är fullständigt utförd" }
  ];

  const vatRateOptions = [
    { value: "25", label: "25% - Normalskattesats", description: "Standard rate – most goods and services" },
    { value: "12", label: "12% - Reducerad skattesats", description: "Food, restaurants, hotels, transport, and more" },
    { value: "6", label: "6% - Låg skattesats", description: "Books, newspapers, cultural events, and public transport" },
    { value: "0", label: "0% - Nollmoms", description: "Export of goods/services, intra-EU sales to businesses" }
  ];

  const normalizeContactType = (type: any): "company" | "private" => {
    if (!type) return "company";
    const val = String(type).toLowerCase();
    return val === "private" || val === "individual" ? "private" : "company";
  };

  // Merge defaultValues with fallback values - memoized to prevent unnecessary re-renders
  const formDefaultValues = useMemo(() => ({
    contactType: normalizeContactType(defaultValues?.contactType || contact?.contactType || "company"),
    fullName: defaultValues?.fullName || contact?.fullName || "",
    email: defaultValues?.email || contact?.email || "",
    phone: defaultValues?.phone || contact?.phone || "",
    address: defaultValues?.address || contact?.address || "",
    city: defaultValues?.city || contact?.city || defaultCity,

    // Company Information
    companyName: defaultValues?.companyName || contact?.companyName || "",
    organizationNumber: defaultValues?.organizationNumber || contact?.organizationNumber || "",
    vatNumber: defaultValues?.vatNumber || contact?.vatNumber || "",
    fTax: defaultValues?.fTax !== undefined ? defaultValues.fTax : (contact?.fTax || false),
    companyType: defaultValues?.companyType || contact?.companyType || "",
    industry: defaultValues?.industry || contact?.industry || "",
    
    // Address Information
    addressType: defaultValues?.addressType || contact?.addressType || "",
    visitingAddress: defaultValues?.visitingAddress || contact?.visitingAddress || "",
    mailingAddress: defaultValues?.mailingAddress || contact?.mailingAddress || "",
    postalCode: defaultValues?.postalCode || contact?.postalCode || "",
    addressCity: defaultValues?.addressCity || contact?.addressCity || "",
    region: defaultValues?.region || contact?.region || "",
    country: defaultValues?.country || contact?.country || "",
    
    // Contact Information
    phoneSwitchboard: defaultValues?.phoneSwitchboard || contact?.phoneSwitchboard || "",
    phoneDirect: defaultValues?.phoneDirect || contact?.phoneDirect || "",
    emailGeneral: defaultValues?.emailGeneral || contact?.emailGeneral || "",
    emailInvoicing: defaultValues?.emailInvoicing || contact?.emailInvoicing || "",
    emailOrders: defaultValues?.emailOrders || contact?.emailOrders || "",
    website: defaultValues?.website || contact?.website || "",
    
    // Contact Persons
    contactPersons: defaultValues?.contactPersons || contact?.contactPersons || [{
      firstName: "",
      lastName: "",
      title: "",
      directPhone: "",
      mobile: "",
      email: ""
    }],
    
    // Additional Addresses
    additionalAddresses: defaultValues?.additionalAddresses || contact?.additionalAddresses || [],
    
    
    // Invoicing Information
    invoiceMethod: defaultValues?.invoiceMethod || contact?.invoiceMethod || "Email",
    invoiceRequirements: defaultValues?.invoiceRequirements || contact?.invoiceRequirements || "",
    paymentTerms: defaultValues?.paymentTerms || contact?.paymentTerms || "net_14",
    vatRate: defaultValues?.vatRate || contact?.vatRate || "25%"
  }), [defaultValues, contact, defaultCity]);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: formDefaultValues,
  });

  // Reset form when defaultValues change (important for edit mode)
  useEffect(() => {
    if (defaultValues || contact) {
      form.reset(formDefaultValues);
      onChange?.(false);
    }
  }, [defaultValues, contact, form, formDefaultValues, onChange]);

  // Notify parent when form values change
  useEffect(() => {
    if (!onChange) return;
    const subscription = form.watch(() => {
      onChange(form.formState.isDirty);
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

  // Availability options removed as part of professional info cleanup

  const addressTypeOptions = [
    { value: "delivery", label: "Delivery Address" },
    { value: "billing", label: "Billing Address" },
    { value: "warehouse", label: "Warehouse Address" },
    { value: "office", label: "Office Address" },
    { value: "postal", label: "Postal Address" },
    { value: "other", label: "Other" }
  ];

  const sportsOptions = [
    "football",
    "basketball", 
    "handball",
    "volleyball",
    "hockey",
    "tennis",
    "badminton",
    "table tennis",
    "athletics",
    "swimming"
  ];

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

  const invoiceMethodOptions = [
    "Paper",
    "EDI",
    "E-invoice",
    "Mail",
    "Email"
  ];

  
  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto px-1">

      <Form {...form}>
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Contact Information</h3>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="contactType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={readOnly}
                    >
                      <FormControl>
                        <SelectTrigger>
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
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Company name or full name" readOnly={readOnly} />
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
                      <FormLabel>Organization Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="556123-4567" readOnly={readOnly} />
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
                      <FormLabel>VAT Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="SE556123456701" readOnly={readOnly} />
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
                      <FormLabel>Company Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={readOnly}>
                        <FormControl>
                          <SelectTrigger>
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
                      <FormLabel>Industry</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Construction, Healthcare, Technology" readOnly={readOnly} />
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
                    <FormLabel>Address Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
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
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Street name and number" readOnly={readOnly} />
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
                      <FormLabel>Address Line 2</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Apartment, suite, unit (optional)" readOnly={readOnly} />
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
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="12345" readOnly={readOnly} />
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
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Stockholm" readOnly={readOnly} />
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
                      <FormLabel>Region</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Stockholm County" readOnly={readOnly} />
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
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Sweden" readOnly={readOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
              </div>
              
              {/* Additional Addresses */}
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendAdditionalAddress({ 
                    type: "", 
                    visitingAddress: "", 
                    mailingAddress: "", 
                    postalCode: "", 
                    addressCity: "", 
                    region: "", 
                    country: "" 
                  })}
                  className="w-fit"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Address
                </Button>
                
                {additionalAddressFields.map((field, index) => (
                  <div key={field.id} className="border border-neutral-200 rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <h5 className="text-sm font-medium text-neutral-700">Address {index + 1}</h5>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAdditionalAddress(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name={`additionalAddresses.${index}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
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
                        name={`additionalAddresses.${index}.visitingAddress`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address Line 1</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Street name and number" readOnly={readOnly} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`additionalAddresses.${index}.mailingAddress`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address Line 2</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Apartment, suite, unit (optional)" readOnly={readOnly} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`additionalAddresses.${index}.postalCode`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal Code</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="12345" readOnly={readOnly} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`additionalAddresses.${index}.addressCity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Stockholm" readOnly={readOnly} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`additionalAddresses.${index}.region`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Region</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Stockholm County" readOnly={readOnly} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`additionalAddresses.${index}.country`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Sweden" readOnly={readOnly} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
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
                      <FormLabel>Phone (Switchboard)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+46 8 123 45 67" readOnly={readOnly} />
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
                      <FormLabel>Phone (Direct)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+46 70 123 45 67" readOnly={readOnly} />
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
                      <FormLabel>Email (General)</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="info@company.com" />
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
                      <FormLabel>Email (Invoicing)</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="billing@company.com" />
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
                      <FormLabel>Email (Orders)</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="orders@company.com" />
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
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://www.company.com" readOnly={readOnly} />
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
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Anna" readOnly={readOnly} />
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
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Andersson" readOnly={readOnly} />
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
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Project Manager" readOnly={readOnly} />
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
                          <FormLabel>Direct Phone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+46 8 123 45 67" readOnly={readOnly} />
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
                          <FormLabel>Mobile</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+46 70 123 45 67" readOnly={readOnly} />
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
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} placeholder="anna.andersson@company.com" />
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
                    <FormLabel>F-Tax Registration</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "true")}
                      value={field.value ? "true" : "false"}
                    >
                      <FormControl>
                        <SelectTrigger>
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
                      <FormLabel>VAT Rate</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
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
                      <FormLabel>Payment Terms</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
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
                      <FormLabel>Invoice Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
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
                    <FormLabel>Invoice Requirements</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Special requirements for invoicing, reference numbers, etc." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {showButtons && (
            <div className="flex justify-end space-x-2 pt-6">
              <Button
                type="button"
                variant="ghost"
                className="text-neutral-600 hover:text-neutral-700 hover:bg-neutral-50"
                onClick={() => onDraft && onDraft(form.getValues())}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Draft
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Contact"}
              </Button>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}