import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Library, Users, PenLine, Share2, Info, SearchX, Layers, TrendingUp, X, Filter, ChevronDown, ChevronUp, RotateCcw, Plus, Check, Trash2, Loader2, ChevronRight } from 'lucide-react';
import type { Difficulty, QuestionType, CognitiveLevel, SubQuestionNumberingStyle } from '../../types';
import { COGNITIVE_LEVELS, DEFAULT_COGNITIVE_LEVEL } from '../../types';
import { useStore } from '../../store';
import { renderMath, preprocessMathHtml, quillFormulaToLatex } from '../../utils/mathjax';
import FullQuill from '../../components/FullQuill';
import { PageHeader, EmptyState } from './components';
import Dialog from './Dialog';
import { DIFFICULTY_LABEL, QUESTION_TYPE_LABEL, relativeTime, stripHtml } from './utils';

type Tab = 'community' | 'mine' | 'contributions';

interface DraftSubquestion {
  id: string;
  type: QuestionType;
  content: string;
  options: string[];
  marks: number;
  cognitiveLevel?: CognitiveLevel;
  subNumberingStyle?: SubQuestionNumberingStyle;
  isOptional?: boolean;
  isExpanded?: boolean;
}

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
  subquestions?: any[];
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
  const {
    user,
    questions,
    sharedQuestions,
    questionPapers,
    courses,
    subjects,
    classes,
    chapters,
    topics,
    categories,
    createQuestion,
    addQuestionToPaper,
    importSharedQuestionToPaper,
    createChapter,
    createTopic,
    createCategory,
  } = useStore();
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

  // Question Bank Constructor State
  const [isConstructorOpen, setIsConstructorOpen] = useState(false);
  const [draftType, setDraftType] = useState<QuestionType>('subjective');
  const [draftContent, setDraftContent] = useState('');
  const [draftOptions, setDraftOptions] = useState<string[]>(['', '', '', '']);
  const [draftMarks, setDraftMarks] = useState<number>(1);
  const [draftDifficulty, setDraftDifficulty] = useState<Difficulty>('medium');
  const [draftIsOptional, setDraftIsOptional] = useState<boolean>(false);
  const [draftCourseId, setDraftCourseId] = useState('');
  const [draftSubjectId, setDraftSubjectId] = useState('');
  const [draftChapterId, setDraftChapterId] = useState('');
  const [draftTopicId, setDraftTopicId] = useState('');
  const [draftCategoryId, setDraftCategoryId] = useState('');
  const [draftCognitiveLevel, setDraftCognitiveLevel] = useState<CognitiveLevel>(DEFAULT_COGNITIVE_LEVEL);
  const [draftSubNumberingStyle, setDraftSubNumberingStyle] = useState<SubQuestionNumberingStyle | ''>('');
  const [draftSubquestions, setDraftSubquestions] = useState<DraftSubquestion[]>([]);

  // Inline taxonomy creator states
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [isCreatingQuestion, setIsCreatingQuestion] = useState(false);
  const [createError, setCreateError] = useState('');

  // Add to Paper State (for preview modal)
  const [targetPaperId, setTargetPaperId] = useState('');
  const [targetSection, setTargetSection] = useState('');
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const [isAddingToPaper, setIsAddingToPaper] = useState(false);

  const handleAddOption = () => {
    if (draftOptions.length < 8) {
      setDraftOptions([...draftOptions, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (draftOptions.length > 2) {
      setDraftOptions(draftOptions.filter((_, i) => i !== index));
    }
  };

  const handleAddDraftSubquestion = () => {
    const newSub: DraftSubquestion = {
      id: 'draft-sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      type: 'subjective',
      content: '',
      options: ['', '', '', ''],
      marks: 1,
      cognitiveLevel: DEFAULT_COGNITIVE_LEVEL,
      isOptional: false,
      isExpanded: true,
    };
    setDraftSubquestions([...draftSubquestions, newSub]);
  };

  const handleUpdateDraftSubquestion = (id: string, field: keyof DraftSubquestion, value: any) => {
    setDraftSubquestions(draftSubquestions.map((sq) => {
      if (sq.id === id) {
        return { ...sq, [field]: value };
      }
      return sq;
    }));
  };

  const handleRemoveDraftSubquestion = (id: string) => {
    setDraftSubquestions(draftSubquestions.filter((sq) => sq.id !== id));
  };

  const handleCancelDraft = () => {
    setIsConstructorOpen(false);
    setDraftType('subjective');
    setDraftContent('');
    setDraftOptions(['', '', '', '']);
    setDraftMarks(1);
    setDraftDifficulty('medium');
    setDraftIsOptional(false);
    setDraftCourseId('');
    setDraftSubjectId('');
    setDraftChapterId('');
    setDraftTopicId('');
    setDraftCategoryId('');
    setDraftCognitiveLevel(DEFAULT_COGNITIVE_LEVEL);
    setDraftSubNumberingStyle('');
    setDraftSubquestions([]);
    setIsAddingChapter(false);
    setNewChapterName('');
    setIsAddingTopic(false);
    setNewTopicName('');
    setIsAddingCategory(false);
    setNewCategoryName('');
    setCreateError('');
  };

  const handleSaveDraftQuestion = async () => {
    const rawContent = quillFormulaToLatex(draftContent.trim());
    const contentText = rawContent.replace(/<[^>]*>/g, '').trim();
    const hasMediaOrMath = /<img\b|<span[^>]*class=["'][^"']*ql-formula/i.test(draftContent) || /\\\(|\\\[|\$\$|\$/.test(rawContent);
    if (!contentText && !hasMediaOrMath) {
      setCreateError('Please enter question content.');
      return;
    }

    const processedOptions = draftOptions.map((o) => quillFormulaToLatex(o.trim())).filter((o) => {
      const text = o.replace(/<[^>]*>/g, '').trim();
      return text.length > 0 || /<img\b|<span[^>]*class=["'][^"']*ql-formula/i.test(o) || /\\\(|\\\[|\$\$|\$/.test(o);
    });

    if (draftType === 'mcq') {
      if (processedOptions.length < 2) {
        setCreateError('Please provide at least 2 options for multiple choice questions.');
        return;
      }
    }

    const processedSubquestions = draftSubquestions.map((sq, idx) => {
      const sqRaw = quillFormulaToLatex(sq.content.trim());
      const sqOpts = (sq.options || []).map((o) => quillFormulaToLatex(o.trim())).filter((o) => {
        const text = o.replace(/<[^>]*>/g, '').trim();
        return text.length > 0 || /<img\b|<span[^>]*class=["'][^"']*ql-formula/i.test(o) || /\\\(|\\\[|\$\$|\$/.test(o);
      });
      return {
        id: sq.id,
        content: sqRaw,
        questionType: sq.type,
        marks: sq.type === 'text' ? 0 : (sq.marks ?? 1),
        options: sqOpts,
        cognitiveLevel: sq.cognitiveLevel || DEFAULT_COGNITIVE_LEVEL,
        subNumberingStyle: sq.subNumberingStyle,
        isOptional: sq.isOptional,
        order: idx + 1,
      };
    });

    setIsCreatingQuestion(true);
    setCreateError('');
    try {
      await createQuestion(
        rawContent,
        draftType,
        draftType === 'mcq' ? processedOptions : undefined,
        draftCourseId || undefined,
        draftSubjectId || undefined,
        undefined,
        draftDifficulty,
        undefined,
        undefined,
        {
          courseId: draftCourseId || undefined,
          subjectId: draftSubjectId || undefined,
          chapterId: draftChapterId || undefined,
          topicId: draftTopicId || undefined,
          categoryId: draftCategoryId || undefined,
          cognitiveLevel: draftCognitiveLevel,
        },
        draftType === 'text' ? 0 : draftMarks,
        undefined,
        processedSubquestions.length > 0 ? (processedSubquestions as any) : undefined,
        draftSubNumberingStyle || undefined
      );

      handleCancelDraft();
      setTab('mine');
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || 'Failed to save question.');
    } finally {
      setIsCreatingQuestion(false);
    }
  };

  const handleAddToPaper = async () => {
    if (!targetPaperId || !viewing) return;
    setIsAddingToPaper(true);
    try {
      if (tab === 'community' || !questions.some((q) => q.id === viewing.id)) {
        const sharedQ = sharedQuestions.find((sq) => sq.id === viewing.id);
        if (sharedQ) {
          await importSharedQuestionToPaper(targetPaperId, sharedQ, targetSection, viewing.marks || 1);
        } else {
          await addQuestionToPaper(targetPaperId, viewing.id, targetSection, viewing.marks || 1);
        }
      } else {
        await addQuestionToPaper(targetPaperId, viewing.id, targetSection, viewing.marks || 1);
      }
      const paperName = questionPapers.find((p) => p.id === targetPaperId)?.title || 'paper';
      setAddedMessage(`Question successfully added to "${paperName}"!`);
      setTimeout(() => setAddedMessage(null), 5000);
    } catch (e: any) {
      console.error(e);
      setAddedMessage(e.message || 'Failed to add question to paper.');
    } finally {
      setIsAddingToPaper(false);
    }
  };

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
        subquestions: q.subquestions || [],
        createdAt: q.createdAt,
      }));

    const mine: BankItem[] = questions
      .filter((q) => !q.parentId)
      .map((q) => {
        const childQuestions = questions.filter((sq) => sq.parentId === q.id);
        const resolvedSubqs = q.subquestions && q.subquestions.length > 0 ? q.subquestions : childQuestions;
        return {
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
          subCount: resolvedSubqs.length,
          subquestions: resolvedSubqs,
          createdAt: q.createdAt,
        };
      });

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
          i.content.toLowerCase().includes(q) ||
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

  // Render MathJax whenever questions list updates, paginates, or changes tabs
  useEffect(() => {
    const timer = setTimeout(() => {
      void renderMath();
    }, 60);
    return () => clearTimeout(timer);
  }, [filtered, limit, tab]);

  useEffect(() => {
    if (viewing) {
      const t = setTimeout(() => {
        void renderMath();
      }, 60);
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
        actions={
          <button
            type="button"
            className="qf-btn qf-btn--primary"
            onClick={() => { handleCancelDraft(); setIsConstructorOpen(true); }}
          >
            <Plus size={16} /> Add question
          </button>
        }
      />

      <div className="qf-callout">
        <Info size={16} />
        <span>
          To add a question to a paper, open the paper in the editor and use the <strong>Question Bank</strong> panel.{' '}
          <Link to="/dashboard/papers">Go to my papers</Link>
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
                ? 'Questions you write in the editor or add here are saved in your Question Bank.'
                : tab === 'contributions'
                  ? 'Questions you write are shared with other teachers automatically, unless you keep them private in Settings.'
                  : 'Check back soon as teachers add questions.'
            }
            action={
              tab === 'mine' ? (
                <button
                  type="button"
                  className="qf-btn qf-btn--primary"
                  onClick={() => { handleCancelDraft(); setIsConstructorOpen(true); }}
                >
                  <Plus size={15} /> Add question
                </button>
              ) : undefined
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
                  <div
                    className="qf-q-card__text tex2jax_process"
                    dangerouslySetInnerHTML={{
                      __html: preprocessMathHtml(q.content) || '<span style="color:var(--qf-text-3)">Empty question</span>',
                    }}
                  />
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
            <div className="qf-q-view__content tex2jax_process" dangerouslySetInnerHTML={{ __html: preprocessMathHtml(viewing.content) }} />
            {viewing.questionType === 'mcq' && viewing.options.length > 0 && (
              <ol className="qf-q-view__options tex2jax_process" type="A">
                {viewing.options.map((o, i) => <li key={i} dangerouslySetInnerHTML={{ __html: preprocessMathHtml(o) }} />)}
              </ol>
            )}

            {viewing.subquestions && viewing.subquestions.length > 0 && (
              <div className="qf-q-view__subquestions" style={{ marginTop: 16, borderTop: '1px solid var(--qf-border)', paddingTop: 14 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--qf-text-2)' }}>
                  Sub-questions ({viewing.subquestions.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {viewing.subquestions.map((sq: any, sidx: number) => (
                    <div key={sq.id || sidx} style={{ padding: '10px 12px', background: 'var(--qf-surface-2, rgba(0,0,0,0.02))', borderRadius: 6, border: '1px solid var(--qf-border)' }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>Part {sidx + 1}</span>
                        {sq.marks ? <span className="qf-chip" style={{ fontSize: 11, padding: '1px 6px' }}>{sq.marks} mark{sq.marks === 1 ? '' : 's'}</span> : null}
                        {sq.isOptional && <span className="qf-chip" style={{ fontSize: 11, padding: '1px 6px' }}>Optional</span>}
                      </div>
                      <div className="tex2jax_process" dangerouslySetInnerHTML={{ __html: preprocessMathHtml(sq.content) }} />
                      {sq.options && sq.options.length > 0 && (
                        <ol type="A" style={{ marginTop: 6, paddingLeft: 18 }} className="tex2jax_process">
                          {sq.options.map((opt: string, oi: number) => (
                            <li key={oi} dangerouslySetInnerHTML={{ __html: preprocessMathHtml(opt) }} />
                          ))}
                        </ol>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {viewing.author && (
              <p className="qf-q-view__by">Contributed by <strong>{viewing.author}</strong> · used {viewing.usageCount || 0} times</p>
            )}

            {questionPapers.length > 0 && (
              <div className="qf-q-add-to-paper-box">
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--qf-text-3)' }}>
                  Add to a Test Paper
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    className="qf-input qf-select qf-select--sm"
                    style={{ minWidth: 200, flex: 1 }}
                    value={targetPaperId}
                    onChange={(e) => setTargetPaperId(e.target.value)}
                  >
                    <option value="">Select paper...</option>
                    {questionPapers.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="qf-input qf-input--sm"
                    style={{ width: 140 }}
                    placeholder="Section (optional)"
                    value={targetSection}
                    onChange={(e) => setTargetSection(e.target.value)}
                  />
                  <button
                    type="button"
                    className="qf-btn qf-btn--primary qf-btn--sm"
                    disabled={!targetPaperId || isAddingToPaper}
                    onClick={handleAddToPaper}
                  >
                    {isAddingToPaper ? <Loader2 size={13} className="qf-spin" /> : <Plus size={13} />}
                    {isAddingToPaper ? 'Adding...' : 'Add to paper'}
                  </button>
                </div>
                {addedMessage && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12.5, color: 'var(--qf-success, #16a34a)', fontWeight: 500 }}>
                    <Check size={14} />
                    <span>{addedMessage}</span>
                    {targetPaperId && (
                      <button
                        type="button"
                        className="qf-btn qf-btn--ghost qf-btn--sm"
                        style={{ padding: '2px 8px', fontSize: 12, height: 24, marginLeft: 'auto' }}
                        onClick={() => window.open(`/editor/${targetPaperId}`, '_blank')}
                      >
                        Open paper in new window →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* QUESTION BANK CONSTRUCTOR MODAL */}
      {isConstructorOpen && (
        <div className="modal-overlay" onClick={handleCancelDraft}>
          <div
            className="modal question-editor-modal"
            style={{ maxWidth: '820px', height: '88vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h2 className="modal-title">Question Bank Constructor</h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Configure question details, taxonomy, options, and nested subquestions
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCancelDraft}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-content" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {createError && (
                <div className="qf-form__error" style={{ marginBottom: 16 }}>
                  {createError}
                </div>
              )}

              {/* Top row: Question Type, Marks, Difficulty, Optional */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 15, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="property-field" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                  <label className="property-label">Question Type</label>
                  <select
                    className="property-input"
                    value={draftType}
                    onChange={(e) => setDraftType(e.target.value as QuestionType)}
                  >
                    <option value="subjective">Subjective</option>
                    <option value="mcq">Multiple Choice</option>
                    <option value="text">Text / Reading Passage (No Marks)</option>
                  </select>
                </div>

                {draftType !== 'text' && (
                  <div className="property-field" style={{ flex: 1, minWidth: 100, marginBottom: 0 }}>
                    <label className="property-label">Marks</label>
                    <input
                      type="number"
                      className="property-input"
                      value={draftMarks}
                      onChange={(e) => setDraftMarks(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      min={1}
                    />
                  </div>
                )}

                <div className="property-field" style={{ flex: 1, minWidth: 130, marginBottom: 0 }}>
                  <label className="property-label">Difficulty</label>
                  <select
                    className="property-input"
                    value={draftDifficulty}
                    onChange={(e) => setDraftDifficulty(e.target.value as Difficulty)}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div className="property-field" style={{ flex: '0 0 auto', marginBottom: 0, paddingBottom: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={draftIsOptional}
                      onChange={(e) => setDraftIsOptional(e.target.checked)}
                    />
                    <span>Optional Question</span>
                  </label>
                </div>
              </div>

              {/* Question Classification & Taxonomy Card */}
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 15,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                    Question Classification & Taxonomy
                  </span>
                  <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>
                    Classify & tag for reuse across papers
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  {/* Course Dropdown */}
                  <div>
                    <label className="property-label" style={{ fontSize: 11, marginBottom: 2 }}>Course / Board</label>
                    <select
                      className="property-input"
                      style={{ fontSize: 12, padding: '5px 8px' }}
                      value={draftCourseId}
                      onChange={(e) => setDraftCourseId(e.target.value)}
                    >
                      <option value="">No Course / Board</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Subject Dropdown */}
                  <div>
                    <label className="property-label" style={{ fontSize: 11, marginBottom: 2 }}>Subject</label>
                    <select
                      className="property-input"
                      style={{ fontSize: 12, padding: '5px 8px' }}
                      value={draftSubjectId}
                      onChange={(e) => {
                        setDraftSubjectId(e.target.value);
                        if (draftChapterId) {
                          const ch = chapters.find((c) => c.id === draftChapterId);
                          if (ch && ch.subjectId && ch.subjectId !== e.target.value) {
                            setDraftChapterId('');
                            setDraftTopicId('');
                          }
                        }
                      }}
                    >
                      <option value="">No Subject</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Chapter Dropdown */}
                  <div>
                    <label className="property-label" style={{ fontSize: 11, marginBottom: 2 }}>Chapter</label>
                    {isAddingChapter ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          type="text"
                          className="property-input"
                          style={{ fontSize: 12, padding: '4px 8px' }}
                          autoFocus
                          placeholder="New chapter..."
                          value={newChapterName}
                          onChange={(e) => setNewChapterName(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && newChapterName.trim()) {
                              const cId = await createChapter(newChapterName.trim(), draftSubjectId || undefined);
                              if (cId) setDraftChapterId(cId);
                              setIsAddingChapter(false);
                              setNewChapterName('');
                            } else if (e.key === 'Escape') {
                              setIsAddingChapter(false);
                              setNewChapterName('');
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={async () => {
                            if (newChapterName.trim()) {
                              const cId = await createChapter(newChapterName.trim(), draftSubjectId || undefined);
                              if (cId) setDraftChapterId(cId);
                            }
                            setIsAddingChapter(false);
                            setNewChapterName('');
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 6px', fontSize: 11 }}
                          onClick={() => { setIsAddingChapter(false); setNewChapterName(''); }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <select
                        className="property-input"
                        style={{ fontSize: 12, padding: '5px 8px' }}
                        value={draftChapterId}
                        onChange={(e) => {
                          if (e.target.value === '__ADD_NEW__') {
                            setIsAddingChapter(true);
                          } else {
                            setDraftChapterId(e.target.value);
                            if (draftTopicId) {
                              const tp = topics.find((t) => t.id === draftTopicId);
                              if (tp && tp.chapterId && tp.chapterId !== e.target.value) {
                                setDraftTopicId('');
                              }
                            }
                          }
                        }}
                      >
                        <option value="">Select Chapter (Optional)</option>
                        {chapters
                          .filter((ch) => !draftSubjectId || !ch.subjectId || ch.subjectId === draftSubjectId)
                          .map((ch) => (
                            <option key={ch.id} value={ch.id}>{ch.name}</option>
                          ))}
                        <option value="__ADD_NEW__">+ Add New Chapter...</option>
                      </select>
                    )}
                  </div>

                  {/* Topic Dropdown */}
                  <div>
                    <label className="property-label" style={{ fontSize: 11 }}>Topic</label>
                    {isAddingTopic ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          type="text"
                          className="property-input"
                          style={{ fontSize: 12, padding: '4px 8px' }}
                          autoFocus
                          placeholder="New topic..."
                          value={newTopicName}
                          onChange={(e) => setNewTopicName(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && newTopicName.trim()) {
                              const tId = await createTopic(newTopicName.trim(), draftChapterId || undefined);
                              if (tId) setDraftTopicId(tId);
                              setIsAddingTopic(false);
                              setNewTopicName('');
                            } else if (e.key === 'Escape') {
                              setIsAddingTopic(false);
                              setNewTopicName('');
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={async () => {
                            if (newTopicName.trim()) {
                              const tId = await createTopic(newTopicName.trim(), draftChapterId || undefined);
                              if (tId) setDraftTopicId(tId);
                            }
                            setIsAddingTopic(false);
                            setNewTopicName('');
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 6px', fontSize: 11 }}
                          onClick={() => { setIsAddingTopic(false); setNewTopicName(''); }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <select
                        className="property-input"
                        style={{ fontSize: 12, padding: '5px 8px' }}
                        value={draftTopicId}
                        onChange={(e) => {
                          if (e.target.value === '__ADD_NEW__') {
                            setIsAddingTopic(true);
                          } else {
                            setDraftTopicId(e.target.value);
                          }
                        }}
                      >
                        <option value="">Select Topic (Optional)</option>
                        {topics
                          .filter((tp) => !draftChapterId || !tp.chapterId || tp.chapterId === draftChapterId)
                          .map((tp) => (
                            <option key={tp.id} value={tp.id}>{tp.name}</option>
                          ))}
                        <option value="__ADD_NEW__">+ Add New Topic...</option>
                      </select>
                    )}
                  </div>

                  {/* Category / Stream */}
                  <div>
                    <label className="property-label" style={{ fontSize: 11 }}>Stream / Category</label>
                    {isAddingCategory ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          type="text"
                          className="property-input"
                          style={{ fontSize: 12, padding: '4px 8px' }}
                          autoFocus
                          placeholder="New stream/category..."
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && newCategoryName.trim()) {
                              const catId = await createCategory(newCategoryName.trim());
                              if (catId) setDraftCategoryId(catId);
                              setIsAddingCategory(false);
                              setNewCategoryName('');
                            } else if (e.key === 'Escape') {
                              setIsAddingCategory(false);
                              setNewCategoryName('');
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={async () => {
                            if (newCategoryName.trim()) {
                              const catId = await createCategory(newCategoryName.trim());
                              if (catId) setDraftCategoryId(catId);
                            }
                            setIsAddingCategory(false);
                            setNewCategoryName('');
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 6px', fontSize: 11 }}
                          onClick={() => { setIsAddingCategory(false); setNewCategoryName(''); }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <select
                        className="property-input"
                        style={{ fontSize: 12, padding: '5px 8px' }}
                        value={draftCategoryId}
                        onChange={(e) => {
                          if (e.target.value === '__ADD_NEW__') {
                            setIsAddingCategory(true);
                          } else {
                            setDraftCategoryId(e.target.value);
                          }
                        }}
                      >
                        <option value="">Select Stream / Category (Optional)</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                        <option value="__ADD_NEW__">+ Add New Stream/Category...</option>
                      </select>
                    )}
                  </div>

                  {/* Cognitive Level Dropdown */}
                  <div>
                    <label className="property-label" style={{ fontSize: 11 }}>Cognitive Level (Bloom's)</label>
                    <select
                      className="property-input"
                      style={{ fontSize: 12, padding: '5px 8px' }}
                      value={draftCognitiveLevel}
                      onChange={(e) => setDraftCognitiveLevel(e.target.value as CognitiveLevel)}
                    >
                      {COGNITIVE_LEVELS.map((cl) => (
                        <option key={cl.value} value={cl.value}>
                          {cl.label}{cl.value === 'understand' ? ' (Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sub-question Numbering Style */}
                  <div>
                    <label className="property-label" style={{ fontSize: 11 }}>Sub-question Numbering</label>
                    <select
                      className="property-input"
                      style={{ fontSize: 12, padding: '5px 8px' }}
                      value={draftSubNumberingStyle}
                      onChange={(e) => setDraftSubNumberingStyle(e.target.value as SubQuestionNumberingStyle)}
                    >
                      <option value="">Default ((a), (b), (c))</option>
                      <option value="letters_paren">(a), (b), (c)</option>
                      <option value="roman_paren">(i), (ii), (iii)</option>
                      <option value="numbers_paren">1), 2), 3)</option>
                      <option value="numbers_paren_both">(1), (2), (3)</option>
                      <option value="letters_dot">a., b., c.</option>
                      <option value="roman_dot">i., ii., iii.</option>
                      <option value="letters_upper_paren">(A), (B), (C)</option>
                      <option value="letters_upper_dot">A., B., C.</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Question Content Editor */}
              <div className="property-field" style={{ marginBottom: 15 }}>
                <label className="property-label">
                  {draftType === 'text' ? 'Passage / Text Content' : 'Question Content'}
                </label>
                <FullQuill
                  value={draftContent}
                  onChange={setDraftContent}
                  placeholder={draftType === 'text' ? 'Enter reading passage or instructions...' : 'Enter your question... (Click the ∑ button in the toolbar to insert formulas)'}
                  toolbarId="qb-constructor-main-toolbar"
                />
              </div>

              {/* MCQ Options */}
              {draftType === 'mcq' && (
                <div className="property-field" style={{ marginBottom: 15 }}>
                  <label className="property-label">Options</label>
                  {draftOptions.map((opt, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Option {String.fromCharCode(65 + i)}</label>
                        {draftOptions.length > 2 && (
                          <button
                            type="button"
                            className="hover-action-btn danger"
                            onClick={() => handleRemoveOption(i)}
                            style={{ padding: '2px 4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger, #dc2626)' }}
                            title="Remove Option"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <FullQuill
                        value={opt}
                        onChange={(val) => {
                          const newOpts = [...draftOptions];
                          newOpts[i] = val;
                          setDraftOptions(newOpts);
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        toolbarId={`qb-draft-opt-toolbar-${i}`}
                        isMini
                        minHeight="54px"
                      />
                    </div>
                  ))}
                  {draftOptions.length < 8 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAddOption}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}
                    >
                      <Plus size={14} /> Add Option
                    </button>
                  )}
                </div>
              )}

              {/* Subquestions Management */}
              <div
                style={{
                  marginTop: 20,
                  paddingLeft: 16,
                  borderLeft: '2px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="property-label" style={{ marginBottom: 0 }}>
                    Subquestions {draftSubquestions.length > 0 ? `(${draftSubquestions.length})` : ''}
                  </label>
                </div>

                {draftSubquestions.map((sq, index) => (
                  <div
                    key={sq.id}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      onClick={() => handleUpdateDraftSubquestion(sq.id, 'isExpanded', !sq.isExpanded)}
                      style={{
                        padding: '12px 15px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        backgroundColor: sq.isExpanded ? 'var(--bg-tertiary)' : 'transparent',
                        borderBottom: sq.isExpanded ? '1px solid var(--border-color)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, overflow: 'hidden' }}>
                        {sq.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          Subquestion {index + 1}
                        </span>
                        {sq.isOptional && (
                          <span className="optional-badge" style={{ fontSize: 10, padding: '1px 6px' }}>Optional</span>
                        )}
                        {!sq.isExpanded && sq.content && (
                          <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                            {sq.content.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ') || 'Empty question'}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="hover-action-btn danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveDraftSubquestion(sq.id);
                        }}
                        style={{ marginLeft: 10, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger, #dc2626)' }}
                        title="Delete subquestion"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {sq.isExpanded && (
                      <div style={{ padding: '15px' }}>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <div className="property-field" style={{ flex: 1, minWidth: 120, marginBottom: 0 }}>
                            <label className="property-label">Question Type</label>
                            <select
                              className="property-input"
                              value={sq.type}
                              onChange={(e) => handleUpdateDraftSubquestion(sq.id, 'type', e.target.value as QuestionType)}
                            >
                              <option value="subjective">Subjective</option>
                              <option value="mcq">Multiple Choice</option>
                              <option value="text">Text / Reading Passage</option>
                            </select>
                          </div>
                          {sq.type !== 'text' && (
                            <div className="property-field" style={{ flex: 1, minWidth: 80, marginBottom: 0 }}>
                              <label className="property-label">Marks</label>
                              <input
                                type="number"
                                className="property-input"
                                value={sq.marks}
                                onChange={(e) => handleUpdateDraftSubquestion(sq.id, 'marks', Math.max(1, parseInt(e.target.value, 10) || 1))}
                                min={1}
                              />
                            </div>
                          )}
                          <div className="property-field" style={{ flex: 1, minWidth: 130, marginBottom: 0 }}>
                            <label className="property-label">Cognitive Level</label>
                            <select
                              className="property-input"
                              value={sq.cognitiveLevel || DEFAULT_COGNITIVE_LEVEL}
                              onChange={(e) => handleUpdateDraftSubquestion(sq.id, 'cognitiveLevel', e.target.value as CognitiveLevel)}
                            >
                              {COGNITIVE_LEVELS.map((cl) => (
                                <option key={cl.value} value={cl.value}>
                                  {cl.label}{cl.value === 'understand' ? ' (Default)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="property-field" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
                            <label className="property-label">Child Sub-Q Format</label>
                            <select
                              className="property-input"
                              value={sq.subNumberingStyle || ''}
                              onChange={(e) => handleUpdateDraftSubquestion(sq.id, 'subNumberingStyle', (e.target.value || undefined) as any)}
                            >
                              <option value="">Inherit</option>
                              <option value="letters_paren">(a), (b), (c)</option>
                              <option value="roman_paren">(i), (ii), (iii)</option>
                              <option value="numbers_paren">1), 2), 3)</option>
                              <option value="numbers_paren_both">(1), (2), (3)</option>
                              <option value="letters_dot">a., b., c.</option>
                              <option value="roman_dot">i., ii., iii.</option>
                              <option value="letters_upper_paren">(A), (B), (C)</option>
                              <option value="letters_upper_dot">A., B., C.</option>
                            </select>
                          </div>
                          <div className="property-field" style={{ flex: '0 0 auto', marginBottom: 0, paddingBottom: 6 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, userSelect: 'none' }}>
                              <input
                                type="checkbox"
                                checked={sq.isOptional || false}
                                onChange={(e) => handleUpdateDraftSubquestion(sq.id, 'isOptional', e.target.checked)}
                              />
                              <span>Optional</span>
                            </label>
                          </div>
                        </div>

                        <div className="property-field" style={{ marginBottom: sq.type === 'mcq' ? 12 : 0 }}>
                          <label className="property-label">Question Content</label>
                          <FullQuill
                            value={sq.content}
                            onChange={(val) => handleUpdateDraftSubquestion(sq.id, 'content', val)}
                            placeholder="Enter subquestion..."
                            toolbarId={`qb-subq-toolbar-${sq.id}`}
                            isMini
                            minHeight="60px"
                          />
                        </div>

                        {sq.type === 'mcq' && (
                          <div className="property-field" style={{ marginBottom: 0 }}>
                            <label className="property-label">Options</label>
                            {sq.options.map((opt, i) => (
                              <div key={i} style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 16 }}>
                                  {String.fromCharCode(65 + i)}
                                </span>
                                <div style={{ flex: 1 }}>
                                  <FullQuill
                                    value={opt}
                                    onChange={(val) => {
                                      const newOpts = [...sq.options];
                                      newOpts[i] = val;
                                      handleUpdateDraftSubquestion(sq.id, 'options', newOpts);
                                    }}
                                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                    toolbarId={`qb-subq-opt-toolbar-${sq.id}-${i}`}
                                    isMini
                                    minHeight="50px"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                  onClick={handleAddDraftSubquestion}
                >
                  <Plus size={14} /> Add Subquestion
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div
              className="modal-actions"
              style={{
                padding: '15px 20px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelDraft}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveDraftQuestion}
                disabled={isCreatingQuestion || !draftContent.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {isCreatingQuestion ? <Loader2 size={14} className="qf-spin" /> : <Plus size={14} />}
                {isCreatingQuestion ? 'Saving Question...' : 'Save Question & Subquestions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

