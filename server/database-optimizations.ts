import { db } from "./db";
import { sql } from "drizzle-orm";
import { 
  invoices, 
  contactAssignments, 
  contacts, 
  activities,
  notifications 
} from "@shared/schema";
import { eq, desc, and, inArray } from "drizzle-orm";

export class DatabaseOptimizations {
  
  // Batch load contact assignments for multiple invoices to reduce N+1 queries
  static async batchLoadInvoiceAssignments(invoiceIds: number[]) {
    if (invoiceIds.length === 0) return {};
    
    const assignments = await db
      .select()
      .from(contactAssignments)
      .where(inArray(contactAssignments.invoiceId, invoiceIds));
    
    // Group by invoiceId for easy lookup
    const assignmentsByInvoice: Record<number, typeof assignments> = {};
    assignments.forEach(assignment => {
      if (!assignmentsByInvoice[assignment.invoiceId]) {
        assignmentsByInvoice[assignment.invoiceId] = [];
      }
      assignmentsByInvoice[assignment.invoiceId].push(assignment);
    });
    
    return assignmentsByInvoice;
  }

  // Batch load decline history for multiple referee-invoice combinations
  static async batchLoadDeclineHistory(refereeInvoicePairs: Array<{refereeId: number, invoiceId: number}>) {
    if (refereeInvoicePairs.length === 0) return {};
    
    // Create conditions for all pairs
    const conditions = refereeInvoicePairs.map(pair => 
      and(
        eq(refereeAssignments.refereeId, pair.refereeId),
        eq(refereeAssignments.invoiceId, pair.invoiceId),
        eq(refereeAssignments.status, 'DECLINED')
      )
    );
    
    const declineHistory = await db
      .select({
        refereeId: refereeAssignments.refereeId,
        invoiceId: refereeAssignments.invoiceId,
        hasDeclined: sql<boolean>`COUNT(*) > 0`
      })
      .from(refereeAssignments)
      .where(sql`${refereeAssignments.refereeId} IN (${refereeInvoicePairs.map(p => p.refereeId).join(',')}) 
                 AND ${refereeAssignments.invoiceId} IN (${refereeInvoicePairs.map(p => p.invoiceId).join(',')})
                 AND ${refereeAssignments.status} = 'DECLINED'`)
      .groupBy(refereeAssignments.refereeId, refereeAssignments.invoiceId);
    
    // Convert to lookup object
    const lookup: Record<string, boolean> = {};
    declineHistory.forEach(record => {
      lookup[`${record.refereeId}-${record.invoiceId}`] = record.hasDeclined;
    });
    
    return lookup;
  }

  // Get dashboard stats with optimized single query
  static async getDashboardStats() {
    const result = await db.execute(sql`
      WITH sent_invoices AS (
        SELECT COUNT(*) as count 
        FROM invoices 
        WHERE status = 'SENT'
      ),
      unpaid_invoices AS (
        SELECT COUNT(*) as count 
        FROM invoices 
        WHERE status = 'UNPAID' OR status = 'PENDING'
      ),
      overdue_invoices AS (
        SELECT COUNT(*) as count 
        FROM invoices 
        WHERE status = 'OVERDUE' OR (status = 'UNPAID' AND date_time < NOW() - INTERVAL '30 days')
      ),
      upcoming_invoices AS (
        SELECT COUNT(*) as count 
        FROM invoices 
        WHERE date_time >= NOW() AND date_time <= NOW() + INTERVAL '14 days'
      ),
      assigned_contacts AS (
        SELECT COUNT(DISTINCT contact_id) as count 
        FROM contact_assignments ca
        JOIN invoices i ON ca.invoice_id = i.id
        WHERE i.date_time >= NOW() AND ca.status = 'ASSIGNED'
      ),
      pending_assignments AS (
        SELECT COUNT(*) as count 
        FROM contact_assignments ca
        JOIN invoices i ON ca.invoice_id = i.id
        WHERE i.date_time >= NOW() AND ca.status = 'NOT_NOTIFIED'
      ),
      active_contacts AS (
        SELECT COUNT(*) as count 
        FROM contacts 
        WHERE availability = 'AVAILABLE'
      )
      SELECT 
        si.count as sent_invoices,
        ui.count as unpaid_invoices,
        oi.count as overdue_invoices,
        upi.count as upcoming_invoices,
        ac.count as assigned_contacts,
        pa.count as pending_assignments,
        act.count as active_contacts
      FROM sent_invoices si, unpaid_invoices ui, overdue_invoices oi, upcoming_invoices upi, assigned_contacts ac, pending_assignments pa, active_contacts act
    `);
    
    const row = result.rows?.[0] || result[0];
    return row as any;
  }

