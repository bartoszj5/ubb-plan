import test from 'node:test';
import assert from 'node:assert/strict';
import { agendaGaps, positionEvents, isRemoteEvent, eventPlace, getWeekStart, getUBBWeekNumber, addDays, dateKey } from '../src/utils/schedule.ts';
import { getPlanPresentation } from '../src/utils/plans.ts';
import type { ScheduleEvent } from '../src/types/index.ts';

function event(start: string, end: string, subject: string, kind?: 'notice'): ScheduleEvent {
  return { start: `2026-10-28T${start}:00`, end: `2026-10-28T${end}:00`, subject, type: 'lab', room: 'B312', teacher: '', summary: subject, kind };
}

test('agenda uses occupied intervals for breaks and excludes information-only notices', () => {
  const a = event('09:00', '11:00', 'A'), b = event('09:30', '10:00', 'B');
  const notice = event('11:00', '12:00', 'Zmiana', 'notice');
  const c = event('11:15', '12:00', 'C'), d = event('12:00', '13:00', 'D');
  const gaps = agendaGaps([d, notice, b, c, a]);
  assert.equal(gaps.get(c), 15);
  assert.equal(gaps.has(b), false);
  assert.equal(gaps.has(notice), false);
  assert.equal(gaps.has(d), false);
});

test('grid gives overlapping lessons separate lanes and lets later clusters use full width', () => {
  const a = event('09:00', '11:00', 'A'), b = event('09:30', '10:00', 'B');
  const c = event('10:00', '10:30', 'C'), d = event('11:00', '12:00', 'D');
  const positioned = positionEvents([d, c, a, b]);
  assert.equal(positioned.find(p => p.event === a)?.columns, 2);
  assert.notEqual(positioned.find(p => p.event === a)?.column, positioned.find(p => p.event === b)?.column);
  assert.equal(positioned.find(p => p.event === b)?.column, positioned.find(p => p.event === c)?.column);
  assert.equal(positioned.find(p => p.event === d)?.columns, 1);
});

test('missing room is not automatically called remote, explicit remote location is recognized', () => {
  const lesson = { ...event('09:00', '11:00', 'A'), room: '' };
  assert.equal(isRemoteEvent(lesson), false);
  assert.equal(eventPlace(lesson), 'Sala niepodana');
  assert.equal(eventPlace({ ...lesson, room: 'nauczanie zdalne' }), 'Zdalnie');
  assert.equal(eventPlace({ ...lesson, groupPlans: [{ id: '1', name: 'Inf/S/1', scheduleType: '0' }] }, '20'), 'Inf/S/1');
});

test('readable plan labels use verified path information and preserve unknown codes', () => {
  assert.deepEqual(getPlanPresentation('Inf/S/IIst/2sem/2gr', ['Wydział Budowy Maszyn i Informatyki', 'Stacjonarne', 'Informatyka S'], '0'), {
    title: 'Informatyka · grupa 2', subtitle: 'II stopień · semestr 2 · stacjonarne', code: 'Inf/S/IIst/2sem/2gr',
  });
  assert.equal(getPlanPresentation('XYZ/S/IIst/2sem/2gr', [], '0').title, 'XYZ/S/IIst/2sem/2gr');
  assert.equal(getPlanPresentation('B312', [], '20').title, 'Sala B312');
  assert.equal(getPlanPresentation('dr Jan Kowalski', [], '10').title, 'dr Jan Kowalski');
});

test('week navigation stays on calendar Mondays across DST and year boundaries', () => {
  const start = getWeekStart(new Date(2026, 9, 25, 12));
  assert.equal(dateKey(start), '2026-10-19');
  assert.equal(dateKey(addDays(start, 7)), '2026-10-26');
  assert.equal(getUBBWeekNumber(addDays(start, 7)) - getUBBWeekNumber(start), 1);
  assert.equal(dateKey(getWeekStart(new Date(2027, 0, 1))), '2026-12-28');
});
