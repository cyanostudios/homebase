import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "../storage";
import { z } from "zod";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { DatabaseOptimizations } from "../database-optimizations";
import { 
  insertContactSchema, 
  insertInvoiceSchema, 
  insertContactAssignmentSchema, 
  insertActivitySchema,
  insertNotificationSchema,
  ContactStatus,
  ActivityType
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Add explicit API route protection to prevent static file interception
  app.use('/api/*', (req, res, next) => {
    console.log(`API route hit: ${req.method} ${req.path}`);
    next();
  });
  // Health check endpoint to verify database connectivity
  app.get("/api/health", async (_req: Request, res: Response) => {
    try {
      await db.execute(sql`SELECT 1`);
      res.json({ 
        status: "ok", 
        database: "connected",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Database health check failed:", error);
      res.status(500).json({ 
        status: "error", 
        database: "disconnected",
        message: "Database connection failed",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Production diagnostic endpoint - must return JSON, not HTML
  app.get("/api/production-test", async (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    
    const diagnostics: any = {
      message: "Production API endpoint test",
      environment: process.env.NODE_ENV || 'development',
      databaseUrlExists: !!process.env.DATABASE_URL,
      timestamp: new Date().toISOString(),
      routeHandlerWorking: true
    };

    // Test basic connection
    try {
      await db.execute(sql`SELECT 1 as test`);
      diagnostics.connectionTest = 'SUCCESS';
    } catch (error: any) {
      diagnostics.connectionTest = `FAILED: ${error.message}`;
      diagnostics.connectionError = error.stack;
    }

    // Test table existence
    try {
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM invoices`);
      const data = result.rows || result;
      const row = Array.isArray(data) ? data[0] : data;
      diagnostics.directInvoiceCount = row?.count || 0;
    } catch (error: any) {
      diagnostics.directInvoiceCount = `FAILED: ${error.message}`;
    }

    // Test storage layer
    try {
      const invoices = await storage.getInvoices();
      diagnostics.storageMatchCount = invoices.length;
      diagnostics.storageTest = 'SUCCESS';
      diagnostics.sampleMatch = invoices[0] || null;
    } catch (error: any) {
      diagnostics.storageTest = `FAILED: ${error.message}`;
      diagnostics.storageError = error.stack;
    }

    res.json(diagnostics);
  });

  // Simple test endpoint to verify JSON responses
  app.get("/api/test", (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({ 
      status: "API routes working", 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });
  
  // Contact login endpoint
  app.post("/api/contact/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Find contact by email
      const contact = await storage.getContactByEmail(email);
      
      if (!contact) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // In a real-world scenario, we'd hash passwords and compare
      // For now we're just checking the email exists
      
      res.json({
        message: "Login successful",
        contact: {
          id: contact.id,
          fullName: contact.fullName,
          email: contact.email
        }
      });
    } catch (error) {
      console.error("Contact login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  
  // Get single contact by ID
  app.get("/api/contacts/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const contact = await storage.getContact(id);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });
  
  // Contact assignment response endpoint (accept/decline)
  app.post("/api/assignments/:id/respond", async (req: Request, res: Response) => {
    try {
      const assignmentId = parseInt(req.params.id);
      const { response, contactId } = req.body;
      
      if (!response || !['ACCEPTED', 'DECLINED'].includes(response)) {
        return res.status(400).json({ message: "Valid response (ACCEPTED or DECLINED) is required" });
      }
      
      // Get the assignment
      const assignment = await storage.getContactAssignment(assignmentId);
      
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      // Verify the contactId matches the assignment
      if (assignment.contactId !== parseInt(contactId)) {
        return res.status(403).json({ message: "Not authorized to respond to this assignment" });
      }
      
      // Update the assignment
      const updatedAssignment = await storage.updateContactAssignment(assignmentId, {
        status: response === 'ACCEPTED' ? ContactStatus.ASSIGNED : ContactStatus.DECLINED,
        responseAt: new Date(),
        response
      });
      
      // Get contact details
      const contact = await storage.getContact(parseInt(contactId));
      
      // Create activity log
      await storage.createActivity({
        activityType: response === 'ACCEPTED' ? ActivityType.ASSIGNMENT_ACCEPTED : ActivityType.ASSIGNMENT_DECLINED,
        description: `${contact?.fullName || 'Contact'} ${response.toLowerCase()} assignment for invoice #${assignment.invoiceId}`,
        contactId: parseInt(contactId),
        invoiceId: assignment.invoiceId,
        userId: null
      });
      
      // Get invoice details for the notification
      const invoice = await storage.getInvoice(assignment.invoiceId);
      
      if (invoice && contact) {
        // Create notification for club admin - don't let this fail the main operation
        try {
          await storage.createNotification({
            contactId: 0, // 0 indicates club admin notification
            message: `${contact.fullName} has ${response.toLowerCase()} the assignment for ${invoice.homeTeam} vs ${invoice.awayTeam}`,
            isRead: false,
            relatedTo: "assignment",
            relatedId: assignmentId
          });
        } catch (notificationError) {
          console.warn("Failed to create notification, but assignment response was successful:", notificationError);
        }
      }
      
      res.json({ 
        message: `Assignment ${response.toLowerCase()} successfully`,
        assignment: updatedAssignment
      });
    } catch (error) {
      console.error("Error responding to assignment:", error);
      res.status(500).json({ message: "Failed to respond to assignment" });
    }
  });

  // Get all invoices
  app.get("/api/invoices", async (req: Request, res: Response) => {
    try {
      console.log("Fetching invoices from database...");
      console.log("Environment:", process.env.NODE_ENV || 'development');
      console.log("Database URL exists:", !!process.env.DATABASE_URL);
      
      const invoices = await storage.getInvoices();
      console.log(`Successfully retrieved ${invoices.length} invoices`);
      
      if (invoices.length === 0) {
        console.warn("WARNING: No invoices returned from database - checking connection");
      }
      
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Get invoice by ID
  app.get("/api/invoices/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const invoice = await storage.getInvoice(id);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  // Create new invoice
  app.post("/api/invoices", async (req: Request, res: Response) => {
    try {
      console.log("=== INVOICE CREATION DEBUG ===");
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      
      try {
        // Validate the data
        const validatedData = insertInvoiceSchema.parse(req.body);
        console.log("Validation passed, validated data:", validatedData);
        
        // Ensure the status is valid
        if (!validatedData.status) {
          validatedData.status = "UPCOMING";
        }
        
        console.log("Creating invoice in storage...");
        // Create the invoice
        const invoice = await storage.createInvoice(validatedData);
        console.log("Invoice created successfully:", invoice);
        
        // Log an activity for the invoice creation
        const homeTeam = invoice.homeTeam || "TBD";
        const awayTeam = invoice.awayTeam || "TBD";
        await storage.createActivity({
          activityType: "INVOICE_CREATED",
          description: `New invoice added: ${homeTeam} vs ${awayTeam}`,
          userId: 1, // In a real app, this would be the authenticated user
          contactId: null,
          invoiceId: invoice.id
        });
        
        // Verify the invoice was stored properly
        const allInvoices = await storage.getInvoices();
        console.log("Number of invoices after creation:", allInvoices.length);
        
        // Return the created invoice
        res.status(201).json(invoice);
      } catch (error: any) {
        console.error("Validation or creation error:", error);
        console.error("Error stack:", error.stack);
        if (error instanceof z.ZodError) {
          console.log("Zod validation errors:", error.errors);
          return res.status(400).json({ 
            message: "Invalid invoice data", 
            errors: error.errors 
          });
        }
        return res.status(400).json({ 
          message: "Invalid invoice data",
          error: error.message
        });
      }
    } catch (error: any) {
      console.error("=== INVOICE CREATION ERROR ===");
      console.error("Error details:", error);
      console.error("Stack trace:", error.stack);
      res.status(500).json({ 
        message: "Failed to create invoice",
        error: error.message,
        stack: error.stack
      });
    }
  });

  // Update invoice
  app.put("/api/invoices/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get original invoice first to compare changes
      const originalInvoice = await storage.getInvoice(id);
      if (!originalInvoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      // ==========================================
      // PRINT EVERYTHING FOR DEBUGGING
      // ==========================================
      console.log("\n\n============ INVOICE UPDATE DEBUG START ============");
      console.log("Original invoice:", JSON.stringify(originalInvoice, null, 2));
      console.log("Raw request body:", JSON.stringify(req.body, null, 2));
      
      // Check what fields are actually being sent from the client
      const sentFields = Object.keys(req.body);
      console.log("Fields included in request:", sentFields);
      
      // Validate the request data
      const validatedData = insertInvoiceSchema.partial().parse(req.body);
      console.log("Validated data:", JSON.stringify(validatedData, null, 2));
      
      // ==========================================
      // SET UP EXPLICIT FIELD-BY-FIELD DETECTION
      // ==========================================
      
      // Create a clean list of changes
      let changedFields: string[] = [];
      
      // Create a fresh array for our changes
      const changes = [];

      // Team category
      if ('team' in req.body && req.body.team !== originalInvoice.team) {
        // Make team category uppercase for better readability
        const newTeam = req.body.team?.toUpperCase();
        changes.push(`Team category updated to ${newTeam}`);
      }
      
      // City
      if ('city' in req.body && req.body.city !== originalInvoice.city) {
        changes.push(`City updated to ${req.body.city}`);
      }
      
      // Date/time field changes
      if ('dateTime' in req.body) {
        // Get date strings for comparison
        const origDateStr = originalInvoice.dateTime ? new Date(originalInvoice.dateTime).toISOString() : '';
        const newDateStr = req.body.dateTime ? new Date(req.body.dateTime).toISOString() : '';
        
        if (origDateStr !== newDateStr) {
          // Format the date in a more readable format
          const newDate = new Date(req.body.dateTime);
          const formattedDate = newDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          changes.push(`Date/time updated to ${formattedDate}`);
        }
      }
      
      // Home team
      if ('homeTeam' in req.body && req.body.homeTeam !== originalInvoice.homeTeam) {
        changes.push(`Home team updated to ${req.body.homeTeam}`);
      }
      
      // Away team
      if ('awayTeam' in req.body && req.body.awayTeam !== originalInvoice.awayTeam) {
        changes.push(`Away team updated to ${req.body.awayTeam}`);
      }
      
      // Venue
      if ('venue' in req.body && req.body.venue !== originalInvoice.venue) {
        changes.push(`Venue changed to ${req.body.venue}`);
      }
      
      // Category
      if ('category' in req.body && req.body.category !== originalInvoice.category) {
        changes.push(`Category changed to ${req.body.category}`);
      }
      
      // Description
      if ('description' in req.body && req.body.description !== originalInvoice.description) {
        if (req.body.description) {
          changes.push(`Description changed to: "${req.body.description}"`);
        } else {
          changes.push("Description removed");
        }
      }
      
      // Sport
      if ('sport' in req.body && req.body.sport !== originalInvoice.sport) {
        changes.push(`Sport changed to ${req.body.sport}`);
      }
      
      // Transfer the changes to our earlier changedFields array
      changedFields = changes;
      
      // Update the invoice
      const updatedInvoice = await storage.updateInvoice(id, validatedData);
      
      // Log summary of all detected changes
      console.log("============ INVOICE UPDATE DEBUG END ============\n\n");
      
      // Print the list of changes we've collected for debugging
      console.log("ACTIVITY DEBUG - Changes to log:", JSON.stringify(changedFields));
      
      // Explicitly create the change message
      let activityDescription = "";
      
      if (updatedInvoice && changedFields.length > 0) {
        // Create the full description with invoice info and specific change details
        // This is the exact format that will be shown in the activity log
        activityDescription = `${updatedInvoice.homeTeam} vs ${updatedInvoice.awayTeam}: ${changedFields.join(', ')}`;
      } else if (updatedInvoice) {
        activityDescription = `${updatedInvoice.homeTeam} vs ${updatedInvoice.awayTeam} updated`;
      }
      
      console.log("ACTIVITY DEBUG - Final message:", activityDescription);
      
      // Create the activity record with the EXACT description we want shown
      const activityResult = await storage.createActivity({
        activityType: "INVOICE_UPDATED",
        description: activityDescription,
        userId: null,
        contactId: null,
        invoiceId: updatedInvoice?.id || null
      });
      
      console.log("ACTIVITY DEBUG - Activity created:", activityResult);
      
      res.json(updatedInvoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  // Get all contacts
  app.get("/api/contacts", async (req: Request, res: Response) => {
    try {
      const contacts = await storage.getContacts();
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  // Get contact by ID
  app.get("/api/contacts/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const contact = await storage.getContact(id);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  // Create new contact
  app.post("/api/contacts", async (req: Request, res: Response) => {
    try {
      console.log("=== CONTACT CREATION DEBUG ===");
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      
      // Handle both structured and flat data formats for compatibility
      const body = req.body;
      let flattenedData;
      
      if (body.company || body.address || body.contactInfo || body.paymentInfo || body.invoiceInfo || body.professional) {
        // New structured format - flatten for database storage
        flattenedData = {
          // Basic information
          contactType: body.contactType,
          fullName: body.fullName,
          email: body.email,
          phone: body.phone,
          
          // Company information
          companyName: body.company?.name,
          organizationNumber: body.company?.organizationNumber,
          vatNumber: body.company?.vatNumber,
          companyType: body.company?.type,
          industry: body.company?.industry,
          
          // Address information
          addressType: body.address?.type,
          visitingAddress: body.address?.street,
          mailingAddress: body.address?.addressLine2,
          postalCode: body.address?.postalCode,
          addressCity: body.address?.city,
          region: body.address?.region,
          country: body.address?.country,
          
          // Contact information
          phoneSwitchboard: body.contactInfo?.phoneSwitchboard,
          phoneDirect: body.contactInfo?.phoneDirect,
          emailGeneral: body.contactInfo?.emailGeneral,
          emailInvoicing: body.contactInfo?.emailInvoicing,
          emailOrders: body.contactInfo?.emailOrders,
          website: body.contactInfo?.website,
          
          
          // Invoice information
          fTax: body.invoiceInfo?.fTax,
          vatRate: body.invoiceInfo?.vatRate,
          paymentTerms: body.invoiceInfo?.paymentTerms,
          invoiceMethod: body.invoiceInfo?.invoiceMethod,
          einvoiceAddress: body.invoiceInfo?.einvoiceAddress,
          referencePerson: body.invoiceInfo?.referencePerson,
          invoiceRequirements: body.invoiceInfo?.invoiceRequirements,
          
          // Arrays (stored as JSON)
          contactPersons: JSON.stringify(body.contactPersons || []),
          additionalAddresses: JSON.stringify(body.additionalAddresses || [])
        };
      } else {
        // Legacy flat format
        flattenedData = {
          ...body,
          contactPersons: JSON.stringify(body.contactPersons || []),
          additionalAddresses: JSON.stringify(body.additionalAddresses || [])
        };
      }
      
      const validatedData = insertContactSchema.parse(flattenedData);
      console.log("Validation passed, creating contact...");
      
      const contact = await storage.createContact(validatedData);
      console.log("Contact created:", contact);
      
      // Create activity
      const contactName = contact.fullName || contact.email || contact.companyName || "New Contact";
      await storage.createActivity({
        activityType: "CONTACT_CREATED",
        description: `New contact added: ${contactName}`,
        userId: 1, // In a real app, this would be the authenticated user
        contactId: contact.id,
        invoiceId: null
      });
      
      res.status(201).json(contact);
    } catch (error: any) {
      console.error("=== CONTACT CREATION ERROR ===");
      console.error("Error details:", error);
      console.error("Stack trace:", error.stack);
      
      if (error instanceof z.ZodError) {
        console.log("Validation errors:", error.errors);
        return res.status(400).json({ 
          message: "Invalid contact data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Failed to create contact",
        error: error.message,
        stack: error.stack
      });
    }
  });

  // Update contact
  app.put("/api/contacts/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      console.log("Update contact request body:", req.body);
      
      // Get original contact for comparison
      const originalContact = await storage.getContact(id);
      if (!originalContact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      const validatedData = insertContactSchema.partial().parse(req.body);
      console.log("Validated data:", validatedData);
      const updatedContact = await storage.updateContact(id, validatedData);
      
      if (!updatedContact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      // Track changes for activity log
      const changes: string[] = [];
      
      console.log("CONTACT DEBUG - Original contact:", originalContact);
      console.log("CONTACT DEBUG - Validated data:", validatedData);
      
      // Compare fields and track changes
      if (validatedData.fullName && validatedData.fullName !== originalContact.fullName) {
        changes.push(`Name changed to ${validatedData.fullName}`);
        console.log("CONTACT DEBUG - Name change detected");
      }
      if (validatedData.email && validatedData.email !== originalContact.email) {
        changes.push(`Email changed to ${validatedData.email}`);
        console.log("CONTACT DEBUG - Email change detected");
      }
      if (validatedData.phone && validatedData.phone !== originalContact.phone) {
        changes.push(`Phone changed to ${validatedData.phone}`);
        console.log("CONTACT DEBUG - Phone change detected");
      }
      if (validatedData.city && validatedData.city !== originalContact.city) {
        changes.push(`City changed to ${validatedData.city}`);
        console.log("CONTACT DEBUG - City change detected");
      }

      
      console.log("CONTACT DEBUG - Total changes detected:", changes.length);
      
      // Log activity if there are changes
      if (changes.length > 0) {
        const activityDescription = `${updatedContact.fullName}: ${changes.join(', ')}`;
        console.log("CONTACT ACTIVITY DEBUG - Changes to log:", changes);
        console.log("CONTACT ACTIVITY DEBUG - Final message:", activityDescription);
        
        const activity = await storage.createActivity({
          activityType: 'CONTACT_UPDATED',
          description: activityDescription,
          contactId: id,
          invoiceId: null,
          userId: null,
        });
        console.log("CONTACT ACTIVITY DEBUG - Activity created:", activity);
      }
      
      res.json(updatedContact);
    } catch (error) {
      console.error("Update contact error:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
      }
      
      // Handle email uniqueness constraint error
      if (error instanceof Error && error.message.includes("already in use")) {
        return res.status(400).json({ message: error.message });
      }
      
      // Handle database unique constraint error
      if (error instanceof Error && (error as any).code === '23505') {
        return res.status(400).json({ message: "Email address is already in use by another contact" });
      }
      
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  // Delete contact
  app.delete("/api/contacts/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if contact exists
      const contact = await storage.getContact(id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // For now, we'll implement a simple delete
      // In a production system, you might want to:
      // - Check for existing assignments
      // - Cascade delete related records
      // - Or mark as inactive instead of hard delete
      
      const success = await storage.deleteContact(id);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to delete contact" });
      }
      
      res.json({ message: "Contact deleted successfully" });
    } catch (error) {
      console.error("Delete contact error:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Get referee assignments by invoice ID
  app.get("/api/invoices/:id/assignments", async (req: Request, res: Response) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const assignments = await storage.getContactAssignmentsByInvoice(invoiceId);
      
      // Fetch the full contact details for each assignment
      const assignmentsWithContacts = await Promise.all(
        assignments.map(async (assignment) => {
          const contact = await storage.getContact(assignment.contactId);
          return { ...assignment, contact };
        })
      );
      
      res.json(assignmentsWithContacts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  // Get contact assignments by contact ID
  app.get("/api/contacts/:id/assignments", async (req: Request, res: Response) => {
    try {
      const contactId = parseInt(req.params.id);
      const assignments = await storage.getContactAssignmentsByContact(contactId);
      
      // Fetch the full invoice details for each assignment
      const assignmentsWithInvoices = await Promise.all(
        assignments.map(async (assignment) => {
          const invoice = await storage.getInvoice(assignment.invoiceId);
          return { ...assignment, invoice };
        })
      );
      
      res.json(assignmentsWithInvoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  // Check if contact has previously declined an invoice
  app.get("/api/invoices/:invoiceId/contact/:contactId/decline-history", async (req: Request, res: Response) => {
    try {
      const invoiceId = parseInt(req.params.invoiceId);
      const contactId = parseInt(req.params.contactId);
      
      // Check if there are any assignments for this contact and invoice with DECLINED status
      const assignments = await storage.getContactAssignmentsByInvoice(invoiceId);
      const declinedAssignment = assignments.find(assignment => 
        assignment.contactId === contactId && assignment.status === "DECLINED"
      );
      
      // Also check activities for decline events
      const activities = await storage.getActivities();
      const invoice = await storage.getInvoice(invoiceId);
      const contact = await storage.getContact(contactId);
      
      let declineActivity = null;
      if (invoice && contact) {
        declineActivity = activities.find(activity => 
          activity.activityType === "ASSIGNMENT_DECLINED" && 
          activity.contactId === contactId &&
          (activity.description.includes(`${invoice.homeTeam} vs ${invoice.awayTeam}`) ||
           activity.description.includes(`Invoice ID: ${invoiceId}`))
        );
      }
      
      const hasDeclined = !!(declinedAssignment || declineActivity);
      const declineDate = declinedAssignment?.responseAt || declineActivity?.createdAt;
      
      res.json({ 
        hasDeclined,
        declineDate
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to check decline history" });
    }
  });

  // Create contact assignment
  app.post("/api/assignments", async (req: Request, res: Response) => {
    try {
      const validatedData = insertContactAssignmentSchema.parse(req.body);
      
      // Check if invoice exists
      const invoice = await storage.getInvoice(validatedData.invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      // Check if contact exists
      const contact = await storage.getContact(validatedData.contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      // Check if the contact is already assigned to this invoice
      const existingAssignments = await storage.getContactAssignmentsByInvoice(validatedData.invoiceId);
      const isAlreadyAssigned = existingAssignments.some(
        assignment => assignment.contactId === validatedData.contactId
      );
      
      if (isAlreadyAssigned) {
        return res.status(400).json({ 
          message: "Contact is already assigned to this invoice",
          error: "DUPLICATE_ASSIGNMENT"
        });
      }
      
      const assignment = await storage.createContactAssignment(validatedData);
      
      // Create activity
      await storage.createActivity({
        activityType: "ASSIGNMENT_CREATED",
        description: `${contact.fullName} was assigned to ${invoice.homeTeam} vs ${invoice.awayTeam}`,
        userId: 1, // In a real app, this would be the authenticated user
        contactId: contact.id,
        invoiceId: invoice.id
      });
      
      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid assignment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create assignment" });
    }
  });

  // Update contact assignment
  app.put("/api/assignments/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertContactAssignmentSchema.partial().parse(req.body);
      
      const assignment = await storage.getContactAssignment(id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      const updatedAssignment = await storage.updateContactAssignment(id, validatedData);
      
      // Create activity if status changed
      if (validatedData.status && validatedData.status !== assignment.status) {
        const invoice = await storage.getInvoice(assignment.invoiceId);
        const contact = await storage.getContact(assignment.contactId);
        
        if (invoice && contact) {
          let activityType = "ASSIGNMENT_UPDATED";
          let description = `${contact.fullName}'s assignment for ${invoice.homeTeam} vs ${invoice.awayTeam} was updated`;
          
          if (validatedData.status === "NOTIFIED") {
            activityType = "NOTIFICATION_SENT";
            description = `Notification sent to ${contact.fullName} for ${invoice.homeTeam} vs ${invoice.awayTeam}`;
          } else if (validatedData.status === "ASSIGNED" && validatedData.response === "ACCEPTED") {
            activityType = "ASSIGNMENT_ACCEPTED";
            description = `${contact.fullName} accepted the assignment for ${invoice.homeTeam} vs ${invoice.awayTeam}`;
          } else if (validatedData.status === "DECLINED" || validatedData.response === "DECLINED") {
            activityType = "ASSIGNMENT_DECLINED";
            description = `${contact.fullName} declined the assignment for ${invoice.homeTeam} vs ${invoice.awayTeam}`;
          }
          
          await storage.createActivity({
            activityType,
            description,
            userId: 1, // In a real app, this would be the authenticated user
            contactId: contact.id,
            invoiceId: invoice.id
          });
        }
      }
      
      res.json(updatedAssignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid assignment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update assignment" });
    }
  });

  // Delete contact assignment
  app.delete("/api/assignments/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      const assignment = await storage.getContactAssignment(id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      await storage.deleteContactAssignment(id);
      
      // Create activity
      const invoice = await storage.getInvoice(assignment.invoiceId);
      const contact = await storage.getContact(assignment.contactId);
      
      if (invoice && contact) {
        await storage.createActivity({
          activityType: "ASSIGNMENT_DELETED",
          description: `${contact.fullName} was removed from ${invoice.homeTeam} vs ${invoice.awayTeam}`,
          userId: 1, // In a real app, this would be the authenticated user
          contactId: contact.id,
          invoiceId: invoice.id
        });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete assignment" });
    }
  });

  // Notify contact
  app.post("/api/assignments/:id/notify", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      const assignment = await storage.getContactAssignment(id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      // Update assignment status to "NOTIFIED"
      const updatedAssignment = await storage.updateContactAssignment(id, {
        status: "NOTIFIED",
        notifiedAt: new Date()
      });
      
      // In a real app, this would integrate with a notification service like Twilio
      console.log(`[Notification Service] Sending notification to contact ID ${assignment.contactId} for invoice ID ${assignment.invoiceId}`);
      
      // Create activity
      const invoice = await storage.getInvoice(assignment.invoiceId);
      const contact = await storage.getContact(assignment.contactId);
      
      if (invoice && contact) {
        // Create activity
        await storage.createActivity({
          activityType: "NOTIFICATION_SENT",
          description: `Notification sent to ${contact.fullName} for ${invoice.homeTeam} vs ${invoice.awayTeam}`,
          userId: 1, // In a real app, this would be the authenticated user
          contactId: contact.id,
          invoiceId: invoice.id
        });
        
        // Create notification record for the contact
        try {
          await storage.createNotification({
            contactId: contact.id,
            message: `You have a new assignment request for ${invoice.homeTeam} vs ${invoice.awayTeam}`,
            isRead: false,
            relatedTo: "assignment",
            relatedId: assignment.id
          });
          console.log(`✓ Notification stored in database for contact ${contact.fullName}`);
        } catch (notificationError: any) {
          console.log(`⚠ Notification logged but not stored in database: ${notificationError?.message}`);
          // Don't fail the entire operation if notification storage fails
        }
      }
      
      res.json(updatedAssignment);
    } catch (error) {
      console.error("Error notifying referee:", error);
      res.status(500).json({ message: "Failed to notify referee" });
    }
  });

  // Get contact notifications
  app.get("/api/contacts/:id/notifications", async (req: Request, res: Response) => {
    try {
      const contactId = parseInt(req.params.id);
      
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      const notifications = await storage.getContactNotifications(contactId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });
  
  // Mark notification as read
  app.post("/api/notifications/:id/read", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      const notification = await storage.markNotificationAsRead(id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json(notification);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });
  
  // Get recent activities
  app.get("/api/activities", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const activities = await storage.getActivities(limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // Clear all activities
  app.delete("/api/activities", async (req: Request, res: Response) => {
    try {
      await storage.clearAllActivities();
      res.json({ message: "All activities cleared successfully" });
    } catch (error) {
      console.error("Error clearing activities:", error);
      res.status(500).json({ message: "Failed to clear activities" });
    }
  });

  // Get dashboard stats
  app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
    try {
      const invoices = await storage.getInvoices();
      const upcomingInvoices = invoices.filter(invoice => {
        if (!invoice.dateTime) return false;
        return new Date(invoice.dateTime) > new Date();
      });
      
      const contacts = await storage.getContacts();
      const activeContacts = contacts; // All contacts are considered active in business context
      
      const allAssignments = [];
      for (const invoice of upcomingInvoices) {
        const assignments = await storage.getContactAssignmentsByInvoice(invoice.id);
        allAssignments.push(...assignments);
      }
      
      const assignedContacts = allAssignments.filter(a => a.status === "ASSIGNED").length;
      const pendingAssignments = allAssignments.filter(a => a.status !== "ASSIGNED").length;
      
      const stats = {
        upcomingInvoices: upcomingInvoices.length,
        assignedContacts,
        pendingAssignments,
        activeContacts: activeContacts.length
      };
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });
  
  // Get contact assignment statistics
  app.get("/api/stats/contact-assignments", async (req: Request, res: Response) => {
    try {
      // Get all contacts, invoices and assignments
      const contacts = await storage.getContacts();
      const invoices = await storage.getInvoices();
      
      // Create a map to count assignments by contact
      const contactAssignmentCounts = new Map();
      
      // Initialize counts for all contacts
      for (const contact of contacts) {
        contactAssignmentCounts.set(contact.id, {
          contactId: contact.id,
          contactName: contact.fullName,
          totalAssignments: 0,
          assignmentsByClub: new Map()
        });
      }
      
      // Count assignments for each contact
      for (const invoice of invoices) {
        if (!invoice.clubId) continue;
        
        const club = await storage.getClub(invoice.clubId);
        if (!club) continue;
        
        const assignments = await storage.getContactAssignmentsByInvoice(invoice.id);
        
        for (const assignment of assignments) {
          const contactStats = contactAssignmentCounts.get(assignment.contactId);
          if (!contactStats) continue;
          
          // Increment total assignments
          contactStats.totalAssignments++;
          
          // Increment club-specific assignments
          const clubAssignments = contactStats.assignmentsByClub.get(club.id) || {
            clubId: club.id,
            clubName: club.name,
            count: 0
          };
          
          clubAssignments.count++;
          contactStats.assignmentsByClub.set(club.id, clubAssignments);
        }
      }
      
      // Convert to array format for response
      const stats: any[] = [];
      contactAssignmentCounts.forEach((contactStats) => {
        if (contactStats.totalAssignments === 0) return;
        
        const clubStats = Array.from(contactStats.assignmentsByClub.values());
        stats.push({
          contactId: contactStats.contactId,
          contactName: contactStats.contactName,
          totalAssignments: contactStats.totalAssignments,
          assignmentsByClub: clubStats
        });
      });
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching contact statistics:", error);
      res.status(500).json({ message: "Failed to fetch contact statistics" });
    }
  });

  // Settings endpoints
  app.get("/api/settings/:key", async (req: Request, res: Response) => {
    try {
      const key = req.params.key;
      const setting = await storage.getSetting(key);
      
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      
      res.json(setting);
    } catch (error) {
      console.error("Error fetching setting:", error);
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.post("/api/settings/:key", async (req: Request, res: Response) => {
    try {
      const key = req.params.key;
      const { value, type = "string" } = req.body;
      
      if (!value) {
        return res.status(400).json({ message: "Value is required" });
      }
      
      const setting = await storage.setSetting(key, value, type);
      res.json(setting);
    } catch (error) {
      console.error("Error saving setting:", error);
      res.status(500).json({ message: "Failed to save setting" });
    }
  });

  app.get("/api/settings", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Database optimization endpoint
  app.post("/api/admin/optimize-database", async (_req: Request, res: Response) => {
    try {
      console.log("Running database optimization...");
      const result = await DatabaseOptimizations.runFullOptimization();
      res.json(result);
    } catch (error) {
      console.error("Database optimization failed:", error);
      res.status(500).json({ 
        success: false, 
        message: "Database optimization failed", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);
  // Seed production database if empty
  app.post("/api/admin/seed-production", async (_req: Request, res: Response) => {
    try {
      const existingInvoices = await storage.getInvoices();
      if (existingInvoices.length > 0) {
        return res.json({ 
          success: false, 
          message: `Database already contains ${existingInvoices.length} invoices` 
        });
      }

      // Create sample invoices
      const invoices = [
        {
          homeTeam: "FC Malmö",
          awayTeam: "BK Höllviken", 
          dateTime: new Date("2025-06-10T18:00:00Z"),
          venue: "Malmö Stadium",
          city: "Malmö",
          category: "Elite",
          description: "Important league match",
          sport: "football",
          team: "senior"
        },
        {
          homeTeam: "Sorgenfri FF",
          awayTeam: "Hyllie IK",
          dateTime: new Date("2025-06-15T17:00:00Z"), 
          venue: "Sorgenfri IP",
          city: "Malmö",
          category: "friendly",
          description: "Youth friendly match",
          sport: "football", 
          team: "u16"
        }
      ];

      const contacts = [
        {
          fullName: "Erik Lindström",
          email: "erik.lindstrom@example.com",
          phone: "+46701234567",
          city: "Malmö",
          address: "Storgatan 123"
        }
      ];

      for (const invoice of invoices) {
        await storage.createInvoice(invoice);
      }
      
      for (const contact of contacts) {
        await storage.createContact(contact);
      }

      res.json({ 
        success: true, 
        message: `Seeded ${invoices.length} invoices and ${contacts.length} contacts`
      });
    } catch (error: any) {
      console.error("Database seeding failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
