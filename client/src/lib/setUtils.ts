/** Toggle membership of `key` in a Set, returning a new Set instance. */
export function toggleSetItem<T>(prev: ReadonlySet<T>, key: T, include: boolean): Set<T> {
  const next = new Set(prev);
  if (include) {
    next.add(key);
  } else {
    next.delete(key);
  }
  return next;
}
