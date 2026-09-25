const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../FileView.tsx'), 'utf8');
const lightboxSrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/ui/ImageLightbox.tsx'),
  'utf8',
);

describe('FileView image preview', () => {
  test('shows a half-width preview that opens shared ImageLightbox', () => {
    expect(viewSrc).toMatch(/ImageLightbox/);
    expect(viewSrc).toMatch(/w-1\/2/);
    expect(viewSrc).toMatch(/files\.previewOpenLightbox/);
    expect(viewSrc).not.toMatch(/createPortal/);
    expect(viewSrc).not.toMatch(/setLightboxOpen/);
  });
});

describe('ImageLightbox', () => {
  test('portals dialog with Escape capture and object-contain full image', () => {
    expect(lightboxSrc).toMatch(/createPortal/);
    expect(lightboxSrc).toMatch(/role="dialog"/);
    expect(lightboxSrc).toMatch(/aria-modal="true"/);
    expect(lightboxSrc).toMatch(/event\.key !== 'Escape'/);
    expect(lightboxSrc).toMatch(/event\.stopPropagation\(\)/);
    expect(lightboxSrc).toMatch(/addEventListener\('keydown', onKeyDown, true\)/);
    expect(lightboxSrc).toMatch(/max-h-\[90vh\] max-w-\[90vw\] object-contain/);
    expect(lightboxSrc).toMatch(/cursor-zoom-in/);
    expect(lightboxSrc).toMatch(/resetKey/);
  });
});
