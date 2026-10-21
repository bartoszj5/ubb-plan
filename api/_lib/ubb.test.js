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

test('multiple teacher links receive full names without changing their destinations', async t => {
  const names = { '910001': 'Nauczyciel Pierwszy', '910002': 'Nauczyciel Drugi', '910003': 'Nauczyciel Trzeci' };
  const requests = [];
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(url);
    if (url.includes('cvsfile')) {
      return new Response('BEGIN:VEVENT\r\nDTSTART:20261021T143000Z\r\nDTEND:20261021T160000Z\r\nSUMMARY:Ja lek NP ND NT L152\r\nEND:VEVENT');
    }
    const teacherId = new URL(url).searchParams.get('id');
    if (names[teacherId]) return new Response(`<h2>Plan zajęć - ${names[teacherId]}, semestr zimowy</h2>`);
    return new Response('<div id="course_1">Ja, lek<br /><a href="plan.php?type=10&id=910001">NP</a> <a href="plan.php?type=10&id=910002">ND</a> <a href="plan.php?type=10&id=910003">NT</a><br /><a href="plan.php?type=20&id=6617">L152</a></div>');
  });
  const response = responseRecorder();
  await scheduleHandler({ query: { type: '0', id: '185657' } }, response);
  assert.equal(response.code, 200);
  const [event] = response.body;
  assert.deepEqual(event.teacherPlans, [
    { scheduleType: '10', id: '910001', name: names['910001'] },
    { scheduleType: '10', id: '910002', name: names['910002'] },
    { scheduleType: '10', id: '910003', name: names['910003'] },
  ]);
  assert.equal(event.teacher, 'NP ND NT');
  assert.deepEqual(event.roomPlans, [{ scheduleType: '20', id: '6617', name: 'L152' }]);
  assert.equal(requests.length, 5); // ICS, HTML and the three existing teacher lookups.
});

test('unavailable teacher names retain a working abbreviated link', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('type=10')) return new Response('Unavailable', { status: 503 });
    return new Response(url.includes('cvsfile')
      ? 'BEGIN:VEVENT\r\nDTSTART:20261021T143000Z\r\nSUMMARY:Ja lek Brak L152\r\nEND:VEVENT'
      : '<div id="course_1">Ja, lek<br /><a href="plan.php?type=10&id=910004">Brak</a><br /><a href="plan.php?type=20&id=6617">L152</a></div>');
  });
  const response = responseRecorder();
  await scheduleHandler({ query: { type: '0', id: '185657' } }, response);
  assert.equal(response.code, 200);
  assert.deepEqual(response.body[0].teacherPlans, [{ scheduleType: '10', id: '910004', name: 'Brak' }]);
});
