// Re-export shared types for consistency across client and server
export type {
  User,
  Club,
  Contact,
  Invoice,
  ContactAssignment,
  Activity,
  Notification,
  Setting,
} from "@shared/schema";
export { ActivityType, ContactStatus } from "@shared/schema";


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
  contactAssignments: any[];
}
