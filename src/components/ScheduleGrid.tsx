import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { ScheduleEvent } from '../types';
import { StarIcon, StarOutlineIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';
import EventModal from './EventModal';
import './ScheduleGrid.css';

interface ScheduleGridProps {
  events: ScheduleEvent[];
  weekStart: Date;
  groupName: string;
  groupPath?: string[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
}

const DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
const DAY_ABBR = ['Pn', 'Wt', 'Sr', 'Cz', 'Pt', 'Sb', 'Nd'];
const MIN_START_HOUR = 7;
const MAX_END_HOUR = 21;

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

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function ScheduleGrid({
  events,
  weekStart,
  groupName,
  groupPath,
  onPrevWeek,
  onNextWeek,
  onGoToToday,
  onToggleFavorite,
  isFavorite
}: ScheduleGridProps) {
  const [showWeekend, setShowWeekend] = useState(false);
  const [modalEvent, setModalEvent] = useState<ScheduleEvent | null>(null);
  const [timeIndicatorPos, setTimeIndicatorPos] = useState<number | null>(null);

  const today = useMemo(() => new Date(), []);

  const weekDates = useMemo(() => {
    return DAYS.map((_, i) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      return date;
    });
  }, [weekStart]);

  const todayIndex = useMemo(() => {
    return weekDates.findIndex(d => isSameDay(d, today));
  }, [weekDates, today]);

  // Mobile day view
  const [mobileViewDay, setMobileViewDay] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    return day === 0 ? 6 : day - 1;
  });

  // Reset mobile day when week changes
  const swipeWeekChangeRef = useRef(false);
  useEffect(() => {
    if (swipeWeekChangeRef.current) {
      swipeWeekChangeRef.current = false;
      return;
    }
    if (todayIndex >= 0) {
      setMobileViewDay(todayIndex);
    } else {
      setMobileViewDay(0);
    }
  }, [weekStart, todayIndex]);

  const displayDays = showWeekend ? 7 : 5;

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;

    if (dx < 0) {
      setMobileViewDay(prev => {
        if (prev < displayDays - 1) return prev + 1;
        swipeWeekChangeRef.current = true;
        onNextWeek();
        return 0;
      });
    } else {
      setMobileViewDay(prev => {
        if (prev > 0) return prev - 1;
        swipeWeekChangeRef.current = true;
        onPrevWeek();
        return displayDays - 1;
      });
    }
  }, [displayDays, onNextWeek, onPrevWeek]);

  // Compute dynamic hour range based on events
  const { startHour, endHour, totalHours, hours } = useMemo(() => {
    let earliest = MAX_END_HOUR;
    let latest = MIN_START_HOUR;

    events.forEach(event => {
      const s = new Date(event.start);
      const e = new Date(event.end);
      const sh = s.getHours() + s.getMinutes() / 60;
      const eh = e.getHours() + e.getMinutes() / 60;
      if (sh < earliest) earliest = sh;
      if (eh > latest) latest = eh;
    });

    if (earliest >= latest) {
      const total = MAX_END_HOUR - MIN_START_HOUR - 1;
      return {
        startHour: MIN_START_HOUR + 1,
        endHour: MAX_END_HOUR,
        totalHours: total,
        hours: Array.from({ length: total }, (_, i) => i + MIN_START_HOUR + 1),
      };
    }

    const s = Math.max(MIN_START_HOUR, Math.floor(earliest) - 1);
    const e = Math.min(MAX_END_HOUR, Math.ceil(latest));
    const total = e - s;
    return {
      startHour: s,
      endHour: e,
      totalHours: total,
      hours: Array.from({ length: total }, (_, i) => i + s),
    };
  }, [events]);

  // Current time indicator
  useEffect(() => {
    const updateTimeIndicator = () => {
      if (todayIndex < 0) {
        setTimeIndicatorPos(null);
        return;
      }
      const now = new Date();
      const h = now.getHours() + now.getMinutes() / 60;
      if (h >= startHour && h <= endHour) {
        setTimeIndicatorPos(((h - startHour) / totalHours) * 100);
      } else {
        setTimeIndicatorPos(null);
      }
    };

    updateTimeIndicator();
    const interval = setInterval(updateTimeIndicator, 60000);
    return () => clearInterval(interval);
  }, [todayIndex, startHour, endHour, totalHours]);

  /* Logic for grouping overlapping events */
  const eventsByDay = useMemo(() => {
    const map: Map<number, (ScheduleEvent & { style: React.CSSProperties; durationHours: number })[]> = new Map();

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

    rawEventsByDay.forEach((dayEvents, dayIndex) => {
      const sorted = [...dayEvents].sort((a, b) =>
        new Date(a.start).getTime() - new Date(b.start).getTime()
      );

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

      const processedEvents: (ScheduleEvent & { style: React.CSSProperties; durationHours: number })[] = [];

      clusters.forEach(cluster => {
        const columns: ScheduleEvent[][] = [];
        const eventCols: Map<ScheduleEvent, number> = new Map();

        cluster.forEach(ev => {
          const start = new Date(ev.start).getTime();
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
          const start = new Date(ev.start);
          const end = new Date(ev.end);
          const evStartHour = start.getHours() + start.getMinutes() / 60;
          const evEndHour = end.getHours() + end.getMinutes() / 60;

          const top = ((evStartHour - startHour) / totalHours) * 100;
          const height = ((evEndHour - evStartHour) / totalHours) * 100;
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

          processedEvents.push({ ...ev, style, durationHours: evEndHour - evStartHour });
        });
      });

      map.set(dayIndex, processedEvents);
    });

    return map;
  }, [events, startHour, totalHours]);

  const formatEventTime = (event: ScheduleEvent) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const format = (d: Date) =>
      `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    return `${format(start)} - ${format(end)}`;
  };

  const breadcrumb = groupPath && groupPath.length > 1
    ? groupPath.slice(0, -1).join(' > ')
    : null;

  return (
    <div className="schedule-grid">
      <div className="schedule-header">
        <div className="schedule-info">
          <div>
            <h2>{groupName}</h2>
            {breadcrumb && <div className="breadcrumb">{breadcrumb}</div>}
          </div>
          <button
            className={`favorite-btn ${isFavorite ? 'is-favorite' : ''}`}
            onClick={onToggleFavorite}
            aria-label={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          >
            {isFavorite ? <StarIcon size={18} /> : <StarOutlineIcon size={18} />}
          </button>
        </div>
        <div className="schedule-controls">
          <button
            className="weekend-toggle"
            onClick={() => setShowWeekend(w => !w)}
            aria-label={showWeekend ? 'Ukryj weekend' : 'Pokaż weekend'}
          >
            {showWeekend ? 'Pn-Nd' : 'Pn-Pt'}
          </button>
          <div className="week-navigation">
            <button onClick={onPrevWeek} className="nav-btn" aria-label="Poprzedni tydzień">
              <ChevronLeftIcon size={16} />
            </button>
            <button onClick={onGoToToday} className="today-btn">
              Dzisiaj
            </button>
            <span className="week-label">{formatWeekRange(weekStart)}</span>
            <button onClick={onNextWeek} className="nav-btn" aria-label="Następny tydzień">
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile day tabs */}
      <div className="mobile-day-tabs" role="tablist">
        {Array.from({ length: displayDays }, (_, i) => i).map(i => (
          <button
            key={i}
            role="tab"
            aria-selected={mobileViewDay === i}
            className={`mobile-day-tab ${mobileViewDay === i ? 'active' : ''} ${todayIndex === i ? 'is-today' : ''}`}
            onClick={() => setMobileViewDay(i)}
          >
            <span className="mobile-day-abbr">{DAY_ABBR[i]}</span>
            <span className="mobile-day-date">{weekDates[i].getDate()}</span>
          </button>
        ))}
      </div>

      <div className="grid-container" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="time-column">
          <div className="time-header"></div>
          {hours.map(hour => (
            <div key={hour} className="time-slot">
              {hour}:00
            </div>
          ))}
        </div>

        {Array.from({ length: displayDays }, (_, i) => i).map(dayIndex => (
          <div
            key={DAYS[dayIndex]}
            className={`day-column ${todayIndex === dayIndex ? 'today' : ''} ${dayIndex === mobileViewDay ? 'mobile-active' : ''}`}
          >
            <div className="day-header">
              <span className="day-name">{DAYS[dayIndex]}</span>
              <span className="day-date">{formatDate(weekDates[dayIndex])}</span>
            </div>
            <div className="day-events" style={{ height: `calc(${totalHours} * 60px)` }}>
              {todayIndex === dayIndex && timeIndicatorPos !== null && (
                <div
                  className="time-indicator"
                  style={{ top: `${timeIndicatorPos}%` }}
                >
                  <div className="time-indicator-dot" />
                  <div className="time-indicator-line" />
                </div>
              )}
              {eventsByDay.get(dayIndex)?.map((event, i) => (
                <div
                  key={i}
                  className={`event-block ${event.durationHours <= 1.25 ? 'event-compact' : ''}`}
                  style={event.style}
                  title={`${event.summary}\n${formatEventTime(event)}`}
                  onClick={() => setModalEvent(event)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModalEvent(event); } }}
                >
                  <span className="event-subject">{event.subject}</span>
                  <span className="event-type">{event.type}</span>
                  <span className="event-time">{formatEventTime(event)}</span>
                  <span className="event-room">{event.room}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {modalEvent && (
        <EventModal event={modalEvent} onClose={() => setModalEvent(null)} />
      )}
    </div>
  );
}
