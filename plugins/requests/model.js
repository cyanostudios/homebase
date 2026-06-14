// plugins/requests/model.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');

const DEFAULT_REQUEST_TYPE = 'general';
const REQUEST_STATUSES = ['not started', 'in progress', 'completed', 'cancelled'];
const REQUEST_PRIORITIES = ['Low', 'Medium', 'High'];
const REQUEST_SOURCES = ['internal', 'external'];

function sanitizeRequestType(value) {
  const trimmed = (value || '').toString().trim().slice(0, 100);
  return trimmed || DEFAULT_REQUEST_TYPE;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function sanitizeAssignedToIds(value) {
  return parseJsonArray(value)
    .map((id) => String(id).trim())
    .filter(Boolean)
    .slice(0, 50);
}

function stableJson(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return value;
    }
  }
  return JSON.stringify(value);
}

class RequestModel {
  static getChangeSummary(existing, requestData) {
    const labels = {
      title: 'Title',
      description: 'Description',
      request_type: 'Type',
      status: 'Status',
      priority: 'Priority',
      team_id: 'Team',
      submitter_name: 'Submitter name',
      submitter_email: 'Submitter email',
      contact_id: 'Contact',
      assigned_to_ids: 'Assignees',
      internal_notes: 'Internal notes',
    };
    const changed = [];

    if ('title' in requestData) {
      const next = (requestData.title || '').toString().trim();
      const prev = (existing.title || '').toString().trim();
      if (next !== prev) changed.push(labels.title);
    }
    if ('description' in requestData) {
      const next = (requestData.description || '').trim();
      const prev = (existing.description || '').trim();
      if (next !== prev) changed.push(labels.description);
    }
    if ('request_type' in requestData) {
      const next = sanitizeRequestType(requestData.request_type);
      const prev = existing.request_type || DEFAULT_REQUEST_TYPE;
      if (next !== prev) changed.push(labels.request_type);
    }
    if ('status' in requestData) {
      const next = REQUEST_STATUSES.includes(requestData.status)
        ? requestData.status
        : 'not started';
      const prev = existing.status || 'not started';
      if (next !== prev) changed.push(labels.status);
    }
    if ('priority' in requestData) {
      const next = REQUEST_PRIORITIES.includes(requestData.priority)
        ? requestData.priority
        : 'Medium';
      const prev = existing.priority || 'Medium';
      if (next !== prev) changed.push(labels.priority);
    }
    if ('team_id' in requestData) {
      const next = requestData.team_id != null ? String(requestData.team_id) : null;
      const prev = existing.team_id != null ? String(existing.team_id) : null;
      if (next !== prev) changed.push(labels.team_id);
    }
    if ('contact_id' in requestData) {
      const next = requestData.contact_id != null ? String(requestData.contact_id) : null;
      const prev = existing.contact_id != null ? String(existing.contact_id) : null;
      if (next !== prev) changed.push(labels.contact_id);
    }
    if ('assigned_to_ids' in requestData) {
      if (
        stableJson(sanitizeAssignedToIds(requestData.assigned_to_ids)) !==
        stableJson(sanitizeAssignedToIds(existing.assigned_to_ids))
      ) {
        changed.push(labels.assigned_to_ids);
      }
    }
    if ('internal_notes' in requestData) {
      const next = (requestData.internal_notes || '').trim();
      const prev = (existing.internal_notes || '').trim();
      if (next !== prev) changed.push(labels.internal_notes);
    }

    return changed.length === 0 ? null : changed.join(', ');
  }

