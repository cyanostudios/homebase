const fs = require('fs');
const path = require('path');

const routesSrc = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');

describe('Pulse routing plugin PUT validation', () => {
  test('accepts enabled toggle without requiring providerKey', () => {
    expect(routesSrc).toMatch(/body\('enabled'\)\.optional\(\)\.isBoolean\(\)/);
    expect(routesSrc).not.toMatch(
      /plugins\/:pluginKey'[\s\S]*?\[body\('providerKey'\)\.isString\(\)\.trim\(\)\.notEmpty\(\)\]/,
    );
    expect(routesSrc).toMatch(/Provide enabled and\/or providerKey/);
  });
});
