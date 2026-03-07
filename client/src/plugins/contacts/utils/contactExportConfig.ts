import type { ExportFormatConfig } from '@/core/utils/exportUtils';

import type { Contact } from '../types/contacts';

function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return '';
  }
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      return '';
    }
    return d.toLocaleDateString('sv-SE');
  } catch {
    return '';
  }
}

export function contactToTxtContent(contact: Contact): string {
  const typeLabel = contact.contactType === 'company' ? 'Company' : 'Private';
  return [
    contact.companyName || '—',
    `Type: ${typeLabel}`,
    contact.contactNumber ? `#${contact.contactNumber}` : '',
    contact.email ? `Email: ${contact.email}` : '',
    contact.phone ? `Phone: ${contact.phone}` : '',
    contact.website ? `Website: ${contact.website}` : '',
    contact.notes ? `Notes: ${contact.notes}` : '',
    `Created: ${formatDate(contact.createdAt)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function getContactExportBaseFilename(contact: Contact): string {
  const name = (contact.companyName || contact.contactNumber || 'contact').replace(
    /[^a-z0-9]/gi,
    '_',
  );
  return name.toLowerCase();
}

export function getContactExportFilename(contact: Contact, extension: string): string {
  return `${getContactExportBaseFilename(contact)}.${extension}`;
}

export function contactToCsvRow(contact: Contact): Record<string, unknown> {
  return {
    contactNumber: contact.contactNumber || '',
    contactType: contact.contactType || '',
    companyName: contact.companyName || '',
    companyType: contact.companyType || '',
    organizationNumber: contact.organizationNumber || '',
    vatNumber: contact.vatNumber || '',
    personalNumber: contact.personalNumber || '',
    email: contact.email || '',
    phone: contact.phone || '',
    phone2: contact.phone2 || '',
    website: contact.website || '',
    taxRate: contact.taxRate || '',
    paymentTerms: contact.paymentTerms || '',
    currency: contact.currency || '',
    fTax: contact.fTax || '',
    notes: contact.notes || '',
    createdAt:
      contact.createdAt instanceof Date
        ? contact.createdAt.toISOString()
        : String(contact.createdAt ?? ''),
    updatedAt:
      contact.updatedAt instanceof Date
        ? contact.updatedAt.toISOString()
        : String(contact.updatedAt ?? ''),
  };
}

export function contactToPdfRow(contact: Contact): Record<string, unknown> {
  return {
    contactNumber: contact.contactNumber || '',
    contactType: contact.contactType === 'company' ? 'Company' : 'Private',
    companyName: contact.companyName || '',
    organizationNumber: contact.organizationNumber || '',
    vatNumber: contact.vatNumber || '',
    personalNumber: contact.personalNumber || '',
    email: contact.email || '',
    phone: contact.phone || '',
    phone2: contact.phone2 || '',
    website: contact.website || '',
    taxRate: contact.taxRate || '',
    paymentTerms: contact.paymentTerms || '',
    currency: contact.currency || '',
    notes: contact.notes || '',
  };
}

export const contactExportConfig: ExportFormatConfig = {
  txt: {
    getContent: contactToTxtContent,
    getFilename: (contact: Contact) => getContactExportFilename(contact, 'txt'),
    baseFilename: `contacts-export-${new Date().toISOString().split('T')[0]}`,
  },
  csv: {
    headers: [
      'contactNumber',
      'contactType',
      'companyName',
      'companyType',
      'organizationNumber',
      'vatNumber',
      'personalNumber',
      'email',
      'phone',
      'phone2',
      'website',
      'taxRate',
      'paymentTerms',
      'currency',
      'fTax',
      'notes',
      'createdAt',
      'updatedAt',
    ],
    mapItemToRow: contactToCsvRow,
  },
  pdf: {
    columns: [
      { key: 'contactNumber', label: 'Contact #' },
      { key: 'contactType', label: 'Type' },
      { key: 'companyName', label: 'Company Name' },
      { key: 'organizationNumber', label: 'Org. Number' },
      { key: 'vatNumber', label: 'VAT Number' },
      { key: 'personalNumber', label: 'Personal Number' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'phone2', label: 'Phone 2' },
      { key: 'website', label: 'Website' },
      { key: 'taxRate', label: 'Tax Rate' },
      { key: 'paymentTerms', label: 'Payment Terms' },
      { key: 'currency', label: 'Currency' },
      { key: 'notes', label: 'Notes' },
    ],
    mapItemToRow: contactToPdfRow,
    title: 'Contacts Export',
  },
};
