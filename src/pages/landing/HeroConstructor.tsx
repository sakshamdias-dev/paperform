import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FileDown, Check, Sigma, Brain } from 'lucide-react';
import { MathText } from './MathText';

/**
 * Self-playing "paper constructor" animation for the hero.
 * Question chips fly from a mini question bank onto an A4 sheet,
 * marks tally up, and the paper is "exported".
 */

const CHIPS = [
  { tag: 'MCQ', label: "Newton's 2nd law", marks: 1, color: 'blue' },
  { tag: 'Short', label: 'Quadratic roots', marks: 3, color: 'orange' },
  { tag: 'Long', label: 'Kinematics · 2 parts', marks: 5, color: 'ink' },
];

const STEP_MS = 1050;
const TOTAL_STEPS = 11;

function useCountUp(value: number, duration = 600) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(a + (value - a) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

export default function HeroConstructor() {
  const [reduceMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [step, setStep] = useState(() => (reduceMotion ? 8 : 0));
  const stageRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [offsets, setOffsets] = useState<{ dx: number; dy: number }[]>([]);

  // advance timeline (pauses when tab hidden / reduced motion shows the final frame)
  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setStep(s => (s + 1) % TOTAL_STEPS);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [reduceMotion]);

  // measure chip → slot travel distances
  useLayoutEffect(() => {
    const measure = () => {
      setOffsets(CHIPS.map((_, i) => {
        const c = chipRefs.current[i];
        const s = slotRefs.current[i];
        if (!c || !s) return { dx: 0, dy: 0 };
        const cr = c.getBoundingClientRect();
        const sr = s.getBoundingClientRect();
        return { dx: sr.left - cr.left + 8, dy: sr.top - cr.top };
      }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  // step at which each chip launches
  const launch = [3, 4, 6];
  const marks = (step >= 4 ? 1 : 0) + (step >= 5 ? 3 : 0) + (step >= 7 ? 5 : 0);
  const shownMarks = useCountUp(marks);

  const chipState = (i: number) => {
    if (step < launch[i]) return 'idle';
    if (step === launch[i]) return 'flying';
    return 'gone';
  };
  const slotIn = (i: number) => step >= launch[i] + 1;

  return (
    <div className={`hc-stage step-${step}`} ref={stageRef} aria-hidden="true">
      {/* soft grid backdrop */}
      <div className="hc-grid" />

      {/* mini question bank */}
      <div className="hc-bank">
        <div className="hc-bank-head">
          <span className="hc-dot" /> Question bank
        </div>
        {CHIPS.map((c, i) => (
          <div
            key={i}
            ref={el => { chipRefs.current[i] = el; }}
            className={`hc-chip c-${c.color} ${chipState(i)}`}
            style={{ ['--dx' as string]: `${offsets[i]?.dx ?? 0}px`, ['--dy' as string]: `${offsets[i]?.dy ?? 0}px` }}
          >
            <span className="hc-chip-tag">{c.tag}</span>
            <span className="hc-chip-label">{c.label}</span>
            <span className="hc-chip-marks">{c.marks}m</span>
            <svg className="hc-cursor" viewBox="0 0 24 24" width="18" height="18">
              <path d="M4 2l16 9-7 2-3 7z" fill="#0b1b33" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
        ))}
        <div className="hc-chip ghost" />
      </div>

      {/* the paper */}
      <div className={`hc-paper ${step >= 8 ? 'exported' : ''}`}>
        <div className="hc-paper-inner">
          <div className={`hc-head ${step >= 1 ? 'in' : ''}`}>
            <div className="hc-school">Greenfield International School</div>
            <div className="hc-title">Mid-Term Examination</div>
            <div className="hc-meta">
              <span>Grade 10 · Science</span>
              <span>Time: 90 min</span>
              <span>Max. Marks: <b>{shownMarks}</b></span>
            </div>
          </div>

          <div className={`hc-sec ${step >= 2 ? 'in' : ''}`}>Section A — Objective</div>

          <div ref={el => { slotRefs.current[0] = el; }} className={`hc-q ${slotIn(0) ? 'in' : ''}`}>
            <span className="hc-qno">1.</span>
            <div className="hc-qbody">
              Which equation represents Newton’s second law?
              <div className="hc-opts">
                <span>(a) <MathText text="$F = m/a$" /></span>
                <span>(b) <MathText text="$F = ma$" /></span>
                <span>(c) <MathText text="$F = m + a$" /></span>
                <span>(d) <MathText text="$E = mc^2$" /></span>
              </div>
            </div>
            <span className="hc-qm">[1]</span>
          </div>

          <div ref={el => { slotRefs.current[1] = el; }} className={`hc-q ${slotIn(1) ? 'in' : ''}`}>
            <span className="hc-qno">2.</span>
            <div className="hc-qbody">
              Find <MathText text="$k$" /> so that <MathText text="$kx^2 + 4x + 1 = 0$" /> has equal roots.
            </div>
            <span className="hc-qm">[3]</span>
          </div>

          <div className={`hc-sec ${step >= 5 ? 'in' : ''}`}>Section B — Long Answer</div>

          <div ref={el => { slotRefs.current[2] = el; }} className={`hc-q ${slotIn(2) ? 'in' : ''}`}>
            <span className="hc-qno">3.</span>
            <div className="hc-qbody">
              A car accelerates from rest at <MathText text="$2\,\text{m/s}^2$" /> for <MathText text="$5\,\text{s}$" />.
              <div className="hc-subs">
                <span>(i) Find its final velocity. <em>[2]</em></span>
                <span>(ii) Find the distance travelled. <em>[3]</em></span>
              </div>
            </div>
            <span className="hc-qm">[5]</span>
          </div>

          <div className={`hc-end ${step >= 7 ? 'in' : ''}`}>— End of Question Paper —</div>
        </div>

        <div className={`hc-stamp ${step >= 8 && step <= 10 ? 'in' : ''}`}>
          <FileDown size={14} /> PDF ready
        </div>
      </div>

      {/* floating annotations */}
      <div className={`hc-note n1 ${step >= 4 && step <= 9 ? 'in' : ''}`}><Sigma size={13} /> LaTeX rendered</div>
      <div className={`hc-note n2 ${step >= 6 && step <= 9 ? 'in' : ''}`}><Brain size={13} /> Bloom’s: Apply</div>
      <div className={`hc-note n3 ${step >= 7 && step <= 9 ? 'in' : ''}`}><Check size={13} /> Auto-numbered</div>
    </div>
  );
}
