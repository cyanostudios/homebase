// plugins/site-audits/services/__tests__/safeFetch.test.js
// http/https/dns are mocked so these tests never touch the real network. We emulate Node's
// request/response event-emitter shape to exercise safeFetch's SSRF protections.
jest.mock('http');
jest.mock('https');
jest.mock('dns');

const http = require('http');
const dns = require('dns');
const { EventEmitter } = require('events');
const { safeFetch, TIMEOUT_MS } = require('../safeFetch');

function fakeRes({ statusCode = 200, headers = {}, body = '' }) {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  res.headers = headers;
  res.destroy = jest.fn(() => {
    setImmediate(() => res.emit('close'));
  });
  setImmediate(() => {
    if (body) res.emit('data', Buffer.from(body));
    res.emit('end');
  });
  return res;
}

function fakeReq() {
  const req = new EventEmitter();
  req.end = jest.fn();
  req.destroy = jest.fn();
  req.setTimeout = jest.fn();
  return req;
}

describe('safeFetch SSRF protections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('refuses to connect when the custom DNS lookup resolves only to a private IP', async () => {
    dns.lookup.mockImplementation((hostname, options, callback) => {
      callback(null, [{ address: '10.1.2.3', family: 4 }]);
    });

    http.request.mockImplementation((options) => {
      const req = fakeReq();
      // Emulate what Node's http client does internally: call the custom `lookup` before
      // ever opening a socket. Our safeLookup should refuse and the request should error out.
      setImmediate(() => {
        options.lookup(options.hostname, { all: true }, (err) => {
          if (err) req.emit('error', err);
        });
      });
      return req;
    });

    const result = await safeFetch('http://sneaky.example.com/');

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBeNull();
    expect(result.error).toMatch(/private|blocked/i);
  });

  test('blocks a redirect hop whose Location header points at a private/localhost URL', async () => {
    http.request.mockImplementationOnce((options, callback) => {
      const req = fakeReq();
      setImmediate(() =>
        callback(fakeRes({ statusCode: 302, headers: { location: 'http://127.0.0.1/admin' } })),
      );
      return req;
    });

    const result = await safeFetch('http://example.com/');

    expect(result.redirects).toHaveLength(1);
    expect(result.redirects[0]).toMatchObject({ to: 'http://127.0.0.1/admin', statusCode: 302 });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not allowed|private|blocked/i);
    // The second hop must never reach http.request.
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  test('follows a redirect to a public URL and returns the final response', async () => {
    http.request.mockImplementationOnce((options, callback) => {
      const req = fakeReq();
      setImmediate(() =>
        callback(fakeRes({ statusCode: 301, headers: { location: 'https://example.com/final' } })),
      );
      return req;
    });

    // The redirect target is https:// so the second hop goes through the https transport.
    const https = require('https');
    https.request.mockImplementationOnce((options, callback) => {
      const req = fakeReq();
      setImmediate(() =>
        callback(
          fakeRes({
            statusCode: 200,
            headers: { 'content-type': 'text/html' },
            body: '<html><title>ok</title></html>',
          }),
        ),
      );
      return req;
    });

    const result = await safeFetch('http://example.com/start');

    expect(result.ok).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.finalUrl).toBe('https://example.com/final');
    expect(result.redirects).toHaveLength(1);
    expect(result.body).toContain('<title>ok</title>');
  });

  test('returns an ok result with the response body for a plain 200', async () => {
    http.request.mockImplementationOnce((options, callback) => {
      const req = fakeReq();
      setImmediate(() =>
        callback(
          fakeRes({
            statusCode: 200,
            headers: { 'content-type': 'text/html' },
            body: '<html><body>hi</body></html>',
          }),
        ),
      );
      return req;
    });

    const result = await safeFetch('http://example.com/');

    expect(result.ok).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('<html><body>hi</body></html>');
    expect(result.redirects).toEqual([]);
  });

  test('rejects a start URL that is already a blocked/private host without any request', async () => {
    const result = await safeFetch('http://127.0.0.1/');
    expect(result.ok).toBe(false);
    expect(http.request).not.toHaveBeenCalled();
  });

  test('rejects an IPv4-mapped IPv6 loopback literal without connecting', async () => {
    const result = await safeFetch('http://[::ffff:127.0.0.1]/admin');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not allowed|private|reserved/i);
    expect(http.request).not.toHaveBeenCalled();
  });

  test('blocks a redirect hop that targets an IPv4-mapped private address', async () => {
    http.request.mockImplementationOnce((_options, callback) => {
      const req = fakeReq();
      setImmediate(() =>
        callback(
          fakeRes({ statusCode: 302, headers: { location: 'http://[::ffff:7f00:1]/latest' } }),
        ),
      );
      return req;
    });

    const result = await safeFetch('http://example.com/');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not allowed|private|reserved/i);
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  test('blocks a redirect whose hostname resolves only to a private address', async () => {
    dns.lookup.mockImplementation((hostname, options, callback) => {
      callback(null, [{ address: '192.168.1.20', family: 4 }]);
    });

    let calls = 0;
    http.request.mockImplementation((options, callback) => {
      calls += 1;
      const req = fakeReq();
      if (calls === 1) {
        setImmediate(() =>
          callback(
            fakeRes({ statusCode: 302, headers: { location: 'http://internal.example/secret' } }),
          ),
        );
        return req;
      }
      setImmediate(() => {
        options.lookup(options.hostname, { all: true }, (err) => {
          if (err) req.emit('error', err);
        });
      });
      return req;
    });

    const result = await safeFetch('http://example.com/');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/private|blocked/i);
    expect(http.request).toHaveBeenCalledTimes(2);
    expect(result.redirects[0]).toMatchObject({ to: 'http://internal.example/secret' });
  });

  test('stops after five redirects instead of treating a further redirect as success', async () => {
    const https = require('https');
    let n = 0;
    https.request.mockImplementation((_options, callback) => {
      n += 1;
      const req = fakeReq();
      setImmediate(() =>
        callback(fakeRes({ statusCode: 302, headers: { location: `https://example.com/r${n}` } })),
      );
      return req;
    });

    const result = await safeFetch('https://example.com/start');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/too many redirects/i);
    expect(https.request).toHaveBeenCalledTimes(6);
  });

  test('aborts a slow-drip response at the 15s wall-clock deadline', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
    try {
      let req;
      http.request.mockImplementation((_options, callback) => {
        req = fakeReq();
        req.destroy = jest.fn((err) => {
          req.emit('error', err || new Error('Request timed out'));
        });
        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = { 'content-type': 'text/html' };
        res.destroy = jest.fn();
        setImmediate(() => {
          callback(res);
          // One byte, then silence. An idle socket timer would wait for the next gap;
          // the wall-clock deadline must still fire.
          res.emit('data', Buffer.from('<'));
        });
        return req;
      });

      const pending = safeFetch('http://example.com/drip');
      await new Promise((resolve) => setImmediate(resolve));

      expect(req.destroy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(TIMEOUT_MS);
      const result = await pending;

      expect(TIMEOUT_MS).toBe(15000);
      expect(req.destroy).toHaveBeenCalled();
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/timed out/i);
    } finally {
      jest.useRealTimers();
    }
  });
});
