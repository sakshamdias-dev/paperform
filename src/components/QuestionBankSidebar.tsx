import { useState, useMemo, useEffect } from 'react';
import type { Question, SharedQuestion } from '../types';
import { Search, X, Eye, Plus, Sparkles, BookOpen, Layers, User as UserIcon } from 'lucide-react';
import { renderMath } from '../utils/mathjax';

interface QuestionBankSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  myQuestions: Question[];
  sharedQuestions: SharedQuestion[];
  paperSubjectName?: string;
  paperClassName?: string;
  sections?: { id: string; title: string }[];
  topLevelQuestions?: { id: string; label: string }[];
  onViewQuestion: (q: any) => void;
  onInsertSharedQuestion: (q: SharedQuestion, targetSection?: string, parentId?: string, isOptional?: boolean) => void;
  onInsertMyQuestion: (q: Question, targetSection?: string, parentId?: string, isOptional?: boolean) => void;
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

export default function QuestionBankSidebar({
  isOpen,
  onClose,
  myQuestions,
  sharedQuestions,
  paperSubjectName,
  paperClassName,
  sections,
  topLevelQuestions,
  onViewQuestion,
  onInsertSharedQuestion,
  onInsertMyQuestion,
}: QuestionBankSidebarProps) {
  const [tab, setTab] = useState<'shared' | 'my'>('shared');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('all');

  // Insert location controls
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [isOptional, setIsOptional] = useState<boolean>(false);

  // Set default section when sections become available
  useEffect(() => {
    if (sections && sections.length > 0 && !selectedSection) {
      setSelectedSection(sections[0].title);
    }
  }, [sections]);

  // Collect distinct topics from shared questions
  const topics = useMemo(() => {
    const set = new Set<string>();
    sharedQuestions.forEach((q) => {
      if (q.topic) set.add(q.topic);
    });
    return Array.from(set);
  }, [sharedQuestions]);

  // Filtered shared questions
  const filteredShared = useMemo(() => {
    return sharedQuestions.filter((q) => {
      if (selectedTopic !== 'all' && q.topic !== selectedTopic) return false;
      if (!searchTerm.trim()) return true;
      const plain = stripHtml(q.content).toLowerCase();
      const term = searchTerm.toLowerCase();
      return (
        plain.includes(term) ||
        (q.topic && q.topic.toLowerCase().includes(term)) ||
        (q.authorName && q.authorName.toLowerCase().includes(term))
      );
    });
  }, [sharedQuestions, selectedTopic, searchTerm]);

  // Filtered my questions
  const filteredMy = useMemo(() => {
    return myQuestions.filter((q) => {
      if (!searchTerm.trim()) return true;
      const plain = stripHtml(q.content).toLowerCase();
      return plain.includes(searchTerm.toLowerCase());
    });
  }, [myQuestions, searchTerm]);

  // Trigger MathJax typeset whenever questions list updates
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        renderMath();
      }, 70);
      return () => clearTimeout(timer);
    }
  }, [isOpen, tab, filteredShared, filteredMy, searchTerm, selectedTopic]);

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
          <span className="qb-count-badge">{sharedQuestions.length}</span>
        </button>
        <button
          className={`qb-tab-btn ${tab === 'my' ? 'active' : ''}`}
          onClick={() => setTab('my')}
        >
          <Layers size={14} />
          My Questions
          <span className="qb-count-badge">{myQuestions.length}</span>
        </button>
      </div>

      {/* Target Section & Parent Question controls (Optional selection) */}
      <div className="qb-target-strip">
        <div className="qb-target-row">
          {sections && sections.length > 0 && (
            <div className="qb-target-col">
              <label>Section:</label>
              <select
                value={selectedSection || sections[0]?.title || ''}
                onChange={(e) => setSelectedSection(e.target.value)}
              >
                {sections.map((s) => (
                  <option key={s.id || s.title} value={s.title}>
                    {s.title || 'Untitled Section'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {topLevelQuestions && topLevelQuestions.length > 0 && (
            <div className="qb-target-col">
              <label>Parent (Optional):</label>
              <select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
              >
                <option value="">Top Level (New Question)</option>
                {topLevelQuestions.map((tq) => (
                  <option key={tq.id} value={tq.id}>
                    {tq.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <label className="qb-optional-toggle">
          <input
            type="checkbox"
            checked={isOptional}
            onChange={(e) => setIsOptional(e.target.checked)}
          />
          <span>Mark added questions as Optional</span>
        </label>
      </div>

      {/* Filters & Search */}
      <div className="qb-filters">
        <div className="qb-search-wrapper">
          <Search size={14} className="qb-search-icon" />
          <input
            type="text"
            className="qb-search-input"
            placeholder={tab === 'shared' ? 'Search by question, topic, author...' : 'Search my questions...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {tab === 'shared' && topics.length > 0 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            <button
              style={{
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 9999,
                border: '1px solid #cbd5e1',
                background: selectedTopic === 'all' ? '#2563eb' : '#ffffff',
                color: selectedTopic === 'all' ? '#ffffff' : '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              onClick={() => setSelectedTopic('all')}
            >
              All Topics
            </button>
            {topics.map((t) => (
              <button
                key={t}
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 9999,
                  border: '1px solid #cbd5e1',
                  background: selectedTopic === t ? '#2563eb' : '#ffffff',
                  color: selectedTopic === t ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => setSelectedTopic(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Context info banner */}
      {(paperSubjectName || paperClassName) && (
        <div style={{ padding: '6px 16px', background: '#eff6ff', borderBottom: '1px solid #dbeafe', fontSize: 11, color: '#1e40af' }}>
          Showing bank for: <strong>{paperSubjectName || 'Subject'}</strong> {paperClassName ? `(${paperClassName})` : ''}
        </div>
      )}

      {/* Questions list */}
      <div className="qb-list">
        {tab === 'shared' ? (
          filteredShared.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b', fontSize: 13 }}>
              No shared questions found. Try clearing your search.
            </div>
          ) : (
            filteredShared.map((q) => {
              return (
                <div key={q.id} className="qb-card">
                  <div className="qb-card-header">
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          background: '#e0f2fe',
                          color: '#0369a1',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                        }}
                      >
                        {q.questionType}
                      </span>
                      {q.topic && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            background: '#f1f5f9',
                            color: '#475569',
                            borderRadius: 4,
                          }}
                        >
                          {q.topic}
                        </span>
                      )}
                    </div>
                    {q.usageCount > 0 && (
                      <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>
                        {q.usageCount} uses
                      </span>
                    )}
                  </div>

                  {/* Render content with LaTeX math */}
                  <div
                    className="qb-card-body tex2jax_process"
                    dangerouslySetInnerHTML={{ __html: q.content }}
                  />

                  {q.questionType === 'mcq' && q.options && q.options.length > 0 && (
                    <div className="qb-card-options tex2jax_process">
                      {q.options.slice(0, 4).map((opt, i) => (
                        <div key={i} className="qb-card-opt-item">
                          <span className="qb-opt-letter">{String.fromCharCode(65 + i)}.</span>
                          <span dangerouslySetInnerHTML={{ __html: opt }} />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="qb-card-actions">
                    <span className="qb-author-badge">
                      <UserIcon size={11} /> {q.authorName}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() =>
                          onViewQuestion({
                            ...q,
                            isShared: true,
                            targetSection: selectedSection || sections?.[0]?.title,
                            parentQuestionId: selectedParentId || undefined,
                            isOptional,
                          })
                        }
                        title="View Full Question"
                      >
                        <Eye size={12} /> View
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() =>
                          onInsertSharedQuestion(
                            q,
                            selectedSection || sections?.[0]?.title,
                            selectedParentId || undefined,
                            isOptional
                          )
                        }
                        title="Add to Paper"
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : filteredMy.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b', fontSize: 13 }}>
            No questions found in your library yet. Questions you create will appear here.
          </div>
        ) : (
          filteredMy.map((q) => {
            return (
              <div key={q.id} className="qb-card">
                <div className="qb-card-header">
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
                  <span style={{ fontSize: 10, color: '#64748b' }}>{q.difficulty}</span>
                </div>

                {/* Render content with LaTeX math */}
                <div
                  className="qb-card-body tex2jax_process"
                  dangerouslySetInnerHTML={{ __html: q.content }}
                />

                {q.questionType === 'mcq' && q.options && q.options.length > 0 && (
                  <div className="qb-card-options tex2jax_process">
                    {q.options.slice(0, 4).map((opt, i) => (
                      <div key={i} className="qb-card-opt-item">
                        <span className="qb-opt-letter">{String.fromCharCode(65 + i)}.</span>
                        <span dangerouslySetInnerHTML={{ __html: opt }} />
                      </div>
                    ))}
                  </div>
                )}

                <div className="qb-card-actions">
                  <span style={{ fontSize: 11, color: '#64748b' }}>Your question</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() =>
                        onViewQuestion({
                          ...q,
                          isShared: false,
                          targetSection: selectedSection || sections?.[0]?.title,
                          parentQuestionId: selectedParentId || undefined,
                          isOptional,
                        })
                      }
                      title="View Full Question"
                    >
                      <Eye size={12} /> View
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() =>
                        onInsertMyQuestion(
                          q,
                          selectedSection || sections?.[0]?.title,
                          selectedParentId || undefined,
                          isOptional
                        )
                      }
                      title="Add to Paper"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
