const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../FileView.tsx'), 'utf8');

describe('FileView image preview', () => {
  test('shows a half-width preview that opens a lightbox', () => {
    expect(viewSrc).toMatch(/w-1\/2/);
    expect(viewSrc).toMatch(/files\.previewOpenLightbox/);
    expect(viewSrc).toMatch(/setLightboxOpen\(true\)/);
    expect(viewSrc).toMatch(/createPortal/);
    expect(viewSrc).toMatch(/role="dialog"/);
    expect(viewSrc).toMatch(/aria-modal="true"/);
    expect(viewSrc).toMatch(/event\.key !== 'Escape'/);
    expect(viewSrc).toMatch(/event\.stopPropagation\(\)/);
    expect(viewSrc).toMatch(/addEventListener\('keydown', onKeyDown, true\)/);
    expect(viewSrc).toMatch(/max-h-\[90vh\] max-w-\[90vw\] object-contain/);
  });
});
