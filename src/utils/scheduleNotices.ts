import type { ScheduleEvent, ScheduleNotice } from '../types';

export function getEventNotices(event: ScheduleEvent): ScheduleNotice[] {
  if (event.kind === 'notice') {
    return [{ text: event.subject, teacher: event.teacher, room: event.room }];
  }
  return event.notices ?? [];
}

export function getNoticeLabel(notices: ScheduleNotice[]): string {
  return notices.some(notice => /(?:przenies|zmian).*sal/iu.test(notice.text))
    ? 'Zmiana sali'
    : 'Informacja';
}

export function formatNotice(notice: ScheduleNotice): string {
  return [notice.text, notice.room && `Sala: ${notice.room}`, notice.teacher && `Dotyczy: ${notice.teacher}`]
    .filter(Boolean).join('\n');
}
