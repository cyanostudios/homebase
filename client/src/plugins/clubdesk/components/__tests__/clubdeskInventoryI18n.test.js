// client/src/plugins/clubdesk/components/__tests__/clubdeskInventoryI18n.test.js
const fs = require('fs');
const path = require('path');

const clubdeskRoot = path.join(__dirname, '../..');
const en = require('../../../../i18n/locales/en.json');
const sv = require('../../../../i18n/locales/sv.json');

function collectKeys(obj, prefix = '') {
  return Object.keys(obj).flatMap((key) => {
    const next = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return collectKeys(value, next);
    }
    return [next];
  });
}

function listSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      listSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('clubdesk inventory i18n', () => {
  test('EN and SV clubdesk.inventory key sets match', () => {
    const enKeys = collectKeys(en.clubdesk.inventory).sort();
    const svKeys = collectKeys(sv.clubdesk.inventory).sort();
    expect(svKeys).toEqual(enKeys);
  });

  test('SV inventory list strings are not leftover English or garments copy', () => {
    expect(sv.clubdesk.inventory.quickContext.emptyTitle).not.toMatch(/Select an article/i);
    expect(sv.clubdesk.inventory.searchPlaceholder).not.toMatch(/^Search /);
    expect(sv.clubdesk.inventory.add).not.toBe('Create article');
    expect(sv.clubdesk.inventory.noYet).not.toMatch(/No inventory/);
    expect(sv.clubdesk.inventory.audience).not.toBe('Linje');
    expect(sv.clubdesk.inventory.audiencePlaceholder).not.toMatch(/Dam|Herr|Barn/);
    expect(sv.clubdesk.inventory.color).not.toBe('Färg');
    expect(sv.clubdesk.inventory.sizePlaceholder).not.toMatch(/\bM\b/);
  });

  test('EN inventory variant labels are food-oriented', () => {
    expect(en.clubdesk.inventory.audience).toBe('Category');
    expect(en.clubdesk.inventory.color).toMatch(/Flavour|variety/i);
    expect(en.clubdesk.inventory.size).toMatch(/Pack size/i);
    expect(en.clubdesk.inventory.material).toBe('Packaging');
    expect(en.clubdesk.inventory.audiencePlaceholder).not.toMatch(/Women|Men|Kids/);
  });

  test('clubdesk inventory sources do not call garments.* i18n keys', () => {
    const files = listSourceFiles(clubdeskRoot).filter((file) =>
      /inventory|Inventory|InventoryList|InventoryForm|InventoryView|clubdeskInventory/i.test(file),
    );
    expect(files.length).toBeGreaterThan(0);
    const offenders = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      if (/t\(\s*['"]garments\./.test(src)) {
        offenders.push(path.relative(clubdeskRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  test('required inventory UI keys exist under clubdesk.inventory', () => {
    const required = [
      'sort',
      'sortAsc',
      'sku',
      'addVariant',
      'deleteConfirm',
      'openInventory',
      'importFailureUnexpected',
      'tabUnavailableInEdit',
      'quickContext.decreaseQuantity',
    ];
    const keys = new Set(collectKeys(en.clubdesk.inventory));
    for (const key of required) {
      expect(keys.has(key)).toBe(true);
    }
  });
});
