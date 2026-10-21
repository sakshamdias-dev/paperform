import { useEffect } from 'react';
import type { QuestionType, Difficulty } from '../types';
import { X, Plus, BookOpen, User as UserIcon, Tag } from 'lucide-react';
import { renderMath } from '../utils/mathjax';

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
    <div className="modal-overlay" style={{ zIndex: 11500 }} onClick={onClose}>
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
              marginBottom: 16
            }}
            dangerouslySetInnerHTML={{ __html: question.content }}
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
                    <div className="tex2jax_process" style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: opt }} />
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
