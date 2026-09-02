import { createSerialLatestQueue } from '../serialLatestQueue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createSerialLatestQueue', () => {
  it('runs save immediately when idle', async () => {
    const queue = createSerialLatestQueue();
    const save = jest.fn(async (payload: number) => payload * 10);
    const events: string[] = [];

    queue.enqueue({
      key: 'p1',
      payload: 2,
      save,
      onSettle: (e) => {
        events.push(`${e.kind}:${'result' in e ? e.result : ''}`);
      },
    });

    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(2);
    expect(events).toEqual(['committed:20']);
    expect(queue.isBusy('p1')).toBe(false);
  });

  it('coalesces: 3 enqueues during in-flight → exactly 2 saves (first + latest)', async () => {
    const queue = createSerialLatestQueue();
    const first = deferred<string>();
    const second = deferred<string>();
    let call = 0;
    const save = jest.fn((_payload: string) => {
      call += 1;
      return call === 1 ? first.promise : second.promise;
    });
    const settles: Array<{ kind: string; generation: number; result?: string }> = [];

    queue.enqueue({
      key: 'p1',
      payload: 'a',
      save,
      onSettle: (e) =>
        settles.push({
          kind: e.kind,
          generation: e.generation,
          result: (e as { result?: string }).result,
        }),
    });
    expect(save).toHaveBeenCalledTimes(1);

    queue.enqueue({
      key: 'p1',
      payload: 'b',
      save,
      onSettle: (e) =>
        settles.push({
          kind: e.kind,
          generation: e.generation,
          result: (e as { result?: string }).result,
        }),
    });
    queue.enqueue({
      key: 'p1',
      payload: 'c',
      save,
      onSettle: (e) =>
        settles.push({
          kind: e.kind,
          generation: e.generation,
          result: (e as { result?: string }).result,
        }),
    });
    expect(save).toHaveBeenCalledTimes(1);

    first.resolve('ok-a');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toBe('c');

    second.resolve('ok-c');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(settles.map((s) => s.kind)).toEqual(['stale', 'committed']);
    expect(settles[0].generation).toBe(1);
    expect(settles[1].generation).toBe(3);
    expect(settles[1].result).toBe('ok-c');
  });

  it('marks failed current generation as shouldRollback true', async () => {
    const queue = createSerialLatestQueue();
    const settles: Array<{ kind: string; shouldRollback?: boolean }> = [];

    queue.enqueue({
      key: 'p1',
      payload: 1,
      save: async () => {
        throw new Error('boom');
      },
      onSettle: (e) =>
        settles.push({
          kind: e.kind,
          shouldRollback: e.kind === 'failed' ? e.shouldRollback : undefined,
        }),
    });

    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(settles).toEqual([{ kind: 'failed', shouldRollback: true }]);
  });

  it('stale failure after newer enqueue → shouldRollback false', async () => {
    const queue = createSerialLatestQueue();
    const first = deferred<never>();
    const second = deferred<string>();
    let call = 0;
    const save = jest.fn(() => {
      call += 1;
      return call === 1 ? first.promise : second.promise;
    });
    const settles: Array<{ kind: string; shouldRollback?: boolean }> = [];

    const onSettle = (e: { kind: string; shouldRollback?: boolean }) =>
      settles.push({
        kind: e.kind,
        shouldRollback: e.kind === 'failed' ? e.shouldRollback : undefined,
      });

    queue.enqueue({ key: 'p1', payload: 'a', save, onSettle });
    queue.enqueue({ key: 'p1', payload: 'b', save, onSettle });

    first.reject(new Error('fail-a'));
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(settles[0]).toEqual({ kind: 'failed', shouldRollback: false });

    second.resolve('ok-b');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(settles[1].kind).toBe('committed');
  });

  it('tracks generation per key independently', async () => {
    const queue = createSerialLatestQueue();
    const a = deferred<number>();
    const b = deferred<number>();

    queue.enqueue({
      key: 'a',
      payload: 1,
      save: async () => a.promise,
      onSettle: () => {},
    });
    queue.enqueue({
      key: 'b',
      payload: 2,
      save: async () => b.promise,
      onSettle: () => {},
    });

    expect(queue.getGeneration('a')).toBe(1);
    expect(queue.getGeneration('b')).toBe(1);
    expect(queue.isBusy('a')).toBe(true);
    expect(queue.isBusy('b')).toBe(true);

    a.resolve(1);
    b.resolve(2);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(queue.isBusy('a')).toBe(false);
    expect(queue.isBusy('b')).toBe(false);
  });
});
