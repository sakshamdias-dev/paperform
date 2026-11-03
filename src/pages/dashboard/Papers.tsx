import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, LayoutGrid, List, FileText, SearchX, X } from 'lucide-react';
import { useStore } from '../../store';
import { useDashboard } from './DashboardLayout';
import { PageHeader, EmptyState, PaperCard, StatusBadge, useLookupNames, usePaperActions, PaperActionsMenu } from './components';
import { examStatus, formatDate, relativeTime, subjectColor, type ExamStatus } from './utils';

type SortKey = 'updated' | 'date' | 'title';
type View = 'grid' | 'list';
const VIEW_KEY = 'questforma_papers_view';

const STATUS_TABS: { key: 'all' | ExamStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'unscheduled', label: 'No date' },
];

export default function Papers() {
  const { openNewPaper } = useDashboard();
  const { questionPapers, courses, subjects, classes, loading } = useStore();
  const names = useLookupNames();
  const { items, dialog } = usePaperActions();
  const [params, setParams] = useSearchParams();

  const search = params.get('q') || '';
  const [subjectFilter, setSubjectFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [status, setStatus] = useState<'all' | ExamStatus>('all');
  const [sort, setSort] = useState<SortKey>('updated');
  const [view, setView] = useState<View>(() => (localStorage.getItem(VIEW_KEY) as View) || 'grid');

  useEffect(() => { localStorage.setItem(VIEW_KEY, view); }, [view]);

  const updateSearch = (v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set('q', v); else next.delete('q');
    setParams(next, { replace: true });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: questionPapers.length, upcoming: 0, completed: 0, unscheduled: 0, today: 0 };
    questionPapers.forEach((p) => { c[examStatus(p)]++; });
    c.upcoming += c.today;
    return c;
  }, [questionPapers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questionPapers
      .filter((p) => !q || p.title.toLowerCase().includes(q))
      .filter((p) => !subjectFilter || p.subjectId === subjectFilter)
      .filter((p) => !classFilter || p.classId === classFilter)
      .filter((p) => !courseFilter || p.courseId === courseFilter)
      .filter((p) => {
        if (status === 'all') return true;
        const s = examStatus(p);
        return status === 'upcoming' ? s === 'upcoming' || s === 'today' : s === status;
      })
      .sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title);
        if (sort === 'date') {
          const ad = a.date ? new Date(a.date).getTime() : Infinity;
          const bd = b.date ? new Date(b.date).getTime() : Infinity;
          return ad - bd;
        }
        return b.updatedAt - a.updatedAt;
      });
  }, [questionPapers, search, subjectFilter, classFilter, courseFilter, status, sort]);

  const hasFilters = !!(search || subjectFilter || classFilter || courseFilter || status !== 'all');
  const clearFilters = () => {
    updateSearch(''); setSubjectFilter(''); setClassFilter(''); setCourseFilter(''); setStatus('all');
  };

  const isInitialLoading = loading && questionPapers.length === 0;

  return (
    <div className="qf-stack">
      <PageHeader
        title="My Papers"
        description="All the question papers you’ve created, in one place."
        actions={
          <button type="button" className="qf-btn qf-btn--primary" onClick={openNewPaper}>
            <Plus size={16} strokeWidth={2.5} /> New paper
          </button>
        }
      />

      <div className="qf-tabs" role="tablist" aria-label="Filter by exam status">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={status === t.key}
            className={`qf-tab ${status === t.key ? 'is-active' : ''}`}
            onClick={() => setStatus(t.key)}
          >
            {t.label}
            <span className="qf-tab__count">{counts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="qf-toolbar">
        <div className="qf-search qf-search--inline">
          <Search size={16} className="qf-search__icon" />
          <input
            type="search"
            className="qf-search__input"
            placeholder="Search papers by title..."
            aria-label="Search papers"
            value={search}
            onChange={(e) => updateSearch(e.target.value)}
          />
        </div>
        <select className="qf-input qf-select qf-select--sm" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} aria-label="Subject">
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="qf-input qf-select qf-select--sm" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Class">
          <option value="">All classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {courses.length > 0 && (
          <select className="qf-input qf-select qf-select--sm" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label="Course">
            <option value="">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {hasFilters && (
          <button type="button" className="qf-btn qf-btn--ghost qf-btn--sm" onClick={clearFilters}><X size={14} /> Clear</button>
        )}
        <div className="qf-toolbar__spacer" />
        <select className="qf-input qf-select qf-select--sm" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
          <option value="updated">Last edited</option>
          <option value="date">Exam date</option>
          <option value="title">Title (A–Z)</option>
        </select>
        <div className="qf-segmented" role="group" aria-label="View">
          <button type="button" className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')} aria-pressed={view === 'grid'} aria-label="Grid view"><LayoutGrid size={16} /></button>
          <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="List view"><List size={16} /></button>
        </div>
      </div>

      {isInitialLoading ? (
        <div className="qf-paper-grid">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="qf-skel qf-skel--card" />)}
        </div>
      ) : questionPapers.length === 0 ? (
        <div className="qf-card">
          <EmptyState
            icon={<FileText size={22} />}
            title="Create your first paper"
            description="Set the subject, class and exam details, then add questions from scratch or from the question bank."
            action={<button type="button" className="qf-btn qf-btn--primary" onClick={openNewPaper}><Plus size={16} /> New paper</button>}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="qf-card">
          <EmptyState
            icon={<SearchX size={22} />}
            title="No papers match your filters"
            description="Try a different search term or clear the filters."
            action={<button type="button" className="qf-btn qf-btn--secondary" onClick={clearFilters}>Clear filters</button>}
          />
        </div>
      ) : view === 'grid' ? (
        <div className="qf-paper-grid">
          {filtered.map((p) => <PaperCard key={p.id} paper={p} menuItems={items(p)} />)}
        </div>
      ) : (
        <div className="qf-card qf-table-card">
          <div className="qf-table-wrap" tabIndex={0} role="region" aria-label="Papers">
            <table className="qf-table">
              <thead>
                <tr>
                  <th scope="col">Paper</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Class</th>
                  <th scope="col">Exam date</th>
                  <th scope="col">Marks</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last edited</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const subject = names.subject(p.subjectId);
                  const color = subjectColor(p.subjectId || subject);
                  return (
                    <tr key={p.id} onClick={() => window.open(`/editor/${p.id}`, '_blank')}>
                      <th scope="row">
                        <span className="qf-table__paper">
                          <span className="qf-file-icon" style={{ color: color.fg, background: color.bg }}><FileText size={15} /></span>
                          <span>
                            <Link to={`/editor/${p.id}`} target="_blank" rel="noopener noreferrer" className="qf-list__title" onClick={(e) => e.stopPropagation()}>{p.title}</Link>
                            <span className="qf-list__meta">{p.isPublished ? 'Published' : 'Draft'}</span>
                          </span>
                        </span>
                      </th>
                      <td>{subject || '—'}</td>
                      <td>{names.klass(p.classId) || '—'}</td>
                      <td>{formatDate(p.date)}</td>
                      <td>{p.maxMarks || 0}</td>
                      <td><StatusBadge paper={p} /></td>
                      <td className="qf-muted">{relativeTime(p.updatedAt)}</td>
                      <td className="qf-table__actions"><PaperActionsMenu items={items(p)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="qf-footnote">Showing {filtered.length} of {questionPapers.length} paper{questionPapers.length === 1 ? '' : 's'}</p>
      )}

      {dialog}
    </div>
  );
}

