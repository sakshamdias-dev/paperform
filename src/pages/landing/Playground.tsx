import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Search, Plus, Minus, Trash2, ChevronUp, ChevronDown, GripVertical, Printer,
  RotateCcw, Sparkles, Layers, FolderPlus, Check, Target,
} from 'lucide-react';
import { useStore } from '../../store';
import {
  DEMO_BANK, SUBJECTS, TYPE_LABEL, BLOOM_ORDER, getQuestion,
  type DemoQuestion, type DemoSubject, type DemoType,
} from './demoData';
import { MathText } from './MathText';

/* ───────────────────────── types ───────────────────────── */

interface PaperItem {
  uid: string;
  qid: string;
  marks: number;
}

interface PaperSectionState {
  id: string;
  title: string;
  items: PaperItem[];
}

interface PaperMeta {
  school: string;
  title: string;
  className: string;
  duration: string;
}

interface PlaygroundState {
  meta: PaperMeta;
  sections: PaperSectionState[];
  target: number;
}

const STORAGE_KEY = 'qf_playground_v1';

const uid = () => Math.random().toString(36).slice(2, 9);

const totalMarksOf = (q: DemoQuestion) =>
  q.subs && q.subs.length ? q.subs.reduce((a, s) => a + s.marks, 0) : q.marks;

const makeItem = (qid: string): PaperItem => {
  const q = getQuestion(qid)!;
  return { uid: uid(), qid, marks: totalMarksOf(q) };
};

const initialState = (): PlaygroundState => ({
  meta: {
    school: 'Greenfield International School',
    title: 'Mid-Term Examination 2026',
    className: 'Grade 10 · Science & Mathematics',
    duration: '1 hr 30 min',
  },
  target: 30,
  sections: [
    { id: uid(), title: 'Section A — Objective', items: [makeItem('p1'), makeItem('m1')] },
    { id: uid(), title: 'Section B — Short Answer', items: [makeItem('m2')] },
    { id: uid(), title: 'Section C — Long Answer', items: [makeItem('p2')] },
  ],
});

const loadState = (): PlaygroundState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlaygroundState;
      // drop any items whose question no longer exists
      parsed.sections.forEach(s => { s.items = s.items.filter(i => getQuestion(i.qid)); });
      if (parsed.sections && parsed.meta) return parsed;
    }
  } catch { /* ignore */ }
  return initialState();
};

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi'];

/* ───────────────────────── component ───────────────────────── */

