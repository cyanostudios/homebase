import { Router, type Request, type Response } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/dashboard/stats", async (_req: Request, res: Response) => {
  try {
    const invoices = await storage.getInvoices();
    const upcoming = invoices.filter(i => i.dateTime && new Date(i.dateTime) > new Date());
    const contacts = await storage.getContacts();
    const allAssignments = [] as any[];
    for (const invoice of upcoming) {
      const assignments = await storage.getContactAssignmentsByInvoice(invoice.id);
      allAssignments.push(...assignments);
    }
    const assignedContacts = allAssignments.filter(a => a.status === "ASSIGNED").length;
    const pendingAssignments = allAssignments.filter(a => a.status !== "ASSIGNED").length;
    res.json({
      upcomingInvoices: upcoming.length,
      assignedContacts,
      pendingAssignments,
      activeContacts: contacts.length,
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
});

router.get("/stats/contact-assignments", async (_req: Request, res: Response) => {
  try {
    const contacts = await storage.getContacts();
    const invoices = await storage.getInvoices();
    const counts = new Map<number, any>();
    for (const contact of contacts) {
      counts.set(contact.id, {
        contactId: contact.id,
        contactName: contact.fullName,
        totalAssignments: 0,
        assignmentsByClub: new Map<number, any>(),
      });
    }
    for (const invoice of invoices) {
      if (!invoice.clubId) continue;
      const club = await storage.getClub(invoice.clubId);
      if (!club) continue;
      const assignments = await storage.getContactAssignmentsByInvoice(invoice.id);
      for (const assignment of assignments) {
        const stats = counts.get(assignment.contactId);
        if (!stats) continue;
        stats.totalAssignments++;
        const clubStats = stats.assignmentsByClub.get(club.id) || { clubId: club.id, clubName: club.name, count: 0 };
        clubStats.count++;
        stats.assignmentsByClub.set(club.id, clubStats);
      }
    }
    const result: any[] = [];
    counts.forEach((stats) => {
      if (stats.totalAssignments === 0) return;
      result.push({
        contactId: stats.contactId,
        contactName: stats.contactName,
        totalAssignments: stats.totalAssignments,
        assignmentsByClub: Array.from(stats.assignmentsByClub.values()),
      });
    });
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch contact statistics" });
  }
});

export default router;
