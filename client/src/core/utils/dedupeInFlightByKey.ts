const inFlight = new Map<string, Promise<unknown>>();

/**
 * Shares one in-flight promise per key until it settles (e.g. React Strict Mode
 * double-mounting useEffect). Prevents duplicate side effects such as public-share view counts.
 */
export function dedupeInFlightByKey<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing !== undefined) {
    return existing as Promise<T>;
  }
  const created = factory().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, created);
  return created as Promise<T>;
}