  // Clean up old activities (older than 30 days) to improve performance
  static async cleanupOldActivities() {
    const result = await db.execute(sql`
      DELETE FROM activities 
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);
    
    console.log(`Cleaned up old activities: ${result.rowCount} rows deleted`);
    return result.rowCount;
  }

  // Clean up read notifications older than 7 days
  static async cleanupOldNotifications() {
    const result = await db.execute(sql`
      DELETE FROM notifications 
      WHERE is_read = true AND created_at < NOW() - INTERVAL '7 days'
    `);
    
    console.log(`Cleaned up old notifications: ${result.rowCount} rows deleted`);
    return result.rowCount;
  }

  // Add database indexes for frequently queried columns
  static async createOptimizationIndexes() {
    try {
      // Index for referee assignments by match_id (frequently queried)
      await db.execute(sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_referee_assignments_match_id 
        ON referee_assignments(match_id)
      `);

      // Index for referee assignments by referee_id
      await db.execute(sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_referee_assignments_referee_id 
        ON referee_assignments(referee_id)
      `);

      // Index for matches by date_time (for upcoming matches queries)
      await db.execute(sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_date_time 
        ON matches(date_time)
      `);

      // Index for activities by created_at (for recent activities)
      await db.execute(sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_created_at 
        ON activities(created_at DESC)
      `);

      // Index for notifications by referee_id and is_read
      await db.execute(sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_referee_read 
        ON notifications(referee_id, is_read)
      `);

      // Composite index for referee assignments status and match date queries
      await db.execute(sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_status_match_date 
        ON referee_assignments(status, match_id)
      `);

      console.log("Database optimization indexes created successfully");
    } catch (error) {
      console.error("Error creating optimization indexes:", error);
    }
  }

  // Analyze database performance and suggest optimizations
  static async analyzePerformance() {
    try {
      // Get table sizes
      const tableSizes = await db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);

      // Get slow queries (if query stats are available)
      const slowQueries = await db.execute(sql`
        SELECT query, calls, total_time, mean_time 
        FROM pg_stat_statements 
        WHERE mean_time > 100 
        ORDER BY mean_time DESC 
        LIMIT 10
      `).catch(() => []);

      console.log("Database analysis complete:");
      console.log("Table sizes:", tableSizes);
      if (slowQueries.length > 0) {
        console.log("Slow queries detected:", slowQueries);
      }

      return { tableSizes, slowQueries };
    } catch (error) {
      console.error("Error analyzing database performance:", error);
      return { tableSizes: [], slowQueries: [] };
    }
  }

  // Run full optimization routine
  static async runFullOptimization() {
    console.log("Starting database optimization routine...");
    
    try {
      // 1. Create indexes for better query performance
      await this.createOptimizationIndexes();
      
      // 2. Clean up old data
      await this.cleanupOldActivities();
      await this.cleanupOldNotifications();
      
      // 3. Analyze performance
      const analysis = await this.analyzePerformance();
      
      // 4. Update table statistics for better query planning
      await db.execute(sql`ANALYZE`);
      
      console.log("Database optimization completed successfully");
      return {
        success: true,
        analysis,
        message: "Database has been optimized with indexes, cleanup, and analysis"
      };
    } catch (error) {
      console.error("Database optimization failed:", error);
      return {
        success: false,
        error: error.message,
        message: "Database optimization encountered errors"
      };
    }
  }
}