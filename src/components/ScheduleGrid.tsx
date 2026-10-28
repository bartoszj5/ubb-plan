import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ScheduleEvent, MobileScheduleView } from '../types';
import { StarIcon, StarOutlineIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, MapPinIcon, CalendarIcon, InfoIcon, SearchIcon, WifiIcon } from './Icons';
import EventModal from './EventModal';
import ScheduleLoader from './ScheduleLoader';
import { getEventNotices, getNoticeLabel } from '../utils/scheduleNotices';
import { getPlanPresentation } from '../utils/plans';
import { addDays, agendaGaps, dateKey, eventPlace, eventTime, eventType, formatTime, isRemoteEvent, positionEvents, sameDay } from '../utils/schedule';
import { readStorage, writeStorage } from '../utils/storage';
import { useMediaQuery } from '../hooks/useMediaQuery';
import './ScheduleGrid.css';

interface ScheduleGridProps {
  events: ScheduleEvent[];
  hasData: boolean;
  loading: boolean;
  fetchedAt: number | null;
  refreshError: string | null;
  onRefresh: () => void;
  scheduleType: string;
  weekStart: Date;
  mobileView: MobileScheduleView;
  onMobileViewChange: (view: MobileScheduleView) => void;
  groupName: string;
  groupPath: string[];
  customLabel?: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
  onChooseDate: (date: Date) => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  isMyPlan: boolean;
  hasMyPlan: boolean;
  onSetMyPlan: () => void;
  onReturnToMyPlan: () => void;
  onSearch: () => void;
  initialScrollTop: number;
  onScrollChange: (top: number) => void;
}
const DAY_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
const DAY_FULL = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
type ViewMode = 'list' | 'grid';
function savedMode(key: string, fallback: ViewMode): ViewMode { const value = readStorage(key, fallback); return value === 'grid' || value === 'list' ? value : fallback; }

interface EventCardProps { event: ScheduleEvent; scheduleType: string; onOpen: (event: ScheduleEvent) => void; compact?: boolean; status?: string; style?: CSSProperties }
function EventCard({ event, scheduleType, onOpen, compact = false, status, style }: EventCardProps) {
  const type = eventType(event.type);
  const notices = getEventNotices(event);
  const title = event.subjectFullName || event.subject;
  const place = eventPlace(event, scheduleType);
  const PlaceIcon = scheduleType === '20' ? CalendarIcon : isRemoteEvent(event) ? WifiIcon : MapPinIcon;
  return <button type="button" className={`event-card ${compact ? 'event-compact' : ''} ${status ? 'event-highlighted' : ''} ${event.kind === 'notice' ? 'event-standalone-notice' : ''}`}
    style={{ '--event-color': type.color, ...style } as CSSProperties} onClick={() => onOpen(event)}
    title={`${title} · ${type.label} · ${eventTime(event)} · ${place}`}
    aria-label={`${title}, ${type.label}, ${eventTime(event)}, ${place}${status ? `, ${status}` : ''}`}>
    <span className="event-card-top"><span className="event-type">{event.kind === 'notice' ? 'Informacja' : type.label}</span>{status && <span className="event-status">{status}</span>}</span>
    <span className="event-subject">{title}</span>
    <span className="event-info"><span className="event-time"><ClockIcon size={15} />{eventTime(event)}</span>
    {(event.room || event.roomPlans?.length || event.kind !== 'notice') && <span className="event-place"><PlaceIcon size={17} />{place}</span>}</span>
    {scheduleType !== '10' && event.teacher && <span className="event-teacher">{(event.teacherPlans?.length ?? 0) > 1 ? `${event.teacherPlans!.length} prowadzących · szczegóły po otwarciu` : event.teacherFullName || event.teacherPlans?.map(p => p.name).join(', ') || event.teacher}</span>}
    {scheduleType === '10' && (event.groupPlans?.length || event.teacher) && <span className="event-teacher">{event.groupPlans?.map(p => p.name).join(', ') || event.teacher}</span>}
    {notices.length > 0 && <span className="event-notice-badge"><InfoIcon size={14} />{getNoticeLabel(notices)}</span>}
  </button>;
}

