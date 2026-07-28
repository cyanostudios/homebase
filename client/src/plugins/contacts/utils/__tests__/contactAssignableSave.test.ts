import { buildContactAssignableSavePayload } from '../contactAssignableSave';

describe('buildContactAssignableSavePayload', () => {
  it('sets isAssignable on a copy of the contact', () => {
    const contact = { id: '1', companyName: 'Acme', isAssignable: false };
    expect(buildContactAssignableSavePayload(contact, true)).toEqual({
      id: '1',
      companyName: 'Acme',
      isAssignable: true,
    });
    expect(contact.isAssignable).toBe(false);
  });
});
