import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Play, Layers, Sigma, Users, CalendarClock, ShieldCheck, Move,
  Library, LayoutTemplate, PenLine, FileDown, ChevronDown, Check,
} from 'lucide-react';
import { useStore } from '../../store';
import { isGuestUser } from '../../utils/guestWorkspace';
import HeroConstructor from './HeroConstructor';
import PaperAnatomy from './PaperAnatomy';
import Playground from './Playground';
import { MathText } from './MathText';
import './landing.css';

/* ───────────────────────── hooks ───────────────────────── */

/** Adds `.is-in` to every [data-reveal] element as it scrolls into view. */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.lp [data-reveal]'));
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }),
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ───────────────────────── small pieces ───────────────────────── */

const MARQUEE = [
  'Multiple choice', 'True / False', 'Fill in the blanks', 'Match the following', 'Long answer',
  'Nested sub-questions', 'LaTeX equations', 'Images & diagrams', 'Bloom’s taxonomy', 'Section-wise marks',
  'Auto-numbering', 'Print-ready PDF',
];

const STEPS = [
  {
    icon: Library, kicker: '01 — Collect',
    title: 'One question bank, perfectly classified.',
    body: 'Save questions once and tag them by course, subject, chapter, topic, difficulty and Bloom’s level. Find the right one in seconds.',
  },
  {
    icon: LayoutTemplate, kicker: '02 — Construct',
    title: 'Drag questions straight onto the page.',
    body: 'Sections, numbering and section totals update as you go. Rearrange anything — the paper keeps its layout.',
  },
  {
    icon: PenLine, kicker: '03 — Refine',
    title: 'Math and science look the way they should.',
    body: 'Type equations visually or in LaTeX. Fractions, matrices, integrals and chemical formulas print sharply every time.',
  },
  {
    icon: FileDown, kicker: '04 — Export',
    title: 'Print-ready in one click.',
    body: 'Download a clean, consistent A4 PDF, ready for the printer or the exam hall. No fiddling with margins or tab stops.',
  },
];

const FAQ = [
  { q: 'Who is QuestForma for?', a: 'Teachers, heads of department and exam cells at schools, coaching institutes and colleges who set papers regularly and want them consistent, fast and print-ready.' },
  { q: 'Do I need to install anything?', a: 'No. QuestForma runs in your browser. Sign up, and you can start building your first paper straight away.' },
  { q: 'Can I write mathematical and scientific notation?', a: 'Yes. QuestForma has a built-in visual equation editor with full LaTeX support, so fractions, matrices, integrals and chemical formulas all render properly.' },
  { q: 'Can colleagues share questions with me?', a: 'Yes. With a shared question bank, teachers can reuse each other’s questions. If you’d rather keep yours to yourself, turn on private mode.' },
  { q: 'Is the demo on this page the real editor?', a: 'It’s a simplified sandbox of the paper constructor, with sample questions. Your account gives you the full editor, your own bank, scheduling and more.' },
];

function MathTyper({ active }: { active: boolean }) {
  const src = '\\int_0^2 (x^3 - 6x^2 + 9x)\\,dx';
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= src.length) clearInterval(id);
    }, 45);
    return () => {
      clearInterval(id);
      setN(0);
    };
  }, [active]);
  const done = active && n >= src.length;
  return (
    <div className="mt-wrap">
      <div className="mt-src"><span className="mt-prompt">LaTeX</span><code>{src.slice(0, n)}<i className="mt-caret" /></code></div>
      <div className={`mt-out ${done ? 'in' : ''}`}><MathText text={`$${src}$`} /></div>
      <div className={`mt-chips ${done ? 'in' : ''}`}>
        <span><MathText text="$\frac{a}{b}$" /></span>
        <span><MathText text="$\sqrt{x}$" /></span>
        <span><MathText text="$\sum$" /></span>
        <span><MathText text="$\mathrm{H_2O}$" /></span>
        <span><MathText text="$\vec{F}$" /></span>
      </div>
    </div>
  );
}

