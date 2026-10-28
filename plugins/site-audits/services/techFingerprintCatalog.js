// plugins/site-audits/services/techFingerprintCatalog.js
// Curated local technology fingerprints (etapp 1.3). No external lookup, dataset, or network.
const CATALOG_VERSION = 1;

function rule(id, name, category, match) {
  const frozenMatch = {};
  if (match.generators) frozenMatch.generators = Object.freeze(match.generators.slice());
  if (match.pathIncludes) frozenMatch.pathIncludes = Object.freeze(match.pathIncludes.slice());
  if (match.hosts) frozenMatch.hosts = Object.freeze(match.hosts.slice());
  if (match.headers) {
    frozenMatch.headers = Object.freeze(
      match.headers.map((header) =>
        Object.freeze({
          name: header.name,
          ...(header.value ? { value: header.value } : {}),
        }),
      ),
    );
  }
  return Object.freeze({
    id,
    name,
    category,
    match: Object.freeze(frozenMatch),
  });
}

// Required products come first so the 40-item cap keeps them when many rules match.
const TECH_FINGERPRINT_CATALOG = Object.freeze([
  rule('wordpress', 'WordPress', 'cms', {
    generators: [/wordpress/i],
    pathIncludes: ['/wp-content/', '/wp-includes/', '/wp-json/'],
  }),
  rule('woocommerce', 'WooCommerce', 'ecommerce', {
    generators: [/woocommerce/i],
    pathIncludes: ['/wp-content/plugins/woocommerce/', 'wc-add-to-cart'],
  }),
  rule('shopify', 'Shopify', 'ecommerce', {
    pathIncludes: ['cdn.shopify.com', '/cdn/shop/', '/cart.js'],
    hosts: ['cdn.shopify.com', 'shopifycdn.com'],
    headers: [{ name: 'x-shopid' }, { name: 'x-shopify-stage' }],
  }),
  rule('magento', 'Magento', 'ecommerce', {
    generators: [/magento/i],
    pathIncludes: ['/static/frontend/', '/skin/frontend/', 'mage/cookies.js'],
    headers: [{ name: 'x-magento-tags' }, { name: 'x-magento-vary' }],
  }),
  rule('wix', 'Wix', 'cms', {
    generators: [/wix/i],
    pathIncludes: ['wixstatic.com', 'parastorage.com'],
    hosts: ['wixstatic.com', 'parastorage.com'],
    headers: [{ name: 'x-wix-request-id' }],
  }),
  rule('squarespace', 'Squarespace', 'cms', {
    generators: [/squarespace/i],
    pathIncludes: ['squarespace.com', 'squarespace-cdn.com'],
    hosts: ['squarespace.com', 'squarespace-cdn.com', 'sqspcdn.com'],
  }),
  rule('drupal', 'Drupal', 'cms', {
    generators: [/drupal/i],
    pathIncludes: ['/sites/default/files/', '/core/misc/drupal.js'],
    headers: [{ name: 'x-drupal-cache' }, { name: 'x-generator', value: /drupal/i }],
  }),
  rule('joomla', 'Joomla', 'cms', {
    generators: [/joomla/i],
    pathIncludes: ['/media/system/js/', '/media/jui/'],
  }),
  rule('ghost', 'Ghost', 'cms', {
    generators: [/ghost/i],
    pathIncludes: ['/ghost/api/'],
    headers: [{ name: 'x-ghost-cache-status' }],
  }),
  rule('webflow', 'Webflow', 'cms', {
    generators: [/webflow/i],
    pathIncludes: ['website-files.com'],
    hosts: ['website-files.com'],
  }),
  rule('nextjs', 'Next.js', 'framework', {
    pathIncludes: ['/_next/'],
    headers: [{ name: 'x-powered-by', value: /next\.js/i }],
  }),
  rule('nuxt', 'Nuxt', 'framework', {
    generators: [/nuxt/i],
    pathIncludes: ['/_nuxt/'],
  }),
  rule('google-tag-manager', 'Google Tag Manager', 'analytics', {
    pathIncludes: ['googletagmanager.com', '/gtm.js'],
    hosts: ['googletagmanager.com'],
  }),
  rule('google-analytics', 'Google Analytics', 'analytics', {
    pathIncludes: ['google-analytics.com', '/gtag/js'],
    hosts: ['google-analytics.com', 'analytics.google.com'],
  }),
  rule('hotjar', 'Hotjar', 'analytics', {
    pathIncludes: ['static.hotjar.com', 'script.hotjar.com'],
    hosts: ['hotjar.com'],
  }),
  rule('facebook-pixel', 'Facebook Pixel', 'analytics', {
    pathIncludes: ['connect.facebook.net', 'fbevents.js'],
    hosts: ['connect.facebook.net'],
  }),
  rule('linkedin-insight', 'LinkedIn Insight', 'analytics', {
    pathIncludes: ['snap.licdn.com', 'px.ads.linkedin.com'],
    hosts: ['snap.licdn.com', 'px.ads.linkedin.com'],
  }),
  rule('tiktok-pixel', 'TikTok Pixel', 'analytics', {
    pathIncludes: ['analytics.tiktok.com'],
    hosts: ['analytics.tiktok.com'],
  }),
  rule('segment', 'Segment', 'analytics', {
    pathIncludes: ['cdn.segment.com'],
    hosts: ['segment.com', 'segment.io'],
  }),
  rule('mixpanel', 'Mixpanel', 'analytics', {
    pathIncludes: ['cdn.mxpnl.com', 'mixpanel.com'],
    hosts: ['mxpnl.com', 'mixpanel.com'],
  }),
  rule('microsoft-clarity', 'Microsoft Clarity', 'analytics', {
    pathIncludes: ['clarity.ms'],
    hosts: ['clarity.ms'],
  }),
  rule('cloudflare', 'Cloudflare', 'cdn', {
    hosts: ['challenges.cloudflare.com'],
    headers: [
      { name: 'cf-ray' },
      { name: 'cf-cache-status' },
      { name: 'server', value: /cloudflare/i },
    ],
  }),
  rule('fastly', 'Fastly', 'cdn', {
    headers: [
      { name: 'x-fastly-request-id' },
      { name: 'server', value: /fastly/i },
      { name: 'via', value: /fastly/i },
    ],
  }),
  rule('intercom', 'Intercom', 'chat', {
    pathIncludes: ['widget.intercom.io', 'js.intercomcdn.com'],
    hosts: ['intercom.io', 'intercomcdn.com'],
  }),
  rule('zendesk', 'Zendesk', 'chat', {
    pathIncludes: ['static.zdassets.com', 'ekr.zdassets.com'],
    hosts: ['zdassets.com', 'zendesk.com'],
  }),
  rule('drift', 'Drift', 'chat', {
    pathIncludes: ['js.driftt.com'],
    hosts: ['driftt.com'],
  }),
  rule('crisp', 'Crisp', 'chat', {
    pathIncludes: ['client.crisp.chat'],
    hosts: ['crisp.chat'],
  }),
  rule('hubspot', 'HubSpot', 'marketing', {
    pathIncludes: ['js.hs-scripts.com', 'js.hubspot.com'],
    hosts: ['hs-scripts.com', 'hubspot.com', 'hs-analytics.net'],
  }),
  rule('cookiebot', 'Cookiebot', 'marketing', {
    pathIncludes: ['consent.cookiebot.com', 'cookiebot.com'],
    hosts: ['cookiebot.com'],
  }),
  rule('onetrust', 'OneTrust', 'marketing', {
    pathIncludes: ['cookielaw.org', 'otSDKStub.js'],
    hosts: ['cookielaw.org', 'onetrust.com'],
  }),
  rule('klaviyo', 'Klaviyo', 'marketing', {
    pathIncludes: ['static.klaviyo.com', 'klaviyo.js'],
    hosts: ['klaviyo.com'],
  }),
  rule('mailchimp', 'Mailchimp', 'marketing', {
    pathIncludes: ['chimpstatic.com', 'list-manage.com'],
    hosts: ['chimpstatic.com', 'list-manage.com', 'mailchimp.com'],
  }),
  rule('vercel', 'Vercel', 'other', {
    headers: [
      { name: 'x-vercel-id' },
      { name: 'x-vercel-cache' },
      { name: 'server', value: /vercel/i },
    ],
  }),
  rule('netlify', 'Netlify', 'other', {
    headers: [{ name: 'x-nf-request-id' }, { name: 'server', value: /netlify/i }],
  }),
  rule('stripe', 'Stripe', 'ecommerce', {
    pathIncludes: ['js.stripe.com'],
    hosts: ['js.stripe.com'],
  }),
  rule('paypal', 'PayPal', 'ecommerce', {
    pathIncludes: ['paypalobjects.com', 'paypal.com/sdk'],
    hosts: ['paypalobjects.com', 'paypal.com'],
  }),
  rule('bigcommerce', 'BigCommerce', 'ecommerce', {
    generators: [/bigcommerce/i],
    pathIncludes: ['cdn.bigcommerce.com'],
    hosts: ['bigcommerce.com'],
  }),
  rule('prestashop', 'PrestaShop', 'ecommerce', {
    generators: [/prestashop/i],
    pathIncludes: ['/modules/ps_', 'prestashop.js'],
  }),
  rule('shopware', 'Shopware', 'ecommerce', {
    generators: [/shopware/i],
    pathIncludes: ['/shopware/'],
  }),
  rule('gatsby', 'Gatsby', 'framework', {
    pathIncludes: ['/page-data/', '/___gatsby'],
  }),
  rule('plausible', 'Plausible', 'analytics', {
    pathIncludes: ['plausible.io/js/'],
    hosts: ['plausible.io'],
  }),
  rule('matomo', 'Matomo', 'analytics', {
    pathIncludes: ['matomo.js', 'piwik.js'],
  }),
  rule('tawk', 'Tawk.to', 'chat', {
    pathIncludes: ['embed.tawk.to'],
    hosts: ['tawk.to'],
  }),
  rule('marketo', 'Marketo', 'marketing', {
    pathIncludes: ['munchkin.js'],
    hosts: ['marketo.net', 'marketo.com'],
  }),
  rule('optimizely', 'Optimizely', 'marketing', {
    pathIncludes: ['cdn.optimizely.com'],
    hosts: ['optimizely.com'],
  }),
  rule('akamai', 'Akamai', 'cdn', {
    headers: [{ name: 'x-akamai-transformed' }, { name: 'server', value: /akamaighost/i }],
  }),
  rule('cloudfront', 'CloudFront', 'cdn', {
    headers: [
      { name: 'x-amz-cf-id' },
      { name: 'x-amz-cf-pop' },
      { name: 'via', value: /cloudfront/i },
    ],
  }),
  rule('sentry', 'Sentry', 'other', {
    pathIncludes: ['browser.sentry-cdn.com', 'js.sentry-cdn.com'],
    hosts: ['sentry-cdn.com', 'sentry.io'],
  }),
  rule('new-relic', 'New Relic', 'other', {
    pathIncludes: ['js-agent.newrelic.com', 'bam.nr-data.net'],
    hosts: ['newrelic.com', 'nr-data.net'],
  }),
  rule('recaptcha', 'reCAPTCHA', 'other', {
    pathIncludes: ['google.com/recaptcha', 'recaptcha/api.js'],
  }),
  rule('jquery', 'jQuery', 'other', {
    pathIncludes: ['code.jquery.com', '/jquery.min.js', '/jquery-'],
    hosts: ['code.jquery.com'],
  }),
  rule('bootstrap', 'Bootstrap', 'framework', {
    pathIncludes: ['/bootstrap.min.js', '/bootstrap.min.css', '/bootstrap.bundle.min.js'],
    hosts: ['bootstrapcdn.com'],
  }),
]);

module.exports = {
  CATALOG_VERSION,
  TECH_FINGERPRINT_CATALOG,
};
