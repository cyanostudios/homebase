import { i18n } from '@lingui/core';

export const setupI18n = () => {
  i18n.load('en', {});
  i18n.activate('en');
  return i18n;
};

export const i18nInstance = setupI18n();
