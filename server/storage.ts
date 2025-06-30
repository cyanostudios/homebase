import { 
  users, type User, type InsertUser,
  clubs, type Club, type InsertClub,
  contacts, type Contact, type InsertContact,
  invoices, type Invoice, type InsertInvoice,
  contactAssignments, type ContactAssignment, type InsertContactAssignment,
  activities, type Activity, type InsertActivity,
  notifications, type Notification, type InsertNotification,
  settings, type Setting, type InsertSetting
} from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

// Storage interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Club operations
  getClub(id: number): Promise<Club | undefined>;
  getClubs(): Promise<Club[]>;
  createClub(club: InsertClub): Promise<Club>;

  // Contact operations
  getContact(id: number): Promise<Contact | undefined>;
  getContactByEmail(email: string): Promise<Contact | undefined>;
  getContacts(): Promise<Contact[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<boolean>;

  // Invoice operations
  getInvoice(id: number): Promise<Invoice | undefined>;
  getInvoices(): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;

  // Contact Assignment operations
  getContactAssignment(id: number): Promise<ContactAssignment | undefined>;
  getContactAssignmentsByInvoice(invoiceId: number): Promise<ContactAssignment[]>;
  getContactAssignmentsByContact(contactId: number): Promise<ContactAssignment[]>;
  createContactAssignment(assignment: InsertContactAssignment): Promise<ContactAssignment>;
  updateContactAssignment(id: number, assignment: Partial<InsertContactAssignment>): Promise<ContactAssignment | undefined>;
  deleteContactAssignment(id: number): Promise<boolean>;
  
  // Activity operations
  getActivities(limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  clearAllActivities(): Promise<void>;
  
  // Notification operations
  getContactNotifications(contactId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  
  // Settings operations
  getSetting(key: string): Promise<Setting | undefined>;
  setSetting(key: string, value: string, type?: string): Promise<Setting>;
  getSettings(): Promise<Setting[]>;
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getClub(id: number): Promise<Club | undefined> {
    const [club] = await db.select().from(clubs).where(eq(clubs.id, id));
    return club || undefined;
  }

  async getClubs(): Promise<Club[]> {
    return await db.select().from(clubs);
  }

  async createClub(insertClub: InsertClub): Promise<Club> {
    const [club] = await db.insert(clubs).values(insertClub).returning();
    return club;
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact || undefined;
  }

  async getContactByEmail(email: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.email, email));
    return contact || undefined;
  }

  async getContacts(): Promise<Contact[]> {
    return await db.select().from(contacts);
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }

  async updateContact(id: number, contactUpdate: Partial<InsertContact>): Promise<Contact | undefined> {
    const [contact] = await db.update(contacts).set(contactUpdate).where(eq(contacts.id, id)).returning();
    return contact || undefined;
  }

  async deleteContact(id: number): Promise<boolean> {
    const result = await db.delete(contacts).where(eq(contacts.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async getInvoices(): Promise<Invoice[]> {
    return await db.select().from(invoices);
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(insertInvoice).returning();
    return invoice;
  }

  async updateInvoice(id: number, invoiceUpdate: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [invoice] = await db.update(invoices).set(invoiceUpdate).where(eq(invoices.id, id)).returning();
    return invoice || undefined;
  }

  async getContactAssignment(id: number): Promise<ContactAssignment | undefined> {
    const [assignment] = await db.select().from(contactAssignments).where(eq(contactAssignments.id, id));
    return assignment || undefined;
  }

  async getContactAssignmentsByInvoice(invoiceId: number): Promise<ContactAssignment[]> {
    return await db.select().from(contactAssignments).where(eq(contactAssignments.invoiceId, invoiceId));
  }

  async getContactAssignmentsByContact(contactId: number): Promise<ContactAssignment[]> {
    return await db.select().from(contactAssignments).where(eq(contactAssignments.contactId, contactId));
  }

  async createContactAssignment(insertAssignment: InsertContactAssignment): Promise<ContactAssignment> {
    const [assignment] = await db.insert(contactAssignments).values(insertAssignment).returning();
    return assignment;
  }

  async updateContactAssignment(id: number, assignmentUpdate: Partial<InsertContactAssignment>): Promise<ContactAssignment | undefined> {
    const [assignment] = await db.update(contactAssignments).set(assignmentUpdate).where(eq(contactAssignments.id, id)).returning();
    return assignment || undefined;
  }

  async deleteContactAssignment(id: number): Promise<boolean> {
    const result = await db.delete(contactAssignments).where(eq(contactAssignments.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getActivities(limit?: number): Promise<Activity[]> {
    let query = db.select().from(activities);
    if (limit) {
      query = query.limit(limit);
    }
    return await query;
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const [activity] = await db.insert(activities).values(insertActivity).returning();
    return activity;
  }

  async clearAllActivities(): Promise<void> {
    await db.delete(activities);
  }

  async getContactNotifications(contactId: number): Promise<Notification[]> {
    return await db.select().from(notifications).where(eq(notifications.contactId, contactId));
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    // Use raw SQL to bypass Drizzle schema issues with notifications table
    const result = await db.execute(sql`
      INSERT INTO notifications (contact_id, message, is_read, related_to, related_id, created_at)
      VALUES (${insertNotification.contactId}, ${insertNotification.message}, ${insertNotification.isRead || false}, ${insertNotification.relatedTo}, ${insertNotification.relatedId}, NOW())
      RETURNING id, contact_id, message, is_read, related_to, related_id, created_at
    `);
    
    const row = result.rows[0] as any;
    return {
      id: row.id,
      contactId: row.contact_id,
      message: row.message,
      isRead: row.is_read,
      relatedTo: row.related_to,
      relatedId: row.related_id,
      createdAt: row.created_at
    };
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const [notification] = await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).returning();
    return notification || undefined;
  }

  // Settings operations
  async getSetting(key: string): Promise<Setting | undefined> {
    if (process.env.NODE_ENV === "development") {
      console.log("DEBUG: getSetting called with key:", key);
    }
    try {
      const result = await db.select().from(settings).where(eq(settings.key, key));
      if (process.env.NODE_ENV === "development") {
        console.log("DEBUG: getSetting result:", result);
      }
      const [setting] = result;
      if (process.env.NODE_ENV === "development") {
        console.log("DEBUG: getSetting setting:", setting);
      }
      return setting || undefined;
    } catch (error) {
      console.error("DEBUG: getSetting error:", error);
      return undefined;
    }
  }

  async setSetting(key: string, value: string, type: string = "string"): Promise<Setting> {
    // Check if setting exists
    const existing = await this.getSetting(key);
    
    if (existing) {
      // Update existing setting
      const [updated] = await db
        .update(settings)
        .set({ value, type })
        .where(eq(settings.key, key))
        .returning();
      return updated;
    } else {
      // Create new setting
      const [created] = await db
        .insert(settings)
        .values({ key, value, type })
        .returning();
      return created;
    }
  }

  async getSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }
}

export const storage = new DatabaseStorage();
