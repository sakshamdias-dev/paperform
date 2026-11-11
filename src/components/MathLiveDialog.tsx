import { useEffect, useRef, useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { MathfieldElement } from 'mathlive';

MathfieldElement.fontsDirectory = '/fonts';
MathfieldElement.soundsDirectory = '/sounds';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'math-field': any;
    }
  }
}

export interface MathLiveDialogProps {
  open: boolean;
  initialLatex?: string;
  onClose: () => void;
  onInsert: (latex: string) => void;
}

export default function MathLiveDialog({ open, initialLatex = '', onClose, onInsert }: MathLiveDialogProps) {
  const [mathKeyboardVisible, setMathKeyboardVisible] = useState(false);
  const mathFieldRef = useRef<any>(null);

  useEffect(() => {
    const kbd = window.mathVirtualKeyboard;
    if (!kbd) return;
    const handler = () => {
      setMathKeyboardVisible(kbd.visible);
    };
    kbd.addEventListener('geometrychange', handler);
    return () => kbd.removeEventListener('geometrychange', handler);
  }, []);

  useEffect(() => {
    if (open) {
      const kbd = window.mathVirtualKeyboard;
      if (kbd) {
        const activeDialog = document.querySelector('dialog[open]') as HTMLElement | null;
        if (activeDialog) {
          kbd.container = activeDialog;
        } else {
          kbd.container = document.body;
        }
      }
      setTimeout(() => {
        if (mathFieldRef.current) {
          mathFieldRef.current.value = initialLatex || '';
          mathFieldRef.current.focus();
        }
      }, 100);
    } else {
      if (window.mathVirtualKeyboard) {
        window.mathVirtualKeyboard.hide();
        window.mathVirtualKeyboard.container = document.body;
      }
    }
  }, [open, initialLatex]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay math-dialog-overlay"
      style={{
        zIndex: 15000,
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...(mathKeyboardVisible ? { alignItems: 'flex-start', paddingTop: '8vh' } : {})
      }}
      onClick={onClose}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 700,
          width: '90%',
          backgroundColor: 'var(--bg-primary, #ffffff)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          zIndex: 15001,
          overflow: 'hidden'
        }}
      >
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
          <h2 className="modal-title" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Insert Math Formula</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary qf-btn qf-btn--secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px' }}
              onClick={(e) => {
                e.stopPropagation();
                if (window.mathVirtualKeyboard) {
                  if (window.mathVirtualKeyboard.visible) {
                    window.mathVirtualKeyboard.hide();
                  } else {
                    window.mathVirtualKeyboard.show();
                  }
                }
              }}
              title="Toggle Virtual Keyboard"
            >
              <Keyboard size={14} /> {mathKeyboardVisible ? 'Hide Keyboard' : 'Keyboard'}
            </button>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              title="Close"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text-secondary, #64748b)' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="modal-content" style={{ padding: '20px' }}>
          <div className="property-field" style={{ marginBottom: 0 }}>
            <label className="property-label" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary, #0f172a)' }}>
              Visual Editor (MathLive)
            </label>
            <math-field
              ref={mathFieldRef}
              math-virtual-keyboard-policy="manual"
              style={{
                fontSize: '24px',
                padding: '12px',
                border: '1px solid var(--border, #cbd5e1)',
                borderRadius: '8px',
                width: '100%',
                backgroundColor: 'white',
                color: 'black',
                minHeight: '80px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <p style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 8, marginBottom: 0 }}>
              Click inside the field to type or use the virtual keyboard. You can also paste LaTeX.
            </p>
          </div>
        </div>
        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid var(--border-color, #e2e8f0)', backgroundColor: 'var(--bg-secondary, #f8fafc)' }}>
          <button
            type="button"
            className="btn btn-secondary qf-btn qf-btn--secondary"
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary qf-btn qf-btn--primary"
            onClick={() => {
              const val = mathFieldRef.current?.value || '';
              onInsert(val);
              onClose();
            }}
            style={{ padding: '8px 16px', fontSize: 13, backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
          >
            Insert Formula
          </button>
        </div>
      </div>
    </div>
  );
}
