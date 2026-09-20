const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

describe('Matches API import progress dialog', () => {
  test('progress dialog is a non-dismissible busy AlertDialog with spinner copy', () => {
    const progressSrc = fs.readFileSync(
      path.join(root, 'MatchApiImportProgressDialog.tsx'),
      'utf8',
    );
    expect(progressSrc).toMatch(/Loader2/);
    expect(progressSrc).toMatch(/animate-spin/);
    expect(progressSrc).toMatch(/matches\.importingTitle/);
    expect(progressSrc).toMatch(/matches\.importingFrom/);
    expect(progressSrc).toMatch(/matches\.importingFromFallback/);
    expect(progressSrc).toMatch(/matches\.importingHint/);
    expect(progressSrc).toMatch(/onOpenChange=\{\(\) => \{\}\}/);
    expect(progressSrc).not.toMatch(/AlertDialogAction|AlertDialogCancel|DialogCloseButton/);
  });

  test('settings import shows progress dialog while import runs', () => {
    const settingsSrc = fs.readFileSync(path.join(root, 'MatchSettingsView.tsx'), 'utf8');
    expect(settingsSrc).toMatch(/MatchApiImportProgressDialog/);
    expect(settingsSrc).toMatch(/isOpen=\{isImporting\}/);
    expect(settingsSrc).toMatch(/sourceLabel=\{importProgressLabel\}/);
  });
});
