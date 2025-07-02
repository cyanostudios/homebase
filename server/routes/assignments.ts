import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertContactAssignmentSchema, ContactStatus, ActivityType } from "@shared/schema";

const router = Router();

router.post("/:id/respond", async (req: Request, res: Response) => {
  try {
    const assignmentId = parseInt(req.params.id);
    const { response, contactId } = req.body;

    if (!response || !["ACCEPTED", "DECLINED"].includes(response)) {
      return res.status(400).json({ message: "Valid response (ACCEPTED or DECLINED) is required" });
    }

    const assignment = await storage.getContactAssignment(assignmentId);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    if (assignment.contactId !== parseInt(contactId)) {
      return res.status(403).json({ message: "Not authorized to respond to this assignment" });
    }

    const updatedAssignment = await storage.updateContactAssignment(assignmentId, {
      status: response === "ACCEPTED" ? ContactStatus.ASSIGNED : ContactStatus.DECLINED,
      responseAt: new Date(),
      response,
    });

    const contact = await storage.getContact(parseInt(contactId));
    await storage.createActivity({
      activityType: response === "ACCEPTED" ? ActivityType.ASSIGNMENT_ACCEPTED : ActivityType.ASSIGNMENT_DECLINED,
      description: `${contact?.fullName || "Contact"} ${response.toLowerCase()} assignment for invoice #${assignment.invoiceId}`,
      contactId: parseInt(contactId),
      invoiceId: assignment.invoiceId,
      userId: null,
    });

    const invoice = await storage.getInvoice(assignment.invoiceId);
    if (invoice && contact) {
      try {
        await storage.createNotification({
          contactId: 0,
          message: `${contact.fullName} has ${response.toLowerCase()} the assignment for ${invoice.homeTeam} vs ${invoice.awayTeam}`,
          isRead: false,
          relatedTo: "assignment",
          relatedId: assignmentId,
        });
      } catch {
        /* ignore notification errors */
      }
    }

    res.json({ message: `Assignment ${response.toLowerCase()} successfully`, assignment: updatedAssignment });
  } catch {
    res.status(500).json({ message: "Failed to respond to assignment" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertContactAssignmentSchema.parse(req.body);
    const invoice = await storage.getInvoice(data.invoiceId);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    const contact = await storage.getContact(data.contactId);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    const existing = await storage.getContactAssignmentsByInvoice(data.invoiceId);
    if (existing.some(a => a.contactId === data.contactId)) {
      return res.status(400).json({ message: "Contact is already assigned to this invoice", error: "DUPLICATE_ASSIGNMENT" });
    }
    const assignment = await storage.createContactAssignment(data);
    await storage.createActivity({
      activityType: "ASSIGNMENT_CREATED",
      description: `${contact.fullName} was assigned to ${invoice.homeTeam} vs ${invoice.awayTeam}`,
      userId: 1,
      contactId: contact.id,
      invoiceId: invoice.id,
    });
    res.status(201).json(assignment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid assignment data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create assignment" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const data = insertContactAssignmentSchema.partial().parse(req.body);
    const assignment = await storage.getContactAssignment(id);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    const updated = await storage.updateContactAssignment(id, data);
    if (data.status && data.status !== assignment.status) {
      const invoice = await storage.getInvoice(assignment.invoiceId);
      const contact = await storage.getContact(assignment.contactId);
      if (invoice && contact) {
        let activityType = "ASSIGNMENT_UPDATED";
        let description = `${contact.fullName}'s assignment for ${invoice.homeTeam} vs ${invoice.awayTeam} was updated`;
        if (data.status === "NOTIFIED") {
          activityType = "NOTIFICATION_SENT";
          description = `Notification sent to ${contact.fullName} for ${invoice.homeTeam} vs ${invoice.awayTeam}`;
        } else if (data.status === "ASSIGNED" && data.response === "ACCEPTED") {
          activityType = "ASSIGNMENT_ACCEPTED";
          description = `${contact.fullName} accepted the assignment for ${invoice.homeTeam} vs ${invoice.awayTeam}`;
        } else if (data.status === "DECLINED" || data.response === "DECLINED") {
          activityType = "ASSIGNMENT_DECLINED";
          description = `${contact.fullName} declined the assignment for ${invoice.homeTeam} vs ${invoice.awayTeam}`;
        }
        await storage.createActivity({ activityType, description, userId: 1, contactId: contact.id, invoiceId: invoice.id });
      }
    }
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid assignment data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update assignment" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const assignment = await storage.getContactAssignment(id);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    await storage.deleteContactAssignment(id);
    const invoice = await storage.getInvoice(assignment.invoiceId);
    const contact = await storage.getContact(assignment.contactId);
    if (invoice && contact) {
      await storage.createActivity({
        activityType: "ASSIGNMENT_DELETED",
        description: `${contact.fullName} was removed from ${invoice.homeTeam} vs ${invoice.awayTeam}`,
        userId: 1,
        contactId: contact.id,
        invoiceId: invoice.id,
      });
    }
    res.status(204).send();
  } catch {
    res.status(500).json({ message: "Failed to delete assignment" });
  }
});

router.post("/:id/notify", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const assignment = await storage.getContactAssignment(id);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    const updated = await storage.updateContactAssignment(id, { status: "NOTIFIED", notifiedAt: new Date() });
    const invoice = await storage.getInvoice(assignment.invoiceId);
    const contact = await storage.getContact(assignment.contactId);
    if (invoice && contact) {
      await storage.createActivity({
        activityType: "NOTIFICATION_SENT",
        description: `Notification sent to ${contact.fullName} for ${invoice.homeTeam} vs ${invoice.awayTeam}`,
        userId: 1,
        contactId: contact.id,
        invoiceId: invoice.id,
      });
      try {
        await storage.createNotification({
          contactId: contact.id,
          message: `You have a new assignment request for ${invoice.homeTeam} vs ${invoice.awayTeam}`,
          isRead: false,
          relatedTo: "assignment",
          relatedId: assignment.id,
        });
      } catch {
        /* ignore notification errors */
      }
    }
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to notify contact" });
  }
});

export default router;
