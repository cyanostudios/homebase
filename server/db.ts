import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from "@shared/schema";

// Check for Replit PostgreSQL environment variables
if (!process.env.PGHOST || !process.env.PGUSER || !process.env.PGPASSWORD || !process.env.PGDATABASE) {
  throw new Error(
    "Replit PostgreSQL environment variables must be set. Ensure the database is provisioned.",
  );
}

// Create connection pool for Replit PostgreSQL
const replitDatabaseUrl = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}?sslmode=require`;

export const pool = new Pool({ 
  connectionString: replitDatabaseUrl,
  max: 5, // Reduced for Replit PostgreSQL
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false }, // Replit PostgreSQL SSL configuration
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

// Initialize Drizzle ORM with the schema for Replit PostgreSQL
export const db = drizzle(pool, { 
  schema,
  logger: process.env.NODE_ENV === 'development'
});

// Database initialization function
export async function initializeDatabase() {
  try {
    // Test the database connection
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log("Database connection test successful");
    
    // Create settings table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'string',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Settings table ensured");
    
    // Create notifications table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        related_to TEXT NOT NULL,
        related_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Notifications table ensured");
    
    // Check if tables exist (look for invoices table) - use direct table count
    const tableCheckResult = await db.execute(sql`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'invoices'
    `);
    
    // Extract table count - handle both result formats
    const tableCheckData = tableCheckResult.rows || tableCheckResult;
    const tableCheckRow = Array.isArray(tableCheckData) ? tableCheckData[0] : tableCheckData;
    const tableCount = parseInt(String(tableCheckRow?.table_count || 0));
    const tablesExist = tableCount > 0;
    console.log("Database tables exist:", tablesExist);
    
    if (tablesExist) {
      // Count records in invoices table
      const invoiceCountResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM invoices
      `);
      
      // Extract count safely - handle both formats
      const invoiceCountData = invoiceCountResult.rows || invoiceCountResult;
      const invoiceCountRow = Array.isArray(invoiceCountData) ? invoiceCountData[0] : invoiceCountData;
      const invoiceCount = parseInt(String(invoiceCountRow?.count || 0));
      console.log("Current invoice count:", invoiceCount);
      
      // If no invoices exist in the deployed database, log a warning
      if (invoiceCount === 0) {
        console.warn("WARNING: Database tables exist but there are no invoices! Data needs to be seeded.");
      }
    }
    
    console.log("Database initialization complete");
    
    return {
      connected: true,
      tablesExist,
      timestamp: new Date().toISOString()
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Database initialization failed:", errorMessage);
    return {
      connected: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    };
  }
}

// Log database connection success
console.log("Database connection established");
