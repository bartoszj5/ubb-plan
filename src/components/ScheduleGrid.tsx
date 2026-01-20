import { useMemo } from 'react';
import type { ScheduleEvent } from '../types';
import './ScheduleGrid.css';

interface ScheduleGridProps {
  events: ScheduleEvent[];
  weekStart: Date;
  groupName: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
}

const DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 - 20:00

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

function getEventColor(subject: string): string {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function formatWeekRange(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${formatDate(start)} - ${formatDate(end)}`;
}

export default function ScheduleGrid({
  events,
  weekStart,
  groupName,
  onPrevWeek,
  onNextWeek,
  onToggleFavorite,
  isFavorite
}: ScheduleGridProps) {
  const weekDates = useMemo(() => {
    return DAYS.map((_, i) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      return date;
    });
  }, [weekStart]);

  const eventsByDay = useMemo(() => {
    const map: Map<number, ScheduleEvent[]> = new Map();
    
    events.forEach(event => {
      const eventDate = new Date(event.start);
      const dayOfWeek = eventDate.getDay();
      // Convert Sunday (0) to 6, Monday (1) to 0, etc.
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      
      if (!map.has(dayIndex)) {
        map.set(dayIndex, []);
      }
      map.get(dayIndex)!.push(event);
    });
    
    return map;
  }, [events]);

  const getEventStyle = (event: ScheduleEvent) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    
    const startHour = start.getUTCHours() + start.getUTCMinutes() / 60;
    const endHour = end.getUTCHours() + end.getUTCMinutes() / 60;
    
    const top = ((startHour - 7) / 14) * 100;
    const height = ((endHour - startHour) / 14) * 100;
    
    return {
      top: `${top}%`,
      height: `${height}%`,
      backgroundColor: getEventColor(event.subject),
    };
  };

  const formatEventTime = (event: ScheduleEvent) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    
    const format = (d: Date) => 
      `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
    
    return `${format(start)} - ${format(end)}`;
  };

  return (
    <div className="schedule-grid">
      <div className="schedule-header">
        <div className="schedule-info">
          <h2>{groupName}</h2>
          <button 
            className={`favorite-btn ${isFavorite ? 'is-favorite' : ''}`}
            onClick={onToggleFavorite}
            title={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          >
            {isFavorite ? '★' : '☆'}
          </button>
        </div>
        <div className="week-navigation">
          <button onClick={onPrevWeek} className="nav-btn">← Poprzedni</button>
          <span className="week-label">{formatWeekRange(weekStart)}</span>
          <button onClick={onNextWeek} className="nav-btn">Następny →</button>
        </div>
      </div>

      <div className="grid-container">
        <div className="time-column">
          <div className="time-header"></div>
          {HOURS.map(hour => (
            <div key={hour} className="time-slot">
              {hour}:00
            </div>
          ))}
        </div>

        {DAYS.map((day, dayIndex) => (
          <div key={day} className="day-column">
            <div className="day-header">
              <span className="day-name">{day}</span>
              <span className="day-date">{formatDate(weekDates[dayIndex])}</span>
            </div>
            <div className="day-events">
              {eventsByDay.get(dayIndex)?.map((event, i) => (
                <div
                  key={i}
                  className="event-block"
                  style={getEventStyle(event)}
                  title={`${event.summary}\n${formatEventTime(event)}`}
                >
                  <span className="event-subject">{event.subject}</span>
                  <span className="event-type">{event.type}</span>
                  <span className="event-room">{event.room}</span>
                  <span className="event-time">{formatEventTime(event)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
