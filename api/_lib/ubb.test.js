import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchFromUBB } from './ubb.js';
import scheduleHandler from '../schedule/[type]/[id].js';
import searchHandler from '../search.js';

function responseRecorder() {
  return {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; },
  };
}

test('an upstream HTTP failure is an uncached 502, never an empty successful plan or search', async t => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response('Unavailable', { status: 503 }));
  for (const handler of [scheduleHandler, searchHandler]) {
    const response = responseRecorder();
    await handler({ query: { type: '0', id: '123', q: 'test' } }, response);
    assert.equal(response.code, 502);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.match(response.body.error, /UBB/);
  }
});

test('slow upstream requests are aborted and produce an uncached 504', async t => {
  t.mock.method(console, 'error', () => {});
  let requestedTimeout;
  t.mock.method(AbortSignal, 'timeout', ms => {
    requestedTimeout = ms;
    return AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'));
  });
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => { signal.throwIfAborted(); });
  const response = responseRecorder();
  await scheduleHandler({ query: { type: '0', id: '123' } }, response);
  assert.equal(requestedTimeout, 10_000);
  assert.equal(response.code, 504);
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('timeouts while reading an upstream response body are also reported as 504', async t => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    text: async () => { throw new DOMException('Body aborted', 'AbortError'); },
  }));
  const response = responseRecorder();
  await scheduleHandler({ query: { type: '0', id: '123' } }, response);
  assert.equal(response.code, 504);
});

test('transport failures return 502 and preserve POST method and form data', async t => {
  let requestOptions;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requestOptions = options;
    throw new TypeError('Connection refused');
  });
  await assert.rejects(fetchFromUBB('/search', { method: 'POST', body: 'word=test' }), { statusCode: 502 });
  assert.equal(requestOptions.method, 'POST');
  assert.equal(requestOptions.body, 'word=test');
  assert.ok(requestOptions.signal instanceof AbortSignal);
});

test('a valid empty calendar is successful and manual refresh is not cached', async t => {
  t.mock.method(globalThis, 'fetch', async url => new Response(
    url.includes('cvsfile') ? 'BEGIN:VCALENDAR\r\nEND:VCALENDAR' : '<div class="title">Grupy \\ Test</div>',
  ));
  const response = responseRecorder();
  await scheduleHandler({ query: { type: '0', id: '123', refresh: '1' } }, response);
  assert.equal(response.code, 200);
  assert.deepEqual(response.body, []);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.ok(Number(response.headers['X-UBB-Fetched-At']) > 0);
});
