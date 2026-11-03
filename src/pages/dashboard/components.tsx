import { useState, type ReactNode } from 'react';
import { Copy, MoreHorizontal, PencilLine, Trash2, CalendarDays, Clock, Award } from 'lucide-react';
import type { QuestionPaper } from '../../types';
import { useStore } from '../../store';
import Dialog from './Dialog';
import Menu, { type MenuItem } from './Menu';
import { examStatus, formatDate, formatDuration, relativeTime, STATUS_LABEL, subjectColor, countdownLabel } from './utils';

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="qf-page-header">
      <div>
        <h1 className="qf-page-header__title">{title}</h1>
        {description && <p className="qf-page-header__desc">{description}</p>}
      </div>
      {actions && <div className="qf-page-header__actions">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="qf-empty">
      <div className="qf-empty__icon">{icon}</div>
      <h3 className="qf-empty__title">{title}</h3>
      {description && <p className="qf-empty__desc">{description}</p>}
      {action && <div className="qf-empty__action">{action}</div>}
    </div>
  );
}

export function StatusBadge({ paper }: { paper: QuestionPaper }) {
  const s = examStatus(paper);
  return <span className={`qf-badge qf-badge--${s}`}><span className="qf-badge__dot" />{STATUS_LABEL[s]}</span>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLookupNames() {
  const { courses, subjects, classes } = useStore();
  return {
    course: (id?: string) => courses.find((c) => c.id === id)?.name,
    subject: (id?: string) => subjects.find((s) => s.id === id)?.name,
    klass: (id?: string) => classes.find((c) => c.id === id)?.name,
  };
}

/** Delete confirmation + action menu shared by every list that shows papers. */
// eslint-disable-next-line react-refresh/only-export-components
export function usePaperActions() {
  const { deleteQuestionPaper, duplicateQuestionPaper, questionPapers } = useStore();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const target = questionPapers.find((p) => p.id === pendingDelete);

  const items = (paper: QuestionPaper): MenuItem[] => [
    { label: 'Open in editor', icon: <PencilLine size={16} />, onSelect: () => window.open(`/editor/${paper.id}`, '_blank') },
    { label: 'Duplicate', icon: <Copy size={16} />, onSelect: () => void duplicateQuestionPaper(paper.id) },
    { label: 'Delete', icon: <Trash2 size={16} />, onSelect: () => setPendingDelete(paper.id), danger: true },
  ];

  const dialog = (
    <Dialog
      open={!!pendingDelete}
      onClose={() => setPendingDelete(null)}
      size="sm"
      title="Delete this paper?"
      description={target ? `“${target.title}” and its questions will be permanently removed. This can’t be undone.` : undefined}
      footer={
        <>
          <button type="button" className="qf-btn qf-btn--secondary" onClick={() => setPendingDelete(null)} autoFocus>Keep paper</button>
          <button
            type="button"
            className="qf-btn qf-btn--danger"
            onClick={() => {
              if (pendingDelete) deleteQuestionPaper(pendingDelete);
              setPendingDelete(null);
            }}
          >
            Delete paper
          </button>
        </>
      }
    />
  );

  return { items, dialog };
}

export function PaperActionsMenu({ items }: { items: MenuItem[] }) {
  return (
    <Menu
      items={items}
      trigger={({ open, toggle }) => (
        <button type="button" className={`qf-icon-btn ${open ? 'is-active' : ''}`} onClick={toggle} aria-label="Paper actions" aria-expanded={open}>
          <MoreHorizontal size={18} />
        </button>
      )}
    />
  );
}

/** Miniature A4 sheet used as the visual thumbnail for a paper. */
export function PaperThumb({ paper, subjectName }: { paper: QuestionPaper; subjectName?: string }) {
  const color = subjectColor(paper.subjectId || subjectName);
  return (
    <div className="qf-thumb" style={{ background: color.bg }}>
      <div className="qf-thumb__sheet">
        <div className="qf-thumb__bar" style={{ background: color.fg }} />
        <div className="qf-thumb__title">{paper.title}</div>
        <div className="qf-thumb__line w80" />
        <div className="qf-thumb__line w60" />
        <div className="qf-thumb__gap" />
        <div className="qf-thumb__line w90" />
        <div className="qf-thumb__line w70" />
        <div className="qf-thumb__line w85" />
      </div>
    </div>
  );
}

export function PaperCard({ paper, menuItems }: { paper: QuestionPaper; menuItems: MenuItem[] }) {
  const names = useLookupNames();
  const subject = names.subject(paper.subjectId);
  const klass = names.klass(paper.classId);
  const color = subjectColor(paper.subjectId || subject);

  return (
    <article className="qf-paper-card" onClick={() => window.open(`/editor/${paper.id}`, '_blank')}>
      <PaperThumb paper={paper} subjectName={subject} />
      <div className="qf-paper-card__body">
        <div className="qf-paper-card__top">
          <StatusBadge paper={paper} />
          <PaperActionsMenu items={menuItems} />
        </div>
        <h3 className="qf-paper-card__title" title={paper.title}>
          <a href={`/editor/${paper.id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); window.open(`/editor/${paper.id}`, '_blank'); }}>{paper.title}</a>
        </h3>
        <div className="qf-paper-card__tags">
          {subject && <span className="qf-chip" style={{ color: color.fg, background: color.bg }}>{subject}</span>}
          {klass && <span className="qf-chip">{klass}</span>}
        </div>
        <dl className="qf-paper-card__meta">
          <div><dt><CalendarDays size={14} /><span className="sr-only">Exam date</span></dt><dd>{formatDate(paper.date)}</dd></div>
          <div><dt><Clock size={14} /><span className="sr-only">Duration</span></dt><dd>{formatDuration(paper.duration)}</dd></div>
          <div><dt><Award size={14} /><span className="sr-only">Marks</span></dt><dd>{paper.maxMarks || 0} marks</dd></div>
        </dl>
        <div className="qf-paper-card__foot">
          <span>{paper.isPublished ? 'Published' : 'Draft'}</span>
          <span>Edited {relativeTime(paper.updatedAt)}</span>
        </div>
      </div>
    </article>
  );
}

export function CountdownPill({ date }: { date?: string }) {
  const label = countdownLabel(date);
  if (!label) return null;
  return <span className="qf-countdown">{label}</span>;
}
