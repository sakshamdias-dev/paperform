import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { MathfieldElement } from 'mathlive';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';


async function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error('Canvas is empty');
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
    }, 'image/jpeg');
  });
}


MathfieldElement.fontsDirectory = '/fonts';
MathfieldElement.soundsDirectory = '/sounds';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'math-field': any;
    }
  }
}

declare global {
  interface Window {
    MathJax: any;
  }
}

import { Rnd } from 'react-rnd';
import {
  Plus,
  Trash2,
  GripVertical,
  Download,
  ArrowLeft,
  Check,
  ListChecks,
  AlignLeft,
  Search,
  Pencil,
  Image as ImageIcon,
  Table2,
  Keyboard,
  Settings,
  X,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  GitFork,
  Layers,
  FolderPlus,
  Loader2,
} from 'lucide-react';
import { useStore } from '../store';
import type { Question, PaperQuestion, QuestionType, PaperSection, Difficulty } from '../types';
import React from 'react';

const BLOCK_TYPES: { type: QuestionType; label: string; icon: typeof AlignLeft; description: string; header: string }[] = [
  { type: 'mcq', label: 'Multiple Choice', icon: ListChecks, description: 'Question with options A-D', header: 'Multiple Choice:' },
  { type: 'subjective', label: 'Subjective Question', icon: AlignLeft, description: 'Answer the following', header: 'Answer the following:' },
];


function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

interface SubQuestionNode {
  pq: PaperQuestion;
  question: Question;
  children: SubQuestionNode[];
}

interface SortableQuestionProps {
  paperQuestion: PaperQuestion;
  question: Question;
  isSelected: boolean;
  questionNumber: number;
  onSelect: () => void;
  onRemove: () => void;
  onEdit: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onAddSubQuestion?: () => void;
  showSectionHeader?: string;
  sectionNumber?: number;
  sectionMarks?: number;
  canMoveSectionUp?: boolean;
  canMoveSectionDown?: boolean;
  onMoveSectionUp?: (section: string) => void;
  onMoveSectionDown?: (section: string) => void;
  subQuestions?: SubQuestionNode[];
  onEditSubQuestion?: (pqId: string) => void;
  onRemoveSubQuestion?: (pqId: string, qId: string) => void;
  onMoveSubQuestionUp?: (pqId: string) => void;
  onMoveSubQuestionDown?: (pqId: string) => void;
  onAddSubSubQuestion?: (pq: PaperQuestion) => void;
}

function getMcqLayout(options: string[]): string {
  if (options.length === 0) return 'vertical';

  const hasLargeOption = options.some(opt => {
    // If it contains an image or table, it's very big
    if (opt.includes('<img') || opt.includes('<table')) return true;

    // Check character length of plain text
    const textOnly = stripHtml(opt).trim();
    // 35 characters is a safe threshold for half-width (2x2 grid) padding
    return textOnly.length > 35;
  });

  if (hasLargeOption) return 'vertical';

  return 'grid'; // 2x2 grid is the default
}

