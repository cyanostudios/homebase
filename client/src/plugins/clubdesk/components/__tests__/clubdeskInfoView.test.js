const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskInfoView.tsx'), 'utf8');
const contactsSrc = fs.readFileSync(
  path.join(__dirname, '../ClubdeskInfoContactsPanel.tsx'),
  'utf8',
);
const swishSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskSwishProfilesPanel.tsx'), 'utf8');

describe('Clubdesk Info settings chrome', () => {
  test('page uses plugin list shell + settings categories like other plugins', () => {
    expect(viewSrc).toMatch(/PLUGIN_PAGE_LIST_SHELL_CLASS/);
    expect(viewSrc).toMatch(/overflow-y-auto/);
    expect(viewSrc).toMatch(/PluginSettingsPageShell/);
    expect(viewSrc).toMatch(/DetailSection/);
    expect(viewSrc).toMatch(/SettingsHeaderSaveButton/);
    expect(viewSrc).toMatch(/md:hidden/);
    expect(viewSrc).not.toMatch(/bg-background/);
    expect(viewSrc).not.toMatch(/px-6 py-4/);
  });

  test('keeps home, info, contacts, and swish editors with existing save APIs', () => {
    expect(viewSrc).toMatch(/getSiteContent/);
    expect(viewSrc).toMatch(/saveSiteContent/);
    expect(viewSrc).toMatch(/cardKey: 'home'/);
    expect(viewSrc).toMatch(/cardKey: 'info'/);
    expect(viewSrc).toMatch(/ClubdeskInfoContactsPanel/);
    expect(viewSrc).toMatch(/ClubdeskSwishProfilesPanel/);
    expect(viewSrc).toMatch(/RichTextEditor/);
    expect(viewSrc).toMatch(/clubdesk-home-title/);
    expect(viewSrc).toMatch(/clubdesk-info-title/);
  });

  test('contacts panel keeps search, reorder, save, and delete', () => {
    expect(contactsSrc).toMatch(/getInfoContacts/);
    expect(contactsSrc).toMatch(/createInfoContact/);
    expect(contactsSrc).toMatch(/updateInfoContact/);
    expect(contactsSrc).toMatch(/deleteInfoContact/);
    expect(contactsSrc).toMatch(/reorderInfoContacts/);
    expect(contactsSrc).toMatch(/searchContact/);
    expect(contactsSrc).toMatch(/ConfirmDialog/);
    expect(contactsSrc).toMatch(/DetailSection/);
    expect(contactsSrc).toMatch(/RoundIconLabelButton/);
    expect(contactsSrc).toMatch(/QUICK_CONTEXT_LINK_TILE_CLASS/);
    expect(contactsSrc).toMatch(/DETAIL_LIST_ITEM_TITLE_CLASS/);
    expect(contactsSrc).toMatch(/expandOnHover=\{false\}/);
    expect(contactsSrc).not.toMatch(/from '@\/components\/ui\/button'/);
  });

  test('swish panel keeps profiles, QR, download, and linked price lists', () => {
    expect(swishSrc).toMatch(/getSwishProfiles/);
    expect(swishSrc).toMatch(/getPriceLists/);
    expect(swishSrc).toMatch(/QrCode/);
    expect(swishSrc).toMatch(/generateQrDataUrl/);
    expect(swishSrc).toMatch(/ConfirmDialog/);
    expect(swishSrc).toMatch(/DetailSection/);
    expect(swishSrc).toMatch(/BADGE_CHIP_CLASS/);
    expect(swishSrc).toMatch(/RoundIconLabelButton/);
    expect(swishSrc).toMatch(/QUICK_CONTEXT_LINK_TILE_CLASS/);
    expect(swishSrc).toMatch(/DETAIL_LIST_ITEM_TITLE_CLASS/);
    expect(swishSrc).toMatch(/lg:grid-cols-\[minmax\(0,18rem\)_minmax\(0,1fr\)\]/);
    expect(swishSrc).toMatch(/clubdesk\.siteContent\.swish\.download/);
    expect(swishSrc).not.toMatch(/from '@\/components\/ui\/button'/);
    expect(swishSrc).not.toMatch(/SelectItem value="new"/);
  });
});
