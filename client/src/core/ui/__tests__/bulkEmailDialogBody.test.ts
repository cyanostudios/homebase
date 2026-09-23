import { resolveBodyOnDialogOpen } from '../bulkEmailDialogBody';

describe('resolveBodyOnDialogOpen', () => {
  test('applies initialBody when dialog transitions closed → open', () => {
    expect(resolveBodyOnDialogOpen(false, true, 'Hello')).toBe('Hello');
    expect(resolveBodyOnDialogOpen(false, true, '')).toBe('');
  });

  test('uses empty string when initialBody is omitted on open', () => {
    expect(resolveBodyOnDialogOpen(false, true, undefined)).toBe('');
  });

  test('does not overwrite while dialog stays open with same empty seed', () => {
    expect(resolveBodyOnDialogOpen(true, true, '', 'user typed')).toBeUndefined();
    expect(resolveBodyOnDialogOpen(true, true, 'Hello', 'user typed')).toBeUndefined();
  });

  test('fills late-arriving initialBody when body is still empty', () => {
    expect(resolveBodyOnDialogOpen(true, true, 'Hello', '')).toBe('Hello');
  });

  test('does nothing when closing or staying closed', () => {
    expect(resolveBodyOnDialogOpen(true, false, 'Hello')).toBeUndefined();
    expect(resolveBodyOnDialogOpen(false, false, 'Hello')).toBeUndefined();
  });
});
