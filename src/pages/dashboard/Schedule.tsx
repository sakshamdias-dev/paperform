import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, Award, Plus, ChevronRight, CalendarX } from 'lucide-react';
import type { QuestionPaper } from '../../types';
import { useStore } from '../../store';
import { useDashboard } from './DashboardLayout';
import { PageHeader, EmptyState, useLookupNames, usePaperActions, PaperActionsMenu, CountdownPill } from './components';
import { daysUntil, formatDuration, relativeTime } from './utils';
import type { MenuItem } from './Menu';

function groupByMonth(papers: QuestionPaper[]) {
  const groups = new Map<string, QuestionPaper[]>();
  papers.forEach((p) => {
    const key = new Date(p.date!).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    groups.set(key, [...(groups.get(key) || []), p]);
  });
  return [...groups.entries()];
}

function ScheduleRow({ paper, items, past }: { paper: QuestionPaper; items: MenuItem[]; past?: boolean }) {
  const names = useLookupNames();
  const d = new Date(paper.date!);
  const days = daysUntil(paper.date) ?? 0;
  return (
    <li className={`qf-schedule-row ${past ? 'is-past' : ''} ${days >= 0 && days <= 3 ? 'is-soon' : ''}`} onClick={() => window.open(`/editor/${paper.id}`, '_blank')}>
      <span className="qf-datebox qf-datebox--lg">
        <span className="qf-datebox__m">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
        <span className="qf-datebox__d">{d.getDate()}</span>
      </span>
      <span className="qf-list__main">
        <Link to={`/editor/${paper.id}`} target="_blank" rel="noopener noreferrer" className="qf-list__title" onClick={(e) => e.stopPropagation()}>{paper.title}</Link>
        <span className="qf-schedule-row__meta">
          <span>{[names.subject(paper.subjectId), names.klass(paper.classId)].filter(Boolean).join(' · ') || 'No subject'}</span>
          <span><Clock size={13} /> {formatDuration(paper.duration)}</span>
          <span><Award size={13} /> {paper.maxMarks || 0} marks</span>
        </span>
      </span>
      {!past && <CountdownPill date={paper.date} />}
      <PaperActionsMenu items={items} />
    </li>
  );
}

export default function Schedule() {
  const { openNewPaper } = useDashboard();
  const { questionPapers } = useStore();
  const { items, dialog } = usePaperActions();
  const names = useLookupNames();

  const { upcoming, past, unscheduled } = useMemo(() => {
    const withDate = questionPapers.filter((p) => daysUntil(p.date) !== null);
    const byDate = (a: QuestionPaper, b: QuestionPaper) => new Date(a.date!).getTime() - new Date(b.date!).getTime();
    return {
      upcoming: withDate.filter((p) => (daysUntil(p.date) ?? -1) >= 0).sort(byDate),
      past: withDate.filter((p) => (daysUntil(p.date) ?? 0) < 0).sort((a, b) => byDate(b, a)),
      unscheduled: questionPapers.filter((p) => daysUntil(p.date) === null),
    };
  }, [questionPapers]);

  const thisWeek = upcoming.filter((p) => (daysUntil(p.date) ?? 99) <= 7).length;

  return (
    <div className="qf-stack">
      <PageHeader
        title="Exam Schedule"
        description={upcoming.length ? `${upcoming.length} upcoming exam${upcoming.length === 1 ? '' : 's'} · ${thisWeek} this week` : 'See every exam you’ve set, by date.'}
        actions={<button type="button" className="qf-btn qf-btn--primary" onClick={openNewPaper}><Plus size={16} strokeWidth={2.5} /> New paper</button>}
      />

      {questionPapers.length === 0 ? (
        <div className="qf-card">
          <EmptyState icon={<CalendarDays size={22} />} title="No exams scheduled" description="When you create a paper with an exam date, it will show up here." action={<button type="button" className="qf-btn qf-btn--primary" onClick={openNewPaper}><Plus size={16} /> New paper</button>} />
        </div>
      ) : (
        <>
          <section className="qf-card" aria-labelledby="sch-up">
            <div className="qf-card__head">
              <div>
                <h2 id="sch-up" className="qf-card__title">Upcoming</h2>
                <p className="qf-card__subtitle">Exams happening today or later</p>
              </div>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState icon={<CalendarDays size={22} />} title="No upcoming exams" description="You’re clear for now. Papers with future dates will appear here." />
            ) : (
              groupByMonth(upcoming).map(([month, papers]) => (
                <div key={month} className="qf-schedule-group">
                  <h3 className="qf-schedule-group__title">{month}</h3>
                  <ul className="qf-list">
                    {papers.map((p) => <ScheduleRow key={p.id} paper={p} items={items(p)} />)}
                  </ul>
                </div>
              ))
            )}
          </section>

          {unscheduled.length > 0 && (
            <section className="qf-card" aria-labelledby="sch-none">
              <div className="qf-card__head">
                <div>
                  <h2 id="sch-none" className="qf-card__title">Needs a date</h2>
                  <p className="qf-card__subtitle">Open these papers to set an exam date</p>
                </div>
              </div>
              <ul className="qf-list">
                {unscheduled.map((p) => (
                  <li key={p.id} className="qf-list__row" onClick={() => window.open(`/editor/${p.id}`, '_blank')}>
                    <span className="qf-file-icon qf-file-icon--muted"><CalendarX size={16} /></span>
                    <span className="qf-list__main">
                      <Link to={`/editor/${p.id}`} target="_blank" rel="noopener noreferrer" className="qf-list__title" onClick={(e) => e.stopPropagation()}>{p.title}</Link>
                      <span className="qf-list__meta">{[names.subject(p.subjectId), names.klass(p.classId)].filter(Boolean).join(' · ') || 'No subject'} · Edited {relativeTime(p.updatedAt)}</span>
                    </span>
                    <ChevronRight size={16} className="qf-muted" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {past.length > 0 && (
            <details className="qf-card qf-disclosure">
              <summary>
                <span>
                  <span className="qf-card__title">Past exams</span>
                  <span className="qf-card__subtitle">{past.length} completed</span>
                </span>
                <ChevronRight size={16} className="qf-disclosure__chev" />
              </summary>
              {groupByMonth(past).map(([month, papers]) => (
                <div key={month} className="qf-schedule-group">
                  <h3 className="qf-schedule-group__title">{month}</h3>
                  <ul className="qf-list">
                    {papers.map((p) => <ScheduleRow key={p.id} paper={p} items={items(p)} past />)}
                  </ul>
                </div>
              ))}
            </details>
          )}
        </>
      )}

      {dialog}
    </div>
  );
}

