const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../InstructionForm.tsx'), 'utf8');

describe('InstructionForm instruction category catalog ownership', () => {
  test('manages instruction categories on the form, not via settings gear', () => {
    expect(formSrc).not.toMatch(/openInstructionSettings\(\{\s*tab:\s*'categories'\s*\}\)/);
    expect(formSrc).not.toMatch(/handleOpenCategorySettings/);
    expect(formSrc).toMatch(/instructionCategoriesCard/);
    expect(formSrc).toMatch(/createInstructionCategory/);
    expect(formSrc).toMatch(/deleteInstructionCategory/);
    expect(formSrc).toMatch(/reorderInstructionCategories/);
  });

  test('deletes without moveToCategory unless reassignment is confirmed', () => {
    expect(formSrc).toMatch(/await deleteInstructionCategory\(serverCat\.id\);/);
    expect(formSrc).toMatch(
      /await deleteInstructionCategory\(serverCat\.id,\s*\{\s*moveToCategory:\s*moveTo\s*\}\);/,
    );
    expect(formSrc).toMatch(/withReassignment/);
    expect(formSrc).toMatch(/apiErr\?\.status === 409/);
    expect(formSrc).toMatch(/setCategoryDeleteError/);
  });

  test('assigns instruction category from the dedicated card, not the information card', () => {
    expect(formSrc).not.toMatch(/id="instruction-category"/);
    expect(formSrc).toMatch(/assignInstructionCategory/);
    expect(formSrc).toMatch(/updateField\('category'/);
  });
});
