/** Sidebar category order and i18n keys — single source of truth. */
export const NAV_CATEGORIES = [
  { id: 'Main', i18nKey: 'main' },
  { id: 'Content', i18nKey: 'content' },
  { id: 'Sport', i18nKey: 'sport' },
  { id: 'Booking', i18nKey: 'booking' },
  { id: 'Business', i18nKey: 'business' },
  { id: 'E-commerce', i18nKey: 'ecommerce' },
  { id: 'Tools', i18nKey: 'tools' },
  { id: 'Account', i18nKey: 'account' },
] as const;

export type NavCategoryId = (typeof NAV_CATEGORIES)[number]['id'];
