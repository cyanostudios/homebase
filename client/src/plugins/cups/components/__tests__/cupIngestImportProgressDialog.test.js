const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

describe('Cups ingest import progress dialog', () => {
  test('progress dialog is a non-dismissible busy AlertDialog with spinner copy', () => {
    const progressSrc = fs.readFileSync(
      path.join(root, 'CupIngestImportProgressDialog.tsx'),
      'utf8',
    );
    expect(progressSrc).toMatch(/Loader2/);
    expect(progressSrc).toMatch(/animate-spin/);
    expect(progressSrc).toMatch(/cups\.importingTitle/);
    expect(progressSrc).toMatch(/cups\.importingFrom/);
    expect(progressSrc).toMatch(/cups\.importingFromProgress/);
    expect(progressSrc).toMatch(/onOpenChange=\{\(\) => \{\}\}/);
    expect(progressSrc).not.toMatch(/AlertDialogAction|AlertDialogCancel|DialogCloseButton/);
  });

  test('list closes pick dialog and shows progress while import runs', () => {
    const listSrc = fs.readFileSync(path.join(root, 'CupsList.tsx'), 'utf8');
    const pickSrc = fs.readFileSync(path.join(root, 'CupIngestPickSourceDialog.tsx'), 'utf8');
    expect(listSrc).toMatch(/CupIngestImportProgressDialog/);
    expect(listSrc).toMatch(/isOpen=\{importRunning\}/);
    expect(listSrc).toMatch(/sourceLabel=\{importProgressLabel\}/);
    expect(listSrc).toMatch(/setPickImportOpen\(false\)/);
    expect(listSrc).toMatch(/setImportProgressLabel\(sourceLabel\)/);
    expect(pickSrc).toMatch(/onConfirm\(selectedId, label\)/);
  });

  test('settings bulk import shows progress with current/total', () => {
    const settingsSrc = fs.readFileSync(path.join(root, 'CupsSettingsView.tsx'), 'utf8');
    expect(settingsSrc).toMatch(/CupIngestImportProgressDialog/);
    expect(settingsSrc).toMatch(/isOpen=\{isImporting\}/);
    expect(settingsSrc).toMatch(/current=\{importProgress\?\.current\}/);
    expect(settingsSrc).toMatch(/total=\{importProgress\?\.total\}/);
    expect(settingsSrc).toMatch(/setImportProgress\(/);
  });
});
