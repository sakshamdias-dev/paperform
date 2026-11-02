import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, FileText, ArrowRight, Library, BookOpen, CalendarDays,
  Sparkles, Copy, Layers, Compass, SlidersHorizontal,
} from 'lucide-react';
import type { QuestionType, Difficulty } from '../../types';
import { useStore } from '../../store';
import { useDashboard } from './DashboardLayout';
import { StatusBadge, useLookupNames, usePaperActions, PaperActionsMenu, CountdownPill } from './components';
import {
  greeting, daysUntil, relativeTime, subjectColor, formatDate, QUESTION_TYPE_LABEL,
} from './utils';

const TYPE_COLORS: Record<QuestionType, string> = {
  mcq: '#3b82f6',
  subjective: '#8b5cf6',
  fillblank: '#10b981',
  truefalse: '#f59e0b',
  match: '#ec4899',
  text: '#64748b',
};

export default function Overview() {
  const navigate = useNavigate();
  const { openNewPaper } = useDashboard();
  const { user, questionPapers, questions, sharedQuestions, subjects, classes, duplicateQuestionPaper } = useStore();
  const names = useLookupNames();
  const { items, dialog } = usePaperActions();

  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    [],
  );

  const recent = useMemo(
    () => [...questionPapers].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3),
    [questionPapers],
  );

  const upcoming = useMemo(
    () =>
      questionPapers
        .filter((p) => { const d = daysUntil(p.date); return d !== null && d >= 0; })
        .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()),
    [questionPapers],
  );

  // Next 7 calendar days strip for the Exam Horizon widget
  const weekStrip = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(base);
      d.setDate(base.getDate() + idx);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const matches = questionPapers.filter((p) => p.date && p.date.startsWith(iso));
      return {
        iso,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        isToday: idx === 0,
        papers: matches,
      };
    });
  }, [questionPapers]);

  // Question Bank Blueprint breakdown
  const bankStats = useMemo(() => {
    const rootQuestions = questions.filter((q) => !q.parentId);
    const byType: Record<QuestionType, number> = {
      mcq: 0, subjective: 0, fillblank: 0, truefalse: 0, match: 0, text: 0,
    };
    const byDiff: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    rootQuestions.forEach((q) => {
      byType[q.questionType] = (byType[q.questionType] || 0) + 1;
      byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
    });
    const mineShared = sharedQuestions.filter((q) => q.createdByUserId === user?.id && !q.parentId);
    const reuse = mineShared.reduce((acc, q) => acc + (q.usageCount || 0), 0);
    const typeSegments = (Object.keys(byType) as QuestionType[])
      .filter((k) => k !== 'text' && byType[k] > 0)
      .map((k) => ({
        type: k,
        label: QUESTION_TYPE_LABEL[k],
        count: byType[k],
        pct: rootQuestions.length ? Math.max(6, Math.round((byType[k] / rootQuestions.length) * 100)) : 0,
        color: TYPE_COLORS[k],
      }));

    return {
      totalPersonal: rootQuestions.length,
      sharedCount: mineShared.length,
      reuse,
      communityTotal: sharedQuestions.filter((q) => !q.parentId).length,
      typeSegments,
      byDiff,
    };
  }, [questions, sharedQuestions, user?.id]);

  // Subject breakdown
  const subjectBreakdown = useMemo(() => {
    return subjects.map((s) => {
      const paperCount = questionPapers.filter((p) => p.subjectId === s.id).length;
      const qCount = questions.filter((q) => q.subjectId === s.id && !q.parentId).length;
      return { ...s, paperCount, qCount, color: subjectColor(s.id) };
    });
  }, [subjects, questionPapers, questions]);

  return (
    <div className="qf-overview-viewport">
      {/* ============================================================
          COMPACT ARCHITECTURAL STUDIO BANNER
         ============================================================ */}
      <section className="qf-studio-hero" aria-label="Workspace overview">
        <div className="qf-studio-hero__main">
          <div className="qf-studio-hero__eyebrow">
            <span className="qf-studio-hero__pulse" aria-hidden />
            <span>{todayLabel}</span>
            {user?.schoolName ? (
              <>
                <span className="qf-studio-hero__sep">·</span>
                <span>{user.schoolName}</span>
              </>
            ) : (
              <Link to="/settings?tab=profile" className="qf-studio-hero__setup-link">+ Set school name</Link>
            )}
          </div>

          <div className="qf-studio-hero__heading-row">
            <h1 className="qf-studio-hero__title">
              {greeting()}, <span className="qf-studio-hero__name">{firstName}</span>
            </h1>
            <p className="qf-studio-hero__narrative">
              {questionPapers.length > 0 ? (
                <>
                  <strong>{questionPapers.length} {questionPapers.length === 1 ? 'paper' : 'papers'}</strong> in your workspace ·{' '}
                  <strong>{bankStats.totalPersonal} {bankStats.totalPersonal === 1 ? 'question' : 'questions'}</strong> in your personal bank
                  {upcoming.length > 0 && (
                    <> · <strong>{upcoming.length} upcoming {upcoming.length === 1 ? 'exam' : 'exams'}</strong></>
                  )}
                </>
              ) : (
                <>
                  <strong>{bankStats.communityTotal} community questions</strong> ready to pull into your first assessment
                </>
              )}
            </p>
          </div>
        </div>

        <div className="qf-studio-hero__actions">
          <button type="button" className="qf-btn qf-btn--ghost" onClick={() => navigate('/schedule')}>
            <CalendarDays size={16} /> Schedule
          </button>
          <button type="button" className="qf-btn qf-btn--secondary" onClick={() => navigate('/question-bank')}>
            <Library size={16} /> Question bank
            <span className="qf-count-pill">{bankStats.totalPersonal + bankStats.communityTotal}</span>
          </button>
          <button type="button" className="qf-btn qf-btn--primary qf-studio-hero__cta" onClick={openNewPaper}>
            <Plus size={16} strokeWidth={2.5} /> Draft new paper
          </button>
        </div>
      </section>

      {/* ============================================================
          SINGLE-SCREEN 2×2 BENTO GRID
         ============================================================ */}
      <div className="qf-bento">
        {/* 1. PAPER WORKBENCH (Row 1, Col 1) */}
        <section className="qf-card qf-bento__cell" aria-labelledby="qf-wb-title">
          <div className="qf-card__head">
            <div>
              <h2 id="qf-wb-title" className="qf-card__title">
                <FileText size={16} className="qf-title-icon" /> Paper Workbench
                <span className="qf-count-pill">{questionPapers.length}</span>
              </h2>
              <p className="qf-card__subtitle">Recent assessments &amp; quick actions</p>
            </div>
            <Link to="/papers" className="qf-link-btn">All papers <ArrowRight size={14} /></Link>
          </div>

          <div className="qf-wb-list">
            {recent.map((p) => {
              const subject = names.subject(p.subjectId);
              const klass = names.klass(p.classId);
              const color = subjectColor(p.subjectId || subject);
              return (
                <article key={p.id} className="qf-wb-row" onClick={() => navigate(`/editor/${p.id}`)}>
                  <div className="qf-wb-row__sheet" style={{ borderTopColor: color.fg }}>
                    <span style={{ background: color.fg }} />
                    <i />
                    <i />
                  </div>
                  <div className="qf-wb-row__main">
                    <div className="qf-wb-row__title-line">
                      <h3 className="qf-wb-row__title">{p.title}</h3>
                      {subject && (
                        <span className="qf-chip qf-chip--xs" style={{ color: color.fg, background: color.bg }}>
                          {subject}
                        </span>
                      )}
                      {klass && <span className="qf-chip qf-chip--xs">{klass}</span>}
                    </div>
                    <span className="qf-wb-row__meta">
                      {p.maxMarks || 0} marks · {formatDate(p.date)} · Edited {relativeTime(p.updatedAt)}
                    </span>
                  </div>
                  <StatusBadge paper={p} />
                  <div className="qf-wb-row__actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="qf-icon-btn qf-icon-btn--sm"
                      title="Duplicate paper"
                      aria-label="Duplicate paper"
                      onClick={() => duplicateQuestionPaper(p.id)}
                    >
                      <Copy size={14} />
                    </button>
                    <PaperActionsMenu items={items(p)} />
                  </div>
                </article>
              );
            })}

            <button type="button" className="qf-wb-create" onClick={openNewPaper}>
              <span className="qf-wb-create__icon"><Plus size={15} /></span>
              <span>Create a new question paper</span>
              <span className="qf-wb-create__hint">Open editor →</span>
            </button>
          </div>
        </section>

        {/* 2. 7-DAY EXAM HORIZON (Row 1, Col 2) */}
        <section className="qf-card qf-bento__cell" aria-labelledby="qf-hz-title">
          <div className="qf-card__head">
            <div>
              <h2 id="qf-hz-title" className="qf-card__title">
                <CalendarDays size={16} className="qf-title-icon" /> Exam Horizon
              </h2>
              <p className="qf-card__subtitle">Next 7 days &amp; upcoming schedule</p>
            </div>
            <Link to="/schedule" className="qf-link-btn">Schedule <ArrowRight size={14} /></Link>
          </div>

          <div className="qf-week-strip" role="list" aria-label="Next 7 days">
            {weekStrip.map((day) => (
              <div
                key={day.iso}
                role="listitem"
                className={`qf-week-day ${day.isToday ? 'is-today' : ''} ${day.papers.length > 0 ? 'has-exam' : ''}`}
                title={day.papers.length ? day.papers.map((p) => p.title).join(', ') : 'No exam scheduled'}
              >
                <span className="qf-week-day__name">{day.dayName}</span>
                <span className="qf-week-day__num">{day.dayNum}</span>
                <span className="qf-week-day__dots" aria-hidden>
                  {day.papers.slice(0, 3).map((p) => <i key={p.id} />)}
                </span>
              </div>
            ))}
          </div>

          {upcoming.length > 0 ? (
            <ul className="qf-list qf-horizon-list">
              {upcoming.slice(0, 2).map((p) => {
                const d = new Date(p.date!);
                return (
                  <li key={p.id} className="qf-list__row qf-list__row--compact" onClick={() => navigate(`/editor/${p.id}`)}>
                    <span className="qf-datebox qf-datebox--sm">
                      <span className="qf-datebox__m">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="qf-datebox__d">{d.getDate()}</span>
                    </span>
                    <span className="qf-list__main">
                      <Link to={`/editor/${p.id}`} className="qf-list__title" onClick={(e) => e.stopPropagation()}>{p.title}</Link>
                      <span className="qf-list__meta">
                        {[names.subject(p.subjectId), names.klass(p.classId)].filter(Boolean).join(' · ') || formatDate(p.date)}
                      </span>
                    </span>
                    <CountdownPill date={p.date} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="qf-horizon-calm">
              <div className="qf-horizon-calm__badge"><Sparkles size={15} /></div>
              <div>
                <strong>Clear horizon ahead</strong>
                <p>No upcoming exam dates set. Assign a future date to any paper to track its countdown here.</p>
              </div>
            </div>
          )}
        </section>

        {/* 3. QUESTION BANK BLUEPRINT (Row 2, Col 1) */}
        <section className="qf-card qf-bento__cell" aria-labelledby="qf-bp-title">
          <div className="qf-card__head">
            <div>
              <h2 id="qf-bp-title" className="qf-card__title">
                <Layers size={16} className="qf-title-icon" /> Question Bank Blueprint
              </h2>
              <p className="qf-card__subtitle">Your question mix &amp; community reach</p>
            </div>
            <Link to="/question-bank?tab=mine" className="qf-link-btn">Browse bank <ArrowRight size={14} /></Link>
          </div>

          <div className="qf-blueprint-metrics">
            <Link to="/question-bank?tab=mine" className="qf-blueprint-metric">
              <span className="qf-blueprint-metric__val">{bankStats.totalPersonal}</span>
              <span className="qf-blueprint-metric__lbl">Authored by you</span>
            </Link>
            <Link to="/question-bank" className="qf-blueprint-metric">
              <span className="qf-blueprint-metric__val">{bankStats.communityTotal}</span>
              <span className="qf-blueprint-metric__lbl">Community pool</span>
            </Link>
            <Link to="/question-bank?tab=contributions" className="qf-blueprint-metric">
              <span className="qf-blueprint-metric__val">{bankStats.reuse}×</span>
              <span className="qf-blueprint-metric__lbl">Peer reuses ({bankStats.sharedCount} shared)</span>
            </Link>
          </div>

          {bankStats.totalPersonal > 0 ? (
            <div className="qf-blueprint-mix">
              <div className="qf-blueprint-mix__bar" aria-label="Question type distribution">
                {bankStats.typeSegments.map((seg) => (
                  <span
                    key={seg.type}
                    style={{ width: `${seg.pct}%`, background: seg.color }}
                    title={`${seg.label}: ${seg.count}`}
                  />
                ))}
              </div>
              <div className="qf-blueprint-bottom">
                <div className="qf-blueprint-mix__legend">
                  {bankStats.typeSegments.map((seg) => (
                    <span key={seg.type} className="qf-blueprint-legend-item">
                      <i style={{ background: seg.color }} />
                      <span>{seg.label}</span>
                      <strong>{seg.count}</strong>
                    </span>
                  ))}
                </div>
                <div className="qf-blueprint-diff__pills">
                  <span className="qf-chip qf-chip--xs qf-diff--easy">Easy · {bankStats.byDiff.easy}</span>
                  <span className="qf-chip qf-chip--xs qf-diff--medium">Med · {bankStats.byDiff.medium}</span>
                  <span className="qf-chip qf-chip--xs qf-diff--hard">Hard · {bankStats.byDiff.hard}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="qf-horizon-calm">
              <div className="qf-horizon-calm__badge"><Compass size={15} /></div>
              <div>
                <strong>Personal bank ready</strong>
                <p>Questions you author in any paper are indexed here by type and difficulty.</p>
              </div>
            </div>
          )}
        </section>

        {/* 4. SUBJECTS & CLASSES COVERAGE (Row 2, Col 2) */}
        <section className="qf-card qf-bento__cell" aria-labelledby="qf-sb-title">
          <div className="qf-card__head">
            <div>
              <h2 id="qf-sb-title" className="qf-card__title">
                <SlidersHorizontal size={16} className="qf-title-icon" /> Subjects &amp; Classes
              </h2>
              <p className="qf-card__subtitle">Your active curriculum shelves</p>
            </div>
            <Link to="/settings?tab=academic" className="qf-link-btn">Configure <ArrowRight size={14} /></Link>
          </div>

          {subjectBreakdown.length > 0 ? (
            <ul className="qf-subject-shelves">
              {subjectBreakdown.slice(0, 4).map((s) => (
                <li key={s.id} className="qf-subject-shelf">
                  <span className="qf-subject-shelf__swatch" style={{ background: s.color.bg, color: s.color.fg }}>
                    {s.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="qf-subject-shelf__info">
                    <strong>{s.name}</strong>
                    <span>{s.paperCount} {s.paperCount === 1 ? 'paper' : 'papers'} · {s.qCount} {s.qCount === 1 ? 'question' : 'questions'}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="qf-horizon-calm">
              <div className="qf-horizon-calm__badge"><BookOpen size={15} /></div>
              <div>
                <strong>No subjects added yet</strong>
                <p>Add subjects and classes in Settings to organise papers by curriculum.</p>
              </div>
            </div>
          )}

          {classes.length > 0 && (
            <div className="qf-classes-strip">
              <span className="qf-classes-strip__label">Classes taught</span>
              <div className="qf-classes-strip__tags">
                {classes.map((c) => <span key={c.id} className="qf-chip qf-chip--xs">{c.name}</span>)}
              </div>
            </div>
          )}
        </section>
      </div>

      {dialog}
    </div>
  );
}
