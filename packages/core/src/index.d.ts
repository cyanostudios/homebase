// packages/core/src/index.d.ts
// TypeScript definitions for @homebase/core

import { Request, Response, NextFunction, Router as ExpressRouter } from 'express';

/**
 * Logger interface for structured logging
 */
export class Logger {
  /**
   * Get logger instance
   */
  static get(): LoggerInstance;

  /**
   * Log info message
   */
  static info(message: string, meta?: Record<string, any>): void;

  /**
   * Log error message
   */
  static error(message: string, error?: Error | null, meta?: Record<string, any>): void;

  /**
   * Log warning message
   */
  static warn(message: string, meta?: Record<string, any>): void;

  /**
   * Log debug message
   */
  static debug(message: string, meta?: Record<string, any>): void;
}

export interface LoggerInstance {
  info(message: string, meta?: Record<string, any>): void;
  error(message: string, error?: Error | null, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  debug(message: string, meta?: Record<string, any>): void;
}

/**
 * Database interface for tenant-isolated queries
 */
export class Database {
  /**
   * Get database instance for current request
   */
  static get(req: Request): DatabaseInstance;

  /**
   * Get database service directly (for non-request contexts)
   */
  static getService(): any;
}

export interface DatabaseInstance {
  /**
   * Execute SQL query with automatic tenant isolation
   */
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;

  /**
   * Execute transaction
   */
  transaction<T = any>(callback: (client: any) => Promise<T>): Promise<T>;

  /**
   * Get raw pool (use with caution)
   */
  getPool(): any;
}

/**
 * Context utilities for accessing request information
 */
export class Context {
  /**
   * Get current user ID
   */
  static getUserId(req: Request): number | null;

  /**
   * Get current tenant owner user ID
   */
  static getTenantUserId(req: Request): number | null;

  /**
   * Get user email
   */
  static getUserEmail(req: Request): string | null;

  /**
   * Get user role
   */
  static getUserRole(req: Request): string | null;

  /**
   * Check if user is admin
   */
  static isAdmin(req: Request): boolean;

  /**
   * Check if user has plugin access
   */
  static hasPluginAccess(req: Request, pluginName: string): boolean;

  /**
   * Get all user plugins
   */
  static getUserPlugins(req: Request): string[];

  /**
   * Get tenant connection string
   */
  static getTenantConnectionString(req: Request): string | null;

  /**
   * Get full user object
   */
  static getUser(req: Request): any;

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(req: Request): boolean;
}

/**
 * Router utilities for creating plugin routes
 */
export class Router {
  /**
   * Create a new Express router
   */
  static create(): ExpressRouter;

  /**
   * Create async error handler middleware
   */
  static asyncHandler(
    handler: (req: Request, res: Response, next: NextFunction) => Promise<any>
  ): (req: Request, res: Response, next: NextFunction) => void;

  /**
   * Create validation middleware
   */
  static validate(schema: any): (req: Request, res: Response, next: NextFunction) => void;

  /**
   * Create pagination middleware
   */
  static paginate(): (req: Request, res: Response, next: NextFunction) => void;

  /**
   * Create response helpers middleware
   */
  static responseHelpers(): (req: Request, res: Response, next: NextFunction) => void;
}
