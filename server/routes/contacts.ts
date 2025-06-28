import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertContactSchema } from "@shared/schema";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const contacts = await storage.getContacts();
    res.json(contacts);
  } catch {
    res.status(500).json({ message: "Failed to fetch contacts" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const contact = await storage.getContact(id);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json(contact);
  } catch {
    res.status(500).json({ message: "Failed to fetch contact" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    let flattened: any;
    if (body.company || body.address || body.contactInfo || body.paymentInfo || body.invoiceInfo || body.professional) {
      flattened = {
        contactType: body.contactType,
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
        companyName: body.company?.name,
        organizationNumber: body.company?.organizationNumber,
        vatNumber: body.company?.vatNumber,
        companyType: body.company?.type,
        industry: body.company?.industry,
        addressType: body.address?.type,
        visitingAddress: body.address?.street,
        mailingAddress: body.address?.addressLine2,
        postalCode: body.address?.postalCode,
        addressCity: body.address?.city,
        region: body.address?.region,
        country: body.address?.country,
        phoneSwitchboard: body.contactInfo?.phoneSwitchboard,
        phoneDirect: body.contactInfo?.phoneDirect,
        emailGeneral: body.contactInfo?.emailGeneral,
        emailInvoicing: body.contactInfo?.emailInvoicing,
        emailOrders: body.contactInfo?.emailOrders,
        website: body.contactInfo?.website,
        bankgiroNumber: body.paymentInfo?.bankgiroNumber,
        plusgiroNumber: body.paymentInfo?.plusgiroNumber,
        iban: body.paymentInfo?.iban,
        bicSwift: body.paymentInfo?.bicSwift,
        bankName: body.paymentInfo?.bankName,
        fTax: body.invoiceInfo?.fTax,
        vatRate: body.invoiceInfo?.vatRate,
        paymentTerms: body.invoiceInfo?.paymentTerms,
        invoiceMethod: body.invoiceInfo?.invoiceMethod,
        einvoiceAddress: body.invoiceInfo?.einvoiceAddress,
        referencePerson: body.invoiceInfo?.referencePerson,
        invoiceRequirements: body.invoiceInfo?.invoiceRequirements,
        contactPersons: JSON.stringify(body.contactPersons || []),
        additionalAddresses: JSON.stringify(body.additionalAddresses || []),
      };
    } else {
      flattened = {
        ...body,
        contactPersons: JSON.stringify(body.contactPersons || []),
        additionalAddresses: JSON.stringify(body.additionalAddresses || []),
      };
    }
    const data = insertContactSchema.parse(flattened);
    const contact = await storage.createContact(data);
    const contactName = contact.fullName || contact.email || contact.companyName || "New Contact";
    await storage.createActivity({
      activityType: "CONTACT_CREATED",
      description: `New contact added: ${contactName}`,
      userId: 1,
      contactId: contact.id,
      invoiceId: null,
    });
    res.status(201).json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create contact" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const original = await storage.getContact(id);
    if (!original) return res.status(404).json({ message: "Contact not found" });
    const data = insertContactSchema.partial().parse(req.body);
    const updated = await storage.updateContact(id, data);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update contact" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const contact = await storage.getContact(id);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    const success = await storage.deleteContact(id);
    if (!success) return res.status(500).json({ message: "Failed to delete contact" });
    res.json({ message: "Contact deleted successfully" });
  } catch {
    res.status(500).json({ message: "Failed to delete contact" });
  }
});

router.get("/:id/assignments", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.id);
    const assignments = await storage.getContactAssignmentsByContact(contactId);
    const withInvoices = await Promise.all(assignments.map(async (a) => ({
      ...a,
      invoice: await storage.getInvoice(a.invoiceId),
    })));
    res.json(withInvoices);
  } catch {
    res.status(500).json({ message: "Failed to fetch assignments" });
  }
});

router.get("/:id/notifications", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.id);
    const contact = await storage.getContact(contactId);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    const notifications = await storage.getContactNotifications(contactId);
    res.json(notifications);
  } catch {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

export default router;
