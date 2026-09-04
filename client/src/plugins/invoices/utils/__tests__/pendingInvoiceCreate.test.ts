import {
  clearPendingInvoiceCreate,
  hasPendingInvoiceCreate,
  peekPendingInvoiceCreate,
  requestInvoiceCreateFromContact,
  setPendingInvoiceCreate,
  subscribeInvoiceCreateRequests,
  takePendingInvoiceCreate,
} from '../pendingInvoiceCreate';

describe('pendingInvoiceCreate', () => {
  afterEach(() => {
    clearPendingInvoiceCreate();
  });

  test('starts empty and accepts null or contact prefill', () => {
    expect(hasPendingInvoiceCreate()).toBe(false);
    expect(peekPendingInvoiceCreate()).toBeUndefined();

    setPendingInvoiceCreate(null);
    expect(hasPendingInvoiceCreate()).toBe(true);
    expect(peekPendingInvoiceCreate()).toBeNull();

    setPendingInvoiceCreate({
      contactId: '42',
      contactName: 'Acme',
      paymentTerms: '30',
    });
    expect(peekPendingInvoiceCreate()).toEqual({
      contactId: '42',
      contactName: 'Acme',
      paymentTerms: '30',
    });
  });

  test('take consumes once so Strict Mode remount can still open later', () => {
    setPendingInvoiceCreate({ contactId: '7', contactName: 'Beta' });

    expect(hasPendingInvoiceCreate()).toBe(true);

    const first = takePendingInvoiceCreate();
    expect(first).toEqual({ contactId: '7', contactName: 'Beta' });
    expect(hasPendingInvoiceCreate()).toBe(false);
    expect(takePendingInvoiceCreate()).toBeUndefined();
  });

  test('clear drops pending intent', () => {
    setPendingInvoiceCreate({ contactId: '1' });
    clearPendingInvoiceCreate();
    expect(hasPendingInvoiceCreate()).toBe(false);
    expect(takePendingInvoiceCreate()).toBeUndefined();
  });

  test('requestInvoiceCreateFromContact notifies subscribers without React context', () => {
    const seen: Array<ReturnType<typeof peekPendingInvoiceCreate>> = [];
    const unsubscribe = subscribeInvoiceCreateRequests(() => {
      seen.push(peekPendingInvoiceCreate());
    });

    requestInvoiceCreateFromContact({ contactId: '9', contactName: 'Gamma' });
    expect(seen).toEqual([{ contactId: '9', contactName: 'Gamma' }]);
    unsubscribe();
  });
});
