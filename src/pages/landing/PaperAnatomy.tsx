import { useEffect, useRef, useState } from 'react';

interface LayerInfo {
  name: string;
  desc: string;
  color: 'ink' | 'blue' | 'indigo' | 'emerald' | 'orange';
  threshold: number;
  scrollTarget: number;
}

const LAYERS: LayerInfo[] = [
  {
    name: 'Header & metadata',
    desc: 'Institution banner, exam title, class, duration & live total marks',
    color: 'ink',
    threshold: 0,
    scrollTarget: 0.16,
  },
  {
    name: 'Sections & rules',
    desc: 'Group into Part A, B, C by question type, difficulty or chapter',
    color: 'blue',
    threshold: 0.22,
    scrollTarget: 0.32,
  },
  {
    name: 'Primary questions',
    desc: 'MCQs, stems and equations pulled straight from your bank',
    color: 'indigo',
    threshold: 0.4,
    scrollTarget: 0.5,
  },
  {
    name: 'Nested sub-questions',
    desc: 'Multi-level parts (i), (ii) and (a), (b) with tree hierarchy',
    color: 'emerald',
    threshold: 0.58,
    scrollTarget: 0.68,
  },
  {
    name: 'Marks & numbering',
    desc: 'Sub-part marks roll up to questions, sections and header total',
    color: 'orange',
    threshold: 0.76,
    scrollTarget: 0.88,
  },
];

