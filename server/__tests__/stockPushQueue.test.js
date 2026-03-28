const stockPushQueue = require('../../plugins/products/stockPushQueue');

describe('stockPushQueue', () => {
  it('runs all batch tasks before order tasks', async () => {
    const order = [];
    const jobs = [
      stockPushQueue.enqueueBatch('t1', async () => {
        order.push('b1');
      }),
      stockPushQueue.enqueueOrder('t1', async () => {
        order.push('o1');
      }),
      stockPushQueue.enqueueBatch('t1', async () => {
        order.push('b2');
      }),
      stockPushQueue.enqueueOrder('t1', async () => {
        order.push('o2');
      }),
    ];
    await Promise.all(jobs);
    expect(order).toEqual(['b1', 'b2', 'o1', 'o2']);
  });
});
