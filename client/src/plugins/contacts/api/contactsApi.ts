import { createApiClient } from '@/core/api/createApiClient';

class ContactsApi {
  private request = createApiClient('/contacts');

  async getContacts() {
    return this.request('');
  }

  /** Contact ids that have at least one time entry (for list badges). */
  async getContactIdsWithTimeEntries(): Promise<{ contactIds: string[] }> {
    return this.request('/with-time-entries');
  }

  async createContact(contactData: any) {
    return this.request('', {
      method: 'POST',
      body: JSON.stringify(contactData),
    });
  }

  async updateContact(id: string, contactData: any) {
    return this.request(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(contactData),
    });
  }

  async deleteContact(id: string) {
    return this.request(`/${id}`, { method: 'DELETE' });
  }
}

export const contactsApi = new ContactsApi();
