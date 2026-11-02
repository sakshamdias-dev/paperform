import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Question, SharedQuestion, CognitiveLevel, BankSubQuestion } from '../types';
import { COGNITIVE_LEVELS } from '../types';
import { Search, X, Eye, Plus, Sparkles, BookOpen, Layers, User as UserIcon, Filter, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { renderMath, preprocessMathHtml } from '../utils/mathjax';
import { useStore } from '../store';

interface QuestionBankSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  myQuestions: Question[];
  sharedQuestions: SharedQuestion[];
  paperSubjectName?: string;
  paperClassName?: string;
  sections?: { id: string; title: string }[];
  onViewQuestion: (q: any) => void;
  onInsertSharedQuestion: (q: SharedQuestion, targetSection?: string, parentId?: string, isOptional?: boolean) => void;
  onInsertMyQuestion: (q: Question, targetSection?: string, parentId?: string, isOptional?: boolean) => void;
  onInsertQuestionSet?: (parentQ: SharedQuestion | Question, selectedSubqIds: string[], isShared: boolean) => Promise<void> | void;
  onInsertStandaloneSubquestion?: (subq: BankSubQuestion, isShared: boolean) => Promise<void> | void;
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function SubquestionsModal({
  question,
  isShared,
  onClose,
  onInsertQuestionSet,
  onInsertStandaloneSubquestion,
}: {
  question: SharedQuestion | Question;
  isShared: boolean;
  onClose: () => void;
  onInsertQuestionSet?: (parentQ: SharedQuestion | Question, selectedSubqIds: string[], isShared: boolean) => Promise<void> | void;
  onInsertStandaloneSubquestion?: (subq: BankSubQuestion, isShared: boolean) => Promise<void> | void;
}) {
  const subqs = question.subquestions || [];
  const [selectedSubqIds, setSelectedSubqIds] = useState<Set<string>>(() => new Set(subqs.map((s) => s.id)));
  const [insertingId, setInsertingId] = useState<string | null>(null);
  const [isInsertingSet, setIsInsertingSet] = useState(false);

  const totalPossibleMarks = useMemo(() => subqs.reduce((acc, s) => acc + (s.marks || 1), 0), [subqs]);
  const selectedMarks = useMemo(
    () => subqs.filter((s) => selectedSubqIds.has(s.id)).reduce((acc, s) => acc + (s.marks || 1), 0),
    [subqs, selectedSubqIds]
  );
  const allSelected = subqs.length > 0 && selectedSubqIds.size === subqs.length;

  useEffect(() => {
    const timer = setTimeout(() => {
      renderMath();
    }, 60);
    return () => clearTimeout(timer);
  }, [question, selectedSubqIds]);

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedSubqIds(new Set());
    } else {
      setSelectedSubqIds(new Set(subqs.map((s) => s.id)));
    }
  };

  const handleToggleSubq = (id: string) => {
    setSelectedSubqIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddStandalone = async (subq: BankSubQuestion) => {
    if (!onInsertStandaloneSubquestion) return;
    setInsertingId(subq.id);
    try {
      await onInsertStandaloneSubquestion(subq, isShared);
    } finally {
      setInsertingId(null);
    }
  };

  const handleAddSet = async () => {
    if (selectedSubqIds.size === 0 || !onInsertQuestionSet) return;
    setIsInsertingSet(true);
    try {
      await onInsertQuestionSet(question, Array.from(selectedSubqIds), isShared);
      onClose();
    } finally {
      setIsInsertingSet(false);
    }
  };

  const topicName = 'topic' in question ? (question as any).topic : undefined;
  const cleanTitle = question.typeHeader || topicName || stripHtml(question.content).substring(0, 36);

  const detectedQNum =
    (question.typeHeader?.match(/Q\s*(\d+)/i) ||
      stripHtml(question.content).match(/Q\s*(\d+)/i))?.[1] || '2';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="qb-modal-backdrop" onClick={onClose} style={{ zIndex: 11500 }}>
      <div
        className="qb-subq-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="qb-subq-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, marginRight: 12 }}>
            <span className="qb-header-icon">
              <Layers size={15} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2
                className="qb-subq-modal-title"
                title={cleanTitle || 'Select Subquestions'}
              >
                {cleanTitle || 'Select Subquestions'}
              </h2>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>
                Choose which parts to insert into your paper
              </div>
            </div>
          </div>
          <button className="qb-close-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Modal Toolbar / Select All & Total Marks */}
        <div className="qb-subq-modal-toolbar">
          <label className="qb-select-all-label">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleToggleAll}
              className="qb-checkbox"
            />
            <span>Select all ({subqs.length})</span>
          </label>
          <div className="qb-selected-marks-counter">
            Selected: <strong>{selectedMarks}</strong> / {totalPossibleMarks} marks
          </div>
        </div>

        {/* Modal Content / Subquestions List */}
        <div className="qb-subq-modal-list">
          {subqs.map((sq, idx) => {
            const isChecked = selectedSubqIds.has(sq.id);
            return (
              <div
                key={sq.id}
                className={`qb-subq-item ${isChecked ? 'selected' : ''}`}
                onClick={() => handleToggleSubq(sq.id)}
                style={{ cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleToggleSubq(sq.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="qb-checkbox"
                  style={{ marginTop: 2 }}
                />
                <div className="qb-subq-item-body">
                  <div className="qb-subq-item-label">
                    <span>Part {detectedQNum}.{idx + 1}</span>
                    <span className="qb-subq-marks-pill">
                      {sq.marks || 1} {((sq.marks || 1) === 1) ? 'mark' : 'marks'}
                    </span>
                  </div>
                  <div
                    className="qb-subq-item-content tex2jax_process"
                    dangerouslySetInnerHTML={{ __html: preprocessMathHtml(sq.content) }}
                  />
                  {sq.questionType === 'mcq' && sq.options && sq.options.length > 0 && (
                    <div className="qb-card-options tex2jax_process" style={{ marginTop: 6 }}>
                      {sq.options.map((opt, oi) => (
                        <div key={oi} className="qb-card-opt-item">
                          <span className="qb-opt-letter">{String.fromCharCode(65 + oi)}.</span>
                          <span dangerouslySetInnerHTML={{ __html: preprocessMathHtml(opt) }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="qb-subq-item-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="qb-add-standalone-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddStandalone(sq);
                    }}
                    disabled={insertingId === sq.id}
                    title="Insert this part as a standalone question"
                  >
                    <Plus size={12} /> Solo
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Actions Footer */}
        <div className="qb-subq-modal-footer">
          <button className="qb-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="qb-btn-primary"
            disabled={selectedSubqIds.size === 0 || isInsertingSet}
            onClick={handleAddSet}
          >
            <Plus size={14} /> Insert {selectedSubqIds.size} {selectedSubqIds.size === 1 ? 'part' : 'parts'} ({selectedMarks}m)
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function QuestionBankSidebar({
  isOpen,
  onClose,
  myQuestions,
  sharedQuestions,
  paperSubjectName,
  paperClassName,
  sections,
  onViewQuestion,
  onInsertSharedQuestion,
  onInsertMyQuestion,
  onInsertQuestionSet,
  onInsertStandaloneSubquestion,
}: QuestionBankSidebarProps) {
  const [tab, setTab] = useState<'shared' | 'my'>('shared');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParentModal, setSelectedParentModal] = useState<{
    question: SharedQuestion | Question;
    isShared: boolean;
  } | null>(null);

  // 8 Filters state (Requirement 8)
  const [showFilters, setShowFilters] = useState(false);
  const [courseFilter, setCourseFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [marksFilter, setMarksFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [cognitiveFilter, setCognitiveFilter] = useState<CognitiveLevel | ''>('');

  // Lookups from store for user's existing records
  const { courses, subjects, classes, chapters, topics, categories, paperQuestions } = useStore();

  // Extract all PaperQuestions across papers to identify parent-child relationships in user questions
  const allPQs = useMemo(() => {
    const list: any[] = [];
    paperQuestions.forEach((pqs) => list.push(...pqs));
    return list;
  }, [paperQuestions]);

  const subQuestionIdSet = useMemo(() => {
    const set = new Set<string>();
    allPQs.forEach((pq) => {
      if (pq.parentId) set.add(pq.questionId);
    });
    return set;
  }, [allPQs]);

  const parentQuestionSubqsMap = useMemo(() => {
    const map = new Map<string, BankSubQuestion[]>();
    allPQs.forEach((parentPq) => {
      if (!parentPq.parentId) {
        const childPqs = allPQs.filter((c) => c.parentId === parentPq.id);
        if (childPqs.length > 0) {
          const subqs: BankSubQuestion[] = childPqs.map((cpq) => {
            const cq = myQuestions.find((q) => q.id === cpq.questionId);
            return {
              id: cpq.questionId,
              content: cq?.content || '',
              questionType: cq?.questionType || 'subjective',
              options: cq?.options || [],
              marks: cpq.marks || 1,
              difficulty: cq?.difficulty || 'medium',
              cognitiveLevel: cq?.cognitiveLevel || 'understand',
              explanation: cq?.explanation,
            };
          });
          map.set(parentPq.questionId, subqs);
        }
      }
    });
    return map;
  }, [allPQs, myQuestions]);

  // In the main Question Bank tab, only parent questions are displayed!
  const parentMyQuestions = useMemo(() => {
    return myQuestions
      .filter((q) => {
        if (q.parentId) return false;
        if (subQuestionIdSet.has(q.id) && !parentQuestionSubqsMap.has(q.id) && (!q.subquestions || q.subquestions.length === 0)) {
          return false;
        }
        return true;
      })
      .map((q) => {
        const derived = parentQuestionSubqsMap.get(q.id);
        if (derived && derived.length > 0 && (!q.subquestions || q.subquestions.length === 0)) {
          return { ...q, subquestions: derived };
        }
        return q;
      });
  }, [myQuestions, subQuestionIdSet, parentQuestionSubqsMap]);

  // Shared questions: only parent questions, enriched with subquestions (same as My Questions)
  const parentSharedQuestions = useMemo(() => {
    const normalizeText = (html: string) => stripHtml(html).replace(/\s+/g, ' ').trim().toLowerCase();

    // Map normalized content of known child subquestions so they don't appear as standalone top-level shared questions
    const childSubqNormSet = new Set<string>();
    const parentSubqsByNormContent = new Map<string, BankSubQuestion[]>();
    const parentSubqsBySharedId = new Map<string, BankSubQuestion[]>();

    allPQs.forEach((parentPq) => {
      if (!parentPq.parentId) {
        const subqs = parentQuestionSubqsMap.get(parentPq.questionId);
        if (subqs && subqs.length > 0) {
          if (parentPq.parentSharedId) {
            parentSubqsBySharedId.set(parentPq.parentSharedId, subqs);
          }
          const pqQuestion = myQuestions.find((mq) => mq.id === parentPq.questionId);
          if (pqQuestion) {
            const norm = normalizeText(pqQuestion.content);
            if (norm) parentSubqsByNormContent.set(norm, subqs);
          }
          subqs.forEach((sq) => {
            const sqNorm = normalizeText(sq.content);
            if (sqNorm) childSubqNormSet.add(sqNorm);
          });
        }
      }
    });

    myQuestions.forEach((mq) => {
      if (mq.subquestions && mq.subquestions.length > 0) {
        const norm = normalizeText(mq.content);
        if (norm && !parentSubqsByNormContent.has(norm)) {
          parentSubqsByNormContent.set(norm, mq.subquestions);
        }
        mq.subquestions.forEach((sq) => {
          const sqNorm = normalizeText(sq.content);
          if (sqNorm) childSubqNormSet.add(sqNorm);
        });
      }
    });

    sharedQuestions.forEach((sq) => {
      if (sq.subquestions && sq.subquestions.length > 0) {
        sq.subquestions.forEach((child) => {
          const childNorm = normalizeText(child.content);
          if (childNorm) childSubqNormSet.add(childNorm);
        });
      }
    });

    // Also group any sharedQuestions that explicitly have parentId pointing to another sharedQuestion
    const sharedChildrenByParentId = new Map<string, BankSubQuestion[]>();
    sharedQuestions.forEach((sq) => {
      if (sq.parentId) {
        const list = sharedChildrenByParentId.get(sq.parentId) || [];
        list.push({
          id: sq.id,
          content: sq.content,
          marks: sq.marks || 1,
          questionType: sq.questionType,
          options: sq.options,
          difficulty: sq.difficulty,
          cognitiveLevel: sq.cognitiveLevel,
        });
        sharedChildrenByParentId.set(sq.parentId, list);
      }
    });

    return sharedQuestions
      .map((q) => {
        if (q.subquestions && q.subquestions.length > 0) return q;
        const norm = normalizeText(q.content);
        const derived =
          sharedChildrenByParentId.get(q.id) ||
          parentSubqsBySharedId.get(q.id) ||
          (norm ? parentSubqsByNormContent.get(norm) : undefined);
        if (derived && derived.length > 0) {
          return { ...q, subquestions: derived };
        }
        return q;
      })
      .filter((q) => {
        if (q.parentId) return false;
        const hasSubqs = q.subquestions && q.subquestions.length > 0;
        if (!hasSubqs) {
          const norm = normalizeText(q.content);
          if (norm && childSubqNormSet.has(norm)) {
            return false;
          }
        }
        return true;
      });
  }, [sharedQuestions, allPQs, myQuestions, parentQuestionSubqsMap]);

  // Aggregate distinct lookup values from shared questions + local tables for dropdown options
  const filterOptions = useMemo(() => {
    const courseSet = new Set<string>();
    courses.forEach(c => courseSet.add(c.name));
    sharedQuestions.forEach(q => { if (q.courseName) courseSet.add(q.courseName); });

    const subjectSet = new Set<string>();
    subjects.forEach(s => subjectSet.add(s.name));
    sharedQuestions.forEach(q => { if (q.subjectName) subjectSet.add(q.subjectName); });

    const classSet = new Set<string>();
    classes.forEach(c => classSet.add(c.name));
    sharedQuestions.forEach(q => { if (q.className) classSet.add(q.className); });

    const chapterSet = new Set<string>();
    chapters.forEach(ch => chapterSet.add(ch.name));
    sharedQuestions.forEach(q => { if (q.chapter) chapterSet.add(q.chapter); });

    const topicSet = new Set<string>();
    topics.forEach(tp => topicSet.add(tp.name));
    sharedQuestions.forEach(q => { if (q.topic) topicSet.add(q.topic); });

    const categorySet = new Set<string>();
    categories.forEach(cat => categorySet.add(cat.name));
    sharedQuestions.forEach(q => { if (q.category) categorySet.add(q.category); });

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
    if (courseFilter) count++;
    if (subjectFilter) count++;
    if (classFilter) count++;
    if (marksFilter) count++;
    if (topicFilter) count++;
    if (chapterFilter) count++;
    if (categoryFilter) count++;
    if (cognitiveFilter) count++;
    return count;
  }, [courseFilter, subjectFilter, classFilter, marksFilter, topicFilter, chapterFilter, categoryFilter, cognitiveFilter]);

  const resetFilters = () => {
    setCourseFilter('');
    setSubjectFilter('');
    setClassFilter('');
    setMarksFilter('');
    setTopicFilter('');
    setChapterFilter('');
    setCategoryFilter('');
    setCognitiveFilter('');
    setSearchTerm('');
  };

  // Helper matchers
  const matchesCourse = (qCourseId?: string, qCourseName?: string) => {
    if (!courseFilter) return true;
    const name = qCourseName || courses.find(c => c.id === qCourseId)?.name || '';
    return name.toLowerCase().includes(courseFilter.toLowerCase());
  };

  const matchesSubject = (qSubjectId?: string, qSubjectName?: string) => {
    if (!subjectFilter) return true;
    const name = qSubjectName || subjects.find(s => s.id === qSubjectId)?.name || '';
    return name.toLowerCase().includes(subjectFilter.toLowerCase());
  };

  const matchesClass = (qClassId?: string, qClassName?: string) => {
    if (!classFilter) return true;
    const name = qClassName || classes.find(c => c.id === qClassId)?.name || '';
    return name.toLowerCase().includes(classFilter.toLowerCase());
  };

  const matchesMarks = (marks?: number) => {
    if (!marksFilter) return true;
    const parsed = parseInt(marksFilter);
    return isNaN(parsed) ? true : (marks === parsed);
  };

  const matchesChapter = (qChapterId?: string, qChapterName?: string) => {
    if (!chapterFilter) return true;
    const name = qChapterName || chapters.find(ch => ch.id === qChapterId)?.name || '';
    return name.toLowerCase().includes(chapterFilter.toLowerCase());
  };

  const matchesTopic = (qTopicId?: string, qTopicName?: string) => {
    if (!topicFilter) return true;
    const name = qTopicName || topics.find(t => t.id === qTopicId)?.name || '';
    return name.toLowerCase().includes(topicFilter.toLowerCase());
  };

  const matchesCategory = (qCategoryId?: string, qCategoryName?: string) => {
    if (!categoryFilter) return true;
    const name = qCategoryName || categories.find(cat => cat.id === qCategoryId)?.name || '';
    return name.toLowerCase().includes(categoryFilter.toLowerCase());
  };

  const matchesCognitive = (level?: CognitiveLevel) => {
    if (!cognitiveFilter) return true;
    const current = (level || 'understand').toLowerCase();
    return current === cognitiveFilter.toLowerCase();
  };

  // Filtered shared questions
  const filteredShared = useMemo(() => {
    return parentSharedQuestions.filter((q) => {
      if (!matchesCourse(q.courseId, q.courseName)) return false;
      if (!matchesSubject(q.subjectId, q.subjectName)) return false;
      if (!matchesClass(q.classId, q.className)) return false;
      if (!matchesMarks(q.marks)) return false;
      if (!matchesChapter(undefined, q.chapter)) return false;
      if (!matchesTopic(undefined, q.topic)) return false;
      if (!matchesCategory(undefined, q.category)) return false;
      if (!matchesCognitive(q.cognitiveLevel)) return false;

      if (!searchTerm.trim()) return true;
      const plain = stripHtml(q.content).toLowerCase();
      const term = searchTerm.toLowerCase();
      const subqMatch = q.subquestions?.some(sq => stripHtml(sq.content).toLowerCase().includes(term));
      return (
        plain.includes(term) ||
        Boolean(subqMatch) ||
        (q.topic && q.topic.toLowerCase().includes(term)) ||
        (q.chapter && q.chapter.toLowerCase().includes(term)) ||
        (q.authorName && q.authorName.toLowerCase().includes(term))
      );
    });
  }, [parentSharedQuestions, courseFilter, subjectFilter, classFilter, marksFilter, topicFilter, chapterFilter, categoryFilter, cognitiveFilter, searchTerm]);

  // Filtered my questions
  const filteredMy = useMemo(() => {
    return parentMyQuestions.filter((q) => {
      if (!matchesCourse(q.courseId)) return false;
      if (!matchesSubject(q.subjectId)) return false;
      if (!matchesClass(q.classId)) return false;
      if (!matchesMarks(q.marks)) return false;
      if (!matchesChapter(q.chapterId)) return false;
      if (!matchesTopic(q.topicId)) return false;
      if (!matchesCategory(q.categoryId)) return false;
      if (!matchesCognitive(q.cognitiveLevel)) return false;

      if (!searchTerm.trim()) return true;
      const plain = stripHtml(q.content).toLowerCase();
      const term = searchTerm.toLowerCase();
      const subqMatch = q.subquestions?.some(sq => stripHtml(sq.content).toLowerCase().includes(term));
      return plain.includes(term) || Boolean(subqMatch);
    });
  }, [parentMyQuestions, courseFilter, subjectFilter, classFilter, marksFilter, topicFilter, chapterFilter, categoryFilter, cognitiveFilter, searchTerm]);

  // Trigger MathJax typeset whenever questions list updates
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        renderMath();
      }, 70);
      return () => clearTimeout(timer);
    }
  }, [isOpen, tab, filteredShared, filteredMy, searchTerm, courseFilter, subjectFilter, classFilter, marksFilter, topicFilter, chapterFilter, categoryFilter, cognitiveFilter]);

  if (!isOpen) return null;

  const formatQuestionType = (type?: string) => {
    switch (type) {
      case 'mcq': return 'MCQ';
      case 'fill_blank': return 'Fill in Blank';
      case 'true_false': return 'True / False';
      case 'subjective': return 'Subjective';
      default: return type || 'Question';
    }
  };

  const cognitiveDotColor = (level?: string) => {
    switch (level) {
      case 'remember': return '#d97706';
      case 'understand': return '#0284c7';
      case 'apply': return '#16a34a';
      case 'analyse': return '#7c3aed';
      case 'evaluate': return '#ea580c';
      case 'create': return '#dc2626';
      default: return '#0284c7';
    }
  };

  return (
    <aside className="question-bank-sidebar">
      {/* Unified Header + Controls */}
      <div className="qb-top">
        <div className="qb-header">
          <div className="qb-title-group">
            <span className="qb-header-icon">
              <BookOpen size={15} />
            </span>
            <div>
              <div className="qb-title">Question Bank</div>
              {(paperSubjectName || paperClassName) && (
                <div className="qb-subtitle">
                  {paperSubjectName || 'Paper'}{paperClassName ? ` · ${paperClassName}` : ''}
                </div>
              )}
            </div>
          </div>
          <button className="qb-close-btn" onClick={onClose} title="Close Question Bank">
            <X size={16} />
          </button>
        </div>

        {/* Segmented Tabs */}
        <div className="qb-tabs">
          <button
            className={`qb-tab-btn ${tab === 'shared' ? 'active' : ''}`}
            onClick={() => setTab('shared')}
          >
            <Sparkles size={13} />
            <span>Community</span>
            <span className="qb-count-badge">{filteredShared.length}</span>
          </button>
          <button
            className={`qb-tab-btn ${tab === 'my' ? 'active' : ''}`}
            onClick={() => setTab('my')}
          >
            <Layers size={13} />
            <span>My Library</span>
            <span className="qb-count-badge">{filteredMy.length}</span>
          </button>
        </div>

        {/* Search + Filter Toggle */}
        <div className="qb-search-row">
          <div className="qb-search-wrapper">
            <Search size={14} className="qb-search-icon" />
            <input
              type="text"
              className="qb-search-input"
              placeholder={tab === 'shared' ? 'Search question, chapter, author...' : 'Search my questions...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="qb-search-clear"
                onClick={() => setSearchTerm('')}
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button
            className={`qb-filter-btn ${showFilters || activeFilterCount > 0 ? 'is-active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Filter Questions"
          >
            <Filter size={13} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="qb-filter-count">{activeFilterCount}</span>
            )}
            {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Active filter pills when filter drawer is closed */}
        {!showFilters && activeFilterCount > 0 && (
          <div className="qb-active-filters">
            <span className="qb-active-filters__label">{activeFilterCount} active</span>
            <button className="qb-reset-link" onClick={resetFilters}>
              <RotateCcw size={11} /> Clear all
            </button>
          </div>
        )}

        {/* Collapsible Filter Drawer */}
        {showFilters && (
          <div className="qb-filter-drawer">
            <div className="qb-filter-drawer__head">
              <span>Filter Questions</span>
              {activeFilterCount > 0 && (
                <button className="qb-reset-link" onClick={resetFilters}>
                  <RotateCcw size={11} /> Reset ({activeFilterCount})
                </button>
              )}
            </div>

            <div className="qb-filter-grid">
              <div>
                <label>Subject</label>
                <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                  <option value="">All Subjects</option>
                  {filterOptions.subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label>Class</label>
                <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                  <option value="">All Classes</option>
                  {filterOptions.classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label>Chapter</label>
                <select value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)}>
                  <option value="">All Chapters</option>
                  {filterOptions.chapters.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                </select>
              </div>

              <div>
                <label>Topic</label>
                <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
                  <option value="">All Topics</option>
                  {filterOptions.topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label>Marks</label>
                <select value={marksFilter} onChange={(e) => setMarksFilter(e.target.value)}>
                  <option value="">Any Marks</option>
                  {[1, 2, 3, 4, 5, 6, 8, 10].map(m => (
                    <option key={m} value={m}>{m} {m === 1 ? 'Mark' : 'Marks'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>Cognitive Level</label>
                <select
                  value={cognitiveFilter}
                  onChange={(e) => setCognitiveFilter(e.target.value as CognitiveLevel | '')}
                >
                  <option value="">All Levels</option>
                  {COGNITIVE_LEVELS.map(cl => (
                    <option key={cl.value} value={cl.value}>{cl.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>Course / Board</label>
                <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
                  <option value="">All Boards</option>
                  {filterOptions.courses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label>Stream</label>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="">All Streams</option>
                  {filterOptions.categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Questions list */}
      <div className="qb-list">
        {tab === 'shared' ? (
          filteredShared.length === 0 ? (
            <div className="qb-empty">
              <div className="qb-empty__title">No matching questions</div>
              <div className="qb-empty__desc">Try adjusting your search or clearing active filters.</div>
              {activeFilterCount > 0 && (
                <button className="qb-btn-ghost" onClick={resetFilters} style={{ marginTop: 8 }}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            filteredShared.map((q) => {
              const subqs = q.subquestions || [];
              const hasSubquestions = subqs.length > 0;
              const totalAllocatedMarks = hasSubquestions
                ? subqs.reduce((acc, s) => acc + (s.marks || 1), 0)
                : (q.marks !== undefined ? q.marks : 1);

              const contextCrumb = [q.chapter, q.topic !== q.chapter ? q.topic : undefined, q.subjectName]
                .filter(Boolean)
                .slice(0, 2)
                .join(' · ');

              return (
                <div
                  key={q.id}
                  className={`qb-card ${hasSubquestions ? 'is-multipart' : ''}`}
                  onClick={() => {
                    if (hasSubquestions) {
                      setSelectedParentModal({ question: q, isShared: true });
                    }
                  }}
                >
                  {/* Row 1: Clean single-line meta header */}
                  <div className="qb-card-meta">
                    <div className="qb-card-meta__left">
                      <span className="qb-type-pill">
                        {formatQuestionType(q.questionType)}
                      </span>
                      {contextCrumb && (
                        <span className="qb-context-crumb" title={contextCrumb}>
                          {contextCrumb}
                        </span>
                      )}
                    </div>

                    <div className="qb-card-meta__right">
                      {hasSubquestions ? (
                        <span className="qb-parts-pill">
                          <Layers size={11} />
                          {subqs.length} {subqs.length === 1 ? 'part' : 'parts'} · {totalAllocatedMarks}m
                        </span>
                      ) : (
                        <span className="qb-marks-pill">
                          {totalAllocatedMarks}m
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Question Content */}
                  <div
                    className="qb-card-body tex2jax_process"
                    dangerouslySetInnerHTML={{ __html: preprocessMathHtml(q.content) }}
                  />

                  {q.questionType === 'mcq' && q.options && q.options.length > 0 && (
                    <div className="qb-card-options tex2jax_process">
                      {q.options.slice(0, 4).map((opt, i) => (
                        <div key={i} className="qb-card-opt-item">
                          <span className="qb-opt-letter">{String.fromCharCode(65 + i)}.</span>
                          <span dangerouslySetInnerHTML={{ __html: preprocessMathHtml(opt) }} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Row 3: Calm Footer + Action */}
                  <div className="qb-card-actions">
                    <div className="qb-card-submeta">
                      <span className="qb-cog-tag" title={`Cognitive Level: ${q.cognitiveLevel || 'Understand'}`}>
                        <i style={{ background: cognitiveDotColor(q.cognitiveLevel) }} />
                        {q.cognitiveLevel || 'Understand'}
                      </span>
                      {q.authorName && (
                        <>
                          <span className="qb-submeta-dot">·</span>
                          <span className="qb-author-badge" title={`Author: ${q.authorName}`}>
                            <UserIcon size={11} />
                            {q.authorName}
                          </span>
                        </>
                      )}
                      {q.usageCount > 0 && (
                        <>
                          <span className="qb-submeta-dot">·</span>
                          <span className="qb-usage-text">{q.usageCount} uses</span>
                        </>
                      )}
                    </div>

                    {hasSubquestions ? (
                      <button
                        className="qb-manage-subq-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedParentModal({ question: q, isShared: true });
                        }}
                        title="Select parts to insert"
                      >
                        <Layers size={12} /> Select parts
                      </button>
                    ) : (
                      <div className="qb-action-pair">
                        <button
                          className="qb-btn-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewQuestion({
                              ...q,
                              isShared: true,
                              targetSection: sections?.[0]?.title,
                            });
                          }}
                          title="Preview full question"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          className="qb-btn-insert"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInsertSharedQuestion(
                              q,
                              sections?.[0]?.title
                            );
                          }}
                          title="Insert into paper"
                        >
                          <Plus size={13} /> Insert
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : filteredMy.length === 0 ? (
          <div className="qb-empty">
            <div className="qb-empty__title">No questions in your library</div>
            <div className="qb-empty__desc">Questions you create in your papers will appear here.</div>
          </div>
        ) : (
          filteredMy.map((q) => {
            const chName = chapters.find(c => c.id === q.chapterId)?.name;
            const tpName = topics.find(t => t.id === q.topicId)?.name;
            const catName = categories.find(cat => cat.id === q.categoryId)?.name;

            const subqs = q.subquestions || [];
            const hasSubquestions = subqs.length > 0;
            const totalAllocatedMarks = hasSubquestions
              ? subqs.reduce((acc, s) => acc + (s.marks || 1), 0)
              : (q.marks !== undefined ? q.marks : 1);

            const contextCrumb = [chName, tpName !== chName ? tpName : undefined, catName]
              .filter(Boolean)
              .slice(0, 2)
              .join(' · ');

            return (
              <div
                key={q.id}
                className={`qb-card ${hasSubquestions ? 'is-multipart' : ''}`}
                onClick={() => {
                  if (hasSubquestions) {
                    setSelectedParentModal({ question: q, isShared: false });
                  }
                }}
              >
                {/* Row 1: Clean single-line meta header */}
                <div className="qb-card-meta">
                  <div className="qb-card-meta__left">
                    <span className="qb-type-pill">
                      {formatQuestionType(q.questionType)}
                    </span>
                    {contextCrumb && (
                      <span className="qb-context-crumb" title={contextCrumb}>
                        {contextCrumb}
                      </span>
                    )}
                  </div>

                  <div className="qb-card-meta__right">
                    {hasSubquestions ? (
                      <span className="qb-parts-pill">
                        <Layers size={11} />
                        {subqs.length} {subqs.length === 1 ? 'part' : 'parts'} · {totalAllocatedMarks}m
                      </span>
                    ) : (
                      <span className="qb-marks-pill">
                        {totalAllocatedMarks}m
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: Question Content */}
                <div
                  className="qb-card-body tex2jax_process"
                  dangerouslySetInnerHTML={{ __html: preprocessMathHtml(q.content) }}
                />

                {q.questionType === 'mcq' && q.options && q.options.length > 0 && (
                  <div className="qb-card-options tex2jax_process">
                    {q.options.slice(0, 4).map((opt, i) => (
                      <div key={i} className="qb-card-opt-item">
                        <span className="qb-opt-letter">{String.fromCharCode(65 + i)}.</span>
                        <span dangerouslySetInnerHTML={{ __html: preprocessMathHtml(opt) }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Row 3: Calm Footer + Action */}
                <div className="qb-card-actions">
                  <div className="qb-card-submeta">
                    <span className="qb-cog-tag" title={`Cognitive Level: ${q.cognitiveLevel || 'Understand'}`}>
                      <i style={{ background: cognitiveDotColor(q.cognitiveLevel) }} />
                      {q.cognitiveLevel || 'Understand'}
                    </span>
                    <span className="qb-submeta-dot">·</span>
                    <span style={{ textTransform: 'capitalize' }}>{q.difficulty}</span>
                  </div>

                  {hasSubquestions ? (
                    <button
                      className="qb-manage-subq-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedParentModal({ question: q, isShared: false });
                      }}
                      title="Select parts to insert"
                    >
                      <Layers size={12} /> Select parts
                    </button>
                  ) : (
                    <div className="qb-action-pair">
                      <button
                        className="qb-btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewQuestion({
                            ...q,
                            isShared: false,
                            targetSection: sections?.[0]?.title,
                          });
                        }}
                        title="Preview full question"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        className="qb-btn-insert"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInsertMyQuestion(
                            q,
                            sections?.[0]?.title
                          );
                        }}
                        title="Insert into paper"
                      >
                        <Plus size={13} /> Insert
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Subquestions Selection Modal */}
      {selectedParentModal && (
        <SubquestionsModal
          question={selectedParentModal.question}
          isShared={selectedParentModal.isShared}
          onClose={() => setSelectedParentModal(null)}
          onInsertQuestionSet={onInsertQuestionSet}
          onInsertStandaloneSubquestion={onInsertStandaloneSubquestion}
        />
      )}
    </aside>
  );
}
