import { useEffect } from 'react';
import type { QuestionType, Difficulty, BankSubQuestion, CognitiveLevel } from '../types';
import { X, Plus, BookOpen, User as UserIcon, Tag, Layers } from 'lucide-react';
import { renderMath, preprocessMathHtml } from '../utils/mathjax';

export interface ViewModalQuestion {
  id?: string;
  content: string;
  questionType: QuestionType;
  options?: string[];
  marks?: number;
  authorName?: string;
  topic?: string;
  difficulty?: Difficulty;
  typeHeader?: string;
  isShared?: boolean;
  parentSharedId?: string | null;
  targetSection?: string;
  parentQuestionId?: string;
  isOptional?: boolean;
  subquestions?: BankSubQuestion[];
  courseId?: string;
  subjectId?: string;
  classId?: string;
  chapterId?: string;
  topicId?: string;
  categoryId?: string;
  cognitiveLevel?: CognitiveLevel;
  explanation?: string;
  imageUrl?: string;
}

interface QuestionViewModalProps {
  question: ViewModalQuestion | null;
  isOpen?: boolean;
  onClose: () => void;
  onInsert: (q: ViewModalQuestion) => void;
  onAdd?: (q: ViewModalQuestion) => void;
}

export default function QuestionViewModal({ question, onClose, onInsert }: QuestionViewModalProps) {
  useEffect(() => {
    if (question) {
      setTimeout(() => {
        renderMath();
      }, 50);
    }
  }, [question]);

  if (!question) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 11500 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, width: '90vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} color="var(--primary, #034089)" />
            <h2 className="modal-title" style={{ fontSize: 18 }}>View Question</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-content" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {/* Metadata Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <span style={{
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 6,
              textTransform: 'uppercase'
            }}>
              {question.questionType}
            </span>

            {question.difficulty && (
              <span style={{
                background: question.difficulty === 'easy' ? '#ecfdf5' : question.difficulty === 'medium' ? '#fffbeb' : '#fef2f2',
                color: question.difficulty === 'easy' ? '#065f46' : question.difficulty === 'medium' ? '#92400e' : '#991b1b',
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 6,
                textTransform: 'capitalize'
              }}>
                {question.difficulty}
              </span>
            )}

            {question.marks !== undefined && (
              <span style={{
                background: '#f8fafc',
                color: '#334155',
                border: '1px solid #e2e8f0',
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 6,
              }}>
                {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
              </span>
            )}

            {question.subquestions && question.subquestions.length > 0 && (
              <span style={{
                background: '#eef4ff',
                color: '#034089',
                border: '1px solid #dbeafe',
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <Layers size={12} /> {question.subquestions.length} {question.subquestions.length === 1 ? 'part' : 'parts'}
              </span>
            )}

            {question.topic && (
              <span style={{
                background: '#f1f5f9',
                color: '#475569',
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <Tag size={12} /> {question.topic}
              </span>
            )}

            {question.authorName && (
              <span style={{
                background: '#fdf4ff',
                color: '#86198f',
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <UserIcon size={12} /> By {question.authorName}
              </span>
            )}
          </div>

          {/* Question Text */}
          <div
            className="tex2jax_process"
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: '#1e293b',
              background: '#fafbfc',
              padding: 16,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              marginBottom: 16,
              whiteSpace: 'pre-wrap'
            }}
            dangerouslySetInnerHTML={{ __html: preprocessMathHtml(question.content) }}
          />

          {/* Options if MCQ */}
          {question.questionType === 'mcq' && question.options && question.options.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 13, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Options:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {question.options.map((opt, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 14px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#2563eb', minWidth: 20 }}>
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <div className="tex2jax_process" style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: preprocessMathHtml(opt) }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subquestions if present */}
          {question.subquestions && question.subquestions.length > 0 && (
            <div style={{ marginTop: 18, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={14} color="#034089" />
                <span>Sub-questions ({question.subquestions.length})</span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {question.subquestions.map((sq, idx) => (
                  <div
                    key={sq.id || idx}
                    style={{
                      padding: '12px 14px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#034089' }}>
                        Part ({String.fromCharCode(97 + idx)})
                      </span>
                      <span style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: '#f8fafc',
                        color: '#334155',
                        border: '1px solid #e2e8f0'
                      }}>
                        {sq.marks || 1} {(sq.marks || 1) === 1 ? 'mark' : 'marks'}
                      </span>
                    </div>
                    <div
                      className="tex2jax_process"
                      style={{ fontSize: 14, lineHeight: 1.55, color: '#1e293b' }}
                      dangerouslySetInnerHTML={{ __html: preprocessMathHtml(sq.content) }}
                    />
                    {sq.questionType === 'mcq' && sq.options && sq.options.length > 0 && (
                      <div className="qb-card-options tex2jax_process" style={{ marginTop: 8 }}>
                        {sq.options.map((opt, oi) => (
                          <div key={oi} className="qb-card-opt-item">
                            <span className="qb-opt-letter">{String.fromCharCode(65 + oi)}.</span>
                            <span dangerouslySetInnerHTML={{ __html: preprocessMathHtml(opt) }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => {
              onInsert(question);
              onClose();
            }}
          >
            <Plus size={16} /> Add to Paper
          </button>
        </div>
      </div>
    </div>
  );
}
