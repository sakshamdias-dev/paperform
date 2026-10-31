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
    <div className="modal-overlay" style={{ zIndex: 11500 }}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 700,
          width: '90vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, marginRight: 12 }}>
            <Layers size={18} color="var(--primary, #034089)" style={{ flexShrink: 0 }} />
            <h2
              className="modal-title"
              style={{
                fontSize: 18,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={`Select Subquestions${cleanTitle ? `: ${cleanTitle}` : ''}`}
            >
              Select Subquestions{cleanTitle ? `: ${cleanTitle}` : ''}
            </h2>
            {isShared && (
              <span className="qb-modal-brand-badge" style={{ flexShrink: 0, marginLeft: 4 }}>EXAMFRIENDLY</span>
            )}
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Modal Toolbar / Select All & Total Marks */}
        <div
          className="qb-subq-modal-toolbar"
          style={{
            padding: '10px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <label className="qb-select-all-label" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleToggleAll}
              className="qb-checkbox"
            />
            <span>Select All</span>
          </label>
          <div className="qb-selected-marks-counter">
            Total Selected: <strong>{selectedMarks} / {totalPossibleMarks} Marks</strong>
          </div>
        </div>

        {/* Modal Content / Subquestions List */}
        <div
          className="modal-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
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
                />
                <div className="qb-subq-item-body">
                  <div className="qb-subq-item-label">
                    Q{detectedQNum}.{idx + 1} ({sq.marks || 1} Mark{(sq.marks || 1) === 1 ? '' : 's'})
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
                  <span className="qb-subq-marks-pill">
                    {sq.marks || 1}m
                  </span>
                  <button
                    className="btn qb-add-standalone-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddStandalone(sq);
                    }}
                    disabled={insertingId === sq.id}
                    title="Insert this subquestion as a standalone question into paper"
                  >
                    <Plus size={13} /> Add to Paper
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Actions Footer */}
        <div
          className="modal-actions"
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
            background: '#fafbfc',
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={selectedSubqIds.size === 0 || isInsertingSet}
            onClick={handleAddSet}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Add {selectedSubqIds.size} Question{selectedSubqIds.size === 1 ? '' : 's'}
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

  return (
    <aside className="question-bank-sidebar">
      {/* Header */}
      <div className="qb-header">
        <div className="qb-title">
          <BookOpen size={16} color="#2563eb" />
          <span>Question Bank</span>
        </div>
        <button className="qb-close-btn" onClick={onClose} title="Close Question Bank">
          <X size={16} />
        </button>
      </div>

      {/* Two Tabs */}
      <div className="qb-tabs">
        <button
          className={`qb-tab-btn ${tab === 'shared' ? 'active' : ''}`}
          onClick={() => setTab('shared')}
        >
          <Sparkles size={14} />
          Shared Questions
          <span className="qb-count-badge">{filteredShared.length}</span>
        </button>
        <button
          className={`qb-tab-btn ${tab === 'my' ? 'active' : ''}`}
          onClick={() => setTab('my')}
        >
          <Layers size={14} />
          My Questions
          <span className="qb-count-badge">{filteredMy.length}</span>
        </button>
      </div>

      {/* Search Bar + Filters Toggle Button */}
      <div className="qb-filters" style={{ paddingBottom: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div className="qb-search-wrapper" style={{ flex: 1, position: 'relative' }}>
            <Search size={14} className="qb-search-icon" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 2, pointerEvents: 'none' }} />
            <input
              type="text"
              className="qb-search-input"
              placeholder={tab === 'shared' ? 'Search by question, topic, author...' : 'Search my questions...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 34, boxSizing: 'border-box' }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2, zIndex: 2 }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button
            className={`btn ${showFilters || activeFilterCount > 0 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '7px 10px',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
            }}
            title="Filter Questions"
          >
            <Filter size={13} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 5px',
                  lineHeight: 1,
                  marginLeft: 2,
                }}
              >
                {activeFilterCount}
              </span>
            )}
            {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* 8 Filters Collapsible Box (Requirement 8) */}
        {showFilters && (
          <div
            style={{
              marginTop: 10,
              padding: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: '#334155', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.04em' }}>
                Advanced Filters (All Optional)
              </span>
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2563eb', fontSize: 11, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontWeight: 600 }}
                >
                  <RotateCcw size={11} /> Reset All
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {/* 1. Course / Program / Board */}
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 2 }}>Course / Board</label>
                <select
                  style={{ width: '100%', padding: '4px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', background: 'white', color: '#1e293b' }}
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                >
                  <option value="">All Courses / Boards</option>
                  {filterOptions.courses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* 2. Subject */}
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 2 }}>Subject</label>
                <select
                  style={{ width: '100%', padding: '4px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', background: 'white', color: '#1e293b' }}
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                >
                  <option value="">All Subjects</option>
                  {filterOptions.subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* 3. Class */}
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 2 }}>Class</label>
                <select
                  style={{ width: '100%', padding: '4px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', background: 'white', color: '#1e293b' }}
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                >
                  <option value="">All Classes</option>
                  {filterOptions.classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* 4. Marks */}
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 2 }}>Marks</label>
                <select
                  style={{ width: '100%', padding: '4px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', background: 'white', color: '#1e293b' }}
                  value={marksFilter}
                  onChange={(e) => setMarksFilter(e.target.value)}
                >
                  <option value="">Any Marks</option>
                  {[1, 2, 3, 4, 5, 6, 8, 10].map(m => (
                    <option key={m} value={m}>{m} {m === 1 ? 'Mark' : 'Marks'}</option>
                  ))}
                </select>
              </div>

              {/* 5. Chapter */}
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 2 }}>Chapter</label>
                <select
                  style={{ width: '100%', padding: '4px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', background: 'white', color: '#1e293b' }}
                  value={chapterFilter}
                  onChange={(e) => setChapterFilter(e.target.value)}
                >
                  <option value="">All Chapters</option>
                  {filterOptions.chapters.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                </select>
              </div>

              {/* 6. Topic */}
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 2 }}>Topic</label>
                <select
                  style={{ width: '100%', padding: '4px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', background: 'white', color: '#1e293b' }}
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                >
                  <option value="">All Topics</option>
                  {filterOptions.topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* 7. Category / Stream */}
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 2 }}>Category / Stream</label>
                <select
                  style={{ width: '100%', padding: '4px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', background: 'white', color: '#1e293b' }}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">All Streams</option>
                  {filterOptions.categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              {/* 8. Cognitive Level */}
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 2 }}>Cognitive Level</label>
                <select
                  style={{ width: '100%', padding: '4px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', background: 'white', color: '#1e293b' }}
                  value={cognitiveFilter}
                  onChange={(e) => setCognitiveFilter(e.target.value as CognitiveLevel | '')}
                >
                  <option value="">All Cognitive Levels</option>
                  {COGNITIVE_LEVELS.map(cl => (
                    <option key={cl.value} value={cl.value}>{cl.label}{cl.value === 'understand' ? ' (Default)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Context info banner */}
      {(paperSubjectName || paperClassName) && (
        <div style={{ padding: '6px 16px', background: '#eff6ff', borderBottom: '1px solid #dbeafe', fontSize: 11, color: '#1e40af', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            Active Paper: <strong>{paperSubjectName || 'Subject'}</strong> {paperClassName ? `(${paperClassName})` : ''}
          </span>
          {activeFilterCount > 0 && (
            <span style={{ fontSize: 10, color: '#2563eb', fontWeight: 600 }}>
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
            </span>
          )}
        </div>
      )}

      {/* Questions list */}
      <div className="qb-list">
        {tab === 'shared' ? (
          filteredShared.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b', fontSize: 13 }}>
              No shared questions match the criteria. Try adjusting your filters.
            </div>
          ) : (
            filteredShared.map((q) => {
              const cognitiveBadgeColor =
                q.cognitiveLevel === 'remember' ? { bg: '#fef3c7', text: '#92400e' } :
                q.cognitiveLevel === 'understand' ? { bg: '#e0f2fe', text: '#0369a1' } :
                q.cognitiveLevel === 'apply' ? { bg: '#dcfce7', text: '#15803d' } :
                q.cognitiveLevel === 'analyse' ? { bg: '#f3e8ff', text: '#7e22ce' } :
                q.cognitiveLevel === 'evaluate' ? { bg: '#ffedd5', text: '#c2410c' } :
                { bg: '#fee2e2', text: '#b91c1c' };

              const subqs = q.subquestions || [];
              const hasSubquestions = subqs.length > 0;
              const totalAllocatedMarks = hasSubquestions
                ? subqs.reduce((acc, s) => acc + (s.marks || 1), 0)
                : (q.marks !== undefined ? q.marks : 1);

              return (
                <div
                  key={q.id}
                  className="qb-card"
                  style={{ cursor: hasSubquestions ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (hasSubquestions) {
                      setSelectedParentModal({ question: q, isShared: true });
                    }
                  }}
                >
                  <div className="qb-card-header" style={{ flexWrap: 'wrap', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          background: '#f1f5f9',
                          color: '#334155',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                        }}
                      >
                        {q.questionType}
                      </span>

                      {/* Cognitive Level badge */}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          background: cognitiveBadgeColor.bg,
                          color: cognitiveBadgeColor.text,
                          borderRadius: 4,
                          textTransform: 'capitalize',
                        }}
                        title={`Cognitive Level: ${q.cognitiveLevel || 'Understand'}`}
                      >
                        {q.cognitiveLevel || 'Understand'}
                      </span>

                      {q.marks !== undefined && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 5px',
                            background: '#e2e8f0',
                            color: '#1e293b',
                            borderRadius: 4,
                          }}
                        >
                          {q.marks}m
                        </span>
                      )}

                      {q.chapter && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            background: '#e0e7ff',
                            color: '#3730a3',
                            borderRadius: 4,
                          }}
                          title={`Chapter: ${q.chapter}`}
                        >
                          Ch: {q.chapter}
                        </span>
                      )}

                      {q.topic && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            background: '#f1f5f9',
                            color: '#475569',
                            borderRadius: 4,
                          }}
                          title={`Topic: ${q.topic}`}
                        >
                          {q.topic}
                        </span>
                      )}

                      {q.category && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            background: '#fef3c7',
                            color: '#92400e',
                            borderRadius: 4,
                          }}
                          title={`Stream / Category: ${q.category}`}
                        >
                          {q.category}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {hasSubquestions && (
                        <span className="qb-subq-badge">
                          {subqs.length} subquestions
                        </span>
                      )}
                      {q.usageCount > 0 && (
                        <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>
                          {q.usageCount} uses
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Render content with LaTeX math */}
                  <div
                    className="qb-card-body tex2jax_process"
                    dangerouslySetInnerHTML={{ __html: preprocessMathHtml(q.content) }}
                  />

                  {hasSubquestions && (
                    <div className="qb-total-marks-label">
                      (Total Marks: {totalAllocatedMarks})
                    </div>
                  )}

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

                  <div className="qb-card-actions">
                    <span className="qb-author-badge">
                      <UserIcon size={11} /> {q.authorName}
                    </span>
                    {hasSubquestions ? (
                      <button
                        className="btn btn-primary qb-manage-subq-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedParentModal({ question: q, isShared: true });
                        }}
                        title="Manage Subquestions"
                      >
                        <Layers size={12} /> Manage Subquestions
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewQuestion({
                              ...q,
                              isShared: true,
                              targetSection: sections?.[0]?.title,
                            });
                          }}
                          title="View Full Question"
                        >
                          <Eye size={12} /> View
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onInsertSharedQuestion(
                              q,
                              sections?.[0]?.title
                            );
                          }}
                          title="Add to Paper"
                        >
                          <Plus size={12} /> Add
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : filteredMy.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b', fontSize: 13 }}>
            No questions found in your library matching the criteria.
          </div>
        ) : (
          filteredMy.map((q) => {
            const chName = chapters.find(c => c.id === q.chapterId)?.name;
            const tpName = topics.find(t => t.id === q.topicId)?.name;
            const catName = categories.find(cat => cat.id === q.categoryId)?.name;
            const cognitiveBadgeColor =
              q.cognitiveLevel === 'remember' ? { bg: '#fef3c7', text: '#92400e' } :
              q.cognitiveLevel === 'understand' ? { bg: '#e0f2fe', text: '#0369a1' } :
              q.cognitiveLevel === 'apply' ? { bg: '#dcfce7', text: '#15803d' } :
              q.cognitiveLevel === 'analyse' ? { bg: '#f3e8ff', text: '#7e22ce' } :
              q.cognitiveLevel === 'evaluate' ? { bg: '#ffedd5', text: '#c2410c' } :
              { bg: '#fee2e2', text: '#b91c1c' };

            const subqs = q.subquestions || [];
            const hasSubquestions = subqs.length > 0;
            const totalAllocatedMarks = hasSubquestions
              ? subqs.reduce((acc, s) => acc + (s.marks || 1), 0)
              : (q.marks !== undefined ? q.marks : 1);

            return (
              <div
                key={q.id}
                className="qb-card"
                style={{ cursor: hasSubquestions ? 'pointer' : 'default' }}
                onClick={() => {
                  if (hasSubquestions) {
                    setSelectedParentModal({ question: q, isShared: false });
                  }
                }}
              >
                <div className="qb-card-header" style={{ flexWrap: 'wrap', gap: 4 }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        background: '#e0e7ff',
                        color: '#3730a3',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                      }}
                    >
                      {q.questionType}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        background: cognitiveBadgeColor.bg,
                        color: cognitiveBadgeColor.text,
                        borderRadius: 4,
                        textTransform: 'capitalize',
                      }}
                    >
                      {q.cognitiveLevel || 'Understand'}
                    </span>
                    {q.marks !== undefined && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 5px', background: '#e2e8f0', color: '#1e293b', borderRadius: 4 }}>
                        {q.marks}m
                      </span>
                    )}
                    {chName && (
                      <span style={{ fontSize: 10, padding: '2px 6px', background: '#e0e7ff', color: '#3730a3', borderRadius: 4 }}>
                        Ch: {chName}
                      </span>
                    )}
                    {tpName && (
                      <span style={{ fontSize: 10, padding: '2px 6px', background: '#f1f5f9', color: '#475569', borderRadius: 4 }}>
                        {tpName}
                      </span>
                    )}
                    {catName && (
                      <span style={{ fontSize: 10, padding: '2px 6px', background: '#fef3c7', color: '#92400e', borderRadius: 4 }}>
                        {catName}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {hasSubquestions && (
                      <span className="qb-subq-badge">
                        {subqs.length} subquestions
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: '#64748b' }}>{q.difficulty}</span>
                  </div>
                </div>

                {/* Render content with LaTeX math */}
                <div
                  className="qb-card-body tex2jax_process"
                  dangerouslySetInnerHTML={{ __html: preprocessMathHtml(q.content) }}
                />

                {hasSubquestions && (
                  <div className="qb-total-marks-label">
                    (Total Marks: {totalAllocatedMarks})
                  </div>
                )}

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

                <div className="qb-card-actions">
                  <span style={{ fontSize: 11, color: '#64748b' }}>Your question</span>
                  {hasSubquestions ? (
                    <button
                      className="btn btn-primary qb-manage-subq-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedParentModal({ question: q, isShared: false });
                      }}
                      title="Manage Subquestions"
                    >
                      <Layers size={12} /> Manage Subquestions
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewQuestion({
                            ...q,
                            isShared: false,
                            targetSection: sections?.[0]?.title,
                          });
                        }}
                        title="View Full Question"
                      >
                        <Eye size={12} /> View
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onInsertMyQuestion(
                            q,
                            sections?.[0]?.title
                          );
                        }}
                        title="Add to Paper"
                      >
                        <Plus size={12} /> Add
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
