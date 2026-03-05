import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ScheduleEvent } from '../types';
import { XIcon, ClockIcon, UserIcon, MapPinIcon, BookOpenIcon, InfoIcon } from './Icons';
import './EventModal.css';

interface EventModalProps {
  event: ScheduleEvent;
  onClose: () => void;
}

export default function EventModal({ event, onClose }: EventModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Basic focus trap
      if (e.key === 'Tab') {
        const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const start = new Date(event.start);
  const end = new Date(event.end);
  const fmt = (d: Date) =>
    `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  const dateStr = start.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return createPortal(
    <div className="event-modal-overlay" ref={overlayRef} onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label={event.subject}>
      <div className="event-modal">
        <div className="event-modal-header">
          <h3>{event.subject}</h3>
          <button ref={closeRef} className="event-modal-close" onClick={onClose} aria-label="Zamknij">
            <XIcon size={20} />
          </button>
        </div>
        <div className="event-modal-body">
          <div className="event-modal-row">
            <ClockIcon size={16} />
            <div>
              <div className="event-modal-label">Czas</div>
              <div className="event-modal-value">{fmt(start)} - {fmt(end)}</div>
              <div className="event-modal-sub">{dateStr}</div>
            </div>
          </div>
          {event.type && (
            <div className="event-modal-row">
              <BookOpenIcon size={16} />
              <div>
                <div className="event-modal-label">Typ zajęć</div>
                <div className="event-modal-value">{event.type}</div>
              </div>
            </div>
          )}
          {event.teacher && (
            <div className="event-modal-row">
              <UserIcon size={16} />
              <div>
                <div className="event-modal-label">Prowadzący</div>
                <div className="event-modal-value">{event.teacher}</div>
              </div>
            </div>
          )}
          {event.room && (
            <div className="event-modal-row">
              <MapPinIcon size={16} />
              <div>
                <div className="event-modal-label">Sala</div>
                <div className="event-modal-value">{event.room}</div>
              </div>
            </div>
          )}
          {event.description && (
            <div className="event-modal-row">
              <InfoIcon size={16} />
              <div>
                <div className="event-modal-label">Opis</div>
                <div className="event-modal-value event-modal-desc">{event.description}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
