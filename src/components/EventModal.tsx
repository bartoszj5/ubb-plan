import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScheduleEvent, SchedulePlanLink } from '../types';
import { ClockIcon, MapPinIcon, UserIcon, InfoIcon, CalendarIcon, WifiIcon, ChevronRightIcon } from './Icons';
import { saveGroupMeta } from '../utils/groupMeta';
import { searchPlans } from '../utils/api';
import { dateKey, eventTime, eventType, isRemoteEvent } from '../utils/schedule';
import { getEventNotices, getNoticeLabel } from '../utils/scheduleNotices';
import Dialog from './Dialog';
import './EventModal.css';

interface EventModalProps { event: ScheduleEvent; scheduleType?: string; onClose: () => void }
export default function EventModal({ event, scheduleType = '0', onClose }: EventModalProps) {
  const [openingPlan, setOpeningPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  useEffect(() => () => request.current?.abort(), []);
  const type = eventType(event.type);
  const notices = getEventNotices(event);
  const remote = isRemoteEvent(event);
  const isRoom = scheduleType === '20', isTeacher = scheduleType === '10';
  const title = event.subjectFullName || event.subject;

  function openPlan(plan: SchedulePlanLink, root: string) {
    if (plan.scheduleType !== '10') saveGroupMeta(plan.id, { name: plan.name, path: [root, plan.name], type: plan.scheduleType });
    navigate(`/plan/${plan.scheduleType}/${plan.id}`, { state: { date: dateKey(new Date(event.start)) } }); onClose();
  }
  async function findPlan(query: string, kind: 'room' | 'group', root: string) {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setOpeningPlan(true); setPlanError(null);
    try {
      const results = await searchPlans(query, kind, controller.signal); controller.signal.throwIfAborted();
      const plan = results.find(p => p.name.trim().toLocaleLowerCase('pl') === query.trim().toLocaleLowerCase('pl'));
      if (plan) openPlan(plan, root);
      else setPlanError(`Nie znaleziono planu „${query}”. Sprawdź go w wyszukiwarce lub odśwież plan zajęć.`);
    } catch { if (!controller.signal.aborted) setPlanError('Nie udało się otworzyć planu. Spróbuj ponownie.'); }
    finally { if (!controller.signal.aborted) setOpeningPlan(false); }
  }
  function links(plans: SchedulePlanLink[] | undefined, root: string, label: string) {
    return plans?.length ? <div className="detail-links">{plans.map(plan => <button type="button" key={`${plan.scheduleType}:${plan.id}`} disabled={openingPlan} className="detail-link" onClick={() => openPlan(plan, root)}>
      <span><strong>{root === 'Prowadzący' && plans.length === 1 ? event.teacherFullName || plan.name : plan.name}</strong><small>{label}</small></span><ChevronRightIcon size={18} />
    </button>)}</div> : null;
  }
  const groupLinks = links(event.groupPlans, 'Grupy', 'Otwórz plan grupy');
  const teacherLinks = links(event.teacherPlans, 'Prowadzący', 'Otwórz plan prowadzącego');
  const roomLinks = links(event.roomPlans?.filter(p => !/zdaln|online|on-line/i.test(p.name)), 'Sale', 'Otwórz plan sali');
  const multipleRooms = !isRoom && !remote && ((event.roomPlans?.length ?? 0) > 1 || /[,;]/.test(event.room));

  return <Dialog title={title} onClose={onClose} className="event-dialog">
    <div className="event-details">
      <div className="detail-type"><span className="type-dot" style={{ backgroundColor: type.color }} />{event.kind === 'notice' ? 'Informacja do planu' : type.label}</div>
      <div className="detail-datetime"><CalendarIcon size={21} /><div><strong>{new Date(event.start).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong><span><ClockIcon size={17} />{eventTime(event)}</span></div></div>
      {planError && <p className="detail-error" role="alert">{planError}</p>}
      {openingPlan && <p role="status">Otwieranie planu…</p>}
      {notices.length > 0 && <div className="detail-notices">{notices.map((notice, index) => <section className="detail-notice" key={index}>
        <h3><InfoIcon size={18} />{getNoticeLabel([notice])}</h3><p>{notice.text}</p>
        {notice.room && <p>{isRoom ? 'Grupa: ' : 'Sala wskazana w uwadze: '}<button type="button" className="text-button" disabled={openingPlan} onClick={() => void findPlan(notice.room!, isRoom ? 'group' : 'room', isRoom ? 'Grupy' : 'Sale')}>{notice.room}</button></p>}
        {notice.teacher && <p>{isTeacher ? 'Grupa' : 'Dotyczy'}: {notice.teacher}</p>}
      </section>)}</div>}
      {multipleRooms && <div className="multiple-rooms"><InfoIcon size={19} /><p>Plan podaje kilka sal. Sprawdź swoją podgrupę. Lista nie określa przypisania sal do prowadzących.</p></div>}
      {isRoom ? <section className="detail-section"><h3><CalendarIcon size={18} />Grupa</h3>{groupLinks || (event.room ? <button type="button" className="detail-link" disabled={openingPlan} onClick={() => void findPlan(event.room, 'group', 'Grupy')}><span><strong>{event.room}</strong><small>Otwórz plan grupy</small></span><ChevronRightIcon size={18} /></button> : <p>Grupa niepodana</p>)}</section>
        : remote ? <section className="detail-section"><h3><WifiIcon size={18} />Forma zajęć</h3><p className="remote-label">Zdalnie</p></section>
        : <section className="detail-section"><h3><MapPinIcon size={18} />{multipleRooms ? 'Sale wskazane w planie' : 'Sala'}</h3>{roomLinks || (event.room ? <button type="button" className="detail-link" disabled={openingPlan} onClick={() => void findPlan(event.room, 'room', 'Sale')}><span><strong>{event.room}</strong><small>Otwórz plan sali</small></span><ChevronRightIcon size={18} /></button> : <p>Sala niepodana w planie</p>)}</section>}
      {isTeacher ? <section className="detail-section"><h3><CalendarIcon size={18} />Grupa</h3>{groupLinks || (event.teacher ? <button type="button" className="detail-link" disabled={openingPlan} onClick={() => void findPlan(event.teacher, 'group', 'Grupy')}><span><strong>{event.teacher}</strong><small>Otwórz plan grupy</small></span><ChevronRightIcon size={18} /></button> : <p>Grupa niepodana</p>)}</section>
        : (event.teacher || teacherLinks) && <section className="detail-section"><h3><UserIcon size={18} />{(event.teacherPlans?.length ?? 0) > 1 ? 'Prowadzący wskazani w planie' : 'Prowadzący'}</h3>{teacherLinks || (event.teacherId ? <button type="button" className="detail-link" disabled={openingPlan} onClick={() => openPlan({ id: event.teacherId!, scheduleType: '10', name: event.teacherFullName || event.teacher }, 'Prowadzący')}><span><strong>{event.teacherFullName || event.teacher}</strong><small>Otwórz plan prowadzącego</small></span><ChevronRightIcon size={18} /></button> : <p>{event.teacherFullName || event.teacher}</p>)}</section>}
      {event.description && <section className="detail-section"><h3><InfoIcon size={18} />Opis z planu</h3><p className="detail-description">{event.description}</p></section>}
    </div>
  </Dialog>;
}
