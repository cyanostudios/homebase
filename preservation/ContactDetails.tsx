import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Edit } from "lucide-react";
import type { Contact } from "@shared/schema";

interface ContactDetailsProps {
  contact: Contact;
  onEdit: () => void;
  onClose: () => void;
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

// Helper function to normalize contact type
const normalizeContactType = (type: any): "company" | "private" => {
  if (!type) return "company";
  const val = String(type).toLowerCase();
  return val === "private" || val === "individual" ? "private" : "company";
};

export function ContactDetails({ contact, onEdit, onClose }: ContactDetailsProps) {
  if (!contact) return null;

  const basicFields = [
    { label: 'Type', value: normalizeContactType((contact as any).contactType) === 'private' ? 'Private' : 'Company' },
    { label: 'Full Name', value: contact.fullName },
    { label: 'Company Name', value: (contact as any).companyName },
    { label: 'Email', value: contact.email },
    { label: 'Phone', value: contact.phone },
    { label: 'Organization Number', value: (contact as any).organizationNumber },
    { label: 'VAT Number', value: (contact as any).vatNumber },
    { label: 'Visiting Address', value: (contact as any).visitingAddress },
    { label: 'Mailing Address', value: (contact as any).mailingAddress },
    { label: 'City', value: (contact as any).addressCity },
    { label: 'Region', value: (contact as any).region },
    { label: 'Country', value: (contact as any).country },
    { label: 'Website', value: (contact as any).website },
    { label: 'Phone Switchboard', value: (contact as any).phoneSwitchboard },
    { label: 'Phone Direct', value: (contact as any).phoneDirect },
    { label: 'Email General', value: (contact as any).emailGeneral },
    { label: 'Email Invoicing', value: (contact as any).emailInvoicing },
    { label: 'Email Orders', value: (contact as any).emailOrders },
    { label: 'F-tax', value: (contact as any).fTax ? 'Yes' : 'No' },
    { label: 'Invoice Method', value: (contact as any).invoiceMethod },
    { label: 'Invoice Requirements', value: (contact as any).invoiceRequirements },
    { label: 'Payment Terms', value: (contact as any).paymentTerms },
    { label: 'VAT Rate', value: (contact as any).vatRate },
  ];

  const contactPersons = parseJsonField((contact as any).contactPersons);
  const additionalAddresses = parseJsonField((contact as any).additionalAddresses);

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-none">
        <CardContent className="p-0">
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
            <div className="pt-6">
              <p className="text-xs font-medium text-neutral-500 mb-2">
                Contact Persons
              </p>
              <div className="space-y-2">
                {contactPersons.map((p: any, idx: number) => (
                  <div key={idx} className="bg-neutral-50 p-3 rounded-md">
                    <div className="font-medium text-sm text-neutral-900">
                      {p.firstName} {p.lastName}
                      {p.title && <span className="text-neutral-500 ml-2">- {p.title}</span>}
                    </div>
                    {(p.directPhone || p.mobile || p.email) && (
                      <div className="text-xs text-neutral-600 mt-1 space-y-1">
                        {p.directPhone && <div>Direct: {p.directPhone}</div>}
                        {p.mobile && <div>Mobile: {p.mobile}</div>}
                        {p.email && <div>Email: {p.email}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {additionalAddresses.length > 0 && (
            <div className="pt-6">
              <p className="text-xs font-medium text-neutral-500 mb-2">
                Additional Addresses
              </p>
              <div className="space-y-2">
                {additionalAddresses.map((a: any, idx: number) => (
                  <div key={idx} className="bg-neutral-50 p-3 rounded-md">
                    <div className="font-medium text-sm text-neutral-900">
                      {a.type && <span className="text-neutral-500">{a.type}: </span>}
                      {a.visitingAddress}
                    </div>
                    {(a.postalCode || a.addressCity || a.region || a.country) && (
                      <div className="text-xs text-neutral-600 mt-1">
                        {a.postalCode} {a.addressCity} {a.region} {a.country}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pt-4 border-t border-neutral-200">
        <Button
          type="button"
          onClick={onClose}
          className="inline-flex items-center px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-600 text-sm font-medium rounded-md transition-colors"
        >
          <X className="w-4 h-4 mr-2" />
          Close
        </Button>
        <Button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-600 text-sm font-medium rounded-md transition-colors"
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </div>
    </div>
  );
}