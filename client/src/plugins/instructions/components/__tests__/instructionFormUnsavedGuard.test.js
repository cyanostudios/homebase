const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../InstructionForm.tsx'), 'utf8');

describe('InstructionForm unsaved guard for category settings (QA B2)', () => {
  test('opens category settings through attemptAction', () => {
    expect(formSrc).toMatch(
      /attemptAction\(\(\) => openInstructionSettings\(\{\s*tab:\s*'categories'\s*\}\)\)/,
    );
    expect(formSrc).toMatch(/onClick=\{handleOpenCategorySettings\}/);
    expect(formSrc).not.toMatch(
      /onClick=\{\(\) => openInstructionSettings\(\{\s*tab:\s*'categories'\s*\}\)\}/,
    );
  });
});
