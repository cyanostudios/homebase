const fs = require('fs');
const path = require('path');

describe('FileQuickContextPanel delete + FileForm cancel wiring', () => {
  const qcSrc = fs.readFileSync(path.join(__dirname, '../FileQuickContextPanel.tsx'), 'utf8');
  const formSrc = fs.readFileSync(path.join(__dirname, '../FileForm.tsx'), 'utf8');

  test('QC delete opens ConfirmDialog then deleteFile', () => {
    expect(qcSrc).toMatch(/ConfirmDialog/);
    expect(qcSrc).toMatch(/variant="danger"/);
    expect(qcSrc).toMatch(/getDeleteMessage/);
    expect(qcSrc).toMatch(/deleteFile\(file\.id\)/);
    expect(qcSrc).toMatch(/setShowDeleteConfirm\(true\)/);
    expect(qcSrc).toMatch(/common\.delete/);
  });

  test('FileForm cancel closes panel (no openForView loop)', () => {
    expect(formSrc).toMatch(/closeFilePanel/);
    expect(formSrc).toMatch(
      /const handleCancel = useCallback\(\(\) => \{\s*[\s\S]*?closeFilePanel\(\);/,
    );
    expect(formSrc).not.toMatch(/onCancel\(\);\s*\}, \[onCancel\]/);
  });
});
