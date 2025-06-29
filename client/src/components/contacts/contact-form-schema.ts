import { z } from "zod";

// Contact person schema for the repeater - All fields optional
export const contactPersonSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  title: z.string().optional(),
  directPhone: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().optional(),
});

// Additional address schema for the repeater - All fields optional
export const additionalAddressSchema = z.object({
  type: z.string().optional(),
  visitingAddress: z.string().optional(),
  mailingAddress: z.string().optional(),
  postalCode: z.string().optional(),
  addressCity: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional()
});

export const contactFormSchema = z.object({
  // Contact Type Selection
  contactType: z.string().optional(),
  
  // Basic Contact Information - All fields optional
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  
  // Company Information
  companyName: z.string().optional(),
  organizationNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  fTax: z.boolean().default(false),
  companyType: z.string().optional(),
  industry: z.string().optional(),
  
  // Address Information
  addressType: z.string().optional(),
  visitingAddress: z.string().optional(),
  mailingAddress: z.string().optional(),
  postalCode: z.string().optional(),
  addressCity: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  
  // Additional Addresses
  additionalAddresses: z.array(additionalAddressSchema).default([]),
  
  // Contact Information
  phoneSwitchboard: z.string().optional(),
  phoneDirect: z.string().optional(),
  emailGeneral: z.string().optional(),
  emailInvoicing: z.string().optional(),
  emailOrders: z.string().optional(),
  website: z.string().optional(),
  
  // Contact Persons
  contactPersons: z.array(contactPersonSchema).default([]),
  
  
  // Invoicing Information
  invoiceMethod: z.string().optional(),
  invoiceRequirements: z.string().optional(),
  paymentTerms: z.string().optional(),
  vatRate: z.string().optional(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
export type ContactPersonFormValues = z.infer<typeof contactPersonSchema>;
export type AdditionalAddressFormValues = z.infer<typeof additionalAddressSchema>;