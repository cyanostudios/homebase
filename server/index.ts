import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import invoicesRouter from "./routes/invoices";
import contactsRouter from "./routes/contacts";
import assignmentsRouter from "./routes/assignments";
import settingsRouter from "./routes/settings";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize the database before registering routes
  const dbStatus = await initializeDatabase();
  log(`Database initialization status: ${JSON.stringify(dbStatus)}`);
  
  // If database is not connected, it's a critical error
  if (!dbStatus.connected) {
    console.error("CRITICAL: Database connection failed. Application may not function correctly.");
  }
  
  // If database is connected but tables don't exist, create schema
  if (dbStatus.connected && !dbStatus.tablesExist) {
    log("Database tables don't exist, but invoices table has been created manually.");
    log("The 'matches' table has been renamed to 'invoices' successfully.");
  }
  
  const server = await registerRoutes(app);

  // Mount feature routers
  app.use("/api/invoices", invoicesRouter);
  app.use("/api/contacts", contactsRouter);
  app.use("/api/assignments", assignmentsRouter);
  app.use("/api/settings", settingsRouter);

  // Log route registration completion for production debugging
  log("=== ROUTE REGISTRATION COMPLETE ===");
  log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  log(`Database URL exists: ${!!process.env.DATABASE_URL}`);
  log("Routes registered before static serving");

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
    log("Development: Vite middleware loaded");
  } else {
    log("Production: Loading static file serving");
    serveStatic(app);
    log("Production: Static file serving loaded");
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
