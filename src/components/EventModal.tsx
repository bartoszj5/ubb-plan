import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ScheduleEvent } from '../types';
import { XIcon, ClockIcon, UserIcon, MapPinIcon, InfoIcon, WifiIcon } from './Icons';
import './EventModal.css';

interface EventModalProps {
  event: ScheduleEvent;
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  'wyk': '#6366F1',
  'wykład': '#6366F1',
  'ćw': '#F59E0B',
  'ćwiczenia': '#F59E0B',
  'lab': '#10B981',
  'laboratorium': '#10B981',
  'sem': '#EC4899',
  'seminarium': '#EC4899',
  'lek': '#8B5CF6',
  'lektorat': '#8B5CF6',
  'proj': '#F97316',
  'projekt': '#F97316',
  'konw': '#06B6D4',
  'konwersatorium': '#06B6D4',
};

function getTypeColor(type: string): string {
  const normalized = type.toLowerCase().trim();
  if (TYPE_COLORS[normalized]) return TYPE_COLORS[normalized];
  for (const [key, color] of Object.entries(TYPE_COLORS)) {
    if (normalized.includes(key) || key.includes(normalized)) return color;
  }
  return '#6366F1';
}

export default function EventModal({ event, onClose }: EventModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
  const typeColor = getTypeColor(event.type);
  const isRemote = !event.room && ((event.description || '').toLowerCase().includes('zdaln') || (event.location || '').toLowerCase().includes('zdaln'));

  return createPortal(
    <div className="event-modal-overlay" ref={overlayRef} onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label={event.subject}>
      <div className="event-modal" style={{ '--modal-accent-color': typeColor } as React.CSSProperties}>
        <div className="event-modal-accent" />
        <div className="event-modal-header">
          <div>
            <h3>{event.subjectFullName || event.subject}</h3>
            {event.subjectFullName && (
              <div className="event-modal-abbr">{event.subject}</div>
            )}
            {event.type && (
              <div
                className="event-modal-type-badge"
                style={{
                  background: `color-mix(in srgb, ${typeColor} 15%, transparent)`,
                  color: typeColor,
                }}
              >
                {event.type}
              </div>
            )}
          </div>
          <button ref={closeRef} className="event-modal-close" onClick={onClose} aria-label="Zamknij">
            <XIcon size={18} />
          </button>
        </div>
        <div className="event-modal-body">
          <div className="event-modal-row">
            <ClockIcon size={16} />
            <div>
              <div className="event-modal-label">Czas</div>
              <div className="event-modal-value mono">{fmt(start)} – {fmt(end)}</div>
            </div>
          </div>
          {event.teacher && (
            <div className="event-modal-row">
              <UserIcon size={16} />
              <div>
                <div className="event-modal-label">Prowadzący</div>
                <div className="event-modal-value">{event.teacherFullName || event.teacher}</div>
              </div>
            </div>
          )}
          {event.room ? (
            <div className="event-modal-row">
              <MapPinIcon size={16} />
              <div>
                <div className="event-modal-label">Sala</div>
                <div className="event-modal-value mono">{event.room}</div>
              </div>
            </div>
          ) : isRemote ? (
            <div className="event-modal-row">
              <WifiIcon size={16} />
              <div>
                <div className="event-modal-label">Forma</div>
                <div className="event-modal-value">Nauczanie zdalne</div>
              </div>
            </div>
          ) : null}
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
