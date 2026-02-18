import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import sv from './locales/sv.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en as Record<string, unknown> },
    sv: { translation: sv as Record<string, unknown> },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
