import test from 'node:test';
import assert from 'node:assert/strict';
import { parseICS, parseScheduleHTMLMeta, attachScheduleNotices } from './parsers.js';

// Shape and content of the UBB English lesson and notice on 7 October 2026.
const html = `
<div id="course_2" class="coursediv"><img src="resize.png" />Ja, lek<br />
<a href="plan.php?type=10&id=112083">IlSz</a> <a href="plan.php?type=10&id=112079">BGó</a> <a href="plan.php?type=10&id=184466">MDo</a><br />
<a href="plan.php?type=20&id=6617">L152</a> <a href="plan.php?type=20&id=21142">L136A</a> <a href="plan.php?type=20&id=6571">B210</a><br />występowanie:<br />Stacjonarne</div>
<div id="course_13" class="coursediv"><img src="resize.png" /><img src="overshadow.png" />Przeniesienie zajęć z sali L152 07.10<br />
<a href="plan.php?type=10&id=112079">BGó</a><br /><a href="plan.php?type=20&id=6635">L325</a></div>`;

function icsEvent(summary, start = '20261007T143000Z', end = '20261007T160000Z') {
  return `BEGIN:VEVENT\r\nDTSTART:${start}\r\nDTEND:${end}\r\nSUMMARY:${summary}\r\nEND:VEVENT\r\n`;
}

const lesson = 'Ja lek IlSz BGó MDo L152 L136A B210';
const notice = 'Przeniesienie zajęć z sali L152 07.10  BGó L325';
const { entries } = parseScheduleHTMLMeta(html);

test('UBB notice preserves its full title, teacher and new room', () => {
  const [event] = parseICS(icsEvent(notice), entries);
  assert.equal(event.kind, 'notice');
  assert.equal(event.subject, 'Przeniesienie zajęć z sali L152 07.10');
  assert.equal(event.type, '');
  assert.equal(event.teacher, 'BGó');
  assert.equal(event.room, 'L325');
});

test('room change attaches to English only on the affected date', () => {
  const events = attachScheduleNotices(parseICS(
    icsEvent(lesson) + icsEvent(notice) + icsEvent(lesson, '20261014T143000Z', '20261014T160000Z'), entries,
  ));
  assert.equal(events.length, 2);
  assert.equal(events[0].teacher, 'IlSz BGó MDo');
  assert.equal(events[0].room, 'L152 L136A B210');
  assert.deepEqual(events[0].notices, [{ text: 'Przeniesienie zajęć z sali L152 07.10', teacher: 'BGó', room: 'L325' }]);
  assert.equal(events[1].notices, undefined);
});

test('unrelated and ambiguous overlapping lessons keep the notice visible separately', () => {
  const [annotation] = parseICS(icsEvent(notice), entries);
  const [english] = parseICS(icsEvent(lesson), entries);
  const unrelated = { ...english, teacher: 'Other' };
  assert.equal(attachScheduleNotices([unrelated, annotation]).length, 2);
  assert.equal(attachScheduleNotices([{ ...english }, { ...english }, annotation]).length, 3);
  assert.equal(attachScheduleNotices([annotation])[0].kind, 'notice');
});

test('touching but non-overlapping lessons do not receive a notice', () => {
  const events = attachScheduleNotices(parseICS(
    icsEvent(lesson, '20261007T130000Z', '20261007T143000Z') + icsEvent(notice), entries,
  ));
  assert.equal(events.length, 2);
  assert.equal(events[0].notices, undefined);
});

test('generic information without room links is still a notice', () => {
  const { entries: genericEntries } = parseScheduleHTMLMeta('<div id="course_1" class="coursediv">Zajęcia odwołane, konsultacje &amp; dyżur<br /><a href="plan.php?type=10&id=112079">BGó</a></div>');
  const [event] = parseICS(icsEvent('Zajęcia odwołane, konsultacje & dyżur  BGó '), genericEntries);
  assert.equal(event.kind, 'notice');
  assert.equal(event.subject, 'Zajęcia odwołane, konsultacje & dyżur');
  assert.equal(event.room, '');
});

test('teacher and room schedules preserve their group fields', () => {
  const teacherHTML = '<div id="course_1" class="coursediv">Ja, lek<br /><a href="plan.php?type=0&id=185657">Group</a><br /><a href="plan.php?type=20&id=6617">L152</a></div>';
  const roomHTML = '<div id="course_1" class="coursediv">Ja, lek<br /><a href="plan.php?type=10&id=112079">BGó</a><br /><a href="plan.php?type=0&id=185657">Group</a></div>';
  const [teacherEvent] = parseICS(icsEvent('Ja lek Group L152'), parseScheduleHTMLMeta(teacherHTML, '10').entries);
  const [roomEvent] = parseICS(icsEvent('Ja lek BGó Group'), parseScheduleHTMLMeta(roomHTML, '20').entries);
  assert.equal(teacherEvent.teacher, 'Group');
  assert.equal(teacherEvent.room, 'L152');
  assert.equal(roomEvent.teacher, 'BGó');
  assert.equal(roomEvent.room, 'Group');
});

test('ICS unfolds and decodes text without changing floating or UTC times', () => {
  const [event] = parseICS('BEGIN:VEVENT\r\nDTSTART:20261007T163000\r\nDTEND:20261007T180000\r\nSUMMARY:Ja lek BGó L152\r\nDESCRIPTION:Zmiana\\nSala L325\\,\r\n  wejście B\\; parter\r\nEND:VEVENT');
  assert.equal(event.start, '2026-10-07T16:30:00');
  assert.equal(event.description, 'Zmiana\nSala L325, wejście B; parter');
  assert.equal(parseICS(icsEvent(lesson))[0].start, '2026-10-07T14:30:00Z');
});
