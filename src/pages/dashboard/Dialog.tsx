import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Prevent closing via Esc / backdrop (e.g. while a request is in flight). */
  locked?: boolean;
}

/**
 * Accessible modal built on the native <dialog> element (focus containment,
 * top-layer rendering, Esc handling and focus return come from the browser).
 */
export default function Dialog({ open, onClose, title, description, children, footer, size = 'md', locked }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (!locked) onCloseRef.current();
    };
    // Light-dismiss fallback for browsers without `closedby` (Safari): require press + release outside.
    let pressedOutside = false;
    const outside = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    const down = (e: PointerEvent) => { pressedOutside = outside(e); };
    const up = (e: PointerEvent) => {
      if (pressedOutside && outside(e) && !locked) onCloseRef.current();
      pressedOutside = false;
    };
    el.addEventListener('cancel', handleCancel);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('cancel', handleCancel);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
    };
  }, [locked]);

  return (
    <dialog
      ref={ref}
      className={`qf-dialog qf-dialog--${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      {open && (
        <>
          <header className="qf-dialog__header">
            <div>
              <h2 id={titleId} className="qf-dialog__title">{title}</h2>
              {description && <p id={descId} className="qf-dialog__desc">{description}</p>}
            </div>
            <button type="button" className="qf-icon-btn" onClick={() => !locked && onClose()} aria-label="Close">
              <X size={18} />
            </button>
          </header>
          {children && <div className="qf-dialog__body">{children}</div>}
          {footer && <footer className="qf-dialog__footer">{footer}</footer>}
        </>
      )}
    </dialog>
  );
}
