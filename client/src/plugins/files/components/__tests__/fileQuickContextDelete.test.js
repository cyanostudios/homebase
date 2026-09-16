const fs = require('fs');
const path = require('path');

describe('File detail delete + FileForm cancel wiring', () => {
  const headerMenusSrc = fs.readFileSync(
    path.join(__dirname, '../FileDetailHeaderMenus.tsx'),
    'utf8',
  );
  const formSrc = fs.readFileSync(path.join(__dirname, '../FileForm.tsx'), 'utf8');

  test('detail header menus open ConfirmDialog then deleteFile', () => {
    expect(headerMenusSrc).toMatch(/ConfirmDialog/);
    expect(headerMenusSrc).toMatch(/variant="danger"/);
    expect(headerMenusSrc).toMatch(/getDeleteMessage/);
    expect(headerMenusSrc).toMatch(/deleteFile\(file\.id\)/);
    expect(headerMenusSrc).toMatch(/setShowDeleteConfirm\(true\)/);
    expect(headerMenusSrc).toMatch(/common\.delete/);
  });

  test('FileForm cancel closes panel (no openForView loop)', () => {
    expect(formSrc).toMatch(/closeFilePanel/);
    expect(formSrc).toMatch(
      /const handleCancel = useCallback\(\(\) => \{\s*[\s\S]*?closeFilePanel\(\);/,
    );
    expect(formSrc).not.toMatch(/onCancel\(\);\s*\}, \[onCancel\]/);
  });
});
