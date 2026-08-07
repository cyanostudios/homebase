const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskForm.tsx'), 'utf8');

describe('ClubdeskForm guide category catalog ownership', () => {
  test('manages guide categories on the form, not via settings gear', () => {
    expect(formSrc).not.toMatch(/openClubdeskSettings\(\{\s*tab:\s*'categories'\s*\}\)/);
    expect(formSrc).not.toMatch(/handleOpenCategorySettings/);
    expect(formSrc).toMatch(/guideCategoriesCard/);
    expect(formSrc).toMatch(/createClubdeskCategory/);
    expect(formSrc).toMatch(/deleteClubdeskCategory/);
    expect(formSrc).toMatch(/reorderClubdeskCategories/);
  });

  test('deletes without moveToCategory unless reassignment is confirmed', () => {
    expect(formSrc).toMatch(/await deleteClubdeskCategory\(serverCat\.id\);/);
    expect(formSrc).toMatch(
      /await deleteClubdeskCategory\(serverCat\.id,\s*\{\s*moveToCategory:\s*moveTo\s*\}\);/,
    );
    expect(formSrc).toMatch(/withReassignment/);
    expect(formSrc).toMatch(/apiErr\?\.status === 409/);
    expect(formSrc).toMatch(/setCategoryDeleteError/);
  });

  test('assigns guide category from the dedicated card, not the information card', () => {
    expect(formSrc).not.toMatch(/id="clubdesk-category"/);
    expect(formSrc).toMatch(/assignGuideCategory/);
    expect(formSrc).toMatch(/updateField\('category'/);
  });
});