export default function PaperAnatomy() {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const el = sectionRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height - vh;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      el.style.setProperty('--p', p.toFixed(4));
      setProgress(p);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Determine the highest landed layer from scroll progress
  let activeFromScroll = 0;
  for (let i = 0; i < LAYERS.length; i++) {
    if (progress >= LAYERS[i].threshold) activeFromScroll = i;
  }

  const focusedLayer = hovered !== null ? hovered : activeFromScroll;
  const isExploded = progress >= 0.06 || hovered !== null;

  // Clicking a layer item smoothly scrolls to that layer's reveal point
  const jumpToLayer = (idx: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const vh = window.innerHeight;
    const total = el.offsetHeight - vh;
    const top = window.scrollY + el.getBoundingClientRect().top + total * LAYERS[idx].scrollTarget;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  const landed = (idx: number) => progress >= LAYERS[idx].threshold || (hovered !== null && idx <= hovered);

  return (
    <section className="lp-anatomy" id="anatomy" ref={sectionRef}>
      <div className="lp-anatomy-sticky">
        <div className="lp-container lp-anatomy-inner">
          <div className="lp-anatomy-copy">
            <div className="lp-kicker">Anatomy of a paper</div>
            <h2 className="lp-h2">
              Every paper is a <em>structure</em>, not a document.
            </h2>
            <p className="lp-sub">
              Word processors treat your exam as one long block of text. QuestForma separates it into five clean
              layers, so sections, nested sub-questions and marks always land in place.
            </p>
            <ol className="lp-layer-list">
              {LAYERS.map((l, i) => {
                const isOn = landed(i);
                const isFocus = focusedLayer === i;
                return (
                  <li
                    key={l.name}
                    style={{ ['--i' as string]: i }}
                    className={`c-${l.color} ${isOn ? 'is-on' : ''} ${isFocus ? 'is-focus' : ''}`}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => jumpToLayer(i)}
                  >
                    <span className="lp-layer-idx">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <b>{l.name}</b>
                      <span>{l.desc}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="lp-explode" aria-hidden="true">
            <div className={`lp-explode-scene ${isExploded ? 'is-exploded' : ''} ${hovered !== null ? 'has-hover' : ''}`}>
              {/* ── SHEET 0: HEADER & METADATA ── */}
              <div
                className={`lp-sheet ly-0 ${landed(0) ? 'is-landed' : ''} ${focusedLayer === 0 ? 'is-focus' : ''}`}
                style={{ ['--i' as string]: 0 }}
                onMouseEnter={() => setHovered(0)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="lp-sheet-label">01 · Header &amp; metadata</span>
                <div className="sk-header">
                  <div className="ln w55 bold" />
                  <div className="ln w35" />
                  <div className="ln-row">
                    <i />
                    <i />
                    <i className="accent" />
                  </div>
                </div>
                <div className="sk-watermark" />
              </div>

              {/* ── SHEET 1: SECTIONS & RULES ── */}
              <div
                className={`lp-sheet ly-1 ${landed(1) ? 'is-landed' : ''} ${focusedLayer === 1 ? 'is-focus' : ''}`}
                style={{ ['--i' as string]: 1 }}
                onMouseEnter={() => setHovered(1)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="lp-sheet-label">02 · Sections &amp; rules</span>
                <div className="sk-sec" style={{ top: '22%', height: '21%' }}>
                  <div className="sk-sec-bar">
                    <span>Section A · Objective</span>
                    <i />
                  </div>
                </div>
                <div className="sk-sec s2" style={{ top: '46%', height: '47%' }}>
                  <div className="sk-sec-bar">
                    <span>Section B · Structured</span>
                    <i />
                  </div>
                </div>
              </div>

              {/* ── SHEET 2: PRIMARY QUESTIONS ── */}
              <div
                className={`lp-sheet ly-2 ${landed(2) ? 'is-landed' : ''} ${focusedLayer === 2 ? 'is-focus' : ''}`}
                style={{ ['--i' as string]: 2 }}
                onMouseEnter={() => setHovered(2)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="lp-sheet-label">03 · Primary questions</span>

                {/* Q1 with MCQ 2x2 skeleton */}
                <div className="sk-q q1" style={{ top: '29%' }}>
                  <b>1.</b>
                  <div className="sk-q-body">
                    <span className="sk-line w85" />
                    <div className="sk-mcq">
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                </div>

                {/* Q2 */}
                <div className="sk-q q2" style={{ top: '39.5%' }}>
                  <b>2.</b>
                  <div className="sk-q-body">
                    <span className="sk-line w72" />
                  </div>
                </div>

                {/* Q3 (parent of sub-questions) */}
                <div className="sk-q q3" style={{ top: '53%' }}>
                  <b>3.</b>
                  <div className="sk-q-body">
                    <span className="sk-line w88" />
                  </div>
                </div>

                {/* Q4 (parent of nested multi-level sub-questions) */}
                <div className="sk-q q4" style={{ top: '71%' }}>
                  <b>4.</b>
                  <div className="sk-q-body">
                    <span className="sk-line w80" />
                  </div>
                </div>
              </div>

              {/* ── SHEET 3: NESTED SUB-QUESTIONS ── */}
              <div
                className={`lp-sheet ly-3 ${landed(3) ? 'is-landed' : ''} ${focusedLayer === 3 ? 'is-focus' : ''}`}
                style={{ ['--i' as string]: 3 }}
                onMouseEnter={() => setHovered(3)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="lp-sheet-label">04 · Nested sub-questions</span>

                {/* Sub-questions under Q3 */}
                <div className="sk-subtree g1" style={{ top: '58%' }}>
                  <div className="sk-subrow s1">
                    <span className="sk-branch" />
                    <em>(i)</em>
                    <span className="sk-subline w76" />
                  </div>
                  <div className="sk-subrow s2">
                    <span className="sk-branch" />
                    <em>(ii)</em>
                    <span className="sk-subline w62" />
                  </div>
                </div>

                {/* Multi-level sub-questions under Q4: (i), (ii) -> (a), (b) */}
                <div className="sk-subtree g2" style={{ top: '76%' }}>
                  <div className="sk-subrow s3">
                    <span className="sk-branch" />
                    <em>(i)</em>
                    <span className="sk-subline w70" />
                  </div>
                  <div className="sk-subrow s4">
                    <span className="sk-branch" />
                    <em>(ii)</em>
                    <span className="sk-subline w60" />
                  </div>
                  <div className="sk-sub2tree">
                    <div className="sk-sub2row s5">
                      <span className="sk-branch" />
                      <em>(a)</em>
                      <span className="sk-subline w68" />
                    </div>
                    <div className="sk-sub2row s6">
                      <span className="sk-branch" />
                      <em>(b)</em>
                      <span className="sk-subline w54" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SHEET 4: MARKS & NUMBERING ── */}
              <div
                className={`lp-sheet ly-4 ${landed(4) ? 'is-landed' : ''} ${focusedLayer === 4 ? 'is-focus' : ''}`}
                style={{ ['--i' as string]: 4 }}
                onMouseEnter={() => setHovered(4)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="lp-sheet-label">05 · Marks &amp; numbering</span>

                <div className="sk-margin-guide" />
                <div className="mk total">Σ 15</div>

                {/* Section A subtotal + Q1, Q2 marks */}
                <div className="mk sec" style={{ top: '23%' }}>2m</div>
                <div className="mk m1" style={{ top: '29%' }}>[1]</div>
                <div className="mk m2" style={{ top: '39.5%' }}>[1]</div>

                {/* Section B subtotal + Q3 roll-up */}
                <div className="mk sec" style={{ top: '47%' }}>13m</div>
                <div className="mk parent m3" style={{ top: '53%' }}>[5]</div>
                <div className="mk sub m4" style={{ top: '58%' }}>[2]</div>
                <div className="mk sub m5" style={{ top: '62.5%' }}>[3]</div>

                {/* Q4 roll-up */}
                <div className="mk parent m6" style={{ top: '71%' }}>[8]</div>
                <div className="mk sub m7" style={{ top: '76%' }}>[2]</div>
                <div className="mk sub2 m8" style={{ top: '85%' }}>[3]</div>
                <div className="mk sub2 m9" style={{ top: '89.5%' }}>[3]</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
