// plugins/files/__tests__/allowedMime.test.js
const { ALLOWED_UPLOAD_MIME } = require('../allowedMime');

describe('ALLOWED_UPLOAD_MIME', () => {
  test('allows common document and image types', () => {
    expect(ALLOWED_UPLOAD_MIME.has('image/png')).toBe(true);
    expect(ALLOWED_UPLOAD_MIME.has('application/pdf')).toBe(true);
  });

  test('rejects executable types', () => {
    expect(ALLOWED_UPLOAD_MIME.has('application/x-msdownload')).toBe(false);
    expect(ALLOWED_UPLOAD_MIME.has('application/javascript')).toBe(false);
  });
});
