export type SerialLatestSettle<TResult> =
  | { kind: 'committed'; key: string; generation: number; result: TResult }
  | { kind: 'stale'; key: string; generation: number; result?: TResult }
  | {
      kind: 'failed';
      key: string;
      generation: number;
      error: unknown;
      /** true iff this generation is still the latest for key (no newer enqueue). */
      shouldRollback: boolean;
    };

type KeyState<TPayload> = {
  generation: number;
  inFlight: boolean;
  pending: TPayload | undefined;
};

export type SerialLatestQueue = {
  /**
   * Bump generation for `key`, replace pending payload with `payload`.
   * If idle, start save immediately; if in-flight, only update pending.
   * After in-flight settles: if pending exists, save pending with its generation
   * (payload is whatever was last enqueued — latest-wins).
   */
  enqueue<TPayload, TResult>(args: {
    key: string;
    payload: TPayload;
    save: (payload: TPayload) => Promise<TResult>;
    onSettle: (event: SerialLatestSettle<TResult>) => void;
  }): void;

  getGeneration(key: string): number;
  isBusy(key: string): boolean;
  /** Test/lifecycle helper: drop all keys (e.g. unmount). */
  clear(): void;
};

/**
 * Per-key serial save queue with latest-wins coalescing and generation tokens.
 * Pure (no React). At most one in-flight `save` per key; further enqueues replace pending.
 */
export function createSerialLatestQueue(): SerialLatestQueue {
  const states = new Map<string, KeyState<unknown>>();

  const getOrCreate = (key: string): KeyState<unknown> => {
    let state = states.get(key);
    if (!state) {
      state = { generation: 0, inFlight: false, pending: undefined };
      states.set(key, state);
    }
    return state;
  };

  const runNext = <TPayload, TResult>(args: {
    key: string;
    save: (payload: TPayload) => Promise<TResult>;
    onSettle: (event: SerialLatestSettle<TResult>) => void;
  }) => {
    const state = getOrCreate(args.key);
    if (state.inFlight || state.pending === undefined) {
      return;
    }

    const payload = state.pending as TPayload;
    const generation = state.generation;
    state.pending = undefined;
    state.inFlight = true;

    void (async () => {
      try {
        const result = await args.save(payload);
        const current = getOrCreate(args.key);
        const isCurrent = current.generation === generation;
        if (isCurrent) {
          args.onSettle({
            kind: 'committed',
            key: args.key,
            generation,
            result,
          });
        } else {
          args.onSettle({
            kind: 'stale',
            key: args.key,
            generation,
            result,
          });
        }
      } catch (error) {
        const current = getOrCreate(args.key);
        const isCurrent = current.generation === generation;
        args.onSettle({
          kind: 'failed',
          key: args.key,
          generation,
          error,
          shouldRollback: isCurrent,
        });
      } finally {
        const current = getOrCreate(args.key);
        current.inFlight = false;
        if (current.pending !== undefined) {
          runNext(args);
        }
      }
    })();
  };

  return {
    enqueue<TPayload, TResult>({
      key,
      payload,
      save,
      onSettle,
    }: {
      key: string;
      payload: TPayload;
      save: (payload: TPayload) => Promise<TResult>;
      onSettle: (event: SerialLatestSettle<TResult>) => void;
    }) {
      const state = getOrCreate(key);
      state.generation += 1;
      state.pending = payload;
      runNext({ key, save, onSettle });
    },

    getGeneration(key: string) {
      return states.get(key)?.generation ?? 0;
    },

    isBusy(key: string) {
      const state = states.get(key);
      if (!state) {
        return false;
      }
      return state.inFlight || state.pending !== undefined;
    },

    clear() {
      states.clear();
    },
  };
}
