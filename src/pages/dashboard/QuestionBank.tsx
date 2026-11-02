import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Library, Users, PenLine, Share2, Info, SearchX, Layers, TrendingUp, X, Filter, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { Difficulty, QuestionType, CognitiveLevel } from '../../types';
import { COGNITIVE_LEVELS } from '../../types';
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
  cognitiveLevel?: CognitiveLevel;
  marks?: number;
  options: string[];
  courseId?: string;
  courseName?: string;
  subjectId?: string;
  subject?: string;
  classId?: string;
  klass?: string;
  chapterId?: string;
  chapter?: string;
  topicId?: string;
  topic?: string;
  categoryId?: string;
  category?: string;
  author?: string;
  usageCount?: number;
  subCount: number;
  createdAt: number;
}

const PAGE_SIZE = 24;

const COGNITIVE_COLOR_MAP: Record<CognitiveLevel, string> = {
  remember: '#d97706',
  understand: '#0284c7',
  apply: '#16a34a',
  analyse: '#7c3aed',
  evaluate: '#ea580c',
  create: '#dc2626',
};

export default function QuestionBank() {
  const { user, questions, sharedQuestions, courses, subjects, classes, chapters, topics, categories } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'community';

  // Search & Type
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [difficulty, setDifficulty] = useState('');

  // 8 Advanced Filters (matching inner panel)
  const [showFilters, setShowFilters] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [marksFilter, setMarksFilter] = useState('');
  const [cognitiveFilter, setCognitiveFilter] = useState<CognitiveLevel | ''>('');
  const [courseFilter, setCourseFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [limit, setLimit] = useState(PAGE_SIZE);
  const [viewing, setViewing] = useState<BankItem | null>(null);

  const resetAllFilters = () => {
    setSearch('');
    setType('');
    setDifficulty('');
    setSubjectFilter('');
    setClassFilter('');
    setChapterFilter('');
    setTopicFilter('');
    setMarksFilter('');
    setCognitiveFilter('');
    setCourseFilter('');
    setCategoryFilter('');
    setLimit(PAGE_SIZE);
  };

  const setTab = (t: Tab) => {
    setParams(t === 'community' ? {} : { tab: t }, { replace: true });
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
        cognitiveLevel: q.cognitiveLevel,
        marks: q.marks,
        options: q.options || [],
        courseId: q.courseId,
        courseName: q.courseName,
        subjectId: q.subjectId,
        subject: q.subjectName,
        classId: q.classId,
        klass: q.className,
        chapter: q.chapter,
        topic: q.topic,
        category: q.category,
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
        cognitiveLevel: q.cognitiveLevel,
        marks: q.marks,
        options: q.options || [],
        courseId: q.courseId,
        courseName: courses.find((c) => c.id === q.courseId)?.name,
        subjectId: q.subjectId,
        subject: subjects.find((s) => s.id === q.subjectId)?.name,
        classId: q.classId,
        klass: classes.find((c) => c.id === q.classId)?.name,
        chapterId: q.chapterId,
        chapter: chapters.find((c) => c.id === q.chapterId)?.name,
        topicId: q.topicId,
        topic: topics.find((t) => t.id === q.topicId)?.name,
        categoryId: q.categoryId,
        category: categories.find((c) => c.id === q.categoryId)?.name,
        subCount: q.subquestions?.length || 0,
        createdAt: q.createdAt,
      }));

    const mineIds = new Set(sharedQuestions.filter((q) => q.createdByUserId === user?.id).map((q) => q.id));
    return {
      community,
      mine,
      contributions: community.filter((q) => mineIds.has(q.id)),
    };
  }, [sharedQuestions, questions, courses, subjects, classes, chapters, topics, categories, user?.id]);

  const current = lists[tab];

  // Distinct filter options across store tables & question records
  const filterOptions = useMemo(() => {
    const courseSet = new Set<string>();
    courses.forEach((c) => courseSet.add(c.name));
    sharedQuestions.forEach((q) => { if (q.courseName) courseSet.add(q.courseName); });

    const subjectSet = new Set<string>();
    subjects.forEach((s) => subjectSet.add(s.name));
    sharedQuestions.forEach((q) => { if (q.subjectName) subjectSet.add(q.subjectName); });

    const classSet = new Set<string>();
    classes.forEach((c) => classSet.add(c.name));
    sharedQuestions.forEach((q) => { if (q.className) classSet.add(q.className); });

    const chapterSet = new Set<string>();
    chapters.forEach((ch) => chapterSet.add(ch.name));
    sharedQuestions.forEach((q) => { if (q.chapter) chapterSet.add(q.chapter); });

    const topicSet = new Set<string>();
    topics.forEach((tp) => topicSet.add(tp.name));
    sharedQuestions.forEach((q) => { if (q.topic) topicSet.add(q.topic); });

    const categorySet = new Set<string>();
    categories.forEach((cat) => categorySet.add(cat.name));
    sharedQuestions.forEach((q) => { if (q.category) categorySet.add(q.category); });

    return {
      courses: Array.from(courseSet).sort(),
      subjects: Array.from(subjectSet).sort(),
      classes: Array.from(classSet).sort(),
      chapters: Array.from(chapterSet).sort(),
      topics: Array.from(topicSet).sort(),
      categories: Array.from(categorySet).sort(),
    };
  }, [courses, subjects, classes, chapters, topics, categories, sharedQuestions]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (type) count++;
    if (difficulty) count++;
    if (subjectFilter) count++;
    if (classFilter) count++;
    if (chapterFilter) count++;
    if (topicFilter) count++;
    if (marksFilter) count++;
    if (cognitiveFilter) count++;
    if (courseFilter) count++;
    if (categoryFilter) count++;
    return count;
  }, [type, difficulty, subjectFilter, classFilter, chapterFilter, topicFilter, marksFilter, cognitiveFilter, courseFilter, categoryFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const parsedMarks = marksFilter ? parseInt(marksFilter, 10) : null;

    const list = current
      .filter((i) => {
        if (!q) return true;
        return (
          i.preview.toLowerCase().includes(q) ||
          (i.chapter || '').toLowerCase().includes(q) ||
          (i.topic || '').toLowerCase().includes(q) ||
          (i.subject || '').toLowerCase().includes(q) ||
          (i.author || '').toLowerCase().includes(q)
        );
      })
      .filter((i) => !type || i.questionType === type)
      .filter((i) => !difficulty || i.difficulty === difficulty)
      .filter((i) => !subjectFilter || (i.subject && i.subject.toLowerCase() === subjectFilter.toLowerCase()))
      .filter((i) => !classFilter || (i.klass && i.klass.toLowerCase() === classFilter.toLowerCase()))
      .filter((i) => !chapterFilter || (i.chapter && i.chapter.toLowerCase() === chapterFilter.toLowerCase()))
      .filter((i) => !topicFilter || (i.topic && i.topic.toLowerCase() === topicFilter.toLowerCase()))
      .filter((i) => parsedMarks === null || i.marks === parsedMarks)
      .filter((i) => !cognitiveFilter || (i.cognitiveLevel || 'understand').toLowerCase() === cognitiveFilter.toLowerCase())
      .filter((i) => !courseFilter || (i.courseName && i.courseName.toLowerCase().includes(courseFilter.toLowerCase())))
      .filter((i) => !categoryFilter || (i.category && i.category.toLowerCase().includes(categoryFilter.toLowerCase())));

    return tab === 'mine'
      ? list.sort((a, b) => b.createdAt - a.createdAt)
      : list.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  }, [current, search, type, difficulty, subjectFilter, classFilter, chapterFilter, topicFilter, marksFilter, cognitiveFilter, courseFilter, categoryFilter, tab]);

  const contributionReuse = lists.contributions.reduce((a, q) => a + (q.usageCount || 0), 0);
  const hasFilters = !!(search || activeFilterCount > 0);

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

      {/* Main Toolbar */}
      <div className="qf-toolbar">
        <div className="qf-search qf-search--inline">
          <Search size={16} className="qf-search__icon" />
          <input
            type="search"
            className="qf-search__input"
            placeholder="Search questions, chapters, authors..."
            aria-label="Search questions"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setLimit(PAGE_SIZE); }}
          />
          {search && (
            <button
              type="button"
              className="qf-search__clear"
              onClick={() => setSearch('')}
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <select className="qf-input qf-select qf-select--sm" value={type} onChange={(e) => setType(e.target.value)} aria-label="Question type">
          <option value="">All types</option>
          {Object.entries(QUESTION_TYPE_LABEL).filter(([k]) => k !== 'text').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select className="qf-input qf-select qf-select--sm" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Difficulty">
          <option value="">Any difficulty</option>
          {Object.entries(DIFFICULTY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <button
          type="button"
          className={`qf-btn ${showFilters || activeFilterCount > 0 ? 'qf-btn--secondary' : 'qf-btn--ghost'} qf-btn--sm`}
          onClick={() => setShowFilters(!showFilters)}
          title="Toggle advanced filters"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Filter size={14} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="qf-badge qf-badge--upcoming" style={{ height: 18, padding: '0 6px', fontSize: 11 }}>
              {activeFilterCount}
            </span>
          )}
          {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {hasFilters && (
          <button type="button" className="qf-btn qf-btn--ghost qf-btn--sm" onClick={resetAllFilters}>
            <RotateCcw size={13} /> Clear all
          </button>
        )}
      </div>

      {/* Collapsible 8-Filter Drawer (Subject, Class, Chapter, Topic, Marks, Cognitive Level / Bloom's, Course/Board, Stream) */}
      {showFilters && (
        <div className="qf-filter-drawer">
          <div className="qf-filter-drawer__header">
            <span className="qf-filter-drawer__title">Advanced Filters</span>
            {activeFilterCount > 0 && (
              <button
                type="button"
                className="qf-btn qf-btn--ghost qf-btn--sm"
                onClick={resetAllFilters}
                style={{ padding: '2px 8px', fontSize: 12 }}
              >
                <RotateCcw size={12} /> Reset ({activeFilterCount})
              </button>
            )}
          </div>

          <div className="qf-filter-grid-8">
            {/* 1. Subject */}
            <div className="qf-filter-cell">
              <label htmlFor="qf-filter-subject">Subject</label>
              <select
                id="qf-filter-subject"
                className="qf-input qf-select qf-select--sm"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
              >
                <option value="">All Subjects</option>
                {filterOptions.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* 2. Class / Grade */}
            <div className="qf-filter-cell">
              <label htmlFor="qf-filter-class">Class / Grade</label>
              <select
                id="qf-filter-class"
                className="qf-input qf-select qf-select--sm"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="">All Classes</option>
                {filterOptions.classes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* 3. Chapter */}
            <div className="qf-filter-cell">
              <label htmlFor="qf-filter-chapter">Chapter</label>
              <select
                id="qf-filter-chapter"
                className="qf-input qf-select qf-select--sm"
                value={chapterFilter}
                onChange={(e) => setChapterFilter(e.target.value)}
              >
                <option value="">All Chapters</option>
                {filterOptions.chapters.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
              </select>
            </div>

            {/* 4. Topic */}
            <div className="qf-filter-cell">
              <label htmlFor="qf-filter-topic">Topic</label>
              <select
                id="qf-filter-topic"
                className="qf-input qf-select qf-select--sm"
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
              >
                <option value="">All Topics</option>
                {filterOptions.topics.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
              </select>
            </div>

            {/* 5. Marks */}
            <div className="qf-filter-cell">
              <label htmlFor="qf-filter-marks">Marks</label>
              <select
                id="qf-filter-marks"
                className="qf-input qf-select qf-select--sm"
                value={marksFilter}
                onChange={(e) => setMarksFilter(e.target.value)}
              >
                <option value="">Any Marks</option>
                {[1, 2, 3, 4, 5, 6, 8, 10].map((m) => (
                  <option key={m} value={m}>{m} {m === 1 ? 'Mark' : 'Marks'}</option>
                ))}
              </select>
            </div>

            {/* 6. Cognitive Level (Bloom's Taxonomy) */}
            <div className="qf-filter-cell">
              <label htmlFor="qf-filter-cognitive">Cognitive Level (Bloom's)</label>
              <select
                id="qf-filter-cognitive"
                className="qf-input qf-select qf-select--sm"
                value={cognitiveFilter}
                onChange={(e) => setCognitiveFilter(e.target.value as CognitiveLevel | '')}
              >
                <option value="">All Cognitive Levels</option>
                {COGNITIVE_LEVELS.map((cl) => (
                  <option key={cl.value} value={cl.value}>{cl.label}</option>
                ))}
              </select>
            </div>

            {/* 7. Course / Board */}
            <div className="qf-filter-cell">
              <label htmlFor="qf-filter-course">Course / Board</label>
              <select
                id="qf-filter-course"
                className="qf-input qf-select qf-select--sm"
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
              >
                <option value="">All Boards / Courses</option>
                {filterOptions.courses.map((co) => <option key={co} value={co}>{co}</option>)}
              </select>
            </div>

            {/* 8. Stream / Category */}
            <div className="qf-filter-cell">
              <label htmlFor="qf-filter-category">Stream / Category</label>
              <select
                id="qf-filter-category"
                className="qf-input qf-select qf-select--sm"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Streams</option>
                {filterOptions.categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Quick Active Filter Badges Strip */}
      {!showFilters && activeFilterCount > 0 && (
        <div className="qf-active-filter-strip">
          <span style={{ fontWeight: 600, color: 'var(--qf-text-2)' }}>Filtered by:</span>
          {subjectFilter && (
            <span className="qf-active-filter-tag">
              Subject: {subjectFilter}
              <button type="button" onClick={() => setSubjectFilter('')} title="Remove subject filter">
                <X size={11} />
              </button>
            </span>
          )}
          {classFilter && (
            <span className="qf-active-filter-tag">
              Class: {classFilter}
              <button type="button" onClick={() => setClassFilter('')} title="Remove class filter">
                <X size={11} />
              </button>
            </span>
          )}
          {chapterFilter && (
            <span className="qf-active-filter-tag">
              Chapter: {chapterFilter}
              <button type="button" onClick={() => setChapterFilter('')} title="Remove chapter filter">
                <X size={11} />
              </button>
            </span>
          )}
          {topicFilter && (
            <span className="qf-active-filter-tag">
              Topic: {topicFilter}
              <button type="button" onClick={() => setTopicFilter('')} title="Remove topic filter">
                <X size={11} />
              </button>
            </span>
          )}
          {marksFilter && (
            <span className="qf-active-filter-tag">
              Marks: {marksFilter}m
              <button type="button" onClick={() => setMarksFilter('')} title="Remove marks filter">
                <X size={11} />
              </button>
            </span>
          )}
          {cognitiveFilter && (
            <span className="qf-active-filter-tag">
              <span className="qf-cog-dot" style={{ background: COGNITIVE_COLOR_MAP[cognitiveFilter] }} />
              Level: {cognitiveFilter}
              <button type="button" onClick={() => setCognitiveFilter('')} title="Remove cognitive level filter">
                <X size={11} />
              </button>
            </span>
          )}
          {courseFilter && (
            <span className="qf-active-filter-tag">
              Board: {courseFilter}
              <button type="button" onClick={() => setCourseFilter('')} title="Remove board filter">
                <X size={11} />
              </button>
            </span>
          )}
          {categoryFilter && (
            <span className="qf-active-filter-tag">
              Stream: {categoryFilter}
              <button type="button" onClick={() => setCategoryFilter('')} title="Remove stream filter">
                <X size={11} />
              </button>
            </span>
          )}
          <button
            type="button"
            className="qf-btn qf-btn--ghost qf-btn--sm"
            onClick={resetAllFilters}
            style={{ padding: '1px 6px', fontSize: 11, height: 'auto', marginLeft: 'auto' }}
          >
            Clear all
          </button>
        </div>
      )}

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
            {filtered.slice(0, limit).map((q) => {
              const cogLevel = q.cognitiveLevel || 'understand';
              return (
                <button key={q.id} type="button" className="qf-q-card" onClick={() => setViewing(q)}>
                  <div className="qf-q-card__chips">
                    <span className="qf-chip qf-chip--outline">{QUESTION_TYPE_LABEL[q.questionType] || q.questionType}</span>
                    <span className={`qf-chip qf-diff--${q.difficulty}`}>{DIFFICULTY_LABEL[q.difficulty] || q.difficulty}</span>
                    <span className="qf-chip" title={`Bloom's Taxonomy Cognitive Level: ${cogLevel}`}>
                      <span className="qf-cog-dot" style={{ background: COGNITIVE_COLOR_MAP[cogLevel] }} />
                      <span style={{ textTransform: 'capitalize' }}>{cogLevel}</span>
                    </span>
                    {q.marks ? <span className="qf-chip">{q.marks} mark{q.marks === 1 ? '' : 's'}</span> : null}
                    {q.subCount > 0 && <span className="qf-chip"><Layers size={12} /> {q.subCount} parts</span>}
                  </div>
                  <p className="qf-q-card__text">{q.preview || 'Image / formula question'}</p>
                  <div className="qf-q-card__foot">
                    <span className="qf-q-card__ctx">{[q.subject, q.klass, q.chapter || q.topic].filter(Boolean).join(' · ') || 'Uncategorised'}</span>
                    {tab !== 'mine' ? (
                      <span className="qf-q-card__ctx">{q.author || 'Educator'} · used {q.usageCount || 0}×</span>
                    ) : (
                      <span className="qf-q-card__ctx">Added {relativeTime(q.createdAt)}</span>
                    )}
                  </div>
                </button>
              );
            })}
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
              {viewing.cognitiveLevel && (
                <span className="qf-chip" title="Bloom's Taxonomy Level">
                  <span className="qf-cog-dot" style={{ background: COGNITIVE_COLOR_MAP[viewing.cognitiveLevel] }} />
                  <span style={{ textTransform: 'capitalize' }}>{viewing.cognitiveLevel}</span>
                </span>
              )}
              {viewing.marks ? <span className="qf-chip">{viewing.marks} marks</span> : null}
              {viewing.subject && <span className="qf-chip">{viewing.subject}</span>}
              {viewing.klass && <span className="qf-chip">{viewing.klass}</span>}
              {viewing.chapter && <span className="qf-chip">Ch: {viewing.chapter}</span>}
              {viewing.topic && viewing.topic !== viewing.chapter && <span className="qf-chip">Topic: {viewing.topic}</span>}
              {viewing.courseName && <span className="qf-chip">{viewing.courseName}</span>}
              {viewing.category && <span className="qf-chip">{viewing.category}</span>}
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

