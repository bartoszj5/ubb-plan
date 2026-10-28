import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './Icons';

interface DialogProps { title: string; children: ReactNode; onClose: () => void; className?: string }
export default function Dialog({ title, children, onClose, className = '' }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById('root');
    const wasInert = root?.inert ?? false;
    const previousOverflow = document.body.style.overflow;
    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      const target = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLElement>('input, button');
      target?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      if (root) root.inert = wasInert;
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div className={`dialog-overlay ${className}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="dialog-panel" role="dialog" aria-modal="true" aria-label={title}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === 'Escape') { e.preventDefault(); close.current(); }
          if (e.key !== 'Tab') return;
          const controls = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') ?? [])]
            .filter(el => el.getClientRects().length > 0);
          if (!controls.length) return;
          const first = controls[0], last = controls[controls.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }}>
        <div className="dialog-heading"><h2>{title}</h2><button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Zamknij"><XIcon size={20} /></button></div>
        {children}
      </div>
    </div>, document.body,
  );
}
