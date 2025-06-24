export interface Contact {
  id: string;
  name: string;
  email: string;
  // Additional contact fields will be defined here
}

/**
 * Repository interface describing basic operations for contacts.
 */
export interface ContactRepo {
  create(contact: Contact): Promise<void>;
  findById(id: string): Promise<Contact | null>;
}
