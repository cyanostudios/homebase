import { 
  users, type User, type InsertUser,
  clubs, type Club, type InsertClub,
  contacts, type Contact, type InsertContact,
  invoices, type Invoice, type InsertInvoice,
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
    const [contact] = await db.insert(contacts).values({
      ...insertContact,
      contactPersons: insertContact.contactPersons as any,
      additionalAddresses: insertContact.additionalAddresses as any,
    }).returning();
    return contact;
  }

  async updateContact(id: number, contactUpdate: Partial<InsertContact>): Promise<Contact | undefined> {
    const [contact] = await db.update(contacts).set({
      ...contactUpdate,
      contactPersons: contactUpdate.contactPersons as any,
      additionalAddresses: contactUpdate.additionalAddresses as any,
    }).where(eq(contacts.id, id)).returning();
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

  async getActivities(limit?: number): Promise<Activity[]> {
    let query = db.select().from(activities);
    if (limit) {
      query = query.limit(limit);
    }
    return await query.execute();
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
    return row as Notification;
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const [notification] = await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).returning();
    return notification || undefined;
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting || undefined;
  }

  async setSetting(key: string, value: string, type: string = "string"): Promise<Setting> {
    const [setting] = await db
      .insert(settings)
      .values({ key, value, type })
      .onConflictDoUpdate({ target: settings.key, set: { value, type, updatedAt: sql`now()` } })
      .returning();
    return setting;
  }

  async getSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }
}

export const storage = new DatabaseStorage();
