// server/core/services/intakeInspectionService.js
// Service layer for CF7 webhook intake: folder, file records, inspection project, file attach.
// Uses existing Files and Inspection models with a synthetic req context (intake user).

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { sanitizeFolderPath } = require('../../../plugins/files/pathUtils');
const FilesModel = require('../../../plugins/files/model');
const InspectionModel = require('../../../plugins/inspection/model');

const UPLOAD_ROOT = path.join(process.cwd(), 'server', 'uploads', 'files');
const filesModel = new FilesModel();

/**
 * Build a req-like object for Database/tenant context.
 * Uses CF7_INTAKE_USER_ID for ownership. For neon provider, looks up tenant connection.
 * @returns {Promise<Object>} Synthetic req with session and optional tenantPool
 */
async function buildIntakeReq() {
  const intakeUserId = process.env.CF7_INTAKE_USER_ID;
  if (!intakeUserId) {
    throw new Error('CF7_INTAKE_USER_ID is required for intake webhook');
  }
  const userId = parseInt(String(intakeUserId).trim(), 10);
  if (!Number.isFinite(userId) || userId < 1) {
    throw new Error('CF7_INTAKE_USER_ID must be a positive integer');
  }

  const req = {
    session: {
      user: { id: userId },
      currentTenantUserId: userId,
    },
    tenantPool: undefined,
  };

  if (process.env.TENANT_PROVIDER === 'neon') {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const r = await pool.query(
        'SELECT neon_connection_string FROM tenants WHERE user_id = $1 AND neon_connection_string IS NOT NULL LIMIT 1',
        [userId]
      );
      await pool.end();
      if (r.rows?.length && r.rows[0].neon_connection_string) {
        const ServiceManager = require('../ServiceManager');
        const connectionPool = ServiceManager.get('connectionPool');
        req.tenantPool = connectionPool.getTenantPool(r.rows[0].neon_connection_string);
      }
    } catch (e) {
      throw new Error(`Failed to resolve tenant for intake user ${userId}: ${e.message}`);
    }
  }

  return req;
}

/**
 * Ensure folder exists on disk. Returns folder path (relative to upload root).
 * @param {string} folderName - Safe folder name (use safeName/sanitize before)
 * @returns {{ path: string, created: boolean }}
 */
function ensureFolderByName(folderName) {
  const folderPath = sanitizeFolderPath(folderName);
  if (!folderPath) {
    throw new Error('Folder name is required');
  }
  const absPath = path.join(UPLOAD_ROOT, folderPath);
  const rootResolved = path.resolve(UPLOAD_ROOT);
  const absResolved = path.resolve(absPath);
  if (!absResolved.startsWith(rootResolved) || absResolved === rootResolved) {
    throw new Error('Invalid folder path');
  }
  if (fs.existsSync(absResolved)) {
    if (fs.statSync(absResolved).isDirectory()) {
      return { path: folderPath, created: false };
    }
    throw new Error('Path already exists as file');
  }
  fs.mkdirSync(absResolved, { recursive: true });
  return { path: folderPath, created: true };
}

/**
 * Create a file record in user_files. Physical file must already exist at the given URL path.
 * @param {Object} req - Synthetic req from buildIntakeReq
 * @param {Object} data - { name, size, mimeType, url, folderPath }
 * @returns {Promise<Object>} File record with id
 */
async function createFileRecord(req, data) {
  return await filesModel.create(req, data);
}

/**
 * Create inspection project.
 * @param {Object} req - Synthetic req from buildIntakeReq
 * @param {Object} data - { name, description, adminNotes }
 * @returns {Promise<Object>} Project with id, files, etc.
 */
async function createInspectionProject(req, data) {
  return await InspectionModel.create(req, data);
}

/**
 * Attach file IDs to inspection project.
 * @param {Object} req - Synthetic req from buildIntakeReq
 * @param {string|number} projectId
 * @param {string[]} fileIds
 * @returns {Promise<Object>} Updated project
 */
async function attachFiles(req, projectId, fileIds) {
  return await InspectionModel.addFiles(req, projectId, fileIds);
}

module.exports = {
  buildIntakeReq,
  ensureFolderByName,
  createFileRecord,
  createInspectionProject,
  attachFiles,
  UPLOAD_ROOT,
};
