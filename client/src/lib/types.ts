// Additional interface definitions
import { ActivityType, ContactAssignment } from "@shared/schema";

export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  clubId: number | null;
  createdAt: string;
}

export interface Club {
  id: number;
  name: string;
  city: string;
  contactEmail: string;
  contactPhone: string | null;
  createdAt: string;
}

export interface Contact {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  address: string | null;
  city: string;
  createdAt: string;
}

export interface Invoice {
  id: number;
  homeTeam: string;
  awayTeam: string;
  dateTime: string;
  venue: string;
  city?: string;
  category: string;
  description: string | null;
  sport: string;
  team?: string;
  status: string;
  clubId: number | null;
  createdAt: string;
}

export interface ContactAssignment {
  id: number;
  invoiceId: number;
  contactId: number;
  role: string;
  status: string;
  notifiedAt: string | null;
  responseAt: string | null;
  response: string | null;
  reminderSent: boolean;
  createdAt: string;
  contact?: Contact;
  invoice?: Invoice;
}

export interface Activity {
  id: number;
  activityType: ActivityType;
  description: string;
  userId: number | null;
  contactId: number | null;
  invoiceId: number | null;
  createdAt: string;
}

export interface DashboardStats {
  sentInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  upcomingInvoices: number;
  assignedContacts: number;
  pendingAssignments: number;
  activeContacts: number;
}

// Define types that aren't conflicting with schema exports
export interface InvoiceWithContacts {
  id: number;
  homeTeam: string;
  awayTeam: string;
  dateTime: string;
  venue: string;
  city: string;
  category: string | null;
  description: string | null;
  sport: string | null;
  team: string | null;
  status: string;
  clubId: number | null;
  createdAt: string;
  contactAssignments: ContactAssignment[];
}

export interface Notification {
  id: number;
  contactId: number;
  message: string;
  isRead: boolean | null;
  relatedTo: string;
  relatedId: number;
  createdAt: string;
}

// Import and re-export types from shared schema (avoiding conflicts)
export type { Contact, ContactAssignment, Setting } from "@shared/schema";
export { ContactStatus, ActivityType } from "@shared/schema";
