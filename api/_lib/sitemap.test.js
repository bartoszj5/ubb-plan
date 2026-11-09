import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSitemap } from './sitemap.js';

test('sitemap lists the home page and each group plan once', () => {
  const xml = buildSitemap([
    { id: '1', type: 'faculty', scheduleType: null },
    { id: '8208', type: 'schedule', scheduleType: '2' },
    { id: '8208', type: 'schedule', scheduleType: '2' },
    { id: '77', type: 'schedule', scheduleType: '0' },
    { id: 'x"><', type: 'schedule', scheduleType: '0' },
  ]);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.equal(xml.match(/<loc>/g).length, 3);
  assert.ok(xml.includes('<loc>https://ubbplan.vercel.app/</loc>'));
  assert.ok(xml.includes('<loc>https://ubbplan.vercel.app/plan/2/8208</loc>'));
  assert.ok(xml.includes('<loc>https://ubbplan.vercel.app/plan/0/77</loc>'));
});

test('sitemap falls back to the home page alone', () => {
  assert.equal(buildSitemap([]).match(/<loc>/g).length, 1);
});
