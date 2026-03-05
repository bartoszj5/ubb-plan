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
const START_HOUR = 8;
const END_HOUR = 21;
const TOTAL_HOURS = END_HOUR - START_HOUR; // 13 hours
const HOURS = Array.from({ length: TOTAL_HOURS }, (_, i) => i + START_HOUR); // 8:00 - 20:00

const COLORS = [
  '#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED',
  '#DB2777', '#0891B2', '#4D7C0F', '#C2410C', '#4338CA'
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

  /* Logic for grouping overlapping events */
  const eventsByDay = useMemo(() => {
    const map: Map<number, (ScheduleEvent & { style: React.CSSProperties })[]> = new Map();
    
    // 1. Group raw events by day
    const rawEventsByDay: Map<number, ScheduleEvent[]> = new Map();
    events.forEach(event => {
      const eventDate = new Date(event.start);
      const dayOfWeek = eventDate.getDay();
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      
      if (!rawEventsByDay.has(dayIndex)) {
        rawEventsByDay.set(dayIndex, []);
      }
      rawEventsByDay.get(dayIndex)!.push(event);
    });
    
    // 2. Process each day to calculate layout
    rawEventsByDay.forEach((dayEvents, dayIndex) => {
      // Sort by start time
      const sorted = [...dayEvents].sort((a, b) => 
        new Date(a.start).getTime() - new Date(b.start).getTime()
      );
      
      // Group into overlapping clusters
      const clusters: ScheduleEvent[][] = [];
      let currentCluster: ScheduleEvent[] = [];
      let clusterEnd = 0;

      sorted.forEach(ev => {
        const start = new Date(ev.start).getTime();
        const end = new Date(ev.end).getTime();
        
        if (currentCluster.length === 0) {
          currentCluster.push(ev);
          clusterEnd = end;
        } else {
          // If this event starts before the current cluster ends, it's part of the cluster
          // Note: Using strict < to allow adjacent events to NOT overlap
          if (start < clusterEnd) {
            currentCluster.push(ev);
            clusterEnd = Math.max(clusterEnd, end);
          } else {
            clusters.push(currentCluster);
            currentCluster = [ev];
            clusterEnd = end;
          }
        }
      });
      if (currentCluster.length > 0) clusters.push(currentCluster);

      // Process clusters to assign columns
      const processedEvents: (ScheduleEvent & { style: React.CSSProperties })[] = [];
      
      clusters.forEach(cluster => {
        const columns: ScheduleEvent[][] = [];
        const eventCols: Map<ScheduleEvent, number> = new Map();

        cluster.forEach(ev => {
            const start = new Date(ev.start).getTime();
            // Find first column where this event fits
            let colIndex = columns.findIndex(col => {
                const lastEvent = col[col.length - 1];
                return new Date(lastEvent.end).getTime() <= start;
            });
            
            if (colIndex === -1) {
                colIndex = columns.length;
                columns.push([]);
            }
            
            columns[colIndex].push(ev);
            eventCols.set(ev, colIndex);
        });
        
        const totalCols = columns.length;
        
        cluster.forEach(ev => {
          const col = eventCols.get(ev) || 0;
          
          /* Style Calculation */
          const start = new Date(ev.start);
          const end = new Date(ev.end);
          
          // Use LOCAL time
          const startHour = start.getHours() + start.getMinutes() / 60;
          const endHour = end.getHours() + end.getMinutes() / 60;
          
          const top = ((startHour - START_HOUR) / TOTAL_HOURS) * 100;
          const height = ((endHour - startHour) / TOTAL_HOURS) * 100;
          
          const leftPct = (col / totalCols) * 100;
          const widthPct = 100 / totalCols;

          const style = {
            top: `${top}%`,
            height: `calc(${height}% - 2px)`,
            left: `calc(${leftPct}% + 2px)`,
            width: `calc(${widthPct}% - 4px)`,
            zIndex: 1,
            '--event-color': getEventColor(ev.subject),
          } as React.CSSProperties;
          
          processedEvents.push({ ...ev, style });
        });
      });

      map.set(dayIndex, processedEvents);
    });
    
    return map;
  }, [events]);

  const formatEventTime = (event: ScheduleEvent) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    
    const format = (d: Date) => 
      `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    
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
                  style={event.style}
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
