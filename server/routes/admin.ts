import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { DatabaseOptimizations } from "../database-optimizations";

const router = Router();

router.post("/optimize-database", async (_req: Request, res: Response) => {
  try {
    const result = await DatabaseOptimizations.runFullOptimization();
    res.json(result);
  } catch {
    res.status(500).json({ success: false, message: "Database optimization failed" });
  }
});

router.post("/seed-production", async (_req: Request, res: Response) => {
  try {
    const existingInvoices = await storage.getInvoices();
    if (existingInvoices.length > 0) {
      return res.json({ success: false, message: `Database already contains ${existingInvoices.length} invoices` });
    }

    const invoices = [
      { homeTeam: "FC Malmö", awayTeam: "BK Höllviken", dateTime: new Date("2025-06-10T18:00:00Z"), venue: "Malmö Stadium", city: "Malmö", category: "Elite", description: "Important league match", sport: "football", team: "senior" },
      { homeTeam: "Sorgenfri FF", awayTeam: "Hyllie IK", dateTime: new Date("2025-06-15T17:00:00Z"), venue: "Sorgenfri IP", city: "Malmö", category: "friendly", description: "Youth friendly match", sport: "football", team: "u16" },
    ];

    const contacts = [
      { fullName: "Erik Lindström", email: "erik.lindstrom@example.com", phone: "+46701234567", city: "Malmö", address: "Storgatan 123" },
    ];

    for (const invoice of invoices) {
      await storage.createInvoice(invoice);
    }

    for (const contact of contacts) {
      await storage.createContact(contact);
    }

    res.json({ success: true, message: `Seeded ${invoices.length} invoices and ${contacts.length} contacts` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
