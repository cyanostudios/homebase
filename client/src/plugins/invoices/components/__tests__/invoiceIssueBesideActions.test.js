const fs = require('fs');
const path = require('path');

const menusSrc = fs.readFileSync(path.join(__dirname, '../InvoiceDetailHeaderMenus.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../InvoicesView.tsx'), 'utf8');
const formSrc = fs.readFileSync(path.join(__dirname, '../InvoicesForm.tsx'), 'utf8');

describe('Invoice Issue beside Actions', () => {
  test('header shows Issue beforeActions for draft and wires status modal', () => {
    expect(menusSrc).toMatch(/beforeActions=/);
    expect(menusSrc).toMatch(/canIssue/);
    expect(menusSrc).toMatch(/invoices\.issue/);
    expect(menusSrc).toMatch(/handleStatusChange\(invoice, 'sent'\)/);
    expect(menusSrc).toMatch(/InvoiceStatusModal/);
    expect(menusSrc).toMatch(/isIssuing=/);
  });

  test('preview rows no longer show Send beside Preview', () => {
    expect(viewSrc).not.toMatch(/invoices\.send/);
    expect(formSrc).not.toMatch(/invoices\.send/);
    expect(viewSrc).toMatch(/common\.preview/);
    expect(formSrc).toMatch(/common\.preview/);
  });

  test('issue confirm modal matches Issue button (Stamp + successSoft)', () => {
    const modalSrc = fs.readFileSync(path.join(__dirname, '../InvoiceStatusModal.tsx'), 'utf8');
    expect(modalSrc).toMatch(/buttonIcon: Stamp/);
    expect(modalSrc).toMatch(/buttonVariant: 'successSoft'/);
    expect(modalSrc).toMatch(/invoices\.issue/);
  });
});
