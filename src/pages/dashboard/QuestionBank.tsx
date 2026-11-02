import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Library, Users, PenLine, Share2, Info, SearchX, Layers, TrendingUp, X } from 'lucide-react';
import type { Difficulty, QuestionType } from '../../types';
import { useStore } from '../../store';
import { renderMath, preprocessMathHtml } from '../../utils/mathjax';
import { PageHeader, EmptyState } from './components';
import Dialog from './Dialog';
import { DIFFICULTY_LABEL, QUESTION_TYPE_LABEL, relativeTime, stripHtml } from './utils';

type Tab = 'community' | 'mine' | 'contributions';

interface BankItem {
  id: string;
  content: string;
  preview: string;
  questionType: QuestionType;
  difficulty: Difficulty;
  marks?: number;
  options: string[];
  subject?: string;
  klass?: string;
  chapter?: string;
  author?: string;
  usageCount?: number;
  subCount: number;
  createdAt: number;
}

const PAGE_SIZE = 24;

export default function QuestionBank() {
  const { user, questions, sharedQuestions, subjects, classes, chapters } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'community';
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [subject, setSubject] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [viewing, setViewing] = useState<BankItem | null>(null);

  const setTab = (t: Tab) => {
    setParams(t === 'community' ? {} : { tab: t }, { replace: true });
    setSubject('');
    setLimit(PAGE_SIZE);
  };

  const lists = useMemo(() => {
    const community: BankItem[] = sharedQuestions
      .filter((q) => !q.parentId)
      .map((q) => ({
        id: q.id,
        content: q.content,
        preview: stripHtml(q.content),
        questionType: q.questionType,
        difficulty: q.difficulty,
        marks: q.marks,
        options: q.options || [],
        subject: q.subjectName,
        klass: q.className,
        chapter: q.chapter || q.topic,
        author: q.authorName,
        usageCount: q.usageCount,
        subCount: q.subquestions?.length || 0,
        createdAt: q.createdAt,
      }));
    const mine: BankItem[] = questions
      .filter((q) => !q.parentId)
      .map((q) => ({
        id: q.id,
        content: q.content,
        preview: stripHtml(q.content),
        questionType: q.questionType,
        difficulty: q.difficulty,
        marks: q.marks,
        options: q.options || [],
        subject: subjects.find((s) => s.id === q.subjectId)?.name,
        klass: classes.find((c) => c.id === q.classId)?.name,
        chapter: chapters.find((c) => c.id === q.chapterId)?.name,
        subCount: q.subquestions?.length || 0,
        createdAt: q.createdAt,
      }));
    const mineIds = new Set(sharedQuestions.filter((q) => q.createdByUserId === user?.id).map((q) => q.id));
    return {
      community,
      mine,
      contributions: community.filter((q) => mineIds.has(q.id)),
    };
  }, [sharedQuestions, questions, subjects, classes, chapters, user?.id]);

  const current = lists[tab];
  const subjectOptions = useMemo(
    () => [...new Set(current.map((q) => q.subject).filter(Boolean) as string[])].sort(),
    [current],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = current
      .filter((i) => !q || i.preview.toLowerCase().includes(q) || (i.chapter || '').toLowerCase().includes(q))
      .filter((i) => !type || i.questionType === type)
      .filter((i) => !difficulty || i.difficulty === difficulty)
      .filter((i) => !subject || i.subject === subject);
    return tab === 'mine' ? list.sort((a, b) => b.createdAt - a.createdAt) : list.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  }, [current, search, type, difficulty, subject, tab]);

  const contributionReuse = lists.contributions.reduce((a, q) => a + (q.usageCount || 0), 0);
  const hasFilters = !!(search || type || difficulty || subject);

  useEffect(() => {
    if (viewing) {
      const t = setTimeout(() => renderMath(), 50);
      return () => clearTimeout(t);
    }
  }, [viewing]);

  const tabs: { key: Tab; label: string; icon: typeof Users; count: number }[] = [
    { key: 'community', label: 'Community', icon: Users, count: lists.community.length },
    { key: 'mine', label: 'My questions', icon: PenLine, count: lists.mine.length },
    { key: 'contributions', label: 'My contributions', icon: Share2, count: lists.contributions.length },
  ];

  return (
    <div className="qf-stack">
      <PageHeader
        title="Question Bank"
        description="Browse questions written by you and by teachers across QuestForma."
      />

      <div className="qf-callout">
        <Info size={16} />
        <span>
          To add a question to a paper, open the paper in the editor and use the <strong>Question Bank</strong> panel.{' '}
          <Link to="/papers">Go to my papers</Link>
        </span>
      </div>

      <div className="qf-tabs" role="tablist" aria-label="Question source">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`qf-tab ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)}>
            <t.icon size={15} /> {t.label}
            <span className="qf-tab__count">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'contributions' && lists.contributions.length > 0 && (
        <div className="qf-impact">
          <TrendingUp size={18} />
          <span>Your shared questions have been used <strong>{contributionReuse}</strong> time{contributionReuse === 1 ? '' : 's'} by other teachers. Thank you for contributing!</span>
        </div>
      )}

      <div className="qf-toolbar">
        <div className="qf-search qf-search--inline">
          <Search size={16} className="qf-search__icon" />
          <input type="search" className="qf-search__input" placeholder="Search questions or chapters" aria-label="Search questions" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE_SIZE); }} />
        </div>
        <select className="qf-input qf-select qf-select--sm" value={type} onChange={(e) => setType(e.target.value)} aria-label="Question type">
          <option value="">All types</option>
          {Object.entries(QUESTION_TYPE_LABEL).filter(([k]) => k !== 'text').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="qf-input qf-select qf-select--sm" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Difficulty">
          <option value="">Any difficulty</option>
          {Object.entries(DIFFICULTY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {subjectOptions.length > 0 && (
          <select className="qf-input qf-select qf-select--sm" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
            <option value="">All subjects</option>
            {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {hasFilters && (
          <button type="button" className="qf-btn qf-btn--ghost qf-btn--sm" onClick={() => { setSearch(''); setType(''); setDifficulty(''); setSubject(''); }}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {current.length === 0 ? (
        <div className="qf-card">
          <EmptyState
            icon={tab === 'community' ? <Library size={22} /> : tab === 'mine' ? <PenLine size={22} /> : <Share2 size={22} />}
            title={tab === 'mine' ? 'No questions yet' : tab === 'contributions' ? 'You haven’t shared any questions yet' : 'The community bank is empty'}
            description={
              tab === 'mine'
                ? 'Questions you write in the editor are saved here automatically.'
                : tab === 'contributions'
                  ? 'Questions you write are shared with other teachers automatically, unless you keep them private in Settings.'
                  : 'Check back soon as teachers add questions.'
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="qf-card">
          <EmptyState icon={<SearchX size={22} />} title="No questions match" description="Try different keywords or remove a filter." />
        </div>
      ) : (
        <>
          <div className="qf-q-grid">
            {filtered.slice(0, limit).map((q) => (
              <button key={q.id} type="button" className="qf-q-card" onClick={() => setViewing(q)}>
                <div className="qf-q-card__chips">
                  <span className="qf-chip qf-chip--outline">{QUESTION_TYPE_LABEL[q.questionType] || q.questionType}</span>
                  <span className={`qf-chip qf-diff--${q.difficulty}`}>{DIFFICULTY_LABEL[q.difficulty] || q.difficulty}</span>
                  {q.marks ? <span className="qf-chip">{q.marks} mark{q.marks === 1 ? '' : 's'}</span> : null}
                  {q.subCount > 0 && <span className="qf-chip"><Layers size={12} /> {q.subCount} parts</span>}
                </div>
                <p className="qf-q-card__text">{q.preview || 'Image / formula question'}</p>
                <div className="qf-q-card__foot">
                  <span className="qf-q-card__ctx">{[q.subject, q.klass, q.chapter].filter(Boolean).join(' · ') || 'Uncategorised'}</span>
                  {tab !== 'mine' ? (
                    <span className="qf-q-card__ctx">{q.author || 'Educator'} · used {q.usageCount || 0}×</span>
                  ) : (
                    <span className="qf-q-card__ctx">Added {relativeTime(q.createdAt)}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
          {filtered.length > limit && (
            <div className="qf-center">
              <button type="button" className="qf-btn qf-btn--secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Show more ({filtered.length - limit} remaining)
              </button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!viewing} onClose={() => setViewing(null)} size="lg" title="Question preview">
        {viewing && (
          <div className="qf-q-view">
            <div className="qf-q-card__chips">
              <span className="qf-chip qf-chip--outline">{QUESTION_TYPE_LABEL[viewing.questionType]}</span>
              <span className={`qf-chip qf-diff--${viewing.difficulty}`}>{DIFFICULTY_LABEL[viewing.difficulty]}</span>
              {viewing.marks ? <span className="qf-chip">{viewing.marks} marks</span> : null}
              {viewing.subject && <span className="qf-chip">{viewing.subject}</span>}
              {viewing.klass && <span className="qf-chip">{viewing.klass}</span>}
            </div>
            <div className="qf-q-view__content" dangerouslySetInnerHTML={{ __html: preprocessMathHtml(viewing.content) }} />
            {viewing.questionType === 'mcq' && viewing.options.length > 0 && (
              <ol className="qf-q-view__options" type="A">
                {viewing.options.map((o, i) => <li key={i} dangerouslySetInnerHTML={{ __html: preprocessMathHtml(o) }} />)}
              </ol>
            )}
            {viewing.author && (
              <p className="qf-q-view__by">Contributed by <strong>{viewing.author}</strong> · used {viewing.usageCount || 0} times</p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

