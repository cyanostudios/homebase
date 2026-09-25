const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('public-clubdesk AppShell patterns', () => {
  const css = read('styles.css');
  const html = read('index.html');
  const js = read('app.js');
  const guide = read('guide.php');
  const priceList = read('price-list.php');
  const inventoryDetail = read('inventory.php');
  const router = read('router.php');
  const caddy = read('docker/Caddyfile');

  test('header uses fixed --header-h and independent --header-logo-h', () => {
    expect(css).toMatch(/--header-h:\s*3\.75rem/);
    expect(css).toMatch(/--header-logo-h:\s*2\.5rem/);
  });

  test('org brand top-bar shows logo + name from account profile', () => {
    expect(html).toMatch(/class="top-bar"/);
    expect(html).toMatch(/org-brand-header/);
    expect(html).toMatch(/org-brand-title/);
    expect(js).toMatch(/BRANDING_API_URL/);
    expect(js).toMatch(/loadOrgBranding/);
    expect(js).toMatch(/applyOrgBranding/);
    expect(js).toMatch(/\/api\/branding\.php/);
    expect(guide).toMatch(/publicAppRenderTopBar/);
    expect(priceList).toMatch(/publicAppRenderTopBar/);
    expect(read('swish.php')).toMatch(/publicAppRenderTopBar/);
    expect(read('kontakt.php')).toMatch(/publicAppRenderTopBar/);
    expect(read('api/branding.php')).toMatch(/publicAppFetchBranding/);
    const brandingHelpers = read('api/branding_helpers.php');
    expect(brandingHelpers).toMatch(/APP_HOMEBASE_API_URL/);
    expect(brandingHelpers).toMatch(/publicAppFetchBrandingFromAccountProfileDb/);
    expect(brandingHelpers).toMatch(/tenants\.organization|FROM tenants/i);
    expect(brandingHelpers).toMatch(/PUBLIC_CLUBDESK_USER_ID/);
    expect(css).toMatch(/\.brand__logo/);
    expect(css).toMatch(/\.brand__title/);
  });

  test('brand tokens map soft gray page intent', () => {
    expect(css).toMatch(/--brand:\s*hsl\(262\s+83%\s+58%\)/);
    expect(css).toMatch(/--bg-page:\s*#f9fafb/i);
  });

  test('display font uses Poppins (request-form parity)', () => {
    expect(css).toMatch(/--font-display:\s*'Poppins',\s*ui-sans-serif,\s*system-ui,\s*sans-serif/);
    expect(css).toMatch(/family=Poppins/);
    expect(css).not.toMatch(/Fraunces/);
  });

  test('listing shell is flat without grid backdrop', () => {
    expect(html).not.toMatch(/class="app-bg"/);
    expect(html).not.toMatch(/app-atmosphere/);
    expect(css).toMatch(/\.app-bg\s*\{[\s\S]*?display:\s*none/);
    expect(css).toMatch(/\.app-atmosphere__grid[\s\S]*?display:\s*none/);
  });

  test('listing tabs share home-sheet page chrome', () => {
    expect(js).toMatch(/function renderPageChrome/);
    expect(js).toMatch(/renderGuideRows[\s\S]*?renderPageChrome/);
    expect(js).toMatch(/renderPriceListListing[\s\S]*?renderPageChrome/);
    expect(js).toMatch(/renderInfoListing[\s\S]*?renderPageChrome/);
    expect(js).toMatch(/backHref:\s*'\//);
    expect(js).toMatch(/guide-back-btn/);
    expect(js).toMatch(/function bindInfoBackButton/);
    expect(js).toMatch(/bindInfoBackButton\(container\)/);
  });

  test('home uses featured square cards plus option rows', () => {
    expect(html).toMatch(/Clubdesk/);
    expect(html).not.toMatch(/id="home-hero"/);
    expect(html).not.toMatch(/id="quick-nav"/);
    expect(js).not.toMatch(/renderQuickNav/);
    expect(js).toMatch(/renderHomeHub/);
    expect(js).toMatch(/home-header/);
    expect(js).toMatch(/home-sheet/);
    expect(js).toMatch(/isFeaturedItem/);
    expect(js).toMatch(/renderHomeSquareCard/);
    expect(js).toMatch(/home-square-grid/);
    expect(js).toMatch(/renderGuideOptionCard/);
    expect(js).toMatch(/renderPriceListCard/);
    expect(js).toMatch(/renderSwishRow/);
    expect(js).toMatch(/renderInfoRow/);
    expect(js).toMatch(/href: '\/swish\/'/);
    expect(js).toMatch(/renderKontaktRow/);
    expect(js).toMatch(/href: '\/kontakt\/'/);
    expect(js).toMatch(/__PUBLIC_APP_INFO_CONTACTS__/);
    expect(js).toMatch(
      /\.\.\.\(isPublicSwishVisible\(site\) \? \[renderSwishRow\(\)\] : \[\]\),\s*\.\.\.\(isPublicContactsVisible\(site\) && infoContacts\.length > 0 \? \[renderKontaktRow\(\)\] : \[\]\),\s*\.\.\.\(isPublicInfoVisible\(site\) \? \[renderInfoRow\(\)\] : \[\]\)/,
    );
    expect(js).toMatch(/function isPublicInfoVisible/);
    expect(js).toMatch(/function isPublicContactsVisible/);
    expect(js).toMatch(/function isPublicSwishVisible/);
    expect(js).toMatch(/info\.visible !== false/);
    expect(js).toMatch(/homeTitle \|\| 'Hem'/);
    expect(js).toMatch(/site-content-html--home/);
    expect(js).toMatch(/option-card/);
    expect(js).not.toMatch(/hub-grid/);
    expect(js).not.toMatch(/data-hub=/);
    expect(css).toMatch(/\.home-header__title/);
    expect(css).toMatch(/\.home-square-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3/);
    expect(css).toMatch(/\.home-square-card\s*\{[\s\S]*?aspect-ratio:\s*1/);
    expect(css).toMatch(/\.home-sheet\s*\{/);
    expect(css).toMatch(/\.option-card\s*\{/);
  });

  test('org Swish page is reachable from Hem and renders QR shell', () => {
    const swish = read('swish.php');
    const swishApp = read('swish-page-app.js');
    expect(router).toMatch(/\/swish/);
    expect(swish).toMatch(/publicAppPrimarySwishProfileSql|data-swish-payee/);
    expect(swish).toMatch(/publicAppCardVisible/);
    expect(swish).toMatch(/Swish är dold/);
    expect(swish).toMatch(/id="org-swish"/);
    expect(swish).toMatch(/id="org-swish-qr"/);
    expect(swish).toMatch(/id="org-swish-number"/);
    expect(swish).toMatch(/swishPayload\.js/);
    expect(swish).toMatch(/qrcode\.bundle\.js/);
    expect(swish).toMatch(/swish-page-app\.js/);
    expect(swish).toMatch(/guide-back-btn/);
    expect(swish).toMatch(/class="bottom-bar"/);
    expect(swish).toMatch(/aria-label="Sidnavigering"/);
    expect(guide).toMatch(/class="bottom-bar"/);
    expect(priceList).toMatch(/class="bottom-bar"/);
    expect(swishApp).toMatch(/buildSwishTypeCPayload/);
    expect(swishApp).toMatch(/SWISH_LOCK\.AMOUNT/);
    expect(swishApp).toMatch(/amount:\s*null/);
    expect(css).toMatch(/\.org-swish\s*\{/);
    expect(js).toMatch(/kind:\s*'swish'/);
  });

  test('kontakt page is reachable from Hem when contacts exist', () => {
    const kontakt = read('kontakt.php');
    expect(router).toMatch(/\/kontakt/);
    expect(kontakt).toMatch(/publicAppInfoContactsSql|kontakt-list/);
    expect(kontakt).toMatch(/publicAppCardVisible/);
    expect(kontakt).toMatch(/Kontakt är dold/);
    expect(kontakt).toMatch(/class="bottom-bar"/);
    expect(js).toMatch(/info_contacts\.php/);
    expect(js).toMatch(/kind:\s*'kontakt'/);
    expect(css).toMatch(/\.kontakt-card\s*\{/);
  });

  test('contacts and swish visibility gates SSR, API, and sitemap', () => {
    const helpers = read('api/db_helpers.php');
    const infoContacts = read('api/info_contacts.php');
    const sitemap = read('api/sitemap.php');
    const brandingHelpers = read('api/branding_helpers.php');
    expect(helpers).toMatch(/function publicAppCardVisible/);
    expect(infoContacts).toMatch(/publicAppCardVisible\(\$pdo,\s*'contacts'\)/);
    expect(infoContacts).toMatch(/public_clubdesk_info_contacts_v2/);
    expect(sitemap).toMatch(/publicAppCardVisible\(\$pdo,\s*'info'\)/);
    expect(sitemap).toMatch(/publicAppCardVisible\(\$pdo,\s*'swish'\)/);
    expect(sitemap).not.toMatch(
      /foreach \(\['\/guides\/', '\/price-lists\/', '\/info\/', '\/swish\/'\]/,
    );
    expect(brandingHelpers).toMatch(/CURLOPT_FOLLOWLOCATION\s*=>\s*false/);
    expect(brandingHelpers).toMatch(/preg_match\('#\^https\?:\/\//);
  });

  test('bottom nav is present on listing and detail pages', () => {
    expect(html).toMatch(/class="bottom-bar"/);
    expect(guide).toMatch(/class="bottom-bar"/);
    expect(priceList).toMatch(/class="bottom-bar"/);
    expect(read('swish.php')).toMatch(/class="bottom-bar"/);
    expect(read('kontakt.php')).toMatch(/class="bottom-bar"/);
  });

  test('bottom tabs are Hem | Guides | Price list', () => {
    expect(html).toMatch(/data-tab="home"/);
    expect(html).toMatch(/data-tab="guides"/);
    expect(html).toMatch(/data-tab="price-lists"/);
    expect(html).not.toMatch(/data-tab="info"/);
    expect(html).not.toMatch(/data-tab="all"/);
    expect(html).toMatch(/>Guides</);
    expect(html).toMatch(/>Price list</);
    expect(html).not.toMatch(/bottom-bar__label">Info</);
  });

  test('guide detail uses step-swipe and /guide/ paths', () => {
    expect(guide).toMatch(/Clubdesk/);
    expect(guide).toMatch(/\/guide\//);
    expect(guide).toMatch(/step-swipe/);
    expect(guide).toMatch(/guide-header__title/);
    expect(guide).toMatch(/guide-header__text|home-header__text/);
    expect(guide).toMatch(/guide-back-btn/);
    expect(guide).toMatch(/guide-header__copy[\s\S]*?guide-back-btn/);
    expect(css).toMatch(/\.guide-header\s*\{[\s\S]*?flex-direction:\s*row/);
    expect(css).toMatch(/\.guide-back-btn\s*\{[\s\S]*?border-radius:\s*var\(--r-pill\)/);
    expect(guide).toMatch(/step-progress/);
    expect(guide).toMatch(/data-progress-seg/);
    expect(guide).not.toMatch(/step-subheader/);
    expect(guide).not.toMatch(/progress-step/);
    expect(guide).not.toMatch(/data-progress-fill/);
    expect(router).toMatch(/\/guide/);
  });

  test('price list detail renders rows by category', () => {
    expect(priceList).toMatch(/price-list-row/);
    expect(priceList).toMatch(/formatPriceAmount/);
    expect(priceList).toMatch(/\/price-list\//);
    expect(priceList).toMatch(/guide-header/);
    expect(priceList).toMatch(/guide-back-btn/);
    expect(priceList).toMatch(/home-sheet/);
    expect(priceList).toMatch(/option-card price-list-row/);
    expect(priceList).toMatch(/home-section--rows/);
    expect(priceList).toMatch(/class="step-subheader"/);
    expect(priceList).toMatch(/step-subheader__guide/);
    expect(priceList).toMatch(/step-subheader__step/);
    expect(priceList).toMatch(/step-subheader__inner--cart/);
    expect(priceList).toMatch(/step-subheader__cart-actions/);
    expect(priceList).toMatch(/data-cart-add/);
    expect(priceList).toMatch(/cart-toggle-btn/);
    expect(priceList).toMatch(/step-nav__btn/);
    expect(priceList).toMatch(/aria-label="Visa varukorg"/);
    expect(priceList).not.toMatch(/step-subheader__bar/);
    expect(priceList).toMatch(/publicAppRenderTopBar/);
    expect(priceList).toMatch(/branding_helpers\.php/);
    expect(priceList).toMatch(/id="cart-view"/);
    expect(priceList).toMatch(/id="cart-clear-btn"/);
    expect(priceList).toMatch(/aria-label="Nollställ varukorg"/);
    expect(priceList).toMatch(/Att betala/);
    expect(priceList).toMatch(/cart-pay__row/);
    expect(priceList).toMatch(/id="cart-total"/);
    expect(priceList).toMatch(/id="cart-swish"/);
    expect(priceList).toMatch(/id="cart-swish-number"/);
    expect(priceList).toMatch(/data-swish-payee/);
    expect(priceList).toMatch(/swishPayload\.js/);
    expect(priceList).toMatch(/qrcode\.bundle\.js/);
    expect(priceList).toMatch(/priceListCart\.js/);
    expect(priceList).toMatch(/price-list-cart-app\.js/);
    expect(priceList).not.toMatch(/detail-hero/);
    expect(priceList).not.toMatch(/featured_image/);
    expect(router).toMatch(/\/price-list/);
    expect(priceList).toMatch(/price-list-row__desc/);
    expect(priceList).toMatch(/option-card__title/);
    expect(css).toMatch(/\.price-list-row__desc\s*\{[\s\S]*?white-space:\s*pre-line/);
    expect(css).toMatch(/\.price-list-row__price/);
    expect(css).toMatch(/\.price-list-qty-btn/);
    expect(css).toMatch(/\.cart-total/);
    expect(css).toMatch(/\.step-subheader__cart-actions/);
    expect(css).toMatch(/\.step-subheader\s+\.cart-clear-btn/);
    expect(priceList).toMatch(/cart-clear-btn__icon/);
    expect(priceList).toMatch(/step-nav__btn--prev cart-clear-btn/);
    expect(js).toMatch(/renderPriceListCard/);
    expect(js).toMatch(/kind:\s*'price-list'/);
    expect(js).toMatch(/function renderGuideOptionCard/);
    expect(js).toMatch(/function renderPriceListCard/);
  });

  test('cart app wires clearCart in subheader mini cart', () => {
    const cartApp = read('price-list-cart-app.js');
    const cartLib = read('lib/priceListCart.js');
    expect(cartLib).toMatch(/function clearCart/);
    expect(cartLib).toMatch(/clearCart,/);
    expect(cartApp).toMatch(/cart-clear-btn/);
    expect(cartApp).toMatch(/Cart\.clearCart\(slug\)/);
    expect(cartApp).toMatch(/cartClearBtn\.hidden\s*=\s*Cart\.uniqueCount\(cart\)\s*===\s*0/);
    expect(cartApp).toMatch(/setView\('list'\)/);
    expect(cartApp).toMatch(/backBtn\.hidden\s*=\s*view\s*===\s*'cart'/);
  });

  test('list uses same-origin PHP APIs for guides and price lists', () => {
    expect(js).toMatch(/\/api\/items\.php/);
    expect(js).toMatch(/\/api\/price_lists\.php/);
    expect(js).toMatch(/\/api\/site_content\.php/);
    expect(js).toMatch(/__PUBLIC_APP_SITE_CONTENT__/);
    expect(js).toMatch(/site-content-html/);
    expect(js).not.toMatch(/\/api\/public\/clubdesk/);
    expect(js).toMatch(/\/guide\//);
    expect(js).toMatch(/\/price-list\//);
    expect(js).toMatch(/\/inventory\//);
    expect(js).toMatch(/\/api\/inventory\.php/);
  });

  test('inventory article detail SSR mirrors price-list routing', () => {
    expect(router).toMatch(/inventory\.php/);
    expect(router).toMatch(/\/inventory\/\(\[a-z0-9-\]\+\)/);
    expect(inventoryDetail).toMatch(/publicAppInventoryBySlugSql/);
    expect(inventoryDetail).toMatch(/parseInventoryPath/);
    expect(inventoryDetail).toMatch(/href="\/inventory\/"/);
    expect(caddy).toMatch(/inventory\.php/);
    expect(caddy).toMatch(/inventoryDetail/);
  });

  test('uses real listing URLs instead of hash routes', () => {
    expect(html).toMatch(/href="\/guides\/"/);
    expect(html).toMatch(/href="\/price-lists\/"/);
    expect(js).toMatch(/href: '\/info\/'/);
    expect(html).not.toMatch(/href="#guides"/);
    expect(router).toMatch(/guides|price-lists/);
    expect(router).toMatch(/kategori/);
  });

  test('guides listing groups by category title without Visa alla', () => {
    expect(js).toMatch(/groupByCategory/);
    expect(js).toMatch(/home-section__title/);
    expect(js).toMatch(/groupItems\.map\(renderGuideOptionCard\)/);
    expect(js).not.toMatch(/data-filter-more/);
  });

  test('PWA installable surface: manifest, icons, theme — no service worker', () => {
    const manifest = JSON.parse(read('manifest.webmanifest'));
    const caddy = read('docker/Caddyfile');
    const pwaHead = read('api/pwa_head.php');
    const swish = read('swish.php');
    const kontakt = read('kontakt.php');

    expect(manifest.name).toBe('Clubdesk');
    expect(manifest.short_name).toBe('Clubdesk');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#7c3bed');
    expect(manifest.background_color).toBe('#f9fafb');
    expect(
      manifest.icons.some((i) => i.src === '/icons/icon-192.png' && i.sizes === '192x192'),
    ).toBe(true);
    expect(
      manifest.icons.some((i) => i.src === '/icons/icon-512.png' && i.sizes === '512x512'),
    ).toBe(true);

    expect(fs.existsSync(path.join(root, 'icons/icon-192.png'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'icons/icon-512.png'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'icons/apple-touch-icon.png'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'icons/favicon-32.png'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'icons/favicon-48.png'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'favicon.svg'))).toBe(true);

    for (const surface of [html, guide, priceList, swish, kontakt]) {
      expect(surface).toMatch(/theme-color|#7c3bed|publicClubdeskPwaHeadTags/);
      expect(surface).not.toMatch(/serviceWorker|navigator\.serviceWorker|sw\.js/);
    }

    expect(html).toMatch(/rel="manifest"/);
    expect(html).toMatch(/manifest\.webmanifest/);
    expect(html).toMatch(/theme-color/);
    expect(html).toMatch(/apple-touch-icon/);
    expect(html).toMatch(/favicon-32\.png/);
    expect(html).toMatch(/#7c3bed/);

    for (const surface of [guide, priceList, swish, kontakt]) {
      expect(surface).toMatch(/pwa_head\.php/);
      expect(surface).toMatch(/publicClubdeskPwaHeadTags\(\)/);
    }

    expect(pwaHead).toMatch(/rel="manifest"/);
    expect(pwaHead).toMatch(/manifest\.webmanifest/);
    expect(pwaHead).toMatch(/theme-color/);
    expect(pwaHead).toMatch(/apple-touch-icon/);
    expect(pwaHead).toMatch(/favicon-32\.png/);
    expect(pwaHead).toMatch(/#7c3bed/);
    expect(pwaHead).toMatch(/publicClubdeskPwaHeadTags/);
    expect(pwaHead).not.toMatch(/serviceWorker/);
    expect(js).not.toMatch(/serviceWorker|navigator\.serviceWorker/);

    expect(caddy).toMatch(/path \/guide \/guide\/\*/);
    expect(caddy).toMatch(/path \/price-list \/price-list\/\*/);
    expect(caddy).toMatch(/path \/swish \/swish\//);
    expect(caddy).toMatch(/path \/kontakt \/kontakt\//);
    expect(caddy).not.toMatch(/\/instruction/);
    expect(caddy).toMatch(/favicon\.ico/);
    expect(caddy).toMatch(/webmanifest/);
    expect(router).toMatch(/favicon\.ico/);
  });
});