export default function Playground({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const enterGuestMode = useStore((s) => s.enterGuestMode);
  const [state, setState] = useState<PlaygroundState>(loadState);
  const [activeSectionRaw, setActiveSection] = useState<string>(() => state.sections[0]?.id ?? '');
  const [subject, setSubject] = useState<DemoSubject | 'All'>('All');
  const [typeFilter, setTypeFilter] = useState<DemoType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [drop, setDrop] = useState<{ sectionId: string; index: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dragRef = useRef<{ kind: 'bank' | 'item'; id: string } | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const { meta, sections, target } = state;

  /* persist */
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  /* active section, falling back to the first one if it was removed */
  const activeSection = sections.some(s => s.id === activeSectionRaw) ? activeSectionRaw : (sections[0]?.id ?? '');

  /* esc + scroll lock */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  useEffect(() => () => { timers.current.forEach(t => clearTimeout(t)); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    const t = window.setTimeout(() => setToast(null), 2200);
    timers.current.push(t);
  };

  const flashItem = (id: string) => {
    setFlash(id);
    const t = window.setTimeout(() => setFlash(f => (f === id ? null : f)), 1200);
    timers.current.push(t);
  };

  /* ───────── derived ───────── */

  const usedIds = useMemo(() => new Set(sections.flatMap(s => s.items.map(i => i.qid))), [sections]);

  const filteredBank = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DEMO_BANK.filter(item =>
      (subject === 'All' || item.subject === subject) &&
      (typeFilter === 'all' || item.type === typeFilter) &&
      (!q || item.text.toLowerCase().includes(q) || item.chapter.toLowerCase().includes(q))
    );
  }, [subject, typeFilter, query]);

  const allItems = useMemo(() => sections.flatMap(s => s.items), [sections]);
  const numberOf = useMemo(() => new Map(allItems.map((it, i) => [it.uid, i + 1])), [allItems]);
  const totalMarks = allItems.reduce((a, i) => a + i.marks, 0);

  const stats = useMemo(() => {
    const diff = { easy: 0, medium: 0, hard: 0 };
    const bloom: Record<string, number> = {};
    BLOOM_ORDER.forEach(b => { bloom[b] = 0; });
    allItems.forEach(i => {
      const q = getQuestion(i.qid)!;
      diff[q.difficulty] += i.marks;
      bloom[q.bloom] += i.marks;
    });
    return { diff, bloom };
  }, [allItems]);

  /* ───────── mutations ───────── */

  const addQuestion = useCallback((qid: string, sectionId?: string, index?: number) => {
    const targetId = sectionId ?? activeSection ?? sections[0]?.id;
    if (!targetId) return;
    const item = makeItem(qid);
    setState(s => ({
      ...s,
      sections: s.sections.map(sec => {
        if (sec.id !== targetId) return sec;
        const items = [...sec.items];
        items.splice(index ?? items.length, 0, item);
        return { ...sec, items };
      }),
    }));
    flashItem(item.uid);
  }, [activeSection, sections]);

  const moveItem = (itemUid: string, toSection: string, toIndex: number) => {
    setState(s => {
      let moving: PaperItem | undefined;
      let fromSection = '';
      let fromIndex = -1;
      s.sections.forEach(sec => sec.items.forEach((it, idx) => {
        if (it.uid === itemUid) { moving = it; fromSection = sec.id; fromIndex = idx; }
      }));
      if (!moving) return s;
      let adjusted = toIndex;
      if (fromSection === toSection && fromIndex < toIndex) adjusted -= 1;
      const removed = s.sections.map(sec => ({ ...sec, items: sec.items.filter(i => i.uid !== itemUid) }));
      return {
        ...s,
        sections: removed.map(sec => {
          if (sec.id !== toSection) return sec;
          const items = [...sec.items];
          items.splice(Math.max(0, Math.min(adjusted, items.length)), 0, moving!);
          return { ...sec, items };
        }),
      };
    });
    flashItem(itemUid);
  };

  const nudge = (itemUid: string, dir: -1 | 1) => {
    setState(s => ({
      ...s,
      sections: s.sections.map(sec => {
        const idx = sec.items.findIndex(i => i.uid === itemUid);
        if (idx === -1) return sec;
        const to = idx + dir;
        if (to < 0 || to >= sec.items.length) return sec;
        const items = [...sec.items];
        [items[idx], items[to]] = [items[to], items[idx]];
        return { ...sec, items };
      }),
    }));
  };

  const removeItem = (itemUid: string) => {
    setState(s => ({ ...s, sections: s.sections.map(sec => ({ ...sec, items: sec.items.filter(i => i.uid !== itemUid) })) }));
  };

  const changeMarks = (itemUid: string, delta: number) => {
    setState(s => ({
      ...s,
      sections: s.sections.map(sec => ({
        ...sec,
        items: sec.items.map(i => (i.uid === itemUid ? { ...i, marks: Math.max(1, Math.min(20, i.marks + delta)) } : i)),
      })),
    }));
  };

  const addSection = () => {
    const letter = String.fromCharCode(65 + sections.length);
    const id = uid();
    setState(s => ({ ...s, sections: [...s.sections, { id, title: `Section ${letter}`, items: [] }] }));
    setActiveSection(id);
  };

  const renameSection = (id: string, title: string) =>
    setState(s => ({ ...s, sections: s.sections.map(sec => (sec.id === id ? { ...sec, title } : sec)) }));

  const removeSection = (id: string) =>
    setState(s => ({ ...s, sections: s.sections.filter(sec => sec.id !== id) }));

  const setMeta = (patch: Partial<PaperMeta>) => setState(s => ({ ...s, meta: { ...s.meta, ...patch } }));

  const reset = () => {
    timers.current.forEach(t => clearTimeout(t));
    const fresh = initialState();
    setState(fresh);
    setActiveSection(fresh.sections[0].id);
    showToast('Paper reset to sample');
  };

  /* Auto-generate a balanced paper that hits the target marks. */
  const autoGenerate = () => {
    if (generating) return;
    timers.current.forEach(t => clearTimeout(t));
    setGenerating(true);
    const pool = DEMO_BANK
      .filter(q => subject === 'All' || q.subject === subject)
      .map(q => ({ q, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map(x => x.q);

    const objective = pool.filter(q => q.type !== 'subjective');
    const short = pool.filter(q => q.type === 'subjective' && totalMarksOf(q) <= 3);
    const long = pool.filter(q => q.type === 'subjective' && totalMarksOf(q) > 3);

    const picks: { sec: number; qid: string }[] = [];
    let sum = 0;
    const tryPick = (list: DemoQuestion[], sec: number, budget: number) => {
      let used = 0;
      for (const q of list) {
        const m = totalMarksOf(q);
        if (sum + m > target || used + m > budget) continue;
        picks.push({ sec, qid: q.id });
        sum += m; used += m;
      }
    };
    tryPick(objective, 0, Math.round(target * 0.25));
    tryPick(short, 1, Math.round(target * 0.3));
    tryPick(long, 2, target);
    // top-up with anything that still fits
    tryPick(pool.filter(q => !picks.find(p => p.qid === q.id)), 1, target);

    const ids = [uid(), uid(), uid()];
    setState(s => ({
      ...s,
      sections: [
        { id: ids[0], title: 'Section A — Objective', items: [] },
        { id: ids[1], title: 'Section B — Short Answer', items: [] },
        { id: ids[2], title: 'Section C — Long Answer', items: [] },
      ],
    }));
    setActiveSection(ids[0]);

    picks.sort((a, b) => a.sec - b.sec).forEach((p, i) => {
      const t = window.setTimeout(() => {
        const item = makeItem(p.qid);
        setState(s => ({
          ...s,
          sections: s.sections.map(sec => (sec.id === ids[p.sec] ? { ...sec, items: [...sec.items, item] } : sec)),
        }));
        flashItem(item.uid);
        if (i === picks.length - 1) {
          setGenerating(false);
          showToast(`Generated ${picks.length} questions · ${sum} marks`);
        }
      }, 260 + i * 170);
      timers.current.push(t);
    });
    if (!picks.length) setGenerating(false);
  };

  const print = () => {
    document.body.classList.add('qf-printing');
    const cleanup = () => {
      document.body.classList.remove('qf-printing');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => { window.print(); setTimeout(cleanup, 500); }, 50);
  };

  /* ───────── drag & drop ───────── */

  const onBankDragStart = (e: React.DragEvent, qid: string) => {
    dragRef.current = { kind: 'bank', id: qid };
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', qid);
  };

  const onItemDragStart = (e: React.DragEvent, itemUid: string) => {
    dragRef.current = { kind: 'item', id: itemUid };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemUid);
  };

  const onDragEnd = () => { dragRef.current = null; setDrop(null); };

  const onItemDragOver = (e: React.DragEvent, sectionId: string, index: number) => {
    if (!dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    const next = { sectionId, index: index + (after ? 1 : 0) };
    if (!drop || drop.sectionId !== next.sectionId || drop.index !== next.index) setDrop(next);
  };

  const onSectionDragOver = (e: React.DragEvent, sectionId: string, len: number) => {
    if (!dragRef.current) return;
    e.preventDefault();
    if (!drop || drop.sectionId !== sectionId) setDrop({ sectionId, index: len });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const d = dragRef.current;
    if (d && drop) {
      if (d.kind === 'bank') addQuestion(d.id, drop.sectionId, drop.index);
      else moveItem(d.id, drop.sectionId, drop.index);
      setActiveSection(drop.sectionId);
    }
    onDragEnd();
  };

  /* ───────── render ───────── */

  const pct = Math.min(100, Math.round((totalMarks / Math.max(1, target)) * 100));
  const maxBloom = Math.max(1, ...Object.values(stats.bloom));

  return (
    <div className={`pg-overlay ${open ? 'is-open' : ''}`} aria-hidden={!open} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pg-shell" role="dialog" aria-modal="true" aria-label="QuestForma playground">
        {/* ── top bar ── */}
        <header className="pg-top">
          <div className="pg-top-left">
            <img src="/questforma-q.svg" alt="" className="pg-top-logo" />
            <div>
              <div className="pg-top-title">Paper Constructor <span className="pg-pill">Live demo</span></div>
              <div className="pg-top-sub">Drag questions from the bank onto the paper. Everything is local — nothing is saved to an account.</div>
            </div>
          </div>
          <div className="pg-top-actions">
            <button className="pg-btn ghost" onClick={reset} title="Reset sample paper"><RotateCcw size={15} /> <span>Reset</span></button>
            <button className="pg-btn ghost" onClick={autoGenerate} disabled={generating}>
              <Sparkles size={15} /> <span>{generating ? 'Building…' : 'Auto-build'}</span>
            </button>
            <button className="pg-btn solid" onClick={print}><Printer size={15} /> <span>Export PDF</span></button>
            <button className="pg-icon-btn" onClick={onClose} aria-label="Close playground"><X size={18} /></button>
          </div>
        </header>

        <div className="pg-body">
          {/* ── question bank ── */}
          <aside className="pg-bank">
            <div className="pg-panel-head">
              <Layers size={15} /> Question bank
              <span className="pg-count">{filteredBank.length}</span>
            </div>
            <div className="pg-search">
              <Search size={14} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search questions or chapters" />
            </div>
            <div className="pg-chips">
              {(['All', ...SUBJECTS] as const).map(s => (
                <button key={s} className={`pg-chip ${subject === s ? 'on' : ''}`} onClick={() => setSubject(s)}>{s}</button>
              ))}
            </div>
            <div className="pg-chips small">
              {(['all', 'mcq', 'subjective', 'truefalse', 'fillblank'] as const).map(t => (
                <button key={t} className={`pg-chip ${typeFilter === t ? 'on' : ''}`} onClick={() => setTypeFilter(t)}>
                  {t === 'all' ? 'Any type' : TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            <div className="pg-bank-list">
              {filteredBank.map(q => {
                const used = usedIds.has(q.id);
                return (
                  <div
                    key={q.id}
                    className={`pg-qcard ${used ? 'used' : ''}`}
                    draggable
                    onDragStart={e => onBankDragStart(e, q.id)}
                    onDragEnd={onDragEnd}
                  >
                    <div className="pg-qcard-top">
                      <span className={`pg-tag t-${q.type}`}>{TYPE_LABEL[q.type]}</span>
                      <span className={`pg-diff d-${q.difficulty}`}>{q.difficulty}</span>
                      <span className="pg-marks-badge">{totalMarksOf(q)}m</span>
                    </div>
                    <div className="pg-qcard-text"><MathText text={q.text} /></div>
                    <div className="pg-qcard-foot">
                      <span>{q.chapter} · {q.bloom}</span>
                      <button className="pg-add" onClick={() => addQuestion(q.id)} aria-label="Add to paper">
                        {used ? <Check size={13} /> : <Plus size={13} />}
                      </button>
                    </div>
                  </div>
                );
              })}
              {!filteredBank.length && <div className="pg-empty-bank">No questions match those filters.</div>}
            </div>
          </aside>

          {/* ── paper ── */}
          <main className="pg-canvas" onDragOver={e => { if (dragRef.current) e.preventDefault(); }} onDrop={onDrop}>
            <div className="pg-paper" ref={paperRef}>
              <div className="pp-header">
                <input className="pp-school" value={meta.school} onChange={e => setMeta({ school: e.target.value })} aria-label="Institution" />
                <input className="pp-title" value={meta.title} onChange={e => setMeta({ title: e.target.value })} aria-label="Exam title" />
                <div className="pp-meta-row">
                  <input className="pp-meta" value={meta.className} onChange={e => setMeta({ className: e.target.value })} aria-label="Class" />
                  <span className="pp-meta-fixed">
                    Time: <input className="pp-meta inline" value={meta.duration} onChange={e => setMeta({ duration: e.target.value })} aria-label="Duration" />
                  </span>
                  <span className="pp-meta-fixed">Max. Marks: <b key={totalMarks} className="pp-total">{totalMarks}</b></span>
                </div>
              </div>
              <div className="pp-instructions">
                <b>General Instructions</b>
                <ol>
                  <li>All questions are compulsory.</li>
                  <li>Marks for each question are indicated against it.</li>
                </ol>
              </div>

              {sections.map(sec => (
                <section
                  key={sec.id}
                  className={`pp-section ${activeSection === sec.id ? 'active' : ''} ${drop?.sectionId === sec.id ? 'drop-target' : ''}`}
                  onClick={() => setActiveSection(sec.id)}
                  onDragOver={e => onSectionDragOver(e, sec.id, sec.items.length)}
                >
                  <div className="pp-section-head">
                    <input
                      className="pp-section-title"
                      value={sec.title}
                      onChange={e => renameSection(sec.id, e.target.value)}
                      aria-label="Section title"
                    />
                    <span className="pp-section-marks">{sec.items.reduce((a, i) => a + i.marks, 0)} marks</span>
                    {sections.length > 1 && (
                      <button className="pp-tool danger no-print" onClick={(e) => { e.stopPropagation(); removeSection(sec.id); }} aria-label="Remove section">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {sec.items.map((item, idx) => {
                    const q = getQuestion(item.qid)!;
                    const showLineBefore = drop?.sectionId === sec.id && drop.index === idx;
                    return (
                      <div key={item.uid}>
                        {showLineBefore && <div className="pp-drop-line" />}
                        <div
                          className={`pp-q ${flash === item.uid ? 'flash' : ''}`}
                          draggable
                          onDragStart={e => onItemDragStart(e, item.uid)}
                          onDragEnd={onDragEnd}
                          onDragOver={e => onItemDragOver(e, sec.id, idx)}
                        >
                          <span className="pp-grip no-print"><GripVertical size={14} /></span>
                          <span className="pp-qno">{numberOf.get(item.uid)}.</span>
                          <div className="pp-qbody">
                            <div className="pp-qtext">
                              <MathText text={q.text} />
                              {q.type === 'truefalse' && <span className="pp-tf"> (True / False)</span>}
                            </div>
                            {q.options && (
                              <div className="pp-options">
                                {q.options.map((o, oi) => (
                                  <div key={oi} className="pp-option"><span>({String.fromCharCode(97 + oi)})</span> <MathText text={o} /></div>
                                ))}
                              </div>
                            )}
                            {q.subs && (
                              <div className="pp-subs">
                                {q.subs.map((s, si) => (
                                  <div key={si} className="pp-sub">
                                    <span className="pp-subno">({ROMAN[si]})</span>
                                    <MathText text={s.text} />
                                    <span className="pp-submarks">[{s.marks}]</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="pp-qmarks">[{item.marks}]</span>

                          <div className="pp-tools no-print" onClick={e => e.stopPropagation()}>
                            <button className="pp-tool" onClick={() => nudge(item.uid, -1)} aria-label="Move up"><ChevronUp size={13} /></button>
                            <button className="pp-tool" onClick={() => nudge(item.uid, 1)} aria-label="Move down"><ChevronDown size={13} /></button>
                            {!q.subs && (
                              <>
                                <button className="pp-tool" onClick={() => changeMarks(item.uid, -1)} aria-label="Decrease marks"><Minus size={13} /></button>
                                <button className="pp-tool" onClick={() => changeMarks(item.uid, 1)} aria-label="Increase marks"><Plus size={13} /></button>
                              </>
                            )}
                            <button className="pp-tool danger" onClick={() => removeItem(item.uid)} aria-label="Remove"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {drop?.sectionId === sec.id && drop.index === sec.items.length && <div className="pp-drop-line" />}
                  {!sec.items.length && (
                    <div className="pp-empty no-print">Drop questions here, or click <Plus size={11} /> in the bank</div>
                  )}
                </section>
              ))}

              <button className="pp-add-section no-print" onClick={addSection}><FolderPlus size={14} /> Add section</button>
              <div className="pp-end">— End of Question Paper —</div>
            </div>
          </main>

          {/* ── blueprint ── */}
          <aside className="pg-blueprint">
            <div className="pg-panel-head"><Target size={15} /> Blueprint</div>

            <div className="bp-card">
              <div className="bp-label">Marks vs. target</div>
              <div className="bp-big">
                <span key={totalMarks} className="bp-num">{totalMarks}</span>
                <span className="bp-of">/ {target}</span>
              </div>
              <div className="bp-bar"><div className={`bp-bar-fill ${totalMarks > target ? 'over' : ''}`} style={{ width: `${pct}%` }} /></div>
              <div className="bp-target-row">
                <span>Target</span>
                <div className="bp-stepper">
                  <button onClick={() => setState(s => ({ ...s, target: Math.max(5, s.target - 5) }))} aria-label="Decrease target"><Minus size={12} /></button>
                  <b>{target}</b>
                  <button onClick={() => setState(s => ({ ...s, target: Math.min(100, s.target + 5) }))} aria-label="Increase target"><Plus size={12} /></button>
                </div>
              </div>
              <div className="bp-hint">
                {totalMarks === target ? 'Perfectly balanced ✓' : totalMarks > target ? `${totalMarks - target} marks over target` : `${target - totalMarks} marks to go`}
              </div>
            </div>

            <div className="bp-card">
              <div className="bp-label">Difficulty mix</div>
              <div className="bp-stack">
                {(['easy', 'medium', 'hard'] as const).map(d => (
                  <div key={d} className={`bp-seg d-${d}`} style={{ flexGrow: stats.diff[d] || 0.0001 }} />
                ))}
              </div>
              <div className="bp-legend">
                {(['easy', 'medium', 'hard'] as const).map(d => (
                  <span key={d}><i className={`d-${d}`} />{d} <b>{stats.diff[d]}</b></span>
                ))}
              </div>
            </div>

            <div className="bp-card">
              <div className="bp-label">Bloom’s taxonomy</div>
              <div className="bp-bloom">
                {BLOOM_ORDER.map(b => (
                  <div key={b} className="bp-bloom-row">
                    <span>{b}</span>
                    <div className="bp-bloom-track"><div style={{ width: `${(stats.bloom[b] / maxBloom) * 100}%` }} /></div>
                    <b>{stats.bloom[b]}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="bp-card soft">
              <div className="bp-mini-grid">
                <div><b>{allItems.length}</b><span>Questions</span></div>
                <div><b>{sections.length}</b><span>Sections</span></div>
                <div><b>{Math.round(totalMarks * 1.8)}m</b><span>Est. time</span></div>
              </div>
            </div>

            <button
              type="button"
              className="pg-btn solid block"
              onClick={() => {
                if (!user?.id) enterGuestMode();
                onClose();
                navigate('/dashboard');
              }}
            >
              Create paper in QuestForma
            </button>
          </aside>
        </div>

        <div className={`pg-toast ${toast ? 'show' : ''}`}><Check size={14} /> {toast}</div>
      </div>
    </div>
  );
}
