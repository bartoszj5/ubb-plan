import type { ScheduleEvent } from '../types/index.ts';

export function getWeekStart(date: Date): Date {
  const value = new Date(date);
  value.setDate(value.getDate() - (value.getDay() + 6) % 7);
  value.setHours(0, 0, 0, 0);
  return value;
}
export function getUBBWeekNumber(weekStart: Date): number {
  return 758 + Math.round((weekStart.getTime() - new Date(2026, 2, 2).getTime()) / (7 * 86400000));
}
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(date: Date, count: number): Date {
  const result = new Date(date); result.setDate(result.getDate() + count); return result;
}
export function sameDay(a: Date, b: Date): boolean { return dateKey(a) === dateKey(b); }
export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}
export function eventTime(event: ScheduleEvent): string { return `${formatTime(event.start)}–${formatTime(event.end)}`; }

const TYPES: Record<string, { label: string; color: string }> = {
  wyk: { label: 'Wykład', color: '#818cf8' }, ćw: { label: 'Ćwiczenia', color: '#d99a35' },
  lab: { label: 'Laboratorium', color: '#3cba91' }, sem: { label: 'Seminarium', color: '#dc78b0' },
  lek: { label: 'Lektorat', color: '#a78bfa' }, proj: { label: 'Projekt', color: '#e69b6f' },
  konw: { label: 'Konwersatorium', color: '#55b8cc' },
};
const ALIASES: Record<string, string> = {
  wykład: 'wyk', lecture: 'wyk', w: 'wyk', ćwiczenia: 'ćw', exercises: 'ćw',
  laboratorium: 'lab', laboratory: 'lab', seminarium: 'sem', seminar: 'sem', lektorat: 'lek', projekt: 'proj', konwersatorium: 'konw',
};
export function eventType(type: string) {
  const normalized = type.toLocaleLowerCase('pl').trim();
  return TYPES[ALIASES[normalized] || normalized] || { label: type || 'Zajęcia', color: '#818cf8' };
}
export function isRemoteEvent(event: ScheduleEvent): boolean {
  const remote = /zdaln|online|on-line/i;
  if (event.roomPlans?.some(plan => !remote.test(plan.name))) return false;
  if (event.room && !remote.test(event.room)) return false;
  return remote.test([event.room, event.location, event.description].filter(Boolean).join(' '));
}
export function eventPlace(event: ScheduleEvent, scheduleType = '0'): string {
  if (scheduleType === '20') return event.groupPlans?.map(p => p.name).join(', ') || event.room || 'Grupa niepodana';
  if (isRemoteEvent(event)) return 'Zdalnie';
  const rooms = event.roomPlans?.map(p => p.name).join(', ') || event.room;
  return rooms ? `Sala ${rooms}` : 'Sala niepodana';
}

/** Use the union of occupied intervals so overlaps cannot create false breaks. */
export function agendaGaps(events: ScheduleEvent[]): Map<ScheduleEvent, number> {
  const result = new Map<ScheduleEvent, number>();
  let occupiedUntil = 0;
  for (const event of [...events].filter(e => e.kind !== 'notice').sort((a, b) => +new Date(a.start) - +new Date(b.start))) {
    const start = +new Date(event.start);
    if (occupiedUntil && start > occupiedUntil) result.set(event, Math.round((start - occupiedUntil) / 60000));
    occupiedUntil = Math.max(occupiedUntil, +new Date(event.end));
  }
  return result;
}
export interface PositionedEvent { event: ScheduleEvent; column: number; columns: number }
export function positionEvents(events: ScheduleEvent[]): PositionedEvent[] {
  const sorted = [...events].sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const clusters: ScheduleEvent[][] = [];
  let until = 0;
  for (const event of sorted) {
    if (!clusters.length || +new Date(event.start) >= until) clusters.push([]);
    clusters[clusters.length - 1].push(event);
    until = Math.max(until, +new Date(event.end));
  }
  return clusters.flatMap(cluster => {
    const ends: number[] = [];
    const positioned = cluster.map(event => {
      let column = ends.findIndex(end => end <= +new Date(event.start));
      if (column < 0) column = ends.length;
      ends[column] = +new Date(event.end);
      return { event, column };
    });
    return positioned.map(item => ({ ...item, columns: ends.length }));
  });
}
