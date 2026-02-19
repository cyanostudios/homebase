// server/core/lists/listsModel.js
// Shared CRUD for list definitions (used by products and files plugins)

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../errors/AppError');

const TABLE = 'lists';

function getUserId(req) {
  const userId = req.session?.user?.id;
  if (!userId) {
    throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
  }
  return userId;
}

/**
 * Get all lists for the current user in a namespace.
 * @param {object} req - Express request (session, tenant)
 * @param {string} namespace - e.g. 'products' or 'files'
 * @returns {Promise<Array<{ id: string, name: string, namespace: string, createdAt: string, updatedAt: string }>>}
 */
async function getLists(req, namespace) {
  try {
    const db = Database.get(req);
    const userId = getUserId(req);
    const ns = String(namespace || '').trim();
    if (!ns) {
      throw new AppError('Namespace is required', 400, AppError.CODES.VALIDATION_ERROR);
    }
    const rows = await db.query(
      `SELECT id, user_id, namespace, name, created_at, updated_at
       FROM ${TABLE}
       WHERE user_id = $1 AND namespace = $2
       ORDER BY name ASC`,
      [userId, ns]
    );
    return (rows || []).map((r) => ({
      id: String(r.id),
      name: r.name ?? '',
      namespace: r.namespace ?? ns,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch (error) {
    if (error instanceof AppError) throw error;
    Logger.error('listsModel.getLists failed', error);
    throw new AppError('Failed to fetch lists', 500, AppError.CODES.DATABASE_ERROR);
  }
}

/**
 * Create a new list.
 * @param {object} req
 * @param {string} namespace
 * @param {string} name
 * @returns {Promise<{ id: string, name: string, namespace: string, createdAt: string, updatedAt: string }>}
 */
async function createList(req, namespace, name) {
  try {
    const db = Database.get(req);
    const userId = getUserId(req);
    const ns = String(namespace || '').trim();
    const listName = String(name ?? '').trim();
    if (!ns) throw new AppError('Namespace is required', 400, AppError.CODES.VALIDATION_ERROR);
    if (!listName) throw new AppError('List name is required', 400, AppError.CODES.VALIDATION_ERROR);

    // Do not pass user_id: PostgreSQLAdapter.insert() appends it from context
    const result = await db.insert(TABLE, {
      namespace: ns,
      name: listName,
    });
    return {
      id: String(result.id),
      name: result.name ?? listName,
      namespace: result.namespace ?? ns,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const code = error?.details?.code ?? error?.code;
    if (code === '23505') {
      throw new AppError('A list with this name already exists', 409, AppError.CODES.CONFLICT);
    }
    Logger.error('listsModel.createList failed', error);
    throw new AppError('Failed to create list', 500, AppError.CODES.DATABASE_ERROR);
  }
}

/**
 * Rename a list. Verifies ownership and namespace.
 */
async function renameList(req, namespace, listId, name) {
  try {
    const db = Database.get(req);
    const userId = getUserId(req);
    const ns = String(namespace || '').trim();
    const id = String(listId || '').trim();
    const listName = String(name ?? '').trim();
    if (!ns || !id) throw new AppError('Namespace and list id are required', 400, AppError.CODES.VALIDATION_ERROR);
    if (!listName) throw new AppError('List name is required', 400, AppError.CODES.VALIDATION_ERROR);

    const result = await db.query(
      `UPDATE ${TABLE}
       SET name = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3 AND namespace = $4
       RETURNING id, name, namespace, created_at, updated_at`,
      [listName, id, userId, ns]
    );
    if (!result || result.length === 0) {
      throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
    }
    const r = result[0];
    return {
      id: String(r.id),
      name: r.name ?? listName,
      namespace: r.namespace ?? ns,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    Logger.error('listsModel.renameList failed', error);
    throw new AppError('Failed to rename list', 500, AppError.CODES.DATABASE_ERROR);
  }
}

/**
 * Delete a list. Verifies ownership and namespace.
 */
async function deleteList(req, namespace, listId) {
  try {
    const db = Database.get(req);
    const userId = getUserId(req);
    const ns = String(namespace || '').trim();
    const id = String(listId || '').trim();
    if (!ns || !id) throw new AppError('Namespace and list id are required', 400, AppError.CODES.VALIDATION_ERROR);

    const result = await db.query(
      `DELETE FROM ${TABLE}
       WHERE id = $1 AND user_id = $2 AND namespace = $3
       RETURNING id`,
      [id, userId, ns]
    );
    if (!result || result.length === 0) {
      throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
    }
    return { id: String(result[0].id) };
  } catch (error) {
    if (error instanceof AppError) throw error;
    Logger.error('listsModel.deleteList failed', error);
    throw new AppError('Failed to delete list', 500, AppError.CODES.DATABASE_ERROR);
  }
}

/**
 * Get a single list by id (for ownership/namespace checks). Returns null if not found.
 */
async function getListById(req, namespace, listId) {
  try {
    const db = Database.get(req);
    const userId = getUserId(req);
    const ns = String(namespace || '').trim();
    const id = String(listId || '').trim();
    if (!ns || !id) return null;
    const rows = await db.query(
      `SELECT id, name, namespace, created_at, updated_at
       FROM ${TABLE}
       WHERE id = $1 AND user_id = $2 AND namespace = $3
       LIMIT 1`,
      [id, userId, ns]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: String(r.id),
      name: r.name ?? '',
      namespace: r.namespace ?? ns,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    Logger.error('listsModel.getListById failed', error);
    throw new AppError('Failed to get list', 500, AppError.CODES.DATABASE_ERROR);
  }
}

const FILE_LIST_ITEMS_TABLE = 'file_list_items';
const CONTACT_LIST_ITEMS_TABLE = 'contact_list_items';

/**
 * Get file ids in a list (files namespace). Returns [] if list not found or not in files namespace.
 */
async function getFileListItems(req, listId) {
  try {
    const list = await getListById(req, 'files', listId);
    if (!list) return [];
    const db = Database.get(req);
    const userId = getUserId(req);
    const rows = await db.query(
      `SELECT file_id FROM ${FILE_LIST_ITEMS_TABLE}
       WHERE list_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
      [listId, userId]
    );
    return (rows || []).map((r) => String(r.file_id));
  } catch (error) {
    if (error instanceof AppError) throw error;
    Logger.error('listsModel.getFileListItems failed', error);
    throw new AppError('Failed to fetch list items', 500, AppError.CODES.DATABASE_ERROR);
  }
}

/**
 * Get contact ids in a list (contacts namespace). Returns [] if list not found or not in contacts namespace.
 */
async function getContactListItems(req, listId) {
  try {
    const list = await getListById(req, 'contacts', listId);
    if (!list) return [];
    const db = Database.get(req);
    const userId = getUserId(req);
    const rows = await db.query(
      `SELECT contact_id FROM ${CONTACT_LIST_ITEMS_TABLE}
       WHERE list_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
      [listId, userId]
    );
    return (rows || []).map((r) => String(r.contact_id));
  } catch (error) {
    if (error instanceof AppError) throw error;
    Logger.error('listsModel.getContactListItems failed', error);
    throw new AppError('Failed to fetch contact list items', 500, AppError.CODES.DATABASE_ERROR);
  }
}

/**
 * Add contacts to a list (contacts namespace).
 */
async function addContactsToList(req, namespace, listId, contactIds) {
  try {
    const list = await getListById(req, namespace, listId);
    if (!list) throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
    if (namespace !== 'contacts') throw new AppError('Namespace must be contacts', 400, AppError.CODES.VALIDATION_ERROR);

    const db = Database.get(req);
    const userId = getUserId(req);
    const ids = Array.isArray(contactIds) ? contactIds : [contactIds];
    let added = 0;
    for (const contactId of ids) {
      if (!contactId) continue;
      try {
        await db.insert(CONTACT_LIST_ITEMS_TABLE, {
          list_id: parseInt(listId, 10),
          contact_id: parseInt(String(contactId), 10),
        });
        added += 1;
      } catch (e) {
        const pgCode = e?.details?.errorCode ?? e?.code;
        if (pgCode === '23505') continue; // duplicate key – contact already in list
        throw e;
      }
    }
    return { added };
  } catch (error) {
    if (error instanceof AppError) throw error;
    Logger.error('listsModel.addContactsToList failed', error);
    throw new AppError('Failed to add contacts to list', 500, AppError.CODES.DATABASE_ERROR);
  }
}

/**
 * Remove a contact from a list (contacts namespace).
 */
async function removeContactFromList(req, namespace, listId, contactId) {
  try {
    const list = await getListById(req, namespace, listId);
    if (!list) throw new AppError('List not found', 404, AppError.CODES.NOT_FOUND);
    if (namespace !== 'contacts') throw new AppError('Namespace must be contacts', 400, AppError.CODES.VALIDATION_ERROR);

    const db = Database.get(req);
    const userId = getUserId(req);
    const result = await db.query(
      `DELETE FROM ${CONTACT_LIST_ITEMS_TABLE}
       WHERE list_id = $1 AND contact_id = $2 AND user_id = $3
       RETURNING contact_id`,
      [listId, contactId, userId]
    );
    return { removed: result && result.length > 0 };
  } catch (error) {
    if (error instanceof AppError) throw error;
    Logger.error('listsModel.removeContactFromList failed', error);
    throw new AppError('Failed to remove contact from list', 500, AppError.CODES.DATABASE_ERROR);
  }
}

module.exports = {
  getLists,
  createList,
  renameList,
  deleteList,
  getListById,
  getFileListItems,
  getContactListItems,
  addContactsToList,
  removeContactFromList,
  getUserId,
};