function StepVisual({ index, active }: { index: number; active: boolean }) {
  if (index === 0) {
    return (
      <div className={`sv sv-bank ${active ? 'on' : ''}`}>
        <div className="sv-filters">
          <span className="f on">Physics</span><span className="f">Chapter: Kinematics</span><span className="f on">Apply</span><span className="f">Medium</span>
        </div>
        {['A car accelerates uniformly from rest…', 'Derive v = u + at from first principles.', 'A ball is thrown vertically upward with…', 'Plot the velocity–time graph for…'].map((t, i) => (
          <div key={i} className="sv-card" style={{ ['--i' as string]: i }}>
            <span className="sv-bar" />
            <div>
              <div className="sv-t">{t}</div>
              <div className="sv-tags"><i>Kinematics</i><i>Apply</i><i>{[5, 3, 4, 2][i]} marks</i></div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className={`sv sv-build ${active ? 'on' : ''}`}>
        <div className="sv-page">
          <div className="sv-line w60" /><div className="sv-line w40 thin" />
          <div className="sv-secname">Section A</div>
          <div className="sv-slot s1"><b>1.</b><span /><em>[1]</em></div>
          <div className="sv-slot s2"><b>2.</b><span /><em>[1]</em></div>
          <div className="sv-secname">Section B</div>
          <div className="sv-slot s3"><b>3.</b><span /><em>[3]</em></div>
          <div className="sv-slot s4 drop"><b>4.</b><span /><em>[5]</em></div>
        </div>
        <div className="sv-dragcard"><Move size={12} /> Long answer · 5m
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 2l16 9-7 2-3 7z" fill="#0b1b33" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        </div>
      </div>
    );
  }
  if (index === 2) {
    return <div className={`sv sv-math ${active ? 'on' : ''}`}><MathTyper active={active} /></div>;
  }
  return (
    <div className={`sv sv-export ${active ? 'on' : ''}`}>
      <div className="sv-sheets">
        {[0, 1, 2].map(i => (
          <div key={i} className="sv-sheet" style={{ ['--i' as string]: i }}>
            <div className="sv-line w60" /><div className="sv-line w40 thin" />
            {[0, 1, 2, 3, 4].map(k => <div key={k} className="sv-line" style={{ width: `${88 - ((k * 13 + i * 7) % 30)}%` }} />)}
          </div>
        ))}
      </div>
      <div className="sv-download">
        <FileDown size={16} />
        <div className="sv-dl-text"><b>Mid-Term_Grade10.pdf</b><span>A4 · 3 pages</span></div>
        <div className="sv-dl-bar"><i /></div>
        <span className="sv-dl-ok"><Check size={14} /></span>
      </div>
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function Landing() {
  const navigate = useNavigate();
  const user = useStore(s => s.user);
  const enterGuestMode = useStore(s => s.enterGuestMode);
  const [playOpen, setPlayOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useReveal();

  useEffect(() => {
    document.title = 'QuestForma — Build question papers, beautifully';
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) setActiveStep(Number((e.target as HTMLElement).dataset.step));
      }),
      { rootMargin: '-45% 0px -45% 0px' }
    );
    stepRefs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const isSignedInReal = Boolean(user?.id && !isGuestUser(user));
  const primaryLabel = isSignedInReal ? 'Open dashboard' : 'Create paper';

  const handleCreatePaper = () => {
    if (!user?.id) enterGuestMode();
    navigate('/dashboard');
  };

  return (
    <div className="lp">
      {/* ───────── nav ───────── */}
      <nav className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="lp-container lp-nav-inner">
          <a href="#top" className="lp-brand">
            <img src="/questforma-q.svg" alt="" />
            <span>QuestForma</span>
          </a>
          <div className="lp-nav-links">
            <a href="#anatomy">Product</a>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="lp-nav-cta">
            <button type="button" className="lp-link" onClick={() => setPlayOpen(true)}>Try the demo</button>
            <button type="button" className="lp-btn sm dark" onClick={handleCreatePaper}>{primaryLabel}</button>
          </div>
        </div>
      </nav>

      {/* ───────── hero ───────── */}
      <header className="lp-hero" id="top">
        <div className="lp-container lp-hero-inner">
          <div className="lp-hero-copy">
            <h1 className="lp-h1" data-reveal>
              Build exam papers<br />
              <em>like an architect,</em><br />
              not a typist.
            </h1>
            <p className="lp-lead" data-reveal>
              QuestForma turns your question bank into polished, print-ready papers. Drag questions in and the
              structure, numbering, marks and math formatting take care of themselves.
            </p>
            <div className="lp-hero-ctas" data-reveal>
              <button type="button" className="lp-btn dark lg" onClick={handleCreatePaper}>
                {primaryLabel} <ArrowRight size={16} />
              </button>
              <button type="button" className="lp-btn outline lg" onClick={() => setPlayOpen(true)}>
                <Play size={16} fill="currentColor" /> Try the live demo
              </button>
            </div>
            <ul className="lp-hero-proof" data-reveal>
              <li><Check size={14} /> Runs in your browser</li>
              <li><Check size={14} /> LaTeX-grade math</li>
              <li><Check size={14} /> One-click PDF</li>
            </ul>
          </div>
          <div className="lp-hero-visual" data-reveal>
            <HeroConstructor />
          </div>
        </div>
      </header>

      {/* ───────── marquee ───────── */}
      <section className="lp-marquee" aria-label="Supported content">
        <div className="lp-marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} className="lp-marquee-item">{m}<i>✦</i></span>
          ))}
        </div>
      </section>

      {/* ───────── anatomy (animated paper layers + sub-questions) ───────── */}
      <PaperAnatomy />

      {/* ───────── how it works ───────── */}
      <section className="lp-how" id="how">
        <div className="lp-container">
          <div className="lp-section-head" data-reveal>
            <div className="lp-kicker">How it works</div>
            <h2 className="lp-h2">From blank page to <em>printed paper</em> in four steps.</h2>
          </div>

          <div className="lp-how-grid">
            <div className="lp-how-steps">
              {STEPS.map((s, i) => (
                <div
                  key={s.kicker}
                  ref={el => { stepRefs.current[i] = el; }}
                  data-step={i}
                  className={`lp-step ${activeStep === i ? 'active' : ''}`}
                >
                  <div className="lp-step-icon"><s.icon size={18} /></div>
                  <div className="lp-step-kicker">{s.kicker}</div>
                  <h3 className="lp-h3">{s.title}</h3>
                  <p>{s.body}</p>
                  <div className="lp-step-mobile-visual"><StepVisual index={i} active /></div>
                </div>
              ))}
            </div>
            <div className="lp-how-visual">
              <div className="lp-how-frame">
                <div className="lp-frame-bar"><i /><i /><i /><span>questforma.app</span></div>
                <div className="lp-frame-body">
                  {STEPS.map((_, i) => (
                    <div key={i} className={`lp-frame-layer ${activeStep === i ? 'on' : ''}`}>
                      <StepVisual index={i} active={activeStep === i} />
                    </div>
                  ))}
                </div>
                <div className="lp-frame-progress">
                  {STEPS.map((_, i) => <span key={i} className={i <= activeStep ? 'on' : ''} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── playground CTA ───────── */}
      <section className="lp-play" id="playground">
        <div className="lp-container">
          <div className="lp-play-card" data-reveal>
            <div className="lp-play-copy">
              <div className="lp-kicker">Interactive playground</div>
              <h2 className="lp-h2">Don’t take our word for it. <em>Build a paper.</em></h2>
              <p className="lp-sub">
                Open the sandbox and put together a real paper from a sample bank of Maths, Physics, Chemistry and
                Biology questions. Drag, reorder, adjust marks, auto-build to a target, then export a PDF.
              </p>
              <div className="lp-play-points">
                <span><Move size={14} /> Drag &amp; drop</span>
                <span><Sigma size={14} /> Live LaTeX</span>
                <span><Layers size={14} /> Live blueprint</span>
                <span><FileDown size={14} /> Real PDF export</span>
              </div>
              <button className="lp-btn dark lg" onClick={() => setPlayOpen(true)}>
                Open the playground <ArrowUpRight size={16} />
              </button>
              <div className="lp-play-note">No sign-up needed · Takes about 60 seconds</div>
            </div>

            <button className="lp-play-preview" onClick={() => setPlayOpen(true)} aria-label="Open the playground">
              <div className="pv-col pv-bank">
                {[0, 1, 2, 3, 4].map(i => <div key={i} className="pv-card" style={{ ['--i' as string]: i }}><i /><span /><span className="short" /></div>)}
              </div>
              <div className="pv-col pv-paper">
                <div className="pv-l w60 c" /><div className="pv-l w40 c thin" />
                <div className="pv-hr" />
                {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="pv-q" style={{ ['--i' as string]: i }}><b /><span /></div>)}
              </div>
              <div className="pv-col pv-bp">
                <div className="pv-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" /><circle className="arc" cx="18" cy="18" r="15.5" /></svg><b>30</b></div>
                {[70, 45, 85, 30].map((w, i) => <div key={i} className="pv-bar"><i style={{ width: `${w}%` }} /></div>)}
              </div>
              <span className="pv-play"><Play size={18} fill="currentColor" /></span>
            </button>
          </div>
        </div>
      </section>

      {/* ───────── features bento ───────── */}
      <section className="lp-features" id="features">
        <div className="lp-container">
          <div className="lp-section-head" data-reveal>
            <div className="lp-kicker">Features</div>
            <h2 className="lp-h2">Everything an exam cell needs. <em>Nothing it doesn’t.</em></h2>
          </div>

          <div className="lp-bento">
            <article className="lp-tile span-2" data-reveal>
              <div className="lp-tile-icon"><Library size={18} /></div>
              <h3 className="lp-h3">A question bank that organises itself</h3>
              <p>Classify by course, subject, class, chapter, topic, category and cognitive level. Filter in a click, reuse for years.</p>
              <div className="ft-tags">
                {['Grade 10', 'Physics', 'Kinematics', 'Numerical', 'Apply', 'Medium', 'Board pattern', 'Grade 12', 'Calculus', 'Analyse', 'Optics', 'Create'].map((t, i) => (
                  <span key={t} style={{ ['--i' as string]: i }}>{t}</span>
                ))}
              </div>
            </article>

            <article className="lp-tile" data-reveal>
              <div className="lp-tile-icon"><Sigma size={18} /></div>
              <h3 className="lp-h3">Native math editor</h3>
              <p>Visual equation input with full LaTeX underneath.</p>
              <div className="ft-math">
                <MathText text="$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$" />
              </div>
            </article>

            <article className="lp-tile" data-reveal>
              <div className="lp-tile-icon"><Users size={18} /></div>
              <h3 className="lp-h3">Shared question bank</h3>
              <p>Reuse colleagues’ questions across your institution, or keep yours private.</p>
              <div className="ft-net">
                {[0, 1, 2, 3, 4].map(i => <span key={i} className={`n n${i}`}>{['AK', 'RS', 'MJ', 'PT', 'You'][i]}</span>)}
                <svg viewBox="0 0 200 110" preserveAspectRatio="none">
                  <path d="M100 55 L30 25 M100 55 L170 25 M100 55 L35 90 M100 55 L165 90" />
                </svg>
              </div>
            </article>

            <article className="lp-tile" data-reveal>
              <div className="lp-tile-icon"><CalendarClock size={18} /></div>
              <h3 className="lp-h3">Schedule &amp; notifications</h3>
              <p>Plan exam dates and keep every paper on track.</p>
              <div className="ft-cal">
                {Array.from({ length: 21 }).map((_, i) => (
                  <i key={i} className={[4, 9, 16].includes(i) ? 'ev' : i === 11 ? 'today' : ''} />
                ))}
              </div>
            </article>

            <article className="lp-tile" data-reveal>
              <div className="lp-tile-icon"><ShieldCheck size={18} /></div>
              <h3 className="lp-h3">Private by default, when you want it</h3>
              <p>One switch decides whether your questions are shared.</p>
              <div className="ft-toggle"><span>Keep my questions private</span><i /></div>
            </article>

            <article className="lp-tile span-2 ft-bloom-tile" data-reveal>
              <div>
                <div className="lp-tile-icon"><Layers size={18} /></div>
                <h3 className="lp-h3">Balanced papers with Bloom’s taxonomy</h3>
                <p>Tag every question with a cognitive level and see at a glance whether your paper tests recall or reasoning.</p>
              </div>
              <div className="ft-bloom">
                {[['Remember', 55], ['Understand', 80], ['Apply', 100], ['Analyse', 62], ['Evaluate', 40], ['Create', 28]].map(([l, v], i) => (
                  <div key={l as string} className="ft-bloom-col" style={{ ['--h' as string]: `${v}%`, ['--i' as string]: i }}>
                    <i /><span>{l}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ───────── numbers ───────── */}
      <section className="lp-numbers">
        <div className="lp-container lp-numbers-grid">
          {[
            ['6', 'Question types', 'MCQ to match-the-following'],
            ['6', 'Bloom’s levels', 'From remember to create'],
            ['1', 'Click to PDF', 'Clean, print-ready A4'],
            ['0', 'Formatting fights', 'Layout handled for you'],
          ].map(([n, l, d]) => (
            <div key={l} className="lp-number" data-reveal>
              <div className="lp-number-n">{n}</div>
              <div className="lp-number-l">{l}</div>
              <div className="lp-number-d">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section className="lp-faq" id="faq">
        <div className="lp-container lp-faq-grid">
          <div data-reveal>
            <div className="lp-kicker">FAQ</div>
            <h2 className="lp-h2">Questions, <em>answered.</em></h2>
            <p className="lp-sub">Have another question? Try the playground. It’s the quickest way to see what QuestForma does.</p>
          </div>
          <div className="lp-faq-list" data-reveal>
            {FAQ.map((f, i) => (
              <div key={f.q} className={`lp-faq-item ${openFaq === i ? 'open' : ''}`}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                  <span>{f.q}</span><ChevronDown size={18} />
                </button>
                <div className="lp-faq-a"><div><p>{f.a}</p></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── final CTA ───────── */}
      <section className="lp-final">
        <div className="lp-container">
          <div className="lp-final-card" data-reveal>
            <div className="lp-final-paper p1" /><div className="lp-final-paper p2" /><div className="lp-final-paper p3" />
            <h2 className="lp-h2">Your next exam paper is <em>ten minutes</em> away.</h2>
            <p className="lp-sub">Set up your question bank once, then build every paper after that in minutes.</p>
            <div className="lp-hero-ctas center">
              <button type="button" className="lp-btn dark lg" onClick={handleCreatePaper}>{primaryLabel} <ArrowRight size={16} /></button>
              <button type="button" className="lp-btn outline lg" onClick={() => setPlayOpen(true)}><Play size={15} /> Try the demo</button>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── footer ───────── */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-brand"><img src="/questforma-q.svg" alt="" /><span>QuestForma</span></div>
          <div className="lp-footer-links">
            <a href="#anatomy">Product</a>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <button type="button" className="lp-link" onClick={handleCreatePaper}>{primaryLabel}</button>
          </div>
          <div className="lp-footer-copy">© {new Date().getFullYear()} QuestForma. Crafted for educators.</div>
        </div>
      </footer>

      <Playground open={playOpen} onClose={() => setPlayOpen(false)} />
    </div>
  );
}
