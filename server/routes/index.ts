import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "../storage";
import { db } from "../db";
import { sql } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use("/api/*", (req, _res, next) => {
    console.log(`API route hit: ${req.method} ${req.path}`);
    next();
  });

  app.get("/api/health", async (_req: Request, res: Response) => {
    try {
      await db.execute(sql`SELECT 1`);
      res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
    } catch {
      res.status(500).json({ status: "error", database: "disconnected", message: "Database connection failed", timestamp: new Date().toISOString() });
    }
  });

  app.get("/api/production-test", async (_req: Request, res: Response) => {
    const diagnostics: any = {
      message: "Production API endpoint test",
      environment: process.env.NODE_ENV || "development",
      databaseUrlExists: !!process.env.DATABASE_URL,
      timestamp: new Date().toISOString(),
    };

    try {
      await db.execute(sql`SELECT 1 as test`);
      diagnostics.connectionTest = "SUCCESS";
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
    }

    try {
      const invoices = await storage.getInvoices();
      diagnostics.storageMatchCount = invoices.length;
      diagnostics.storageTest = "SUCCESS";
    } catch (error: any) {
      diagnostics.storageTest = `FAILED: ${error.message}`;
    }

    res.json(diagnostics);
  });

  app.get("/api/test", (_req: Request, res: Response) => {
    res.json({ status: "API routes working", timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || "development" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
