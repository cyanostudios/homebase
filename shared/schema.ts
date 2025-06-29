import { pgTable, text, serial, integer, boolean, timestamp, json, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enum for contact status
export enum ContactStatus {
  NOT_ASSIGNED = "NOT_ASSIGNED",
  NOT_NOTIFIED = "NOT_NOTIFIED",
  NOTIFIED = "NOTIFIED",
  ASSIGNED = "ASSIGNED",
  DECLINED = "DECLINED"
}



// Enum for referee/contact status
export enum RefereeStatus {
  NOT_ASSIGNED = "NOT_ASSIGNED",
  NOT_NOTIFIED = "NOT_NOTIFIED",
  NOTIFIED = "NOTIFIED",
  ASSIGNED = "ASSIGNED",
  DECLINED = "DECLINED"
}

// Enum for referee/contact availability
export enum RefereeAvailability {
  AVAILABLE = "AVAILABLE",
  LIMITED = "LIMITED",
  BUSY = "BUSY",
  UNAVAILABLE = "UNAVAILABLE"
}

// Enum for referee/contact roles
export enum RefereeRole {
  MAIN_REFEREE = "MAIN_REFEREE",
  ASSISTANT_REFEREE = "ASSISTANT_REFEREE",
  FOURTH_OFFICIAL = "FOURTH_OFFICIAL"
}

// Enum for activity types
export enum ActivityType {
  INVOICE_CREATED = "INVOICE_CREATED",
  INVOICE_UPDATED = "INVOICE_UPDATED",
  CONTACT_CREATED = "CONTACT_CREATED",
  CONTACT_UPDATED = "CONTACT_UPDATED",
  ASSIGNMENT_CREATED = "ASSIGNMENT_CREATED",
  ASSIGNMENT_UPDATED = "ASSIGNMENT_UPDATED",
  ASSIGNMENT_DELETED = "ASSIGNMENT_DELETED",
  ASSIGNMENT_ACCEPTED = "ASSIGNMENT_ACCEPTED",
  ASSIGNMENT_DECLINED = "ASSIGNMENT_DECLINED",
  NOTIFICATION_SENT = "NOTIFICATION_SENT",
  NOTIFICATION_READ = "NOTIFICATION_READ"
}

// Club table
export const clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("club_admin"),
  clubId: integer("club_id").references(() => clubs.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contact table
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  // Basic Contact Information
  fullName: text("full_name"),
  email: text("email").unique(),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),

  
  // Company Information
  companyName: text("company_name"),
  organizationNumber: text("organization_number"),
  vatNumber: text("vat_number"),
  fTax: boolean("f_tax").default(false),
  companyType: text("company_type"), // AB, HB, Sole Proprietorship, etc.
  industry: text("industry"),
  
  // Address Information
  addressType: text("address_type"),
  visitingAddress: text("visiting_address"),
  mailingAddress: text("mailing_address"),
  postalCode: text("postal_code"),
  addressCity: text("address_city"),
  region: text("region"),
  country: text("country"),
  deliveryAddress: text("delivery_address"),
  
  // Contact Information
  phoneSwitchboard: text("phone_switchboard"),
  phoneDirect: text("phone_direct"),
  emailGeneral: text("email_general"),
  emailInvoicing: text("email_invoicing"),
  emailOrders: text("email_orders"),
  website: text("website"),
  
  // Contact Persons (stored as JSON array)
  contactPersons: json("contact_persons").$type<Array<{
    firstName: string;
    lastName: string;
    title: string;
    directPhone?: string;
    mobile?: string;
    email?: string;
  }>>().default([]),
  
  // Additional Addresses (stored as JSON array)
  additionalAddresses: json("additional_addresses").$type<Array<{
    type: string;
    visitingAddress: string;
    mailingAddress?: string;
    postalCode: string;
    addressCity: string;
    region?: string;
    country: string;
  }>>().default([]),
  
  
  // Invoicing Information
  invoiceMethod: text("invoice_method"), // e-invoice, PDF, mail
  einvoiceAddress: text("einvoice_address"),
  referencePerson: text("reference_person"),
  invoiceRequirements: text("invoice_requirements"),
  paymentTerms: text("payment_terms"),
  vatRate: text("vat_rate"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoice table - All fields made optional for restructuring
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  homeTeam: text("home_team"),
  awayTeam: text("away_team"),
  dateTime: timestamp("date_time"),
  venue: text("venue"),
  city: text("city"),
  category: text("category"),
  description: text("description"),
  sport: text("sport").default("football"),
  team: text("team"),
  status: text("status").default("UPCOMING"),
  clubId: integer("club_id").references(() => clubs.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ContactAssignment table to manage many-to-many relationship
export const contactAssignments = pgTable("contact_assignments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  contactId: integer("contact_id").notNull().references(() => contacts.id),
  role: text("role").notNull().default("MAIN_REFEREE"),
  status: text("status").notNull().default("NOT_ASSIGNED"),
  notifiedAt: timestamp("notified_at"),
  responseAt: timestamp("response_at"),
  response: text("response"),
  reminderSent: boolean("reminder_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activity table for tracking activities
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  activityType: text("activity_type").notNull(),
  description: text("description").notNull(),
  userId: integer("user_id").references(() => users.id),
  contactId: integer("contact_id").references(() => contacts.id),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contacts.id),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  relatedTo: text("related_to").notNull(), // assignment, invoice, etc.
  relatedId: integer("related_id").notNull(), // assignment ID, invoice ID, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Settings table for storing application settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  type: text("type").notNull().default("string"), // 'string', 'json', 'number', 'boolean'
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ one }) => ({
  club: one(clubs, {
    fields: [users.clubId],
    references: [clubs.id],
  }),
}));

export const clubsRelations = relations(clubs, ({ many }) => ({
  users: many(users),
  invoices: many(invoices),
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
  assignments: many(contactAssignments),
  notifications: many(notifications),
  activities: many(activities),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  club: one(clubs, {
    fields: [invoices.clubId],
    references: [clubs.id],
  }),
  assignments: many(contactAssignments),
  activities: many(activities),
}));

export const contactAssignmentsRelations = relations(contactAssignments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [contactAssignments.invoiceId],
    references: [invoices.id],
  }),
  contact: one(contacts, {
    fields: [contactAssignments.contactId],
    references: [contacts.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
    relationName: 'activityUser',
  }),
  contact: one(contacts, {
    fields: [activities.contactId],
    references: [contacts.id],
    relationName: 'activityContact',
  }),
  invoice: one(invoices, {
    fields: [activities.invoiceId],
    references: [invoices.id],
    relationName: 'activityInvoice',
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  contact: one(contacts, {
    fields: [notifications.contactId],
    references: [contacts.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertClubSchema = createInsertSchema(clubs).omit({ id: true, createdAt: true });
export const insertContactSchema = createInsertSchema(contacts)
  .omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices)
  .omit({ id: true, createdAt: true })
  .extend({
    dateTime: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  });
export const insertContactAssignmentSchema = createInsertSchema(contactAssignments).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Club = typeof clubs.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type ContactAssignment = typeof contactAssignments.$inferSelect;
export type InsertContactAssignment = z.infer<typeof insertContactAssignmentSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
