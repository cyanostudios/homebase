import { describe, expect, it, jest } from '@jest/globals';

import { applyMobileSearchUpdate, type MobileSearchBinding } from '../MobileActionsContext';

describe('applyMobileSearchUpdate', () => {
  const onChange = jest.fn();

  function binding(value: string): MobileSearchBinding {
    return { value, onChange, placeholder: 'Search' };
  }

  it('keeps searchOpen true when value updates while panel is open', () => {
    const next = applyMobileSearchUpdate(true, binding('a'));
    expect(next.searchOpen).toBe(true);
    expect(next.search?.value).toBe('a');

    const typed = applyMobileSearchUpdate(next.searchOpen, binding('ab'));
    expect(typed.searchOpen).toBe(true);
    expect(typed.search?.value).toBe('ab');
  });

  it('closes searchOpen only when binding is cleared', () => {
    const cleared = applyMobileSearchUpdate(true, null);
    expect(cleared.searchOpen).toBe(false);
    expect(cleared.search).toBeNull();
  });

  it('does not open search when registering while closed', () => {
    const registered = applyMobileSearchUpdate(false, binding(''));
    expect(registered.searchOpen).toBe(false);
    expect(registered.search?.value).toBe('');
  });

  it('simulates open then value sync without clearing (panel stay-open)', () => {
    // User opens panel
    let open = true;
    // ListSearchInput syncs value (must not clear)
    let state = applyMobileSearchUpdate(open, binding(''));
    expect(state.searchOpen).toBe(true);
    open = state.searchOpen;
    state = applyMobileSearchUpdate(open, binding('q'));
    expect(state.searchOpen).toBe(true);
    // Only explicit clear closes
    state = applyMobileSearchUpdate(open, null);
    expect(state.searchOpen).toBe(false);
  });
});