export default function ScheduleGrid(props: ScheduleGridProps) {
  const { events, hasData, loading, refreshError, fetchedAt, scheduleType, weekStart, mobileView, onMobileViewChange, onChooseDate } = props;
  const isMobile = useMediaQuery('(max-width: 768px)');
  const compactScreen = useMediaQuery('(max-width: 1024px)');
  const [mobileMode, setMobileMode] = useState(() => savedMode('ubb-view-mobile:v1', 'list'));
  const [desktopMode, setDesktopMode] = useState(() => savedMode('ubb-view-desktop:v1', 'grid'));
  const mode = compactScreen ? mobileMode : desktopMode;
  const [showWeekend, setShowWeekend] = useState(() => readStorage('ubb-show-weekend:v1', false));
  const [modalEvent, setModalEvent] = useState<ScheduleEvent | null>(null);
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const lastScrollKey = useRef('');
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const presentation = getPlanPresentation(props.groupName, props.groupPath, scheduleType);
  const title = props.customLabel || presentation.title;
  const titleParts = title.split(' · ');
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEvents = useMemo(() => events.filter(event => {
    const start = new Date(event.start), end = new Date(event.end);
    return Number.isFinite(+start) && +end > +start && start >= weekStart && start < addDays(weekStart, 7);
  }).sort((a, b) => +new Date(a.start) - +new Date(b.start)), [events, weekStart]);
  const day = mobileView.weekStartTime === weekStart.getTime() ? mobileView.day : 0;
  const selectedDate = dates[day];
  const hasWeekendEvents = weekEvents.some(event => (new Date(event.start).getDay() + 6) % 7 >= 5);
  const includeWeekend = showWeekend || hasWeekendEvents || day >= 5;
  const visibleDates = dates.slice(0, includeWeekend ? 7 : 5);
  const dayEvents = useMemo(() => weekEvents.filter(event => sameDay(new Date(event.start), selectedDate)), [weekEvents, selectedDate]);
  const lessons = dayEvents.filter(event => event.kind !== 'notice');
  const gaps = useMemo(() => agendaGaps(dayEvents), [dayEvents]);
  const isToday = sameDay(selectedDate, now);
  const hasCurrent = lessons.some(event => +new Date(event.start) <= +now && +new Date(event.end) > +now);
  const nextStart = lessons.find(event => +new Date(event.start) > +now)?.start;
  const nextDayEvent = weekEvents.find(event => event.kind !== 'notice' && new Date(event.start) >= addDays(selectedDate, 1));
  const changedEvents = weekEvents.filter(event => getEventNotices(event).length > 0);
  const singleDay = isMobile || mode === 'list';

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const tabs = tabsRef.current;
    const selected = tabs?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    if (!tabs || !selected) return;
    if (selected.offsetLeft < tabs.scrollLeft) tabs.scrollLeft = selected.offsetLeft;
    else if (selected.offsetLeft + selected.offsetWidth > tabs.scrollLeft + tabs.clientWidth) tabs.scrollLeft = selected.offsetLeft + selected.offsetWidth - tabs.clientWidth;
  }, [day, includeWeekend, singleDay]);
  const scrollKey = `${dateKey(weekStart)}:${singleDay ? day : 'week'}:${mode}`;
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || !hasData) return;
    if (lastScrollKey.current === scrollKey) return;
    container.scrollTop = restored.current ? 0 : props.initialScrollTop;
    restored.current = true; lastScrollKey.current = scrollKey;
  }, [hasData, scrollKey, props.initialScrollTop]);

  function selectDay(index: number) { onMobileViewChange({ weekStartTime: weekStart.getTime(), day: index }); }
  function chooseDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value === dateKey(selectedDate)) return;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isFinite(+date)) onChooseDate(date);
  }
  function changeMode(next: ViewMode) {
    if (compactScreen) setMobileMode(next); else setDesktopMode(next);
    writeStorage(compactScreen ? 'ubb-view-mobile:v1' : 'ubb-view-desktop:v1', next);
  }
  function eventStatus(event: ScheduleEvent): string | undefined {
    if (event.kind === 'notice') return;
    if (+new Date(event.start) <= +now && +new Date(event.end) > +now) return 'Trwa teraz';
    if (isToday && !hasCurrent && event.start === nextStart) return 'Najbliższe zajęcia';
    if (selectedDate > now && event === lessons[0]) return 'Pierwsze zajęcia';
  }
  const first = lessons[0];
  const lastEnd = lessons.length ? new Date(Math.max(...lessons.map(event => +new Date(event.end)))) : null;
  const startHours = weekEvents.map(event => new Date(event.start).getHours() + new Date(event.start).getMinutes() / 60);
  const endHours = weekEvents.map(event => sameDay(new Date(event.start), new Date(event.end)) ? new Date(event.end).getHours() + new Date(event.end).getMinutes() / 60 : 24);
  const startHour = Math.max(0, Math.floor(startHours.length ? Math.min(...startHours) : 8) - 1);
  const endHour = Math.min(24, Math.ceil(endHours.length ? Math.max(...endHours) : 20));
  const hourHeight = 80;
  const hourCount = Math.max(1, endHour - startHour);
  const gridHeight = hourCount * hourHeight;
  const fitWeek = !isMobile && mode === 'grid';
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const datesLabel = `${weekStart.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} – ${visibleDates.at(-1)!.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const dayLabel = selectedDate.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

  const emptyDay = <div className="empty-plan"><CalendarIcon size={32} /><h3>Brak zajęć w {refreshError ? 'pobranym ' : ''}planie</h3><p>{!singleDay && !weekEvents.length ? datesLabel : dayLabel}</p><p className="empty-help">{refreshError ? 'Nie udało się ponownie sprawdzić danych. Spróbuj odświeżyć plan.' : 'Sprawdź kolejny termin lub wybierz inną datę.'}</p>
    <button type="button" className="primary-button" onClick={() => nextDayEvent ? onChooseDate(new Date(nextDayEvent.start)) : props.onNextWeek()}>{nextDayEvent ? 'Następny dzień z zajęciami' : 'Sprawdź kolejny tydzień'}</button></div>;

  const changes = hasData && changedEvents.length > 0 ? <section className="plan-changes"><h2><InfoIcon size={18} />Informacje do zajęć w tym tygodniu</h2>{changedEvents.map((event, index) => <button type="button" key={index} onClick={() => setModalEvent(event)}><strong>{getNoticeLabel(getEventNotices(event))}</strong><span>{event.subjectFullName || event.subject} · {new Date(event.start).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</span><ChevronRightIcon size={17} /></button>)}</section> : null;

  return <div className={`schedule-page ${fitWeek ? 'fit-week' : ''}`}>
    <section className="plan-heading">
      {props.hasMyPlan && !props.isMyPlan && <button type="button" className="back-to-plan text-button" onClick={props.onReturnToMyPlan}><ChevronLeftIcon size={16} />Wróć do mojego planu</button>}
      <div className="plan-title-row"><div className="plan-title-copy"><h1>{titleParts.length === 2 && /^grupa \d+$/.test(titleParts[1]) ? <>{titleParts[0]}<span className="plan-title-group"> · {titleParts[1]}</span></> : title}</h1><p>{presentation.subtitle}</p></div>
        <div className="plan-title-actions"><button type="button" className={`favorite-button ${props.isFavorite ? 'is-favorite' : ''}`} aria-pressed={props.isFavorite} aria-label={props.isFavorite ? 'Usuń z zapisanych' : 'Zapisz plan'} onClick={props.onToggleFavorite}>
          {props.isFavorite ? <StarIcon size={20} /> : <StarOutlineIcon size={20} />}<span>{props.isFavorite ? 'Zapisany' : 'Zapisz'}</span></button>
          <details className="mobile-plan-options" data-shortcuts-blocked><summary className="icon-button" aria-label="Opcje planu"><InfoIcon size={21} /></summary><div className="plan-options-panel">
            <button type="button" className="text-button" onClick={props.onSearch}><SearchIcon size={17} />Zmień plan</button>
            <button type="button" className="text-button" aria-pressed={props.isMyPlan} onClick={props.onSetMyPlan}><CalendarIcon size={17} />{props.isMyPlan ? 'Usuń ustawienie mojego planu' : 'Ustaw jako mój plan'}</button>
            <strong>{props.groupName}</strong><p>{props.groupPath.join(' › ')}</p>
            {props.isMyPlan && <p>Ten plan otwiera się na stronie głównej.</p>}
          </div></details></div>
      </div>
      <div className="plan-heading-actions"><button type="button" className="text-button" onClick={props.onSearch}><SearchIcon size={16} />Zmień plan</button>
        <button type="button" className={`my-plan-button ${props.isMyPlan ? 'is-my-plan' : ''}`} aria-pressed={props.isMyPlan} onClick={props.onSetMyPlan}><CalendarIcon size={16} />{props.isMyPlan ? 'To mój plan' : 'Ustaw jako mój plan'}</button>
      </div>
    </section>

    <div className="schedule-toolbar"><div className="date-controls" data-shortcuts-blocked>
      <button type="button" className="icon-button" onClick={props.onPrevWeek} aria-label="Poprzedni tydzień"><ChevronLeftIcon size={20} /></button>
      <label className="date-picker"><span className="sr-only">Wybierz datę</span><input type="date" aria-label="Wybierz datę" value={dateKey(selectedDate)} onInput={e => chooseDate(e.currentTarget.value)} onChange={e => chooseDate(e.target.value)} /></label>
      <button type="button" className="icon-button" onClick={props.onNextWeek} aria-label="Następny tydzień"><ChevronRightIcon size={20} /></button>
      <button type="button" className="today-button" onClick={props.onGoToToday}>Dziś</button>
    </div><div className="view-controls"><div className="view-switch" role="group" aria-label="Widok planu"><button type="button" aria-pressed={mode === 'list'} onClick={() => changeMode('list')}>Lista</button><button type="button" aria-pressed={mode === 'grid'} onClick={() => changeMode('grid')}>Siatka</button></div>
      {hasWeekendEvents ? <span className="weekend-required">Weekend w planie</span> : <label className="weekend-option"><input type="checkbox" checked={includeWeekend} onChange={e => { setShowWeekend(e.target.checked); writeStorage('ubb-show-weekend:v1', e.target.checked); if (!e.target.checked && day >= 5) selectDay(0); }} />Weekend</label>}
    </div></div>

    <div className="data-status"><span role="status" aria-live="polite">{loading ? hasData ? 'Odświeżanie planu…' : 'Wczytywanie planu…' : fetchedAt ? `Pobrano z UBB ${new Date(fetchedAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} o ${formatTime(new Date(fetchedAt))}` : 'Plan nie został pobrany'}</span>
      <button type="button" className="text-button" onClick={props.onRefresh} disabled={loading}>Odśwież</button></div>
    {refreshError && <div className="schedule-error" role="alert"><InfoIcon size={18} /><span>{refreshError}{hasData ? ' Wyświetlamy poprzednio pobrany plan.' : ''}</span><button type="button" className="text-button" disabled={loading} onClick={props.onRefresh}>Spróbuj ponownie</button></div>}

    {singleDay && <div className="day-tabs" ref={tabsRef} role="tablist" aria-label="Dzień tygodnia" data-shortcuts-blocked>{visibleDates.map((date, index) => <button type="button" key={dateKey(date)} role="tab" id={`day-tab-${index}`} aria-controls="day-panel"
      aria-selected={day === index} tabIndex={day === index ? 0 : -1} className={`${day === index ? 'active' : ''} ${sameDay(date, now) ? 'is-today' : ''}`} onClick={() => selectDay(index)}
      aria-label={`${DAY_FULL[index]}, ${date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}${sameDay(date, now) ? ', dzisiaj' : ''}`}
      onKeyDown={e => { let next = index; if (e.key === 'ArrowRight') next = (index + 1) % visibleDates.length; else if (e.key === 'ArrowLeft') next = (index + visibleDates.length - 1) % visibleDates.length; else if (e.key === 'Home') next = 0; else if (e.key === 'End') next = visibleDates.length - 1; else return; e.preventDefault(); e.stopPropagation(); selectDay(next); e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus(); }}>
      <span>{DAY_SHORT[index]}</span><strong>{date.getDate()}</strong>{weekEvents.some(event => event.kind !== 'notice' && sameDay(new Date(event.start), date)) && <span className="day-has-events" aria-hidden="true" />}
    </button>)}</div>}

    <div className={`schedule-scroll ${mode === 'list' ? 'agenda-scroll' : 'grid-scroll'}`} ref={scrollRef}
      id={singleDay ? 'day-panel' : undefined} role={singleDay ? 'tabpanel' : undefined} aria-labelledby={singleDay ? `day-tab-${day}` : undefined}
      onScroll={e => { if (hasData && lastScrollKey.current === scrollKey) props.onScrollChange(e.currentTarget.scrollTop); }}
      onTouchStart={e => { if (mode === 'grid') touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={e => {
        const start = touchStart.current; touchStart.current = null;
        if (!start || !isMobile || mode !== 'grid') return;
        const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        if (dx < 0) { if (day < visibleDates.length - 1) selectDay(day + 1); else props.onNextWeek(); }
        else if (day > 0) selectDay(day - 1); else onChooseDate(addDays(weekStart, includeWeekend ? -1 : -3));
      }}>
      {loading && !hasData ? <ScheduleLoader />
        : !hasData ? <div className="empty-plan"><InfoIcon size={32} /><h3>Nie udało się wyświetlić planu</h3><p>Wybierz „Spróbuj ponownie”, aby pobrać dane.</p></div>
        : mode === 'list' ? <div className="agenda"><div className="agenda-heading"><div><h2>{isToday ? 'Dzisiaj' : DAY_FULL[day]}</h2><p>{selectedDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
          {first && lastEnd && <div className="day-summary"><strong>{lessons.length} {lessons.length === 1 ? 'zajęcie' : lessons.length < 5 ? 'zajęcia' : 'zajęć'} w planie</strong><span>{formatTime(first.start)}–{formatTime(lastEnd)}</span></div>}</div>
          {isToday && lastEnd && +lastEnd <= +now && <p className="day-finished">Na dziś koniec zajęć w tym planie.</p>}
          {dayEvents.length ? <div className="agenda-events">{dayEvents.map((event, index) => <div key={`${event.start}:${event.subject}:${index}`}>
            {gaps.has(event) && <p className="agenda-break">Przerwa {gaps.get(event)} min</p>}
            <EventCard event={event} scheduleType={scheduleType} onOpen={setModalEvent} status={eventStatus(event)} />
          </div>)}</div> : emptyDay}
        </div>
        : !weekEvents.length || (isMobile && !dayEvents.length) ? emptyDay
        : <div className="week-grid" style={{ '--day-count': singleDay ? 1 : visibleDates.length, '--hour-count': hourCount } as CSSProperties}>
          <div className="grid-time-column"><div className="grid-corner" aria-hidden="true" />{Array.from({ length: endHour - startHour }, (_, i) => <div className="grid-time" key={i} style={fitWeek ? undefined : { height: hourHeight }}>{startHour + i}:00</div>)}</div>
          {(isMobile ? [selectedDate] : visibleDates).map(date => {
            const dayIndex = (date.getDay() + 6) % 7;
            const entries = positionEvents(weekEvents.filter(event => sameDay(new Date(event.start), date)));
            return <section key={dateKey(date)} className={`grid-day ${sameDay(date, now) ? 'today' : ''}`} aria-label={`${DAY_FULL[dayIndex]} ${date.toLocaleDateString('pl-PL')}`}>
              <div className="grid-day-heading"><span>{DAY_FULL[dayIndex]}</span><strong>{date.getDate()}</strong></div>
              <div className="grid-day-events" style={fitWeek ? undefined : { height: gridHeight }}>
                {sameDay(date, now) && nowHour >= startHour && nowHour < endHour && <div className="time-indicator" style={{ top: fitWeek ? `${(nowHour - startHour) / hourCount * 100}%` : (nowHour - startHour) * hourHeight }}><span>{formatTime(now)}</span></div>}
                {!entries.length && <p className="grid-empty-day">Brak zajęć</p>}
                {entries.map(({ event, column, columns }, index) => {
                  const start = new Date(event.start), end = new Date(event.end);
                  const from = start.getHours() + start.getMinutes() / 60;
                  const duration = Math.min((+end - +start) / 3600000, 24 - from);
                  return <EventCard key={`${event.start}:${event.subject}:${index}`} event={event} scheduleType={scheduleType} onOpen={setModalEvent} compact={duration <= 1}
                    style={{ position: 'absolute', top: fitWeek ? `${(from - startHour) / hourCount * 100}%` : (from - startHour) * hourHeight, height: fitWeek ? `calc(${duration / hourCount * 100}% - 3px)` : Math.max(32, duration * hourHeight - 4), left: `calc(${column / columns * 100}% + 3px)`, width: `calc(${100 / columns}% - 6px)` }} />;
                })}
              </div>
            </section>;
          })}
        </div>}
      {!fitWeek && changes}
    </div>
    {fitWeek && changes && <details className="week-notices"><summary><InfoIcon size={15} />Informacje do zajęć ({changedEvents.length})</summary>{changes}</details>}
    {!singleDay && <div className="week-caption">{datesLabel}<span>Strzałki: zmiana tygodnia · T: dzisiaj</span></div>}
    {modalEvent && <EventModal event={modalEvent} scheduleType={scheduleType} onClose={() => setModalEvent(null)} />}
  </div>;
}
