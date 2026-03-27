/**
 * Express module augmentation
 *
 * Declares the custom properties that Homebase adds to:
 *  - express-session's SessionData  (req.session.user, .tenantConnectionString, .tenantId)
 *  - Express's Request              (req.tenantPool)
 *
 * This file has zero runtime impact – it is erased at compile time.
 */

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      email: string;
      role: string;
      plugins: string[];
    };
    tenantConnectionString?: string;
    tenantSchemaName?: string | null;
    tenantId?: number | null;
    tenantRole?: 'user' | 'editor' | 'admin' | null;
    tenantOwnerUserId?: number | null;
  }
}

declare global {
  namespace Express {
    interface Request {
      /** Tenant-specific database pool (only set when TENANT_PROVIDER=neon) */
      tenantPool?: import('pg').Pool;
    }
  }
}

export {};
