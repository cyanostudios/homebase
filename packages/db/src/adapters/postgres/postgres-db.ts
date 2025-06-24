import type { Contact, ContactRepo } from '../../interfaces/db.types';

/**
 * Stub implementation of the ContactRepo for a Postgres database.
 */
export class PostgresContactRepo implements ContactRepo {
  async create(contact: Contact): Promise<void> {
    // Placeholder: persist the contact using a Postgres client
  }

  async findById(id: string): Promise<Contact | null> {
    // Placeholder: retrieve the contact from Postgres
    return null;
  }
}
