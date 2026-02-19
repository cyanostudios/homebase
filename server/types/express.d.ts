/**
 * Express module augmentation
 *
 * Declares the custom properties that Homebase adds to:
 *  - express-session's SessionData  (req.session.user, .tenantConnectionString, .currentTenantUserId)
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
        currentTenantUserId?: number;
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

export { };
