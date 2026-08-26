import type { InputHTMLAttributes } from 'react';

/** Props that keep list filters from triggering browser address/contact autofill. */
export const LIST_SEARCH_FIELD_PROPS = {
  type: 'text',
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  name: 'homebase-list-filter',
  inputMode: 'search',
  role: 'searchbox',
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-form-type': 'other',
} satisfies InputHTMLAttributes<HTMLInputElement>;
