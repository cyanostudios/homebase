import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertInvoiceSchema } from "@shared/schema";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const invoices = await storage.getInvoices();
    res.json(invoices);
  } catch {
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const invoice = await storage.getInvoice(id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(invoice);
  } catch {
    res.status(500).json({ message: "Failed to fetch invoice" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertInvoiceSchema.parse(req.body);
    if (!data.status) data.status = "UPCOMING";
    const invoice = await storage.createInvoice(data);
    await storage.createActivity({
      activityType: "INVOICE_CREATED",
      description: `New invoice added: ${invoice.homeTeam || "TBD"} vs ${invoice.awayTeam || "TBD"}`,
      userId: 1,
      contactId: null,
      invoiceId: invoice.id,
    });
    res.status(201).json(invoice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid invoice data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create invoice" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const original = await storage.getInvoice(id);
    if (!original) return res.status(404).json({ message: "Invoice not found" });
    const update = insertInvoiceSchema.partial().parse(req.body);
    const updated = await storage.updateInvoice(id, update);
    await storage.createActivity({
      activityType: "INVOICE_UPDATED",
      description: `${updated?.homeTeam} vs ${updated?.awayTeam} updated`,
      userId: null,
      contactId: null,
      invoiceId: updated?.id || null,
    });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid invoice data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update invoice" });
  }
});

router.get("/:id/assignments", async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const assignments = await storage.getContactAssignmentsByInvoice(invoiceId);
    const withContacts = await Promise.all(assignments.map(async (a) => ({
      ...a,
      contact: await storage.getContact(a.contactId),
    })));
    res.json(withContacts);
  } catch {
    res.status(500).json({ message: "Failed to fetch assignments" });
  }
});

router.get("/:invoiceId/contact/:contactId/decline-history", async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    const contactId = parseInt(req.params.contactId);
    const assignments = await storage.getContactAssignmentsByInvoice(invoiceId);
    const declined = assignments.find(a => a.contactId === contactId && a.status === "DECLINED");
    const activities = await storage.getActivities();
    const invoice = await storage.getInvoice(invoiceId);
    const contact = await storage.getContact(contactId);

    let declineActivity = null as any;
    if (invoice && contact) {
      declineActivity = activities.find(a =>
        a.activityType === "ASSIGNMENT_DECLINED" &&
        a.contactId === contactId &&
        (a.description.includes(`${invoice.homeTeam} vs ${invoice.awayTeam}`) ||
         a.description.includes(`Invoice ID: ${invoiceId}`))
      );
    }

    res.json({
      hasDeclined: !!(declined || declineActivity),
      declineDate: declined?.responseAt || declineActivity?.createdAt,
    });
  } catch {
    res.status(500).json({ message: "Failed to check decline history" });
  }
});

export default router;