function SortableQuestion({
  paperQuestion,
  question,
  isSelected,
  questionNumber,
  onSelect,
  onRemove,
  onEdit,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  showSectionHeader,
  canMoveSectionUp,
  canMoveSectionDown,
  onMoveSectionUp,
  onMoveSectionDown,
  subQuestions,
  onEditSubQuestion,
  onRemoveSubQuestion,
  onMoveSubQuestionUp,
  onMoveSubQuestionDown,
}: SortableQuestionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: paperQuestion.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const mcqLayout = question.questionType === 'mcq' ? getMcqLayout(question.options || []) : 'vertical';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rendered-question-item ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      data-question-id={question.id}
    >
      {/* Section Divider Header */}
      {showSectionHeader && (
        <div className="section-divider">
          <span>{showSectionHeader}</span>
          <div className="section-admin-actions">
            {onMoveSectionUp && (
              <button
                className="section-action-icon-btn"
                onClick={(e) => { e.stopPropagation(); onMoveSectionUp(showSectionHeader); }}
                disabled={!canMoveSectionUp}
                title={`Move Section ${showSectionHeader} Up`}
              >
                <ChevronUp size={14} />
              </button>
            )}
            {onMoveSectionDown && (
              <button
                className="section-action-icon-btn"
                onClick={(e) => { e.stopPropagation(); onMoveSectionDown(showSectionHeader); }}
                disabled={!canMoveSectionDown}
                title={`Move Section ${showSectionHeader} Down`}
              >
                <ChevronDown size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Clean HTML - Question Content & Options with Inline Actions */}
      <div className="clean-question">
        <div className="q-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, position: 'relative' }}>
          <div className="q-drag-handle" {...attributes} {...listeners} title="Drag to reorder">
            <GripVertical size={14} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
            {!/^(q\.?\s*\d+|question\s*\d+|\d+[\.\)])/i.test(stripHtml(question.content).trim()) && (
              <span className="q-number">
                {questionNumber}.
              </span>
            )}
            <div className="q-content-wrapper" style={{ flex: 1, minWidth: 0 }}>
              <div className="q-text" dangerouslySetInnerHTML={{ __html: (question.content || '').replace(/&nbsp;/g, ' ') }} />
              {question.questionType === 'mcq' && question.options && question.options.length > 0 && (
                <div className={`q-options q-options-${mcqLayout}`}>
                  {question.options.map((opt, i) => (
                    <span key={i} className="q-option" data-option-index={i} style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
                      <span style={{ marginRight: '4px' }}>{String.fromCharCode(65 + i)}.</span>
                      <span dangerouslySetInnerHTML={{ __html: (opt || '').replace(/&nbsp;/g, ' ') }} />
                    </span>
                  ))}
                </div>
              )}

            </div>
          </div>

          {/* Right side on the same level: Question Controls + Marks */}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 16, position: 'relative' }}>
            <div className="question-card-actions">
              {onMoveUp && (
                <button
                  className="q-action-icon-btn"
                  onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                  disabled={!canMoveUp}
                  title="Move Question Up"
                >
                  <ChevronUp size={14} />
                </button>
              )}
              {onMoveDown && (
                <button
                  className="q-action-icon-btn"
                  onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                  disabled={!canMoveDown}
                  title="Move Question Down"
                >
                  <ChevronDown size={14} />
                </button>
              )}
              <button
                className="q-action-icon-btn"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                title="Edit Question"
              >
                <Pencil size={13} />
              </button>
              <button
                className="q-action-icon-btn danger"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                title="Delete Question"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <span className="marks-inline">{paperQuestion.marks}m</span>
          </div>
        </div>

        {/* Flattened sub-questions for proper right-alignment */}
        {subQuestions && subQuestions.length > 0 && (
          <div className="sub-questions" style={{ marginTop: 12 }}>
            {subQuestions.map((sub, si) => {
              const renderSubQ = (node: SubQuestionNode, depth: number, idx: number, numSiblings: number): React.ReactNode => {
                let label = `(${String.fromCharCode(97 + idx)})`;
                if (depth === 1) label = `(${['i', 'ii', 'iii', 'iv', 'v'][idx] || String(idx + 1)})`;
                if (depth >= 2) label = `•`;
                const subContentText = stripHtml(node.question.content).trim();
                const hasCustomNumber = /^(q\.?\s*\d+|question\s*\d+|\d+[\.\)]|\(\d+\)|[a-z][\.\)]|\([a-z]\)|\([ivx]+\)|[ivx]+[\.\)]|[•\-\*])/i.test(subContentText);

                const subMcqLayout = node.question.questionType === 'mcq' ? getMcqLayout(node.question.options || []) : 'vertical';

                const canMoveUp = idx > 0;
                const canMoveDown = idx < numSiblings - 1;

                return (
                  <React.Fragment key={node.pq.id}>
                    <div className="q-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, position: 'relative', marginTop: 10 }}>
                      <div style={{ width: 14, flexShrink: 0 }} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 0, marginLeft: 24 + depth * 20 }}>
                        {!hasCustomNumber && (
                          <span className="q-number" style={{ fontSize: '0.85em', minWidth: 24 }}>{label}</span>
                        )}
                        <div className="q-content-wrapper" style={{ flex: 1, minWidth: 0 }}>
                          <div className="q-text" dangerouslySetInnerHTML={{ __html: (node.question.content || '').replace(/&nbsp;/g, ' ') }} />
                          {node.question.questionType === 'mcq' && node.question.options && node.question.options.length > 0 && (
                            <div className={`q-options q-options-${subMcqLayout}`}>
                              {node.question.options.map((opt, oi) => (
                                <span key={oi} className="q-option" style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
                                  <span style={{ marginRight: '4px' }}>{String.fromCharCode(65 + oi)}.</span>
                                  <span dangerouslySetInnerHTML={{ __html: (opt || '').replace(/&nbsp;/g, ' ') }} />
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 16, position: 'relative' }}>
                        <div className="question-card-actions">
                          {onMoveSubQuestionUp && (
                            <button className="q-action-icon-btn" onClick={(e) => { e.stopPropagation(); onMoveSubQuestionUp(node.pq.id); }} disabled={!canMoveUp} title="Move Question Up">
                              <ChevronUp size={14} />
                            </button>
                          )}
                          {onMoveSubQuestionDown && (
                            <button className="q-action-icon-btn" onClick={(e) => { e.stopPropagation(); onMoveSubQuestionDown(node.pq.id); }} disabled={!canMoveDown} title="Move Question Down">
                              <ChevronDown size={14} />
                            </button>
                          )}
                          {onEditSubQuestion && (
                            <button className="q-action-icon-btn" onClick={(e) => { e.stopPropagation(); onEditSubQuestion(node.pq.id); }} title="Edit Subquestion">
                              <Pencil size={13} />
                            </button>
                          )}
                          {onRemoveSubQuestion && (
                            <button className="q-action-icon-btn danger" onClick={(e) => { e.stopPropagation(); onRemoveSubQuestion(node.pq.id, node.question.id); }} title="Delete Subquestion">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                        <span className="marks-inline" style={{ fontSize: '0.85em' }}>{node.pq.marks}m</span>
                      </div>
                    </div>
                    {node.children && node.children.length > 0 && node.children.map((child, ci) => renderSubQ(child, depth + 1, ci, node.children.length))}
                  </React.Fragment>
                );
              };
              return renderSubQ(sub, 0, si, subQuestions.length);
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const CustomToolbar = ({ id = "toolbar" }: { id?: string }) => (
  <div id={id}>
    <span className="ql-formats">
      <button className="ql-bold" title="Bold" />
      <button className="ql-italic" title="Italic" />
      <button className="ql-underline" title="Underline" />
      <button className="ql-strike" title="Strikethrough" />
    </span>
    <span className="ql-formats">
      <button className="ql-list" value="ordered" title="Numbered List" />
      <button className="ql-list" value="bullet" title="Bullet List" />
    </span>
    <span className="ql-formats">
      <button className="ql-script" value="sub" title="Subscript" />
      <button className="ql-script" value="super" title="Superscript" />
    </span>
    <span className="ql-formats">
      <select className="ql-align" title="Text Alignment">
        <option value="" />
        <option value="center" />
        <option value="right" />
        <option value="justify" />
      </select>
    </span>
    <span className="ql-formats">
      <button className="ql-image" title="Insert Image">
        <ImageIcon size={16} />
      </button>
      <button className="ql-table" title="Insert Table">
        <Table2 size={16} />
      </button>
      <button className="ql-math" title="Insert LaTeX Formula">
        <span style={{ fontSize: 16, fontWeight: 'bold' }}>&sum;</span>
      </button>
      <button className="ql-clean" title="Clear Formatting" />
    </span>
  </div>
);

function FullQuill({ value, onChange, placeholder, openMathDialog, toolbarId = "toolbar", onImageClick }: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  openMathDialog: (onInsert: (latex: string) => void) => void;
  toolbarId?: string;
  onImageClick?: (imgElement: HTMLImageElement, htmlValue: string, onChange: (newHtml: string) => void) => void;
}) {
  const quillRef = useRef<ReactQuill>(null);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);

  const confirmTableInsert = () => {
    if (quillRef.current && tableRows > 0 && tableCols > 0) {
      const quill = quillRef.current.getEditor();
      const range = quill.getSelection();
      const tableModule = quill.getModule('table') as any;
      if (tableModule) {
        quill.insertText(range?.index || quill.getLength() - 1, '\n');
        tableModule.insertTable(tableRows + 1, tableCols);
      }
    }
    setShowTableDialog(false);
  };

  const modules = useMemo(() => ({
    toolbar: {
      container: `#${toolbarId}`,
      handlers: {
        table: () => setShowTableDialog(true),
        math: () => {
          if (!quillRef.current) return;
          const quill = quillRef.current.getEditor();
          const range = quill.getSelection(true) || { index: Math.max(0, quill.getLength() - 1) };
          openMathDialog((latex) => {
            const mathText = `\\(${latex}\\)`;
            quill.insertText(range.index, mathText, 'user');
            quill.setSelection(range.index + mathText.length, 0);
          });
        }
      }
    },
    table: true
  }), [toolbarId, openMathDialog]);

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && onImageClick) {
      onImageClick(target as HTMLImageElement, value, onChange);
    }
  };

  return (
    <div className="rich-editor-wrapper" onClick={handleEditorClick}>
      <CustomToolbar id={toolbarId} />
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        placeholder={placeholder}
        style={{ background: 'white', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}
      />

      {showTableDialog && (
        <div className="modal-overlay" onClick={() => setShowTableDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title">Insert Table</h2>
            </div>
            <div className="modal-content">
              <div className="property-field">
                <label className="property-label">Rows</label>
                <input
                  type="number"
                  className="property-input"
                  value={tableRows}
                  onChange={(e) => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                />
              </div>
              <div className="property-field">
                <label className="property-label">Columns</label>
                <input
                  type="number"
                  className="property-input"
                  value={tableCols}
                  onChange={(e) => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowTableDialog(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmTableInsert}>Insert Table</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    questionPapers,
    questions,
    paperQuestions,
    courses,
    subjects,
    classes,
    fetchPaperQuestions,
    fetchQuestions,
    removeQuestionFromPaper,
    reorderPaperQuestions,
    updateQuestionPaper,
    createAndAddQuestion,
    updateQuestion,
    updatePaperQuestion,
    deleteQuestion,
  } = useStore();

  const user = useStore((s) => s.user);

  const paper = questionPapers.find(qp => qp.id === id);
  const [selectedPQId, setSelectedPQId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [suggestedSearch, setSuggestedSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const [draftType, setDraftType] = useState<QuestionType | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [draftOptions, setDraftOptions] = useState<string[]>(['', '', '', '']);
  const [draftSection, setDraftSection] = useState<PaperSection>('');
  const [draftMarks, setDraftMarks] = useState(1);
  const [draftDifficulty, setDraftDifficulty] = useState<Difficulty>('medium');
  const [draftTypeHeader, setDraftTypeHeader] = useState('');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingPQId, setEditingPQId] = useState<string | null>(null);

  interface DraftSubquestion {
    id: string; // Used for React keys and temp identification
    questionId?: string; // Original question ID if editing
    pqId?: string; // Original paper_question ID if editing
    type: QuestionType;
    content: string;
    options: string[];
    marks: number;
    difficulty: Difficulty;
    isExpanded?: boolean;
  }
  const [draftSubquestions, setDraftSubquestions] = useState<DraftSubquestion[]>([]);

  const [isConstructorOpen, setIsConstructorOpen] = useState(false);
  const [activeView, setActiveView] = useState<'tree' | 'add-section' | 'add-question'>('tree');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [qParentId, setQParentId] = useState<string>('');
  const [isAddingNewSection, setIsAddingNewSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});



  const [showMathDialog, setShowMathDialog] = useState(false);
  const [showCreatorHub, setShowCreatorHub] = useState(false);
  const [showPaperSettings, setShowPaperSettings] = useState(false);
  const [mathKeyboardVisible, setMathKeyboardVisible] = useState(false);
  const mathDialogCallbackRef = useRef<((latex: string) => void) | null>(null);
  const mathFieldRef = useRef<any>(null);

  const [editingImage, setEditingImage] = useState<{
    imgElement: HTMLImageElement;
    originalHtml: string;
    originalWidth: number;
    contextSelector: string;
    onApply: (newHtml: string) => Promise<void> | void;
  } | null>(null);
  const [imageOverlayRect, setImageOverlayRect] = useState<{ top: number; left: number; width: number; height: number; clipTop: number; clipBottom: number; clipLeft: number; clipRight: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  // Update overlay rect when editingImage changes or on scroll/resize
  useEffect(() => {
    if (!editingImage) { setImageOverlayRect(null); return; }

    const update = () => {
      let el = editingImage.imgElement;
      // React re-renders (like FullQuill recreating or dangerouslySetInnerHTML refreshing) 
      // can cause the img element to detach. Reconnect it!
      if (!document.body.contains(el)) {
        const candidates = Array.from(document.querySelectorAll(`${editingImage.contextSelector} img[src="${el.src}"]`)) as HTMLImageElement[];
        const newEl = candidates.find(c => !c.closest('.measurement-container'));

        if (newEl) {
          el = newEl;
          // Update the state reference so handleMouseMove gets the right element too
          editingImage.imgElement = el;
        } else {
          // Image was permanently removed from DOM
          setImageOverlayRect(null);
          setEditingImage(null);
          return;
        }
      }

      el.style.outline = '2px solid var(--accent)';

      const rect = el.getBoundingClientRect();
      const scrollParent = el.closest('.modal-content, .editor-content-area, .paper-preview-scroll, .editor-canvas');
      let clipTop = 0; let clipBottom = window.innerHeight; let clipLeft = 0; let clipRight = window.innerWidth;

      if (scrollParent) {
        const pRect = scrollParent.getBoundingClientRect();
        clipTop = pRect.top;
        clipBottom = pRect.bottom;
        clipLeft = pRect.left;
        clipRight = pRect.right;
      }

      // Safety check: if width/height are 0, it means it's hidden or not rendered
      if (rect.width === 0 || rect.height === 0) {
        setImageOverlayRect(null);
        return;
      }

      setImageOverlayRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height, clipTop, clipBottom, clipLeft, clipRight });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      if (editingImage?.imgElement && document.body.contains(editingImage.imgElement)) {
        editingImage.imgElement.style.outline = '';
      }
      window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update);
    };
  }, [editingImage]);

  // Global mouse handlers for corner drag resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current || !editingImage || !imageOverlayRect) return;
      e.preventDefault();
      const delta = e.clientX - resizeRef.current.startX;
      let newWidth = Math.max(30, resizeRef.current.startWidth + delta);
      // Clamp to parent container width
      const parent = editingImage.imgElement.parentElement;
      if (parent) {
        const parentWidth = parent.getBoundingClientRect().width;
        newWidth = Math.min(newWidth, parentWidth);
      }
      editingImage.imgElement.style.width = `${newWidth}px`;
      editingImage.imgElement.style.height = 'auto';
      const rect = editingImage.imgElement.getBoundingClientRect();
      setImageOverlayRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        clipTop: imageOverlayRect.clipTop,
        clipBottom: imageOverlayRect.clipBottom,
        clipLeft: imageOverlayRect.clipLeft,
        clipRight: imageOverlayRect.clipRight
      });
    };
    const handleMouseUp = () => {
      if (resizeRef.current) resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [editingImage, imageOverlayRect]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editingImage) return;
    resizeRef.current = { startX: e.clientX, startWidth: editingImage.imgElement.getBoundingClientRect().width };
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
  };

  const applyImageEdit = useCallback(async (newSrc?: string) => {
    if (!editingImage) return;
    const currentWidth = editingImage.imgElement.getBoundingClientRect().width;
    const parser = new DOMParser();
    const doc = parser.parseFromString(editingImage.originalHtml, 'text/html');
    const imgs = doc.querySelectorAll('img');
    const targetSrc = editingImage.imgElement.getAttribute('src');

    imgs.forEach(img => {
      if (img.getAttribute('src') === targetSrc || img.src === editingImage.imgElement.src) {
        if (newSrc && typeof newSrc === 'string') img.src = newSrc;
        const w = Math.round(currentWidth);
        img.style.width = `${w}px`;
        img.setAttribute('width', `${w}`);
      }
    });
    await editingImage.onApply(doc.body.innerHTML);
    setEditingImage(null);
  }, [editingImage]);


  // Click outside to apply edit and dismiss orange border
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        editingImage &&
        target !== editingImage.imgElement &&
        !target.closest('.rnd-handle') &&
        !target.closest('.crop-btn') &&
        !target.closest('.ReactModalPortal') // Crop modal
      ) {
        // e.preventDefault() here might break legitimate clicks, so we just passively save
        applyImageEdit();
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [editingImage, applyImageEdit]);

  const handleQuillImageClick = useCallback((imgElement: HTMLImageElement, htmlValue: string, onChange: (newHtml: string) => void) => {
    setEditingImage({
      imgElement,
      originalHtml: htmlValue,
      originalWidth: imgElement.getBoundingClientRect().width,
      contextSelector: '.rich-editor-wrapper',
      onApply: (newHtml) => onChange(newHtml),
    });
  }, []);

  // Track MathLive virtual keyboard visibility
  useEffect(() => {
    const kbd = window.mathVirtualKeyboard;
    if (!kbd) return;
    const handler = () => {
      setMathKeyboardVisible(kbd.visible);
    };
    kbd.addEventListener('geometrychange', handler);
    return () => kbd.removeEventListener('geometrychange', handler);
  }, []);

  const openMathDialog = useCallback((onInsert: (latex: string) => void) => {
    mathDialogCallbackRef.current = onInsert;
    setShowMathDialog(true);
    setTimeout(() => {
      if (mathFieldRef.current) {
        mathFieldRef.current.focus();
      }
    }, 100);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const paperRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      fetchPaperQuestions(id);
      fetchQuestions();
    }
  }, [id, fetchPaperQuestions, fetchQuestions]);

  const paperQuestionsList = useMemo(() => {
    return paperQuestions.get(id || '') || [];
  }, [paperQuestions, id]);

  // Tree building logic
  const sections = useMemo(() => {
    const secMap = new Map<string, any>();
    const pqMap = new Map<string, any>();

    paperQuestionsList.forEach(pq => {
      const q = questions.find(x => x.id === pq.questionId);
      pqMap.set(pq.id, { ...pq, text: q?.content, type: q?.questionType, options: q?.options, children: [] });
    });

    paperQuestionsList.forEach(pq => {
      const node = pqMap.get(pq.id);
      if (pq.parentId) {
        if (pqMap.has(pq.parentId)) {
          pqMap.get(pq.parentId).children.push(node);
        }
      } else {
        if (!secMap.has(pq.section)) {
          secMap.set(pq.section, { id: pq.section, title: pq.section, questions: [] });
        }
        secMap.get(pq.section).questions.push(node);
      }
    });

    return Array.from(secMap.values());
  }, [paperQuestionsList, questions]);

  const totalQuestionsCount = paperQuestionsList.length;

  const getAllQuestionsFlat = (qs: any[], excludeId?: string | null, depth = 0): any[] => {
    let result: any[] = [];
    qs.forEach((q) => {
      if (excludeId && q.id === excludeId) return;

      let text = q.text ? q.text.replace(/<[^>]*>?/gm, '') : 'Empty';
      // Decode common HTML entities that come from Quill
      text = text.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
      text = text.trim().substring(0, 45);

      const prefix = depth > 0 ? '' : '';
      result.push({ id: q.id, label: `${prefix}${text}...` });
      if (q.children && q.children.length > 0) {
        result = result.concat(getAllQuestionsFlat(q.children, excludeId, depth + 1));
      }
    });
    return result;
  };

  const selectedSectionObj = sections.find(s => s.id === draftSection);
  const parentCandidates = selectedSectionObj ? getAllQuestionsFlat(selectedSectionObj.questions, editingPQId) : [];

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };


  // Render MathJax formulas in the paper preview and property panel
  useEffect(() => {
    // Dynamically load MathJax if it's not already loaded
    if (!window.MathJax) {
      window.MathJax = {
        tex: {
          inlineMath: [['\\(', '\\)']],
          displayMath: [['$$', '$$']],
          macros: {
            degree: '^\\circ'
          }
        },
        svg: {
          fontCache: 'global'
        },
        options: {
          ignoreHtmlClass: 'ql-editor',
          processHtmlClass: 'tex2jax_process'
        }
      };
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
      script.async = true;
      document.head.appendChild(script);
    } else if (window.MathJax.typesetPromise) {
      // If MathJax is already loaded, re-render the math on the page
      window.MathJax.typesetPromise().catch((err: any) => console.log('MathJax error:', err));
    }
  });



  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleMoveQuestion = async (pqId: string, direction: 'up' | 'down') => {
    if (!id) return;
    const currentIndex = paperQuestionsList.findIndex(pq => pq.id === pqId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= paperQuestionsList.length) return;
    const newList = arrayMove(paperQuestionsList, currentIndex, targetIndex);
    await reorderPaperQuestions(id, newList);
  };

  const distinctSections = useMemo(() => {
    const seen = new Set<string>();
    const res: string[] = [];
    for (const pq of paperQuestionsList) {
      if (!seen.has(pq.section)) {
        seen.add(pq.section);
        res.push(pq.section);
      }
    }
    return res;
  }, [paperQuestionsList]);

  const sectionTotalMarks = useMemo(() => {
    const map: Record<string, number> = {};
    for (const pq of paperQuestionsList) {
      map[pq.section] = (map[pq.section] || 0) + (pq.marks || 0);
    }
    return map;
  }, [paperQuestionsList]);

  const handleMoveSection = async (section: string, direction: 'up' | 'down') => {
    if (!id) return;
    const secIdx = distinctSections.indexOf(section);
    if (secIdx === -1) return;
    const targetSecIdx = direction === 'up' ? secIdx - 1 : secIdx + 1;
    if (targetSecIdx < 0 || targetSecIdx >= distinctSections.length) return;

    const targetSection = distinctSections[targetSecIdx];
    const newOrderSections = [...distinctSections];
    newOrderSections[secIdx] = targetSection;
    newOrderSections[targetSecIdx] = section;

    const grouped: Record<string, PaperQuestion[]> = {};
    for (const s of newOrderSections) grouped[s] = [];
    for (const pq of paperQuestionsList) {
      if (grouped[pq.section]) {
        grouped[pq.section].push(pq);
      } else {
        grouped[pq.section] = [pq];
      }
    }

    const newList: PaperQuestion[] = [];
    for (const s of newOrderSections) {
      if (grouped[s]) newList.push(...grouped[s]);
    }
    for (const pq of paperQuestionsList) {
      if (!newList.some(item => item.id === pq.id)) {
        newList.push(pq);
      }
    }

    await reorderPaperQuestions(id, newList);
  };

  const handleAddSubQuestion = (parentPQ: PaperQuestion) => {
    setDraftSection(parentPQ.section);
    setQParentId(parentPQ.id);
    setIsConstructorOpen(true);
    setActiveView('add-question');
    setDraftType('subjective');
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && id) {
      const oldIndex = paperQuestionsList.findIndex(pq => pq.id === active.id);
      const newIndex = paperQuestionsList.findIndex(pq => pq.id === over.id);
      const newList = arrayMove(paperQuestionsList, oldIndex, newIndex);
      await reorderPaperQuestions(id, newList);
    }
  };

  const handleAddOption = () => {
    setDraftOptions(prev => [...prev, '']);
  };

  const handleRemoveOption = (index: number) => {
    setDraftOptions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectBlockType = (type: QuestionType) => {
    setDraftType(type);
    setDraftContent('');
    setDraftOptions(['', '', '', '']);
    setDraftSection(prev => prev || (selectedPQId ? (paperQuestionsList.find(pq => pq.id === selectedPQId)?.section || '') : ''));
    setDraftMarks(selectedPQId ? (paperQuestionsList.find(pq => pq.id === selectedPQId)?.marks || 1) : 1);
    setDraftDifficulty('medium');
    setDraftTypeHeader('');
    setSelectedPQId(null);
    setDraftSubquestions([]);
    setShowCreatorHub(false);
  };

  const handleAddDraftSubquestion = () => {
    setDraftSubquestions(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        type: 'subjective',
        content: '',
        options: ['', '', '', ''],
        marks: 1,
        difficulty: 'medium',
        isExpanded: true
      }
    ]);
  };

  const handleUpdateDraftSubquestion = (id: string, field: keyof DraftSubquestion, value: any) => {
    setDraftSubquestions(prev => prev.map(sq => sq.id === id ? { ...sq, [field]: value } : sq));
  };

  const handleRemoveDraftSubquestion = (id: string) => {
    setDraftSubquestions(prev => prev.filter(sq => sq.id !== id));
  };

  const handleAddDraftToPaper = async () => {
    if (!id || !draftType || !draftContent.trim()) return;

    if (paper?.maxMarks) {
      let proposedTotal = totalMarks;
      if (editingQuestionId && editingPQId) {
        const oldPQ = paperQuestionsList.find(pq => pq.id === editingPQId);
        if (oldPQ && !oldPQ.parentId) {
          proposedTotal = proposedTotal - oldPQ.marks + draftMarks;
        }
      } else {
        if (!qParentId) {
          proposedTotal += draftMarks;
        }
      }
      if (proposedTotal > paper.maxMarks) {
        window.alert(`Error: Total marks (${proposedTotal}) cannot exceed the maximum marks provided in the paper settings (${paper.maxMarks}).`);
        return;
      }
    }

    setSaving(true);
    try {
      const options = draftType === 'mcq' ? draftOptions.filter(o => o.trim()) : [];
      let currentParentId = qParentId || undefined;

      // If we are editing an existing question, update it instead of creating a new one
      if (editingQuestionId && editingPQId) {
        await updateQuestion(editingQuestionId, {
          content: draftContent.trim(),
          questionType: draftType,
          options: options.length > 0 ? options : [],
          difficulty: draftDifficulty,
          typeHeader: draftTypeHeader || undefined,
        });
        await updatePaperQuestion(editingPQId, {
          marks: draftMarks,
          section: draftSection,
          parentId: currentParentId || null,
        });
        currentParentId = editingPQId;
      } else {
        // Creating a new question
        const result = await createAndAddQuestion(
          id,
          draftContent.trim(),
          draftType,
          options.length > 0 ? options : undefined,
          draftSection,
          currentParentId,
          draftMarks,
          undefined,
          paper?.subjectId,
          paper?.classId,
          draftDifficulty,
          undefined,
          undefined,
          draftTypeHeader || undefined,
        );
        if (result) {
          currentParentId = result;
        } else {
          showToastMessage('Failed to add main question. Check console.');
          return;
        }
      }

      // Find deleted subquestions
      if (currentParentId) {
        const originalChildren = paperQuestionsList.filter(q => q.parentId === currentParentId);
        const currentSubqIds = new Set(draftSubquestions.map(sq => sq.pqId).filter(Boolean));
        for (const child of originalChildren) {
          if (!currentSubqIds.has(child.id)) {
            await removeQuestionFromPaper(child.id, paper?.id || id);
          }
        }
      }

      // Create or update all draft subquestions
      for (const sq of draftSubquestions) {
        if (!sq.content.trim()) continue;
        const sqOptions = sq.type === 'mcq' ? sq.options.filter(o => o.trim()) : [];
        if (sq.questionId && sq.pqId) {
          // Update existing
          await updateQuestion(sq.questionId, {
            content: sq.content.trim(),
            questionType: sq.type,
            options: sqOptions.length > 0 ? sqOptions : [],
            difficulty: sq.difficulty,
          });
          await updatePaperQuestion(sq.pqId, {
            marks: sq.marks,
          });
        } else {
          // Create new
          await createAndAddQuestion(
            id,
            sq.content.trim(),
            sq.type,
            sqOptions.length > 0 ? sqOptions : undefined,
            draftSection,
            currentParentId,
            sq.marks,
            undefined,
            paper?.subjectId,
            paper?.classId,
            sq.difficulty,
            undefined,
            undefined,
            undefined
          );
        }
      }

      showToastMessage(editingQuestionId ? 'Question updated!' : 'Question added!');
      setDraftType(null);
      setDraftContent('');
      setDraftOptions(['', '', '', '']);
      setDraftSubquestions([]);
      setEditingQuestionId(null);
      setEditingPQId(null);
      setQParentId('');
      setActiveView('tree');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateHeaderConfig = async (updates: Partial<any>) => {
    if (!paper) return;
    const newConfig = { ...(paper.headerConfig || {}), ...updates };
    await updateQuestionPaper(paper.id, { headerConfig: newConfig });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleUpdateHeaderConfig({ logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };


  const handleRemovePQ = (_pqId: string, questionId: string) => {
    if (id) {
      removeQuestionFromPaper(id, questionId);
      if (selectedPQId === _pqId) setSelectedPQId(null);
      showToastMessage('Question removed');
    }
  };



  const handleEditQuestion = (pqId?: string) => {
    const targetId = pqId || selectedPQId;
    const pq = paperQuestionsList.find(pq => pq.id === targetId);
    if (!pq) return;
    const q = questions.find(q => q.id === pq.questionId);
    if (!q) return;
    setEditingQuestionId(q.id);
    setEditingPQId(pq.id);
    setDraftType(q.questionType);
    setDraftContent(q.content);
    const opts = q.options || [];
    setDraftOptions(opts.length > 0 ? [...opts] : ['', '', '', '']);
    setDraftSection(pq.section);
    setDraftMarks(pq.marks);
    setDraftDifficulty(q.difficulty || 'medium');
    setDraftTypeHeader(q.typeHeader || '');
    setQParentId(pq.parentId || '');

    // Load existing subquestions
    const children = paperQuestionsList
      .filter(childPq => childPq.parentId === pq.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const loadedSubqs: DraftSubquestion[] = children.map(childPq => {
      const childQ = questions.find(q => q.id === childPq.questionId);
      const childOpts = childQ?.options || [];
      return {
        id: childPq.id, // we use pqId as the list key
        questionId: childPq.questionId,
        pqId: childPq.id,
        type: childQ?.questionType || 'subjective',
        content: childQ?.content || '',
        options: childOpts.length > 0 ? [...childOpts] : ['', '', '', ''],
        marks: childPq.marks || 1,
        difficulty: childQ?.difficulty || 'medium',
        isExpanded: false
      };
    });
    setDraftSubquestions(loadedSubqs);

    setSelectedPQId(null);
  };


  const getQuestion = (questionId: string) => questions.find(q => q.id === questionId);
  const getCourse = (id?: string) => courses.find(c => c.id === id);
  const getSubject = (id?: string) => subjects.find(s => s.id === id);
  const getClass = (id?: string) => classes.find(c => c.id === id);



  const totalMarks = useMemo(() => {
    return paperQuestionsList.filter(pq => !pq.parentId).reduce((sum, pq) => sum + pq.marks, 0);
  }, [paperQuestionsList]);

  const suggestedQuestions = useMemo(() => {
    // Deduplicate questions by content so the bank doesn't show identical clones
    const uniqueQuestions = [];
    const seenContent = new Set();

    for (const q of questions) {
      const normalized = stripHtml(q.content).replace(/\s+/g, '').toLowerCase();
      if (!seenContent.has(normalized)) {
        seenContent.add(normalized);
        uniqueQuestions.push(q);
      }
    }

    const searchTerms = suggestedSearch.toLowerCase().trim().split(/\s+/).filter(Boolean);

    return uniqueQuestions
      .filter(q => {
        if (searchTerms.length === 0) return true;
        const plainText = stripHtml(q.content).toLowerCase();
        // Question matches if it contains ALL search terms
        return searchTerms.every(term => plainText.includes(term));
      })
      .slice(0, 30);
  }, [questions, suggestedSearch]);

  const handleAddSuggested = async (questionId: string) => {
    if (!id) return;

    if (paper?.maxMarks && (totalMarks + 1 > paper.maxMarks)) {
      window.alert(`Error: Total marks (${totalMarks + 1}) cannot exceed the maximum marks provided in the paper settings (${paper.maxMarks}).`);
      return;
    }

    const q = questions.find(q => q.id === questionId);
    if (!q) return;
    setSaving(true);
    try {
      // Create a fresh clone so we bypass the unique (paper_id, question_id) database constraint,
      // allowing the user to add the same question multiple times to the same paper.
      await createAndAddQuestion(
        id,
        q.content,
        q.questionType,
        q.options,
        draftSection || '',
        undefined,
        1,
        undefined,
        q.subjectId,
        q.classId,
        q.difficulty,
        q.explanation,
        q.imageUrl,
        q.typeHeader || undefined,
      );
      showToastMessage('Question added from bank!');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBankQuestion = async (questionId: string) => {
    await deleteQuestion(questionId);
    showToastMessage('Question deleted from bank');
  };

  const exportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    showToastMessage('Opening print dialog...');

    try {
      const originalTitle = document.title;
      if (paper?.title) {
        document.title = paper.title;
      }

      const paperElement = document.getElementById('printable-paper');
      if (!paperElement) throw new Error('Paper container not found');

      // Temporarily hide UI elements that shouldn't be printed
      paperElement.classList.add('preview-active');

      if (window.MathJax?.typesetPromise) {
        await window.MathJax.typesetPromise();
      }

      // Wait a brief moment for layout recalculation and math rendering
      await new Promise(resolve => setTimeout(resolve, 500));

      window.print();

      paperElement.classList.remove('preview-active');
      document.title = originalTitle;
      
    } catch (err) {
      console.error('Print Error:', err);
      showToastMessage('Failed to open print dialog');
    } finally {
      setIsExporting(false);
    }
  };

  if (!paper) {
    return (
      <div className="editor-layout" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p>Paper not found</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go to Dashboard</button>
      </div>
    );
  }
  // Build sub-question tree for a given parent PQ id
  const buildSubTree = (parentId: string): SubQuestionNode[] => {
    return paperQuestionsList
      .filter(pq => pq.parentId === parentId)
      .map(pq => {
        const q = getQuestion(pq.questionId);
        return q ? { pq, question: q, children: buildSubTree(pq.id) } : null;
      })
      .filter(Boolean) as SubQuestionNode[];
  };

  const renderQuestionRange = (startIdx: number, endIdx: number) => {
    // Only render top-level questions (those without a parentId)
    const topLevel = paperQuestionsList.slice(startIdx, endIdx).filter(pq => !pq.parentId);

    return topLevel.map((pq, idx) => {
      const q = getQuestion(pq.questionId);
      if (!q) return null;

      let showSectionHeader: string | undefined;

      const prevPQ = idx > 0 ? topLevel[idx - 1] : null;

      if (!prevPQ || prevPQ.section !== pq.section) {
        showSectionHeader = pq.section;
      }

      // Question number within its section (top-level only)
      let questionNumber = 1;
      if (paper?.headerConfig?.continuousNumbering) {
        questionNumber = idx + 1;
      } else {
        for (let i = idx - 1; i >= 0; i--) {
          if (topLevel[i].section !== pq.section) break;
          questionNumber++;
        }
      }

      const secIdx = showSectionHeader ? distinctSections.indexOf(showSectionHeader) : -1;
      const sectionNumber = secIdx !== -1 ? secIdx + 1 : 1;
      const sectionMarks = showSectionHeader ? (sectionTotalMarks[showSectionHeader] || 0) : 0;
      const canMoveSectionUp = secIdx > 0;
      const canMoveSectionDown = secIdx !== -1 && secIdx < distinctSections.length - 1;

      const subs = buildSubTree(pq.id);

      return (
        <SortableQuestion
          key={pq.id}
          paperQuestion={pq}
          question={q}
          isSelected={selectedPQId === pq.id}
          questionNumber={questionNumber}
          showSectionHeader={showSectionHeader}
          sectionNumber={sectionNumber}
          sectionMarks={sectionMarks}
          canMoveSectionUp={canMoveSectionUp}
          canMoveSectionDown={canMoveSectionDown}
          onMoveSectionUp={(sec) => handleMoveSection(sec, 'up')}
          onMoveSectionDown={(sec) => handleMoveSection(sec, 'down')}
          canMoveUp={idx > 0}
          canMoveDown={idx < topLevel.length - 1}
          onMoveUp={() => handleMoveQuestion(pq.id, 'up')}
          onMoveDown={() => handleMoveQuestion(pq.id, 'down')}
          onAddSubQuestion={() => handleAddSubQuestion(pq)}
          onSelect={() => { setSelectedPQId(pq.id); setDraftType(null); }}
          onRemove={() => handleRemovePQ(pq.id, pq.questionId)}
          onEdit={() => { handleEditQuestion(pq.id); setIsConstructorOpen(true); setActiveView('add-question'); }}
          subQuestions={subs}
          onEditSubQuestion={(pqId) => { handleEditQuestion(pqId); setIsConstructorOpen(true); setActiveView('add-question'); }}
          onRemoveSubQuestion={(pqId, qId) => handleRemovePQ(pqId, qId)}
          onMoveSubQuestionUp={(pqId) => handleMoveQuestion(pqId, 'up')}
          onMoveSubQuestionDown={(pqId) => handleMoveQuestion(pqId, 'down')}
          onAddSubSubQuestion={(pq) => handleAddSubQuestion(pq)}
        />
      );
    });
  };

  const renderPaperHeader = () => (
    <div className="paper-header" style={{ position: 'relative', paddingBottom: 10, marginBottom: 4 }}>
      {paper.headerConfig?.logoUrl && (
        <>
          <Rnd
            size={{ width: paper.headerConfig.logoSize || 80, height: 'auto' }}
            position={paper.headerConfig.logoPos || { x: 20, y: 20 }}
            onDragStop={(_e, d) => { void handleUpdateHeaderConfig({ logoPos: { x: d.x, y: d.y } }); }}
            onResizeStop={(_e, _dir, ref) => {
              void handleUpdateHeaderConfig({ logoSize: parseInt(ref.style.width) });
            }}
            bounds="parent"
            className="no-print-handles"
          >
            <img
              src={paper.headerConfig.logoUrl}
              alt="Logo"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </Rnd>
          <img
            className="logo-print-only"
            src={paper.headerConfig.logoUrl}
            alt="Logo"
            style={{
              position: 'absolute',
              left: `${paper.headerConfig.logoPos?.x || 20}px`,
              top: `${paper.headerConfig.logoPos?.y || 20}px`,
              width: `${paper.headerConfig.logoSize || 80}px`,
            }}
          />
        </>
      )}

      {paper.qpCode && (
        <>
          <Rnd
            position={paper.headerConfig?.barcodePos || { x: 550, y: 20 }}
            onDragStop={(_e, d) => { void handleUpdateHeaderConfig({ barcodePos: { x: d.x, y: d.y } }); }}
            bounds="parent"
            enableResizing={false}
            className="no-print-handles"
          >
            <div className="barcode-wrapper" style={{ position: 'relative' }}>
              <div className="barcode-text">QP Code: {paper.qpCode}</div>
              <button 
                onClick={() => updateQuestionPaper(paper.id, { qpCode: '' })}
                className="hide-on-print"
                style={{ 
                  position: 'absolute', top: -10, right: -10, 
                  background: 'var(--danger-color, #ef4444)', color: 'white', 
                  borderRadius: '50%', width: 20, height: 20, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  border: 'none', cursor: 'pointer', fontSize: 12, padding: 0 
                }}
                title="Remove QP Code"
              >
                ✕
              </button>
            </div>
          </Rnd>

          <div
            className="barcode-print-only"
            style={{
              position: 'absolute',
              left: `${paper.headerConfig?.barcodePos?.x || 550}px`,
              top: `${paper.headerConfig?.barcodePos?.y || 20}px`,
            }}
          >
            <div className="barcode-text">QP Code: {paper.qpCode}</div>
          </div>
        </>
      )}

      <h1 className="paper-school-name">{user?.schoolName || 'Institution Name'}</h1>
      <h2 className="paper-exam-title">{paper.title}</h2>
      <div className="paper-info">
        <span>Course: {getCourse(paper.courseId)?.name || '-'}</span>
        <span>Subject: {getSubject(paper.subjectId)?.name || '-'}</span>
        <span>Class: {getClass(paper.classId)?.name || '-'}</span>
        {paper.date && <span>Date: {new Date(paper.date).toLocaleDateString()}</span>}
        {paper.duration && <span>Duration: {paper.duration} min</span>}
        <span>Total Marks: {totalMarks}</span>
      </div>
      {paper.instructions && (
        <div className="paper-instructions">
          <strong>Instructions:</strong>
          <span dangerouslySetInnerHTML={{ __html: paper.instructions }} />
        </div>
      )}
    </div>
  );



  return (
    <div className="editor-layout">

      {/* TOP TOOLBAR */}
      <div className="editor-top-toolbar">
        <div className="toolbar-left">
          <button className="toolbar-icon-btn" onClick={() => navigate('/')} title="Back to Dashboard">
            <ArrowLeft size={18} />
          </button>
          <div className="toolbar-title-group">
            <h2 className="toolbar-paper-title">{paper.title}</h2>
            <span className="toolbar-paper-meta">
              {getCourse(paper.courseId)?.name || 'No Course'} • {getSubject(paper.subjectId)?.name || 'No Subject'} • {totalMarks} Marks{paper.duration ? ` • ${paper.duration} min` : ''}
            </span>
          </div>
        </div>
        <div className="toolbar-right">
          <button className="toolbar-btn-outlined" onClick={() => setShowPaperSettings(true)}>
            <Settings size={14} /> Paper Settings
          </button>
          <button className="toolbar-btn-accent" onClick={() => { setIsConstructorOpen(true); setActiveView('tree'); }}>
            <Layers size={14} /> Edit/View Questions
          </button>
          <button className="toolbar-btn-accent" onClick={exportPDF} disabled={isExporting}>
            {isExporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            {isExporting ? 'Generating...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* CENTER - Clean HTML Paper (WYSIWYG) */}
      <div className="editor-canvas">
        <div 
          className="paper-container" 
          ref={paperRef} 
          id="printable-paper"
          style={{
            fontSize: paper.headerConfig?.fontSize ? `${paper.headerConfig.fontSize}px` : undefined,
            fontFamily: paper.headerConfig?.fontFamily ? paper.headerConfig.fontFamily : undefined,
          }}
        >
          {/* Hidden measurement container */}
          <div
            ref={measureRef}
            className="measurement-container"
            style={{
              position: 'absolute', left: -9999, top: 0,
              width: '794px', padding: '20px 40px',
              background: 'white', zIndex: -1, opacity: 0, pointerEvents: 'none',
            }}
          >
            {paperQuestionsList.map((pq) => {
              const q = getQuestion(pq.questionId);
              if (!q) return null;
              const mcqLayout = q.questionType === 'mcq' ? getMcqLayout(q.options || []) : 'vertical';
              return (
                <div key={pq.id} data-pq-id={pq.id} className="clean-question" style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <span className="q-number">1.</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="q-text" dangerouslySetInnerHTML={{ __html: q.content }} />
                      {q.questionType === 'mcq' && q.options && q.options.length > 0 && (
                        <div className={`q-options q-options-${mcqLayout}`}>
                          {q.options.map((opt, i) => (
                            <span key={i} className="q-option">{String.fromCharCode(65 + i)}. {opt}</span>
                          ))}
                        </div>
                      )}
                      {q.questionType === 'truefalse' && (
                        <div className="q-options q-options-horizontal">
                          <span className="q-option">(a) True</span>
                          <span className="q-option">(b) False</span>
                        </div>
                      )}
                    </div>
                    <span className="marks-inline" style={{ flexShrink: 0, marginLeft: 24 }}>{pq.marks}m</span>
                  </div>
                </div>
              );
            })}
          </div>

          {sections.length === 0 ? (
            <div className="paper-page last-page">
              {renderPaperHeader()}
              <div className="empty-paper">
                <div className="empty-paper-icon">
                  <Plus size={28} />
                </div>
                <h3>No questions yet</h3>
                <p>Click "Add Question" in the toolbar to get started</p>
                <button className="btn btn-primary" onClick={() => { setIsConstructorOpen(true); setActiveView('tree'); }} style={{ marginTop: 16 }}>
                  <Plus size={14} style={{ marginRight: 6 }} />
                  Add Question
                </button>
              </div>
            </div>
          ) : (
            <div className="paper-page last-page">
              {renderPaperHeader()}
              <div className="paper-questions-list">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={paperQuestionsList.map(pq => pq.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {renderQuestionRange(0, paperQuestionsList.length)}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          )}
          <div className="print-footer">Created using PaperForm</div>
          <div className="print-spacer" />

          {/* Inline image resize handles */}
          {editingImage && imageOverlayRect && (
            <>
              {/* Corner handles */}
              {['nw', 'ne', 'sw', 'se'].map(corner => {
                const isRight = corner.includes('e');
                const isBottom = corner.includes('s');
                const top = isBottom ? imageOverlayRect.top + imageOverlayRect.height - 5 : imageOverlayRect.top - 5;
                const left = isRight ? imageOverlayRect.left + imageOverlayRect.width - 5 : imageOverlayRect.left - 5;

                // Don't render handle if it's outside the scroll container's bounds
                if (top < imageOverlayRect.clipTop || top > imageOverlayRect.clipBottom || left < imageOverlayRect.clipLeft || left > imageOverlayRect.clipRight) {
                  return null;
                }

                return (
                  <div
                    key={corner}
                    onMouseDown={startResize}
                    style={{
                      position: 'fixed',
                      top,
                      left,
                      width: 10,
                      height: 10,
                      background: 'var(--accent)',
                      border: '2px solid white',
                      borderRadius: 2,
                      cursor: (corner === 'nw' || corner === 'se') ? 'nwse-resize' : 'nesw-resize',
                      zIndex: 1001,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }}
                  />
                );
              })}

              {/* Inline crop button top right of the image */}
              <button
                className="crop-btn"
                style={{
                  position: 'fixed',
                  top: Math.max(imageOverlayRect.clipTop + 8, imageOverlayRect.top + 8),
                  left: Math.min(imageOverlayRect.clipRight - 65, imageOverlayRect.left + imageOverlayRect.width - 65), // ~65px width
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  color: '#6B7280',
                  fontSize: 12,
                  padding: '4px 8px',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 1001,
                  opacity: (imageOverlayRect.top > imageOverlayRect.clipBottom || imageOverlayRect.top + imageOverlayRect.height < imageOverlayRect.clipTop) ? 0 : 1,
                  pointerEvents: (imageOverlayRect.top > imageOverlayRect.clipBottom || imageOverlayRect.top + imageOverlayRect.height < imageOverlayRect.clipTop) ? 'none' : 'auto'
                }}
                onClick={(e) => { e.stopPropagation(); setShowCropModal(true); }}
                title="Crop Image"
              >
                ✂ Crop
              </button>
            </>
          )}

          {/* Crop modal — only shown when user clicks Crop */}
          {showCropModal && editingImage && (
            <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowCropModal(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Crop Image</h3>
                <div style={{ maxHeight: '65vh', overflow: 'auto', background: '#f9fafb', borderRadius: 8, display: 'flex', justifyContent: 'center' }}>
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                  >
                    <img
                      ref={imgRef}
                      src={editingImage.imgElement.src}
                      alt="Crop preview"
                      style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block' }}
                    />
                  </ReactCrop>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button className="btn btn-secondary" onClick={() => { setShowCropModal(false); setCrop(undefined); setCompletedCrop(undefined); }}>Cancel</button>
                  <button className="btn btn-primary" onClick={async () => {
                    if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && imgRef.current) {
                      const croppedSrc = await getCroppedImg(imgRef.current, completedCrop);
                      await applyImageEdit(croppedSrc);
                    }
                    setShowCropModal(false);
                    setCrop(undefined);
                    setCompletedCrop(undefined);
                  }}>Apply Crop</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATOR HUB MODAL */}
      {showCreatorHub && (
        <div className="modal-overlay" onClick={() => setShowCreatorHub(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title">Add Question</h2>
              <button className="modal-close-btn" onClick={() => setShowCreatorHub(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-content">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Choose a question type to create, or add from your question bank.
              </p>
              <div className="creator-hub-cards">
                {BLOCK_TYPES.map(({ type, label, icon: Icon, description }) => (
                  <button
                    key={type}
                    className="creator-hub-card"
                    onClick={() => handleSelectBlockType(type)}
                  >
                    <div className="creator-hub-card-icon"><Icon size={20} /></div>
                    <div className="creator-hub-card-info">
                      <span className="creator-hub-card-label">{label}</span>
                      <span className="creator-hub-card-desc">{description}</span>
                    </div>
                    <span className="creator-hub-card-arrow">→</span>
                  </button>
                ))}
              </div>

              {/* Question Bank Section */}
              <div className="creator-hub-bank">
                <h4 className="creator-hub-bank-title">
                  <Search size={14} /> Question Bank
                </h4>
                <div style={{ marginBottom: 12 }}>
                  <input
                    type="text"
                    placeholder="Search your bank..."
                    value={suggestedSearch}
                    onChange={(e) => setSuggestedSearch(e.target.value)}
                    className="creator-hub-search"
                  />
                </div>
                <div className="creator-hub-bank-list">
                  {suggestedQuestions.length === 0 ? (
                    <div className="creator-hub-bank-empty">No questions found</div>
                  ) : (
                    suggestedQuestions.map(q => (
                      <div key={q.id} className="creator-hub-bank-item">
                        <div className="creator-hub-bank-item-info">
                          <span className="creator-hub-bank-item-type">
                            {BLOCK_TYPES.find(b => b.type === q.questionType)?.label || q.questionType}
                          </span>
                          <span className="creator-hub-bank-item-text">
                            {stripHtml(q.content)}
                          </span>
                        </div>
                        <div className="creator-hub-bank-item-actions" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => { handleAddSuggested(q.id); setShowCreatorHub(false); }} title="Add to paper">
                            <Plus size={14} />
                          </button>
                          <button onClick={() => handleDeleteBankQuestion(q.id)} title="Delete from bank" className="danger">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* TEST PAPER CONSTRUCTOR MODAL */}
      {isConstructorOpen && (
        <div className="modal-overlay" onClick={() => setIsConstructorOpen(false)}>
          <div className="modal question-editor-modal" style={{ maxWidth: '1000px', height: '85vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h2 className="modal-title">Test Paper Constructor</h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Configure sections, questions, and nested subquestions
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsConstructorOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {sections.length > 0 && (
              <div style={{ display: 'flex', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', flexShrink: 0, alignItems: 'center' }}>
                <button className={`btn ${activeView === 'tree' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveView('tree')} style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center' }}>
                  <Layers size={14} style={{ marginRight: 6 }} /> Tree View
                </button>
                <div style={{ flex: 1 }} />

                <button className={`btn ${activeView === 'add-question' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => {
                  if (sections.length > 0 && !draftSection) setDraftSection(sections[0].id);
                  if (!draftType) setDraftType('subjective');
                  setEditingQuestionId(null);
                  setEditingPQId(null);
                  setDraftContent('');
                  setDraftOptions(['', '', '', '']);
                  setDraftSubquestions([]);
                  setQParentId('');
                  setActiveView('add-question');
                }} style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center' }}>
                  <Plus size={14} style={{ marginRight: 6 }} /> Add Question
                </button>
              </div>
            )}

            <div className="modal-content" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {sections.length === 0 && activeView === 'tree' && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <h3 style={{ marginBottom: 10 }}>No questions added yet</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Get started by adding a section or your first question.</p>
                  <div style={{ display: 'flex', gap: 15, justifyContent: 'center' }}>

                    <button className="btn btn-primary" onClick={() => {
                      setActiveView('add-question');
                      setDraftType('subjective');
                    }} style={{ padding: '15px 25px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <Plus size={24} />
                      <span>Add Question</span>
                    </button>
                  </div>
                </div>
              )}

              {activeView === 'tree' && sections.length > 0 && (
                <div style={{ marginBottom: 15, display: 'flex', justifyContent: 'flex-end', padding: '0 20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={paper?.headerConfig?.continuousNumbering || false}
                      onChange={(e) => {
                        if (paper) {
                          updateQuestionPaper(paper.id, {
                            headerConfig: { ...paper.headerConfig, continuousNumbering: e.target.checked }
                          });
                        }
                      }}
                    />
                    Continuous numbering across sections
                  </label>
                </div>
              )}
              {activeView === 'tree' && sections.length > 0 && (
                <div className="tree-view">
                  {sections.map(sec => {
                    const sectionQCount = sec.questions.length;
                    const sectionTotalM = sec.questions.reduce((sum: number, q: any) => sum + (q.marks || 0), 0);

                    return (
                      <div key={sec.id} className="tree-section">
                        <div className="tree-section-header">
                          <div className="tree-section-icon">
                            <Layers size={16} />
                          </div>
                          <div className="tree-section-info">
                            <div className="tree-section-title">{sec.title || 'No Section'}</div>
                            <div className="tree-section-stats">
                              <span className="tree-section-stat">{sectionQCount} question{sectionQCount !== 1 ? 's' : ''}</span>
                              <span className="tree-section-stat">•</span>
                              <span className="tree-section-stat">{sectionTotalM} marks</span>
                            </div>
                          </div>

                        </div>

                        <div className="tree-section-body">
                          {sec.questions.length === 0 ? (
                            <div className="tree-empty-section">No questions in this section yet</div>
                          ) : (
                            sec.questions.map((q: any, i: number) => {
                              const renderTreeNode = (node: any, depth: number, idx: number): React.ReactNode => {
                                const isExp = expandedNodes[node.id] !== false; // default expanded
                                const hasChildren = node.children && node.children.length > 0;
                                const numLabel = depth === 0 ? `Q${idx + 1}` : '↳';
                                const depthStr = String(Math.min(depth, 3));

                                return (
                                  <div key={node.id} className="tree-node">
                                    {depth > 0 && <div className="tree-node-branch" />}

                                    <div className="tree-node-card" data-depth={depthStr}>
                                      <button
                                        className={`tree-node-toggle ${!hasChildren ? 'invisible' : ''}`}
                                        onClick={() => toggleExpand(node.id)}
                                      >
                                        {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      </button>

                                      <div className="tree-node-badge" data-depth={depthStr}>
                                        {numLabel}
                                      </div>

                                      <div className="tree-node-content">
                                        <div className="tree-node-text" dangerouslySetInnerHTML={{ __html: (node.text || '<em>Empty</em>').replace(/&nbsp;/g, ' ') }} />
                                        <div className="tree-node-meta">
                                          <span className="tree-node-pill marks">
                                            <strong>{node.marks}</strong> marks
                                          </span>
                                          <span className="tree-node-pill type">{node.type}</span>
                                          {hasChildren && (
                                            <span className="tree-node-pill children-count">
                                              {node.children.length} sub-Q{node.children.length > 1 ? 's' : ''}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="tree-node-actions">
                                        <button className="tree-act-btn sub" onClick={() => {
                                          setDraftSection(sec.id);
                                          setQParentId(node.id);
                                          setEditingQuestionId(null);
                                          setEditingPQId(null);
                                          setDraftType('subjective');
                                          setDraftContent('');
                                          setDraftOptions(['', '', '', '']);
                                          setActiveView('add-question');
                                        }}>
                                          <GitFork size={12} style={{ transform: 'rotate(90deg)' }} /> Sub
                                        </button>
                                        <div className="tree-act-divider" />
                                        <button className="tree-act-icon" onClick={() => { handleEditQuestion(node.id); setActiveView('add-question'); }} title="Edit">
                                          <Pencil size={13} />
                                        </button>
                                        <button className="tree-act-icon danger" onClick={() => handleRemovePQ(node.id, node.questionId)} title="Delete">
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>

                                    {hasChildren && isExp && (
                                      <div className="tree-children">
                                        {node.children.map((child: any, cidx: number) =>
                                          renderTreeNode(child, depth + 1, cidx)
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              };
                              return renderTreeNode(q, 0, i);
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeView === 'add-section' && (
                <div style={{ maxWidth: 500, margin: '0 auto', padding: '20px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                    <FolderPlus size={18} /> Add New Section
                  </h3>
                  <div className="property-field">
                    <label className="property-label">Section Title</label>
                    <input
                      type="text"
                      className="property-input"
                      placeholder="e.g., Section A: Objective Type"
                      value={newSectionTitle}
                      onChange={(e) => setNewSectionTitle(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                    {totalQuestionsCount > 0 && <button className="btn btn-secondary" onClick={() => setActiveView('tree')}>Cancel</button>}
                    <button className="btn btn-primary" onClick={() => {
                      if (!newSectionTitle.trim()) return;
                      // Just set draftSection to new title, it will be added when a question is added
                      setDraftSection(newSectionTitle);
                      setNewSectionTitle('');
                      setQParentId('');
                      setDraftType('subjective');
                      setActiveView('add-question');
                    }}>Continue to Add Questions</button>
                  </div>
                </div>
              )}

              {activeView === 'add-question' && draftType && (
                <div style={{ maxWidth: 700, margin: '0 auto' }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 15 }}>
                    <div className="property-field" style={{ flex: 1 }}>
                      <label className="property-label">Target Section</label>
                      {isAddingNewSection ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="text"
                            className="property-input"
                            autoFocus
                            placeholder="New Section Name"
                            value={newSectionName}
                            onChange={e => setNewSectionName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                if (newSectionName.trim()) {
                                  const title = newSectionName.trim();
                                  handleUpdateHeaderConfig({ customSections: [...(paper?.headerConfig?.customSections || []), title] });
                                  setDraftSection(title);
                                  setQParentId('');
                                }
                                setIsAddingNewSection(false);
                                setNewSectionName('');
                              } else if (e.key === 'Escape') {
                                setIsAddingNewSection(false);
                                setNewSectionName('');
                              }
                            }}
                          />
                          <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => { setIsAddingNewSection(false); setNewSectionName(''); }}>Cancel</button>
                          <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={() => {
                            if (newSectionName.trim()) {
                              const title = newSectionName.trim();
                              handleUpdateHeaderConfig({ customSections: [...(paper?.headerConfig?.customSections || []), title] });
                              setDraftSection(title);
                              setQParentId('');
                            }
                            setIsAddingNewSection(false);
                            setNewSectionName('');
                          }}>Add</button>
                        </div>
                      ) : (
                        <select className="property-input" value={draftSection} onChange={(e) => {
                          if (e.target.value === '__ADD_NEW__') {
                            setIsAddingNewSection(true);
                          } else {
                            setDraftSection(e.target.value);
                            setQParentId('');
                          }
                        }}>
                          <option value="">No Section</option>
                          {Array.from(new Set([...sections.map(s => s.title), ...(paper?.headerConfig?.customSections || [])])).map(sTitle => <option key={sTitle} value={sTitle}>{sTitle}</option>)}
                          {!Array.from(new Set([...sections.map(s => s.title), ...(paper?.headerConfig?.customSections || [])])).includes(draftSection) && draftSection && (
                            <option value={draftSection}>{draftSection} (new)</option>
                          )}
                          <option value="__ADD_NEW__">+ Add New Section</option>
                        </select>
                      )}
                    </div>
                    <div className="property-field" style={{ flex: 1 }}>
                      <label className="property-label">Parent Question (Optional)</label>
                      <select className="property-input" value={qParentId} onChange={(e) => setQParentId(e.target.value)}>
                        <option value="">Top Level (No Parent)</option>
                        {parentCandidates.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginBottom: 15 }}>
                    <div className="property-field" style={{ flex: 1 }}>
                      <label className="property-label">Question Type</label>
                      <select className="property-input" value={draftType} onChange={(e) => setDraftType(e.target.value as any)}>
                        <option value="subjective">Subjective</option>
                        <option value="mcq">Multiple Choice</option>
                      </select>
                    </div>
                    <div className="property-field" style={{ flex: 1 }}>
                      <label className="property-label">Marks</label>
                      <input type="number" className="property-input" value={draftMarks} onChange={(e) => setDraftMarks(parseInt(e.target.value) || 1)} min={1} />
                    </div>
                    <div className="property-field" style={{ flex: 1 }}>
                      <label className="property-label">Difficulty</label>
                      <select className="property-input" value={draftDifficulty} onChange={(e) => setDraftDifficulty(e.target.value as Difficulty)}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  <div className="property-field" style={{ marginBottom: 15 }}>
                    <label className="property-label">Question Content</label>
                    <FullQuill value={draftContent} onChange={setDraftContent} placeholder="Enter your question..." openMathDialog={openMathDialog} toolbarId="question-toolbar" onImageClick={handleQuillImageClick} />
                  </div>

                  {draftType === 'mcq' && (
                    <div className="property-field" style={{ marginBottom: 15 }}>
                      <label className="property-label">Options</label>
                      {draftOptions.map((opt, i) => (
                        <div key={i} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Option {String.fromCharCode(65 + i)}</label>
                            {draftOptions.length > 2 && (
                              <button className="hover-action-btn danger" onClick={() => handleRemoveOption(i)} style={{ padding: '2px 4px' }}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                          <FullQuill value={opt} onChange={(val) => { const newOpts = [...draftOptions]; newOpts[i] = val; setDraftOptions(newOpts); }} placeholder={`Option ${String.fromCharCode(65 + i)}`} openMathDialog={openMathDialog} toolbarId={`option-toolbar-${i}`} onImageClick={handleQuillImageClick} />
                        </div>
                      ))}
                      <button className="btn btn-secondary" onClick={handleAddOption} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                        <Plus size={14} /> Add Option
                      </button>
                    </div>
                  )}

                  <div style={{
                    marginTop: 20,
                    paddingLeft: 16,
                    borderLeft: '2px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className="property-label" style={{ marginBottom: 0 }}>
                        Subquestions {draftSubquestions.length > 0 ? `(${draftSubquestions.length})` : ''}
                      </label>
                    </div>

                    {draftSubquestions.map((sq, index) => (
                      <div key={sq.id} style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, position: 'relative', overflow: 'hidden' }}>
                        <div
                          onClick={() => handleUpdateDraftSubquestion(sq.id, 'isExpanded', !sq.isExpanded)}
                          style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', backgroundColor: sq.isExpanded ? 'var(--bg-tertiary)' : 'transparent', borderBottom: sq.isExpanded ? '1px solid var(--border-color)' : 'none' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, overflow: 'hidden' }}>
                            {sq.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Subquestion {index + 1}</span>
                            {!sq.isExpanded && sq.content && (
                              <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                                {sq.content.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ') || 'Empty question'}
                              </span>
                            )}
                          </div>
                          <button className="hover-action-btn danger" onClick={(e) => { e.stopPropagation(); handleRemoveDraftSubquestion(sq.id); }} style={{ marginLeft: 10 }}>
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {sq.isExpanded && (
                          <div style={{ padding: '15px' }}>
                            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                              <div className="property-field" style={{ flex: 1, marginBottom: 0 }}>
                                <label className="property-label">Question Type</label>
                                <select className="property-input" value={sq.type} onChange={(e) => handleUpdateDraftSubquestion(sq.id, 'type', e.target.value)}>
                                  <option value="subjective">Subjective</option>
                                  <option value="mcq">Multiple Choice</option>
                                </select>
                              </div>
                              <div className="property-field" style={{ flex: 1, marginBottom: 0 }}>
                                <label className="property-label">Marks</label>
                                <input type="number" className="property-input" value={sq.marks} onChange={(e) => handleUpdateDraftSubquestion(sq.id, 'marks', parseInt(e.target.value) || 1)} min={1} />
                              </div>
                            </div>

                            <div className="property-field" style={{ marginBottom: sq.type === 'mcq' ? 12 : 0 }}>
                              <label className="property-label">Question Content</label>
                              <FullQuill value={sq.content} onChange={(val) => handleUpdateDraftSubquestion(sq.id, 'content', val)} placeholder="Enter subquestion..." openMathDialog={openMathDialog} toolbarId={`subq-toolbar-${sq.id}`} onImageClick={handleQuillImageClick} />
                            </div>

                            {sq.type === 'mcq' && (
                              <div className="property-field" style={{ marginBottom: 0 }}>
                                <label className="property-label">Options</label>
                                {sq.options.map((opt, i) => (
                                  <div key={i} style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 16 }}>{String.fromCharCode(65 + i)}</span>
                                    <div style={{ flex: 1 }}>
                                      <FullQuill value={opt} onChange={(val) => {
                                        const newOpts = [...sq.options];
                                        newOpts[i] = val;
                                        handleUpdateDraftSubquestion(sq.id, 'options', newOpts);
                                      }} placeholder={`Option ${String.fromCharCode(65 + i)}`} openMathDialog={openMathDialog} toolbarId={`subq-opt-toolbar-${sq.id}-${i}`} onImageClick={handleQuillImageClick} />
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
                      className="btn btn-secondary"
                      style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                      onClick={handleAddDraftSubquestion}
                    >
                      <Plus size={14} /> Add Subquestion
                    </button>
                  </div>
                </div>
              )}
            </div>

            {activeView === 'add-question' && (
              <div className="modal-actions" style={{ padding: '15px 20px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', flexShrink: 0 }}>
                {totalQuestionsCount > 0 && <button className="btn btn-secondary" onClick={() => setActiveView('tree')}>Cancel</button>}
                <button className="btn btn-primary" onClick={handleAddDraftToPaper} disabled={saving || !draftContent.trim()}>
                  {saving ? (editingQuestionId ? 'Updating...' : 'Saving...') : (editingQuestionId ? 'Update & Save All' : 'Save Question & Subquestions')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAPER SETTINGS MODAL */}
      {showPaperSettings && (
        <div className="modal-overlay" onClick={() => setShowPaperSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title">Paper Settings</h2>
              <button className="modal-close-btn" onClick={() => setShowPaperSettings(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-content" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <div className="property-field">
                <label className="property-label">Paper Title</label>
                <input
                  type="text"
                  className="property-input"
                  value={paper.title}
                  onChange={(e) => updateQuestionPaper(paper.id, { title: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label">QP Code</label>
                  <input
                    type="text"
                    className="property-input"
                    value={paper.qpCode || ''}
                    onChange={(e) => updateQuestionPaper(paper.id, { qpCode: e.target.value })}
                    placeholder="Enter QP Code..."
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label">Font Size (px)</label>
                  <input
                    type="number"
                    className="property-input"
                    value={paper.headerConfig?.fontSize || 16}
                    onChange={(e) => handleUpdateHeaderConfig({ fontSize: parseInt(e.target.value) || 16 })}
                    placeholder="16"
                  />
                </div>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label">Font Family</label>
                  <select
                    className="property-input"
                    value={paper.headerConfig?.fontFamily || 'Inter, sans-serif'}
                    onChange={(e) => handleUpdateHeaderConfig({ fontFamily: e.target.value })}
                  >
                    <option value="Inter, sans-serif">Inter</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="Courier New, monospace">Courier New</option>
                    <option value="Georgia, serif">Georgia</option>
                  </select>
                </div>
              </div>
              <div className="property-field">
                <label className="property-label">Institution Name</label>
                <input
                  type="text"
                  className="property-input"
                  value={user?.schoolName || ''}
                  onChange={(e) => {
                    if (user) useStore.getState().setUser({ ...user, schoolName: e.target.value });
                  }}
                  placeholder="Enter Institution name..."
                />
              </div>
              <div className="property-field">
                <label className="property-label">Institution Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="property-input"
                  style={{ fontSize: 12 }}
                />
                {paper.headerConfig?.logoUrl && (
                  <button
                    className="btn btn-danger"
                    onClick={() => handleUpdateHeaderConfig({ logoUrl: undefined })}
                    style={{ width: '100%', marginTop: 8, fontSize: 12, padding: '4px 8px' }}
                  >
                    Remove Logo
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label">Course</label>
                  <select
                    className="property-input"
                    value={paper.courseId || ''}
                    onChange={(e) => updateQuestionPaper(paper.id, { courseId: e.target.value || undefined })}
                  >
                    <option value="">No Course</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label">Subject</label>
                  <select
                    className="property-input"
                    value={paper.subjectId || ''}
                    onChange={(e) => updateQuestionPaper(paper.id, { subjectId: e.target.value || undefined })}
                  >
                    <option value="">No Subject</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label">Class</label>
                  <select
                    className="property-input"
                    value={paper.classId || ''}
                    onChange={(e) => updateQuestionPaper(paper.id, { classId: e.target.value || undefined })}
                  >
                    <option value="">No Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label">Date</label>
                  <input
                    type="date"
                    className="property-input"
                    value={paper.date || ''}
                    onChange={(e) => updateQuestionPaper(paper.id, { date: e.target.value })}
                  />
                </div>
              </div>
              <div className="property-field">
                <label className="property-label">Duration (min)</label>
                <input
                  type="number"
                  className="property-input"
                  value={paper.duration || 0}
                  onChange={(e) => updateQuestionPaper(paper.id, { duration: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="property-field">
                <label className="property-label">Instructions</label>
                <FullQuill
                  value={paper.instructions || ''}
                  onChange={(val) => updateQuestionPaper(paper.id, { instructions: val })}
                  placeholder="Enter instructions..."
                  openMathDialog={openMathDialog}
                  toolbarId="instructions-toolbar"
                  onImageClick={handleQuillImageClick}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowPaperSettings(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* MathLive Equation Dialog (Rendered last with highest z-index so it always appears above the Question Modal) */}
      {showMathDialog && (
        <div
          className="modal-overlay math-dialog-overlay"
          style={{
            zIndex: 10000,
            ...(mathKeyboardVisible ? { alignItems: 'flex-start', paddingTop: '8vh' } : {})
          }}
          onClick={() => {
            if (window.mathVirtualKeyboard) window.mathVirtualKeyboard.hide();
            setShowMathDialog(false);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, zIndex: 10001 }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title">Insert Math Formula</h2>
              <button
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.mathVirtualKeyboard) {
                    if (window.mathVirtualKeyboard.visible) {
                      window.mathVirtualKeyboard.hide();
                    } else {
                      window.mathVirtualKeyboard.show();
                    }
                  }
                }}
                title="Toggle Virtual Keyboard"
              >
                <Keyboard size={14} /> {mathKeyboardVisible ? 'Hide Keyboard' : 'Keyboard'}
              </button>
            </div>
            <div className="modal-content">
              <div className="property-field">
                <label className="property-label">Visual Editor (MathLive)</label>
                <math-field
                  ref={mathFieldRef}
                  math-virtual-keyboard-policy="manual"
                  style={{
                    fontSize: '24px',
                    padding: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    width: '100%',
                    backgroundColor: 'white',
                    color: 'black',
                    minHeight: '80px'
                  }}
                />
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                  Click inside the field to type or use the virtual keyboard. You can also paste LaTeX.
                </p>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => {
                if (window.mathVirtualKeyboard) window.mathVirtualKeyboard.hide();
                setShowMathDialog(false);
              }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                console.log('Insert Formula button clicked', {
                  callback: !!mathDialogCallbackRef.current,
                  mathFieldRef: !!mathFieldRef.current,
                  value: mathFieldRef.current?.value
                });
                if (mathDialogCallbackRef.current && mathFieldRef.current) {
                  mathDialogCallbackRef.current(mathFieldRef.current.value);
                }
                if (window.mathVirtualKeyboard) window.mathVirtualKeyboard.hide();
                setShowMathDialog(false);
              }}>Insert Formula</button>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <div className="toast-notification">
          <Check size={18} />
          {toastMessage}
        </div>
      )}

    </div>
  );
}