  async getAll(req) {
    try {
      const db = Database.get(req);
      const { team_id, status, request_type, source } = req.query || {};
      let query = 'SELECT * FROM requests';
      const params = [];
      const conditions = [];

      if (team_id) {
        params.push(parseInt(team_id, 10));
        conditions.push(`team_id = $${params.length}`);
      }
      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }
      if (request_type) {
        params.push(request_type);
        conditions.push(`request_type = $${params.length}`);
      }
      if (source) {
        params.push(source);
        conditions.push(`source = $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY created_at DESC';

      const rows = await db.query(query, params);
      return rows.map(this.transformRow);
    } catch (error) {
      Logger.error('Failed to fetch requests', error);
      throw new AppError('Failed to fetch requests', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, requestId) {
    try {
      const db = Database.get(req);
      const rows = await db.query('SELECT * FROM requests WHERE id = $1', [requestId]);
      if (!rows || rows.length === 0) {
        throw new AppError('Request not found', 404, AppError.CODES.NOT_FOUND);
      }
      return this.transformRow(rows[0]);
    } catch (error) {
      Logger.error('Failed to fetch request', error, { requestId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to fetch request', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, requestData) {
    try {
      const db = Database.get(req);
      const {
        title,
        description,
        request_type,
        status,
        priority,
        team_id,
        submitter_name,
        submitter_email,
        contact_id,
        assigned_to_ids,
        internal_notes,
        source,
      } = requestData;

      const trimmedTitle = (title || '').toString().trim();
      if (!trimmedTitle) {
        throw new AppError('Request title is required', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const result = await db.insert('requests', {
        title: trimmedTitle.slice(0, 500),
        description: description ? description.trim().slice(0, 10000) : null,
        request_type: sanitizeRequestType(request_type),
        status: REQUEST_STATUSES.includes(status) ? status : 'not started',
        priority: REQUEST_PRIORITIES.includes(priority) ? priority : 'Medium',
        team_id: team_id ? parseInt(team_id, 10) : null,
        submitter_name: submitter_name ? submitter_name.trim().slice(0, 255) : null,
        submitter_email: submitter_email ? submitter_email.trim().slice(0, 255) : null,
        contact_id: contact_id ? parseInt(contact_id, 10) : null,
        assigned_to_ids: JSON.stringify(sanitizeAssignedToIds(assigned_to_ids)),
        internal_notes: internal_notes ? internal_notes.trim().slice(0, 10000) : null,
        source: REQUEST_SOURCES.includes(source) ? source : 'internal',
      });

      Logger.info('Request created', { requestId: result.id });
      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to create request', error, { title: requestData?.title });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create request', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async createPublic(pool, requestData) {
    try {
      const { title, description, request_type, team_id, submitter_name, submitter_email } =
        requestData;

      const trimmedTitle = (title || '').toString().trim();
      if (!trimmedTitle) {
        throw new AppError('Request title is required', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const result = await pool.query(
        `INSERT INTO requests
          (title, description, request_type, team_id, submitter_name, submitter_email, source, status, priority)
         VALUES ($1, $2, $3, $4, $5, $6, 'external', 'not started', 'Medium')
         RETURNING *`,
        [
          trimmedTitle.slice(0, 500),
          description ? description.trim().slice(0, 10000) : null,
          sanitizeRequestType(request_type),
          team_id ? parseInt(team_id, 10) : null,
          submitter_name ? submitter_name.trim().slice(0, 255) : null,
          submitter_email ? submitter_email.trim().slice(0, 255) : null,
        ],
      );

      Logger.info('Public request created', { requestId: result.rows[0]?.id });
      return this.transformRow(result.rows[0]);
    } catch (error) {
      Logger.error('Failed to create public request', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create request', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getPublicTeams(pool) {
    try {
      const result = await pool.query(
        `SELECT id, name, age_group, gender FROM teams WHERE status = 'active' ORDER BY name ASC`,
      );
      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        age_group: row.age_group || null,
        gender: row.gender || null,
      }));
    } catch (error) {
      Logger.error('Failed to fetch public teams list', error);
      throw new AppError('Failed to fetch teams', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, requestId, requestData) {
    try {
      const db = Database.get(req);
      const userId = req.session?.currentTenantUserId || req.session?.user?.id;
      if (!userId) {
        throw new AppError('User context required for update', 401, AppError.CODES.UNAUTHORIZED);
      }

      const existing = await db.query('SELECT * FROM requests WHERE id = $1', [requestId]);
      if (!existing || existing.length === 0) {
        throw new AppError('Request not found', 404, AppError.CODES.NOT_FOUND);
      }
      const current = existing[0];

      const {
        title,
        description,
        request_type,
        status,
        priority,
        team_id,
        submitter_name,
        submitter_email,
        contact_id,
        assigned_to_ids,
        internal_notes,
      } = requestData;

      const trimmedTitle = (title || current.title || '').toString().trim();
      if (!trimmedTitle) {
        throw new AppError('Request title is required', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const changeSummary = RequestModel.getChangeSummary(current, requestData);

      const result = await db.update('requests', requestId, {
        title: trimmedTitle.slice(0, 500),
        description:
          description !== undefined
            ? description
              ? description.trim().slice(0, 10000)
              : null
            : (current.description ?? null),
        request_type:
          request_type !== undefined
            ? sanitizeRequestType(request_type)
            : current.request_type || DEFAULT_REQUEST_TYPE,
        status:
          status !== undefined
            ? REQUEST_STATUSES.includes(status)
              ? status
              : 'not started'
            : current.status || 'not started',
        priority:
          priority !== undefined
            ? REQUEST_PRIORITIES.includes(priority)
              ? priority
              : 'Medium'
            : current.priority || 'Medium',
        team_id:
          team_id !== undefined
            ? team_id
              ? parseInt(team_id, 10)
              : null
            : (current.team_id ?? null),
        submitter_name:
          submitter_name !== undefined
            ? submitter_name
              ? submitter_name.trim().slice(0, 255)
              : null
            : (current.submitter_name ?? null),
        submitter_email:
          submitter_email !== undefined
            ? submitter_email
              ? submitter_email.trim().slice(0, 255)
              : null
            : (current.submitter_email ?? null),
        contact_id:
          contact_id !== undefined
            ? contact_id
              ? parseInt(contact_id, 10)
              : null
            : (current.contact_id ?? null),
        assigned_to_ids:
          assigned_to_ids !== undefined
            ? JSON.stringify(sanitizeAssignedToIds(assigned_to_ids))
            : current.assigned_to_ids,
        internal_notes:
          internal_notes !== undefined
            ? internal_notes
              ? internal_notes.trim().slice(0, 10000)
              : null
            : (current.internal_notes ?? null),
      });

      Logger.info('Request updated', { requestId });
      const request = this.transformRow(result);
      if (changeSummary) {
        request._changeSummary = changeSummary;
      }
      return request;
    } catch (error) {
      Logger.error('Failed to update request', error, { requestId });
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to update request: ${error.message || 'Unknown error'}`,
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async delete(req, requestId) {
    try {
      const db = Database.get(req);
      await db.deleteRecord('requests', requestId);
      Logger.info('Request deleted', { requestId });
      return { id: requestId };
    } catch (error) {
      Logger.error('Failed to delete request', error, { requestId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete request', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async bulkDelete(req, idsTextArray) {
    try {
      return await BulkOperationsHelper.bulkDelete(req, 'requests', idsTextArray);
    } catch (error) {
      Logger.error('Failed to bulk delete requests', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to bulk delete requests', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformRow(row) {
    return {
      id: row.id.toString(),
      title: row.title || '',
      description: row.description ?? null,
      requestType: row.request_type || 'general',
      status: row.status || 'not started',
      priority: row.priority || 'Medium',
      teamId: row.team_id != null ? Number(row.team_id) : null,
      submitterName: row.submitter_name ?? null,
      submitterEmail: row.submitter_email ?? null,
      contactId: row.contact_id != null ? row.contact_id.toString() : null,
      assignedToIds: parseJsonArray(row.assigned_to_ids),
      internalNotes: row.internal_notes ?? null,
      source: row.source || 'internal',
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

module.exports = RequestModel;
