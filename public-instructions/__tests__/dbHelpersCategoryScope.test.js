const fs = require('fs');
const path = require('path');

const helpers = fs.readFileSync(path.join(__dirname, '../api/db_helpers.php'), 'utf8');

describe('public-instructions db_helpers category scoping (QA B1)', () => {
  test('list JOIN matches categories by user_id and name', () => {
    expect(helpers).toMatch(
      /LEFT JOIN instruction_categories c\s+ON c\.user_id = i\.user_id\s+AND lower\(btrim\(c\.name\)\) = lower\(btrim\(i\.category\)\)/,
    );
  });

  test('categoryOrder SQL scopes to published owners via EXISTS user_id', () => {
    expect(helpers).toMatch(/function publicAppCategoryOrderSql/);
    expect(helpers).toMatch(/WHERE EXISTS \(/);
    expect(helpers).toMatch(/i\.user_id = c\.user_id/);
    expect(helpers).toMatch(/i\.publication_status = 'published'/);
  });
});
