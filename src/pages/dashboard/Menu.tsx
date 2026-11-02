import { useEffect, useRef, useState, type ReactNode } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export function useClickOutside<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

interface MenuProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: (MenuItem | 'divider')[];
  align?: 'start' | 'end';
  placement?: 'bottom' | 'top';
  header?: ReactNode;
}

export default function Menu({ trigger, items, align = 'end', placement = 'bottom', header }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));

  return (
    <div className="qf-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={`qf-menu__panel qf-menu__panel--${align} qf-menu__panel--${placement}`} role="menu">
          {header}
          {items.map((item, i) =>
            item === 'divider' ? (
              <div key={`d${i}`} className="qf-menu__divider" role="separator" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`qf-menu__item ${item.danger ? 'is-danger' : ''}`}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

