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
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';


async function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;
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
    crop.width * scaleX,
    crop.height * scaleY
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

const BaseQuillImage = ReactQuill.Quill.import('formats/image') as any;
const QUILL_IMAGE_ATTRIBUTES = ['alt', 'height', 'width', 'style', 'data-x', 'data-y', 'data-align'];
class CustomQuillImage extends BaseQuillImage {
  static formats(domNode: HTMLElement) {
    return QUILL_IMAGE_ATTRIBUTES.reduce((formats: Record<string, string>, attribute) => {
      if (domNode.hasAttribute(attribute)) {
        formats[attribute] = domNode.getAttribute(attribute) || '';
      }
      return formats;
    }, {});
  }
  format(name: string, value: string) {
    if (QUILL_IMAGE_ATTRIBUTES.includes(name)) {
      if (value) {
        this.domNode.setAttribute(name, value);
      } else {
        this.domNode.removeAttribute(name);
      }
    } else {
      super.format(name, value);
    }
  }
}
ReactQuill.Quill.register(CustomQuillImage, true);

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
  Copy,
  Move,
  GripVertical,
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
  FileText,
  BookOpen,
  Printer,
  Eye,
} from 'lucide-react';
import { useStore } from '../store';
import type {
  Question,
  PaperQuestion,
  QuestionType,
  PaperSection,
  Difficulty,
  SubQuestionNumberingStyle,
  VisibleHeaderFields,
  CognitiveLevel,
  QuestionMeta,
} from '../types';
import { COGNITIVE_LEVELS, DEFAULT_COGNITIVE_LEVEL } from '../types';
import React from 'react';
import QuestionBankSidebar from '../components/QuestionBankSidebar';
import QuestionViewModal, { type ViewModalQuestion } from '../components/QuestionViewModal';
import SectionEditModal from '../components/SectionEditModal';
import { renderMath, preprocessMathHtml, cleanImageHtml } from '../utils/mathjax';

const HEADER_FIELD_CONFIG: { key: keyof VisibleHeaderFields; label: string }[] = [
  { key: 'examTitle', label: 'Exam Title' },
  { key: 'course', label: 'Course' },
  { key: 'subject', label: 'Subject' },
  { key: 'gradeClass', label: 'Class' },
  { key: 'date', label: 'Date' },
  { key: 'duration', label: 'Duration' },
  { key: 'totalMarks', label: 'Total Marks' },
];

const BLOCK_TYPES: { type: QuestionType; label: string; icon: typeof AlignLeft; description: string; header: string }[] = [
  { type: 'mcq', label: 'Multiple Choice', icon: ListChecks, description: 'Question with options A-D', header: 'Multiple Choice:' },
  { type: 'subjective', label: 'Subjective Question', icon: AlignLeft, description: 'Answer the following', header: 'Answer the following:' },
  { type: 'text', label: 'Text / Reading Passage', icon: FileText, description: 'Passage, scenario, or instructions in between questions', header: 'Read the following:' },
];

function formatSubQuestionNumber(index: number, depth: number, style?: SubQuestionNumberingStyle): string {
  const lettersLower = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
  const lettersUpper = lettersLower.map(l => l.toUpperCase());
  const romans = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];

  const num = index + 1;
  const lLow = lettersLower[index] || String(num);
  const lUp = lettersUpper[index] || String(num);
  const rom = romans[index] || String(num);

  if (depth === 0) {
    switch (style) {
      case 'roman_paren': return `(${rom})`;
      case 'numbers_paren': return `${num})`;
      case 'letters_dot': return `${lLow}.`;
      case 'roman_dot': return `${rom}.`;
      case 'numbers_paren_both': return `(${num})`;
      case 'letters_upper_dot': return `${lUp}.`;
      case 'letters_upper_paren': return `(${lUp})`;
      case 'letters_paren':
      default:
        return `(${lLow})`;
    }
  } else if (depth === 1) {
    switch (style) {
      case 'roman_paren': return `(${lLow})`;
      case 'letters_paren': return `(${rom})`;
      default: return `(${rom})`;
    }
  } else {
    return '•';
  }
}


function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function LazyNumberInput({ value, onChange, placeholder, className, min, fallback = 0 }: { value: number; onChange: (val: number) => void; placeholder?: string; className?: string; min?: number; fallback?: number }) {
  const [localValue, setLocalValue] = useState(value?.toString() || '');

  useEffect(() => {
    setLocalValue(value?.toString() || '');
  }, [value]);

  const handleCommit = () => {
    let num = parseInt(localValue);
    if (isNaN(num)) num = fallback;
    if (min !== undefined && num < min) num = min;
    setLocalValue(num.toString());
    onChange(num);
  };

  return (
    <input
      type="number"
      className={className}
      value={localValue}
      placeholder={placeholder}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      min={min}
    />
  );
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
  onCopy?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onAddSubQuestion?: () => void;
  showSectionHeader?: string;
  sectionNumber?: number;
  sectionMarks?: number;
  sectionDescription?: string;
  onEditSection?: (section: string) => void;
  canMoveSectionUp?: boolean;
  canMoveSectionDown?: boolean;
  onMoveSectionUp?: (section: string) => void;
  onMoveSectionDown?: (section: string) => void;
  subQuestions?: SubQuestionNode[];
  onEditSubQuestion?: (pqId: string) => void;
  onCopySubQuestion?: (pqId: string) => void;
  onRemoveSubQuestion?: (pqId: string, qId: string) => void;
  onMoveSubQuestionUp?: (pqId: string) => void;
  onMoveSubQuestionDown?: (pqId: string) => void;
  onAddSubSubQuestion?: (pq: PaperQuestion) => void;
  subQuestionNumberingStyle?: SubQuestionNumberingStyle;
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
  onCopy,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  showSectionHeader,
  sectionDescription,
  onEditSection,
  canMoveSectionUp,
  canMoveSectionDown,
  onMoveSectionUp,
  onMoveSectionDown,
  subQuestions,
  onEditSubQuestion,
  onCopySubQuestion,
  onRemoveSubQuestion,
  onMoveSubQuestionUp,
  onMoveSubQuestionDown,
  subQuestionNumberingStyle,
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
  const isTextType = question.questionType === 'text';

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
          <div className="section-divider-top">
            <span style={{ fontWeight: 700 }}>{showSectionHeader}</span>
            <div className="section-admin-actions">
              {onEditSection && (
                <button
                  className="section-action-icon-btn"
                  onClick={(e) => { e.stopPropagation(); onEditSection(showSectionHeader); }}
                  title={`Edit Section ${showSectionHeader}`}
                >
                  <Pencil size={13} />
                </button>
              )}
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
          {sectionDescription && (
            <div className="section-description-text" data-section-name={showSectionHeader} dangerouslySetInnerHTML={{ __html: sectionDescription }} />
          )}
        </div>
      )}

      {/* Clean HTML - Question Content & Options with Inline Actions */}
      <div className="clean-question">
        <div className="q-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, position: 'relative' }}>
          <div className="q-drag-handle" {...attributes} {...listeners} title="Drag to reorder">
            <GripVertical size={14} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
            {!isTextType && !/^(q\.?\s*\d+|question\s*\d+|\d+[\.\)])/i.test(stripHtml(question.content).trim()) && (
              <span className="q-number">
                {questionNumber}.
              </span>
            )}
            <div className="q-content-wrapper" style={{ flex: 1, minWidth: 0 }}>
              {paperQuestion.isOptional && (
                <span className="optional-badge">Optional</span>
              )}
              {isTextType ? (
                <div className="q-text q-text-passage" dangerouslySetInnerHTML={{ __html: preprocessMathHtml(question.content) }} />
              ) : (
                <div className="q-text" dangerouslySetInnerHTML={{ __html: preprocessMathHtml(question.content) }} />
              )}
              {question.questionType === 'mcq' && question.options && question.options.length > 0 && (
                <div className={`q-options q-options-${mcqLayout}`}>
                  {question.options.map((opt, i) => (
                    <span key={i} className="q-option" data-option-index={i} style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
                      <span style={{ marginRight: '4px' }}>{String.fromCharCode(65 + i)}.</span>
                      <span dangerouslySetInnerHTML={{ __html: preprocessMathHtml(opt) }} />
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
              {onCopy && (
                <button
                  className="q-action-icon-btn"
                  onClick={(e) => { e.stopPropagation(); onCopy(); }}
                  title="Copy Question"
                >
                  <Copy size={13} />
                </button>
              )}
              <button
                className="q-action-icon-btn danger"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                title="Delete Question"
              >
                <Trash2 size={13} />
              </button>
            </div>
            {isTextType ? (
              <span className="marks-inline" style={{ opacity: 0.6, fontSize: '0.8em' }}>Passage</span>
            ) : (
              <span className="marks-inline">
                {paperQuestion.isOptional ? `(Opt - ${paperQuestion.marks}m)` : `${paperQuestion.marks}m`}
              </span>
            )}
          </div>
        </div>

        {/* Flattened sub-questions for proper right-alignment */}
        {subQuestions && subQuestions.length > 0 && (
          <div className="sub-questions" style={{ marginTop: 12 }}>
            {subQuestions.map((sub, si) => {
              const renderSubQ = (node: SubQuestionNode, depth: number, idx: number, numSiblings: number): React.ReactNode => {
                const effectiveStyle = node.pq.subNumberingStyle || paperQuestion.subNumberingStyle || subQuestionNumberingStyle;
                const label = formatSubQuestionNumber(idx, depth, effectiveStyle);
                const subContentText = stripHtml(node.question.content).trim();
                const hasCustomNumber = /^(q\.?\s*\d+|question\s*\d+|\d+[\.\)]|\(\d+\)|[a-z][\.\)]|\([a-z]\)|\([ivx]+\)|[ivx]+[\.\)]|[•\-\*])/i.test(subContentText);

                const subMcqLayout = node.question.questionType === 'mcq' ? getMcqLayout(node.question.options || []) : 'vertical';

                const canMoveUp = idx > 0;
                const canMoveDown = idx < numSiblings - 1;

                return (
                  <React.Fragment key={node.pq.id}>
                    <div className="q-row" data-question-id={node.question.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, position: 'relative', marginTop: 10 }}>
                      <div style={{ width: 14, flexShrink: 0 }} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 0, marginLeft: 24 + depth * 20 }}>
                        {!hasCustomNumber && (
                          <span className="q-number" style={{ fontSize: '0.85em', minWidth: 24 }}>{label}</span>
                        )}
                        <div className="q-content-wrapper" style={{ flex: 1, minWidth: 0 }}>
                          {node.pq.isOptional && (
                            <span className="optional-badge" style={{ fontSize: '10px' }}>Optional</span>
                          )}
                          <div className="q-text" dangerouslySetInnerHTML={{ __html: preprocessMathHtml(node.question.content) }} />
                          {node.question.questionType === 'mcq' && node.question.options && node.question.options.length > 0 && (
                            <div className={`q-options q-options-${subMcqLayout}`}>
                              {node.question.options.map((opt, oi) => (
                                <span key={oi} className="q-option" data-option-index={oi} style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
                                  <span style={{ marginRight: '4px' }}>{String.fromCharCode(65 + oi)}.</span>
                                  <span dangerouslySetInnerHTML={{ __html: preprocessMathHtml(opt) }} />
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 16, position: 'relative' }}>
                        <div className="question-card-actions">
                          {onMoveSubQuestionUp && (
                            <button className="q-action-icon-btn" onClick={(e) => { e.stopPropagation(); onMoveSubQuestionUp(node.pq.id); }} disabled={!canMoveUp} title="Move Subquestion Up">
                              <ChevronUp size={14} />
                            </button>
                          )}
                          {onMoveSubQuestionDown && (
                            <button className="q-action-icon-btn" onClick={(e) => { e.stopPropagation(); onMoveSubQuestionDown(node.pq.id); }} disabled={!canMoveDown} title="Move Subquestion Down">
                              <ChevronDown size={14} />
                            </button>
                          )}
                          {onEditSubQuestion && (
                            <button className="q-action-icon-btn" onClick={(e) => { e.stopPropagation(); onEditSubQuestion(node.pq.id); }} title="Edit Subquestion">
                              <Pencil size={13} />
                            </button>
                          )}
                          {onCopySubQuestion && (
                            <button className="q-action-icon-btn" onClick={(e) => { e.stopPropagation(); onCopySubQuestion(node.pq.id); }} title="Copy Subquestion">
                              <Copy size={13} />
                            </button>
                          )}
                          {onRemoveSubQuestion && (
                            <button className="q-action-icon-btn danger" onClick={(e) => { e.stopPropagation(); onRemoveSubQuestion(node.pq.id, node.question.id); }} title="Delete Subquestion">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                        <span className="marks-inline" style={{ fontSize: '0.85em' }}>
                          {node.pq.isOptional ? `(Opt - ${node.pq.marks}m)` : `${node.pq.marks}m`}
                        </span>
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
      <button className="ql-align" value="" title="Align Left" />
      <button className="ql-align" value="center" title="Align Center" />
      <button className="ql-align" value="right" title="Align Right" />
      <button className="ql-align" value="justify" title="Justify" />
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

function ensureQuillTableStructure(tableEl: HTMLTableElement) {
  const usedIds = new Set<string>();
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  rows.forEach((tr) => {
    const cells = Array.from(tr.children) as HTMLElement[];
    let rowId = cells[0]?.getAttribute('data-row') || '';
    if (!rowId || usedIds.has(rowId)) {
      rowId = `row-${Math.random().toString(36).slice(2, 7)}`;
    }
    usedIds.add(rowId);
    cells.forEach((cell) => {
      cell.setAttribute('data-row', rowId);
      if (!cell.innerHTML.trim()) {
        cell.innerHTML = '<br>';
      }
    });
  });
}

function focusTableCell(cellEl: HTMLElement | null | undefined) {
  if (!cellEl) return;
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(cellEl);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function FullQuill({ value, onChange, placeholder, openMathDialog, toolbarId = "toolbar", onImageClick }: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  openMathDialog: (onInsert: (latex: string) => void) => void;
  toolbarId?: string;
  onImageClick?: (imgElement: HTMLImageElement, htmlValue: string, onChange: (newHtml: string) => void, startEvent?: React.MouseEvent) => void;
}) {
  const quillRef = useRef<ReactQuill>(null);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);
  const [isInsideTable, setIsInsideTable] = useState(false);
  const activeTableCellRef = useRef<HTMLTableCellElement | null>(null);
  const lastSelectionRef = useRef<{ index: number; length: number } | null>(null);

  const syncEditorHtml = useCallback(() => {
    if (!quillRef.current) return;
    const quill = quillRef.current.getEditor();
    quill.update(ReactQuill.Quill.sources.USER);
    onChange(cleanImageHtml(quill.root.innerHTML));
  }, [onChange]);

  const confirmTableInsert = () => {
    if (quillRef.current && tableRows > 0 && tableCols > 0) {
      const quill = quillRef.current.getEditor();
      quill.focus();
      const range = lastSelectionRef.current || quill.getSelection(true) || { index: Math.max(0, quill.getLength() - 1), length: 0 };
      const tableModule = quill.getModule('table') as any;
      if (tableModule) {
        quill.setSelection(range.index, 0, ReactQuill.Quill.sources.SILENT);
        tableModule.insertTable(tableRows, tableCols);
        setTimeout(() => {
          quill.focus();
          const firstCell = quill.root.querySelector('td') as HTMLTableCellElement | null;
          if (firstCell) {
            activeTableCellRef.current = firstCell;
            setIsInsideTable(true);
          }
          onChange(cleanImageHtml(quill.root.innerHTML));
        }, 30);
      }
    }
    setShowTableDialog(false);
  };

  const handleTableAction = useCallback((action: 'row-above' | 'row-below' | 'col-left' | 'col-right' | 'del-row' | 'del-col' | 'del-table') => {
    if (!quillRef.current) return;
    const quill = quillRef.current.getEditor();
    let cell = activeTableCellRef.current;

    if (!cell || !quill.root.contains(cell)) {
      const sel = window.getSelection();
      const anchorEl = sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement;
      const foundCell = anchorEl?.closest('td, th') as HTMLTableCellElement | null;
      if (foundCell && quill.root.contains(foundCell)) {
        cell = foundCell;
      }
    }
    if (!cell || !quill.root.contains(cell)) {
      cell = quill.root.querySelector('td, th') as HTMLTableCellElement | null;
    }
    if (!cell) return;

    const tr = cell.closest('tr') as HTMLTableRowElement | null;
    const table = cell.closest('table') as HTMLTableElement | null;
    if (!tr || !table) return;

    ensureQuillTableStructure(table);

    const tbody = (table.querySelector('tbody') || table) as HTMLElement;
    const rows = Array.from(table.querySelectorAll('tr'));
    const rowIndex = rows.indexOf(tr);
    const cellsInRow = Array.from(tr.children) as HTMLTableCellElement[];
    const colIndex = Math.max(0, cellsInRow.indexOf(cell));
    const colCount = Math.max(1, cellsInRow.length);

    if (action === 'del-table') {
      table.remove();
      if (!quill.root.innerHTML.trim()) {
        quill.root.innerHTML = '<p><br></p>';
      }
      activeTableCellRef.current = null;
      setIsInsideTable(false);
      syncEditorHtml();
      return;
    }

    if (action === 'row-above' || action === 'row-below') {
      const newRow = document.createElement('tr');
      const newRowId = `row-${Math.random().toString(36).slice(2, 7)}`;
      for (let c = 0; c < colCount; c++) {
        const td = document.createElement('td');
        td.setAttribute('data-row', newRowId);
        td.innerHTML = '<br>';
        newRow.appendChild(td);
      }
      if (action === 'row-above') {
        tbody.insertBefore(newRow, tr);
      } else {
        tbody.insertBefore(newRow, tr.nextSibling);
      }
      const nextCell = (newRow.children[colIndex] || newRow.children[0]) as HTMLTableCellElement;
      activeTableCellRef.current = nextCell;
      setIsInsideTable(true);
      syncEditorHtml();
      focusTableCell(nextCell);
      return;
    }

    if (action === 'col-left' || action === 'col-right') {
      const insertIdx = action === 'col-left' ? colIndex : colIndex + 1;
      let targetCell: HTMLTableCellElement | null = null;
      rows.forEach((r, rIdx) => {
        const rCells = Array.from(r.children) as HTMLElement[];
        const rowId = rCells[0]?.getAttribute('data-row') || `row-${Math.random().toString(36).slice(2, 7)}`;
        const td = document.createElement('td');
        td.setAttribute('data-row', rowId);
        td.innerHTML = '<br>';
        const refNode = rCells[insertIdx] || null;
        r.insertBefore(td, refNode);
        if (rIdx === rowIndex) {
          targetCell = td;
        }
      });
      if (targetCell) {
        activeTableCellRef.current = targetCell;
        setIsInsideTable(true);
        focusTableCell(targetCell);
      }
      syncEditorHtml();
      return;
    }

    if (action === 'del-row') {
      if (rows.length <= 1) {
        table.remove();
        if (!quill.root.innerHTML.trim()) {
          quill.root.innerHTML = '<p><br></p>';
        }
        activeTableCellRef.current = null;
        setIsInsideTable(false);
        syncEditorHtml();
        return;
      }
      const fallbackRow = rows[rowIndex + 1] || rows[rowIndex - 1];
      tr.remove();
      const nextCell = (fallbackRow?.children[Math.min(colIndex, fallbackRow.children.length - 1)] || null) as HTMLTableCellElement | null;
      activeTableCellRef.current = nextCell;
      setIsInsideTable(Boolean(nextCell));
      syncEditorHtml();
      focusTableCell(nextCell);
      return;
    }

    if (action === 'del-col') {
      if (colCount <= 1) {
        table.remove();
        if (!quill.root.innerHTML.trim()) {
          quill.root.innerHTML = '<p><br></p>';
        }
        activeTableCellRef.current = null;
        setIsInsideTable(false);
        syncEditorHtml();
        return;
      }
      rows.forEach((r) => {
        const target = r.children[colIndex];
        if (target) target.remove();
      });
      const remainingCells = Array.from(tr.children) as HTMLTableCellElement[];
      const nextCell = remainingCells[Math.min(colIndex, remainingCells.length - 1)] || null;
      activeTableCellRef.current = nextCell;
      setIsInsideTable(Boolean(nextCell));
      syncEditorHtml();
      focusTableCell(nextCell);
    }
  }, [syncEditorHtml]);

  const modules = useMemo(() => ({
    toolbar: {
      container: `#${toolbarId}`,
      handlers: {
        table: () => setShowTableDialog(true),
        align: function (this: any, alignVal: string | false) {
          if (!quillRef.current) return;
          const quill = quillRef.current.getEditor();
          quill.focus();
          const normalizedAlign = alignVal || false;

          // If inside a table cell, also apply alignment class/style to the cell
          if (activeTableCellRef.current && quill.root.contains(activeTableCellRef.current)) {
            const td = activeTableCellRef.current;
            td.classList.remove('ql-align-center', 'ql-align-right', 'ql-align-justify');
            if (normalizedAlign) {
              td.classList.add(`ql-align-${normalizedAlign}`);
              td.style.textAlign = normalizedAlign;
            } else {
              td.style.textAlign = 'left';
            }
          }

          const range = quill.getSelection() || lastSelectionRef.current;
          if (range && range.length > 0) {
            quill.formatLine(range.index, range.length, 'align', normalizedAlign, ReactQuill.Quill.sources.USER);
          } else if (range) {
            quill.formatLine(range.index, 1, 'align', normalizedAlign, ReactQuill.Quill.sources.USER);
          } else {
            quill.formatLine(0, Math.max(1, quill.getLength()), 'align', normalizedAlign, ReactQuill.Quill.sources.USER);
          }
          onChange(cleanImageHtml(quill.root.innerHTML));
        },
        math: () => {
          if (!quillRef.current) return;
          const quill = quillRef.current.getEditor();
          const range = lastSelectionRef.current || quill.getSelection(true) || { index: Math.max(0, quill.getLength() - 1), length: 0 };
          openMathDialog((latex) => {
            const mathText = `\\(${latex}\\)`;
            quill.insertText(range.index, mathText, 'user');
            quill.setSelection(range.index + mathText.length, 0);
          });
        }
      }
    },
    table: true
  }), [toolbarId, openMathDialog, onChange]);

  const checkTableContext = useCallback((targetNode?: Node | null) => {
    if (!quillRef.current) return;
    const quill = quillRef.current.getEditor();
    const sel = window.getSelection();
    const node = targetNode || sel?.anchorNode;
    const el = node instanceof HTMLElement ? node : node?.parentElement;
    const cell = el?.closest('td, th') as HTMLTableCellElement | null;
    if (cell && quill.root.contains(cell)) {
      activeTableCellRef.current = cell;
      setIsInsideTable(true);
    } else {
      activeTableCellRef.current = null;
      setIsInsideTable(false);
    }
  }, []);

  const handleEditorMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    checkTableContext(target);
    if (target.tagName === 'IMG' && onImageClick) {
      if ((target as HTMLImageElement).style.outline) {
        (target as HTMLImageElement).style.outline = '';
      }
      onImageClick(target as HTMLImageElement, value, onChange, e);
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if (!quillRef.current) return;
    const quill = quillRef.current.getEditor();
    const sel = window.getSelection();
    const anchorEl = sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement;
    const currentCell = (anchorEl?.closest('td, th') || activeTableCellRef.current) as HTMLTableCellElement | null;

    if (!currentCell || !quill.root.contains(currentCell)) return;

    const tr = currentCell.closest('tr') as HTMLTableRowElement | null;
    const table = currentCell.closest('table') as HTMLTableElement | null;
    if (!tr || !table) return;

    // Word-like Tab / Shift+Tab navigation across table cells
    if (e.key === 'Tab') {
      e.preventDefault();
      ensureQuillTableStructure(table);
      const allCells = Array.from(table.querySelectorAll('td, th')) as HTMLTableCellElement[];
      const idx = allCells.indexOf(currentCell);
      if (e.shiftKey) {
        if (idx > 0) {
          const prevCell = allCells[idx - 1];
          activeTableCellRef.current = prevCell;
          focusTableCell(prevCell);
        }
      } else {
        if (idx >= 0 && idx < allCells.length - 1) {
          const nextCell = allCells[idx + 1];
          activeTableCellRef.current = nextCell;
          focusTableCell(nextCell);
        } else {
          // At the very last cell of the table: insert a new row below and focus its first cell (like Word)
          activeTableCellRef.current = currentCell;
          handleTableAction('row-below');
          const updatedRows = Array.from(table.querySelectorAll('tr'));
          const lastRowFirstCell = updatedRows[updatedRows.length - 1]?.querySelector('td, th') as HTMLTableCellElement | null;
          if (lastRowFirstCell) {
            activeTableCellRef.current = lastRowFirstCell;
            focusTableCell(lastRowFirstCell);
          }
        }
      }
      return;
    }

    // Prevent Backspace / Delete from destroying table cell boundaries and scrambling columns
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const range = quill.getSelection();
      if (!range) return;
      const [startLine, startOffset] = quill.getLine(range.index);
      const [endLine] = quill.getLine(range.index + range.length);

      if (range.length === 0 && startLine) {
        if (e.key === 'Backspace' && startOffset === 0) {
          e.preventDefault();
          return;
        }
        if (e.key === 'Delete' && startOffset >= startLine.length() - 1) {
          e.preventDefault();
          return;
        }
      } else if (range.length > 0 && startLine !== endLine) {
        // Selection spans across multiple cells: clear text cleanly without removing <td> elements
        e.preventDefault();
        ensureQuillTableStructure(table);
        const domRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
        if (domRange) {
          const allCells = Array.from(table.querySelectorAll('td, th')) as HTMLTableCellElement[];
          allCells.forEach((td) => {
            if (domRange.intersectsNode(td)) {
              td.innerHTML = '<br>';
            }
          });
          syncEditorHtml();
          focusTableCell(currentCell);
        }
      }
    }
  };

  return (
    <div
      className="rich-editor-wrapper"
      onMouseDown={handleEditorMouseDown}
      onKeyUp={() => checkTableContext()}
      onKeyDown={handleEditorKeyDown}
    >
      <CustomToolbar id={toolbarId} />
      {isInsideTable && (
        <div
          className="quill-table-context-bar"
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="quill-table-bar-label">
            <Table2 size={13} /> Table:
          </span>
          <button type="button" className="quill-table-bar-btn" onClick={() => handleTableAction('row-above')} title="Insert Row Above">
            + Row Above
          </button>
          <button type="button" className="quill-table-bar-btn" onClick={() => handleTableAction('row-below')} title="Insert Row Below">
            + Row Below
          </button>
          <span className="quill-table-bar-sep" />
          <button type="button" className="quill-table-bar-btn" onClick={() => handleTableAction('col-left')} title="Insert Column Left">
            + Col Left
          </button>
          <button type="button" className="quill-table-bar-btn" onClick={() => handleTableAction('col-right')} title="Insert Column Right">
            + Col Right
          </button>
          <span className="quill-table-bar-sep" />
          <button type="button" className="quill-table-bar-btn danger" onClick={() => handleTableAction('del-row')} title="Delete Current Row">
            Delete Row
          </button>
          <button type="button" className="quill-table-bar-btn danger" onClick={() => handleTableAction('del-col')} title="Delete Current Column">
            Delete Col
          </button>
          <button type="button" className="quill-table-bar-btn danger" onClick={() => handleTableAction('del-table')} title="Delete Entire Table">
            Delete Table
          </button>
        </div>
      )}
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        onChangeSelection={(range) => {
          if (range) {
            lastSelectionRef.current = { index: range.index, length: range.length };
            checkTableContext();
          }
        }}
        useSemanticHTML={false}
        modules={modules}
        placeholder={placeholder}
        style={{ background: 'white', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}
      />

      {showTableDialog && (
        <div className="modal-overlay" style={{ zIndex: 12000 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title">Insert Table</h2>
              <button className="modal-close-btn" onClick={() => setShowTableDialog(false)}>✕</button>
            </div>
            <div className="modal-content">
              <div className="property-field">
                <label className="property-label">Rows</label>
                <input
                  type="number"
                  autoFocus
                  className="property-input"
                  value={tableRows}
                  onChange={(e) => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmTableInsert();
                    if (e.key === 'Escape') setShowTableDialog(false);
                  }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmTableInsert();
                    if (e.key === 'Escape') setShowTableDialog(false);
                  }}
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
    chapters,
    topics,
    categories,
    sharedQuestions,
    fetchPaperQuestions,
    fetchQuestions,
    fetchSharedQuestions,
    fetchLookups,
    createChapter,
    createTopic,
    createCategory,
    removeQuestionFromPaper,
    reorderPaperQuestions,
    updateQuestionPaper,
    createAndAddQuestion,
    updateQuestion,
    updatePaperQuestion,
    deleteQuestion,
    importSharedQuestionToPaper,
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
  const [draftIsOptional, setDraftIsOptional] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingPQId, setEditingPQId] = useState<string | null>(null);

  // Classification & Taxonomy states for Question Editor
  const [draftCourseId, setDraftCourseId] = useState<string>('');
  const [draftSubjectId, setDraftSubjectId] = useState<string>('');
  const [draftCognitiveLevel, setDraftCognitiveLevel] = useState<CognitiveLevel>(DEFAULT_COGNITIVE_LEVEL);
  const [draftChapterId, setDraftChapterId] = useState<string>('');
  const [draftTopicId, setDraftTopicId] = useState<string>('');
  const [draftCategoryId, setDraftCategoryId] = useState<string>('');
  const [draftSubNumberingStyle, setDraftSubNumberingStyle] = useState<SubQuestionNumberingStyle | ''>('');

  // Inline "add new" inputs for lookups
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  interface DraftSubquestion {
    id: string; // Used for React keys and temp identification
    questionId?: string; // Original question ID if editing
    pqId?: string; // Original paper_question ID if editing
    type: QuestionType;
    content: string;
    options: string[];
    marks: number;
    difficulty: Difficulty;
    isOptional?: boolean;
    isExpanded?: boolean;
    cognitiveLevel?: CognitiveLevel;
    subNumberingStyle?: SubQuestionNumberingStyle;
  }
  const [draftSubquestions, setDraftSubquestions] = useState<DraftSubquestion[]>([]);

  const [isConstructorOpen, setIsConstructorOpen] = useState(false);
  const [activeView, setActiveView] = useState<'tree' | 'add-section' | 'add-question'>('tree');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [qParentId, setQParentId] = useState<string>('');
  const [isAddingNewSection, setIsAddingNewSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Question Bank & UI States
  const [isQuestionBankOpen, setIsQuestionBankOpen] = useState(false);
  const [viewingQuestion, setViewingQuestion] = useState<ViewModalQuestion | null>(null);
  const [editingSection, setEditingSection] = useState<{ oldName: string; name: string; description: string } | null>(null);



  const [showMathDialog, setShowMathDialog] = useState(false);
  const [showCreatorHub, setShowCreatorHub] = useState(false);
  const [showPaperSettings, setShowPaperSettings] = useState(false);
  const [mathKeyboardVisible, setMathKeyboardVisible] = useState(false);
  const mathDialogCallbackRef = useRef<((latex: string) => void) | null>(null);
  const mathFieldRef = useRef<any>(null);

  // Close drawers on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isQuestionBankOpen) setIsQuestionBankOpen(false);
        if (showPaperSettings) setShowPaperSettings(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuestionBankOpen, showPaperSettings]);

  // Auto-sync draft course and subject from paper details
  useEffect(() => {
    if (paper) {
      if (!draftCourseId && paper.courseId) setDraftCourseId(paper.courseId);
      if (!draftSubjectId && paper.subjectId) setDraftSubjectId(paper.subjectId);
    }
  }, [paper?.courseId, paper?.subjectId]);

  const [editingImage, setEditingImage] = useState<{
    imgElement: HTMLImageElement;
    imgIndex: number;
    originalHtml: string;
    originalWidth: number;
    contextSelector: string;
    onApply: (newHtml: string) => Promise<void> | void;
  } | null>(null);
  const [imageOverlayRect, setImageOverlayRect] = useState<{ top: number; left: number; width: number; height: number; clipTop: number; clipBottom: number; clipLeft: number; clipRight: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const dragImageRef = useRef<{ startX: number; startY: number; startMarginLeft: number; startMarginTop: number; moved: boolean } | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const syncImgAttributesToDoc = useCallback((sourceImg: HTMLImageElement, targetImg: HTMLImageElement, newSrc?: string, overrideWidth?: number) => {
    if (newSrc && typeof newSrc === 'string') {
      targetImg.src = newSrc;
      targetImg.setAttribute('src', newSrc);
    }
    const widthVal = overrideWidth !== undefined ? overrideWidth : Math.round(sourceImg.getBoundingClientRect().width);
    if (widthVal > 0) {
      targetImg.style.width = `${widthVal}px`;
      targetImg.setAttribute('width', `${widthVal}`);
    }
    targetImg.style.height = 'auto';
    targetImg.removeAttribute('height');
    targetImg.style.outline = '';

    if (sourceImg.style.display) targetImg.style.display = sourceImg.style.display;
    if (sourceImg.style.marginLeft) targetImg.style.marginLeft = sourceImg.style.marginLeft;
    else targetImg.style.removeProperty('margin-left');
    if (sourceImg.style.marginRight) targetImg.style.marginRight = sourceImg.style.marginRight;
    else targetImg.style.removeProperty('margin-right');
    if (sourceImg.style.marginTop) targetImg.style.marginTop = sourceImg.style.marginTop;
    else targetImg.style.removeProperty('margin-top');

    const dataX = sourceImg.getAttribute('data-x');
    const dataY = sourceImg.getAttribute('data-y');
    const dataAlign = sourceImg.getAttribute('data-align');
    if (dataX !== null) targetImg.setAttribute('data-x', dataX);
    else targetImg.removeAttribute('data-x');
    if (dataY !== null) targetImg.setAttribute('data-y', dataY);
    else targetImg.removeAttribute('data-y');
    if (dataAlign !== null) targetImg.setAttribute('data-align', dataAlign);
    else targetImg.removeAttribute('data-align');
  }, []);

  // Update overlay rect when editingImage changes or on scroll/resize
  useEffect(() => {
    if (!editingImage) { setImageOverlayRect(null); return; }

    const update = () => {
      let el = editingImage.imgElement;
      // React re-renders (like FullQuill recreating or dangerouslySetInnerHTML refreshing) 
      // can cause the img element to detach. Reconnect it!
      if (!document.body.contains(el)) {
        const candidates = Array.from(document.querySelectorAll(`${editingImage.contextSelector} img`)) as HTMLImageElement[];
        const validCandidates = candidates.filter(c => !c.closest('.measurement-container') && !c.closest('.paper-header'));
        const newEl = validCandidates.find(c => c.src === el.src) || validCandidates[editingImage.imgIndex];

        if (newEl) {
          el = newEl;
          editingImage.imgElement = el;
        } else {
          setImageOverlayRect(null);
          setEditingImage(null);
          return;
        }
      }

      if (el.style.outline) {
        el.style.outline = '';
      }

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

  // Commit image transform (resize, drag move, alignment) immediately to Quill and React state
  const commitImageTransform = useCallback((overrideWidth?: number) => {
    if (!editingImage) return;
    const imgEl = editingImage.imgElement;
    const widthVal = overrideWidth !== undefined ? overrideWidth : Math.round(imgEl.getBoundingClientRect().width);
    syncImgAttributesToDoc(imgEl, imgEl, undefined, widthVal);

    const qlEditor = imgEl.closest('.ql-editor');
    let updatedHtml = '';
    if (qlEditor) {
      updatedHtml = cleanImageHtml(qlEditor.innerHTML);
    } else {
      const parser = new DOMParser();
      const doc = parser.parseFromString(editingImage.originalHtml, 'text/html');
      const imgs = Array.from(doc.querySelectorAll('img'));
      const targetSrc = imgEl.getAttribute('src');
      const matchedByIdx = imgs[editingImage.imgIndex];
      if (matchedByIdx) {
        syncImgAttributesToDoc(imgEl, matchedByIdx, undefined, widthVal);
      } else {
        imgs.forEach(img => {
          if (img.getAttribute('src') === targetSrc || img.src === imgEl.src) {
            syncImgAttributesToDoc(imgEl, img, undefined, widthVal);
          }
        });
      }
      updatedHtml = cleanImageHtml(doc.body.innerHTML);
    }

    void editingImage.onApply(updatedHtml);

    setEditingImage(prev => prev ? {
      ...prev,
      originalHtml: updatedHtml,
      originalWidth: widthVal,
    } : null);

    const rect = imgEl.getBoundingClientRect();
    setImageOverlayRect(prev => prev ? {
      ...prev,
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    } : null);
  }, [editingImage, syncImgAttributesToDoc]);

  const commitImageTransformRef = useRef(commitImageTransform);
  useEffect(() => {
    commitImageTransformRef.current = commitImageTransform;
  });

  // Global mouse handlers for corner drag resize & image drag-to-move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!editingImage || !imageOverlayRect) return;

      if (resizeRef.current) {
        e.preventDefault();
        const delta = e.clientX - resizeRef.current.startX;
        let newWidth = Math.max(30, resizeRef.current.startWidth + delta);
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
        return;
      }

      if (dragImageRef.current) {
        const deltaX = e.clientX - dragImageRef.current.startX;
        const deltaY = e.clientY - dragImageRef.current.startY;
        if (!dragImageRef.current.moved && Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) {
          return;
        }
        e.preventDefault();
        dragImageRef.current.moved = true;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        const imgEl = editingImage.imgElement;
        const container = (imgEl.closest('.ql-editor, .q-text, .q-option, .section-description-text, .paper-instructions-body') || imgEl.parentElement) as HTMLElement | null;
        const imgRect = imgEl.getBoundingClientRect();
        const maxLeft = container ? Math.max(0, container.getBoundingClientRect().width - imgRect.width) : 600;

        const newMarginLeft = Math.max(0, Math.min(Math.round(maxLeft), Math.round(dragImageRef.current.startMarginLeft + deltaX)));
        const newMarginTop = Math.max(-20, Math.min(300, Math.round(dragImageRef.current.startMarginTop + deltaY)));

        imgEl.style.display = 'block';
        imgEl.style.marginLeft = `${newMarginLeft}px`;
        imgEl.style.marginRight = 'auto';
        imgEl.style.marginTop = `${newMarginTop}px`;
        imgEl.setAttribute('data-x', String(newMarginLeft));
        imgEl.setAttribute('data-y', String(newMarginTop));
        imgEl.removeAttribute('data-align');

        const rect = imgEl.getBoundingClientRect();
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
      }
    };

    const handleMouseUp = () => {
      if (resizeRef.current) {
        resizeRef.current = null;
        if (editingImage?.imgElement) {
          const finalWidth = Math.round(editingImage.imgElement.getBoundingClientRect().width);
          commitImageTransformRef.current(finalWidth);
        }
      }
      if (dragImageRef.current) {
        const wasMoved = dragImageRef.current.moved;
        dragImageRef.current = null;
        if (wasMoved && editingImage?.imgElement) {
          commitImageTransformRef.current();
        }
      }
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

  const getImgCurrentOffsets = (imgEl: HTMLImageElement) => {
    const container = (imgEl.closest('.ql-editor, .q-text, .q-option, .section-description-text, .paper-instructions-body') || imgEl.parentElement) as HTMLElement | null;
    let startMarginLeft = parseInt(imgEl.style.marginLeft || imgEl.getAttribute('data-x') || '0', 10);
    if (isNaN(startMarginLeft) || imgEl.style.marginLeft === 'auto') {
      if (container) {
        startMarginLeft = Math.max(0, Math.round(imgEl.getBoundingClientRect().left - container.getBoundingClientRect().left));
      } else {
        startMarginLeft = 0;
      }
    }
    const startMarginTop = parseInt(imgEl.style.marginTop || imgEl.getAttribute('data-y') || '0', 10) || 0;
    return { startMarginLeft, startMarginTop };
  };

  const startImageDrag = (e: React.MouseEvent, targetImg?: HTMLImageElement) => {
    e.preventDefault();
    e.stopPropagation();
    const imgEl = targetImg || editingImage?.imgElement;
    if (!imgEl) return;
    const { startMarginLeft, startMarginTop } = getImgCurrentOffsets(imgEl);
    dragImageRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startMarginLeft,
      startMarginTop,
      moved: false,
    };
  };

  const alignSelectedImage = (alignment: 'left' | 'center' | 'right') => {
    if (!editingImage) return;
    const imgEl = editingImage.imgElement;
    imgEl.style.display = 'block';
    imgEl.removeAttribute('data-x');
    imgEl.setAttribute('data-align', alignment);
    if (alignment === 'left') {
      imgEl.style.marginLeft = '0px';
      imgEl.style.marginRight = 'auto';
    } else if (alignment === 'center') {
      imgEl.style.marginLeft = 'auto';
      imgEl.style.marginRight = 'auto';
    } else {
      imgEl.style.marginLeft = 'auto';
      imgEl.style.marginRight = '0px';
    }
    commitImageTransform();
  };

  const applyImageEdit = useCallback(async (newSrc?: string, newWidth?: number) => {
    if (!editingImage) return;
    const currentWidth = newWidth !== undefined ? Math.round(newWidth) : Math.round(editingImage.imgElement.getBoundingClientRect().width);
    const imgEl = editingImage.imgElement;
    syncImgAttributesToDoc(imgEl, imgEl, newSrc, currentWidth);

    const qlEditor = imgEl.closest('.ql-editor');
    let finalHtml = '';
    if (qlEditor) {
      finalHtml = cleanImageHtml(qlEditor.innerHTML);
    } else {
      const parser = new DOMParser();
      const doc = parser.parseFromString(editingImage.originalHtml, 'text/html');
      const imgs = Array.from(doc.querySelectorAll('img'));
      const targetSrc = imgEl.getAttribute('src');
      const matchedByIdx = imgs[editingImage.imgIndex];

      if (matchedByIdx) {
        syncImgAttributesToDoc(imgEl, matchedByIdx, newSrc, currentWidth);
      } else {
        imgs.forEach(img => {
          if (img.getAttribute('src') === targetSrc || img.src === imgEl.src) {
            syncImgAttributesToDoc(imgEl, img, newSrc, currentWidth);
          }
        });
      }
      finalHtml = cleanImageHtml(doc.body.innerHTML);
    }

    await editingImage.onApply(finalHtml);
    setEditingImage(null);
  }, [editingImage, syncImgAttributesToDoc]);

  // Click outside to apply edit and dismiss selection overlay
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        editingImage &&
        target !== editingImage.imgElement &&
        !target.closest('.rnd-handle') &&
        !target.closest('.crop-btn') &&
        !target.closest('.image-overlay-toolbar') &&
        !target.closest('.image-drag-surface') &&
        !target.closest('.modal-overlay') // Crop modal
      ) {
        void applyImageEdit();
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [editingImage, applyImageEdit]);

  const handleQuillImageClick = useCallback((imgElement: HTMLImageElement, htmlValue: string, onChange: (newHtml: string) => void, startEvent?: React.MouseEvent) => {
    const qlEditor = imgElement.closest('.ql-editor');
    const allImgs = qlEditor ? Array.from(qlEditor.querySelectorAll('img')) : [imgElement];
    const imgIndex = Math.max(0, allImgs.indexOf(imgElement));
    setEditingImage({
      imgElement,
      imgIndex,
      originalHtml: htmlValue,
      originalWidth: imgElement.getBoundingClientRect().width,
      contextSelector: '.rich-editor-wrapper',
      onApply: (newHtml) => onChange(newHtml),
    });
    if (startEvent) {
      startImageDrag(startEvent, imgElement);
    }
  }, []);

  const handlePaperImageMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'IMG') return;
    if (target.closest('.paper-header') || target.closest('.measurement-container')) return;

    const imgElement = target as HTMLImageElement;
    if (imgElement.style.outline) {
      imgElement.style.outline = '';
    }

    const optionEl = imgElement.closest('.q-option[data-option-index]') as HTMLElement | null;
    const questionHolder = imgElement.closest('[data-question-id]') as HTMLElement | null;
    const sectionDescEl = imgElement.closest('.section-description-text[data-section-name]') as HTMLElement | null;
    const instructionsEl = imgElement.closest('.paper-instructions-body') as HTMLElement | null;

    if (optionEl && questionHolder) {
      const qId = questionHolder.getAttribute('data-question-id');
      const optIdx = parseInt(optionEl.getAttribute('data-option-index') || '0', 10);
      const q = questions.find(item => item.id === qId);
      if (!q || !q.options) return;
      const imgs = Array.from(optionEl.querySelectorAll('img'));
      const imgIndex = Math.max(0, imgs.indexOf(imgElement));
      setEditingImage({
        imgElement,
        imgIndex,
        originalHtml: q.options[optIdx] || '',
        originalWidth: imgElement.getBoundingClientRect().width,
        contextSelector: `#printable-paper [data-question-id="${q.id}"] .q-option[data-option-index="${optIdx}"]`,
        onApply: async (newHtml) => {
          const latestQ = useStore.getState().questions.find(item => item.id === q.id) || q;
          const nextOpts = [...(latestQ.options || [])];
          nextOpts[optIdx] = newHtml;
          await updateQuestion(q.id, { options: nextOpts });
        },
      });
      startImageDrag(e, imgElement);
      return;
    }

    if (questionHolder) {
      const qId = questionHolder.getAttribute('data-question-id');
      const q = questions.find(item => item.id === qId);
      if (!q) return;
      const textContainer = (imgElement.closest('.q-text') || questionHolder) as HTMLElement;
      const imgs = Array.from(textContainer.querySelectorAll('img'));
      const imgIndex = Math.max(0, imgs.indexOf(imgElement));
      setEditingImage({
        imgElement,
        imgIndex,
        originalHtml: q.content || '',
        originalWidth: imgElement.getBoundingClientRect().width,
        contextSelector: `#printable-paper [data-question-id="${q.id}"] .q-text`,
        onApply: async (newHtml) => {
          await updateQuestion(q.id, { content: newHtml });
        },
      });
      startImageDrag(e, imgElement);
      return;
    }

    if (sectionDescEl && paper) {
      const secName = sectionDescEl.getAttribute('data-section-name') || '';
      const imgs = Array.from(sectionDescEl.querySelectorAll('img'));
      const imgIndex = Math.max(0, imgs.indexOf(imgElement));
      const origDesc = paper.headerConfig?.sectionDescriptions?.[secName] || '';
      setEditingImage({
        imgElement,
        imgIndex,
        originalHtml: origDesc,
        originalWidth: imgElement.getBoundingClientRect().width,
        contextSelector: `#printable-paper .section-description-text[data-section-name="${secName}"]`,
        onApply: async (newHtml) => {
          await handleUpdateHeaderConfig({
            sectionDescriptions: {
              ...(paper.headerConfig?.sectionDescriptions || {}),
              [secName]: newHtml,
            },
          });
        },
      });
      startImageDrag(e, imgElement);
      return;
    }

    if (instructionsEl && paper) {
      const imgs = Array.from(instructionsEl.querySelectorAll('img'));
      const imgIndex = Math.max(0, imgs.indexOf(imgElement));
      setEditingImage({
        imgElement,
        imgIndex,
        originalHtml: paper.instructions || '',
        originalWidth: imgElement.getBoundingClientRect().width,
        contextSelector: '#printable-paper .paper-instructions-body',
        onApply: async (newHtml) => {
          await updateQuestionPaper(paper.id, { instructions: newHtml });
        },
      });
      startImageDrag(e, imgElement);
    }
  }, [questions, paper, updateQuestion, updateQuestionPaper]);

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
      fetchSharedQuestions();
      fetchLookups();
    }
  }, [id, fetchPaperQuestions, fetchQuestions, fetchSharedQuestions, fetchLookups]);

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
    void renderMath();
  });



  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleMoveTopLevelQuestion = async (pqId: string, direction: 'up' | 'down') => {
    if (!id) return;
    const topLevelPQs = paperQuestionsList.filter(pq => !pq.parentId);
    const currentIndex = topLevelPQs.findIndex(pq => pq.id === pqId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= topLevelPQs.length) return;

    // Helper to get all descendant IDs of a question
    const getSubtree = (parentId: string): PaperQuestion[] => {
      const parent = paperQuestionsList.find(p => p.id === parentId);
      if (!parent) return [];
      const children = paperQuestionsList.filter(p => p.parentId === parentId);
      return [parent, ...children.flatMap(c => getSubtree(c.id))];
    };

    // Swap top-level questions in the topLevel array
    const newTopLevel = arrayMove(topLevelPQs, currentIndex, targetIndex);

    // Reconstruct full list preserving each question's entire subtree
    const reconstructedList: PaperQuestion[] = [];
    for (const top of newTopLevel) {
      reconstructedList.push(...getSubtree(top.id));
    }

    // Append any stray questions if any
    for (const pq of paperQuestionsList) {
      if (!reconstructedList.some(item => item.id === pq.id)) {
        reconstructedList.push(pq);
      }
    }

    await reorderPaperQuestions(id, reconstructedList);
  };

  const handleMoveSubQuestion = async (subPQId: string, direction: 'up' | 'down') => {
    if (!id) return;
    const targetPQ = paperQuestionsList.find(pq => pq.id === subPQId);
    if (!targetPQ || !targetPQ.parentId) return;

    // Find all sibling subquestions under the same parent
    const siblings = paperQuestionsList.filter(pq => pq.parentId === targetPQ.parentId);
    const currentIndex = siblings.findIndex(pq => pq.id === subPQId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const swappedSiblings = arrayMove(siblings, currentIndex, targetIndex);

    // Replace the siblings in paperQuestionsList while keeping everything else untouched
    const siblingIds = new Set(siblings.map(s => s.id));
    const siblingQueue = [...swappedSiblings];
    const newList = paperQuestionsList.map(pq => {
      if (siblingIds.has(pq.id)) {
        return siblingQueue.shift()!;
      }
      return pq;
    });

    await reorderPaperQuestions(id, newList);
  };

  const handleSaveSectionEdit = async (oldName: string, newName: string, description: string) => {
    if (!paper) return;
    const trimmedNew = newName.trim();
    if (!trimmedNew) return;

    // Update section name in paper_questions if renamed
    if (oldName !== trimmedNew) {
      const pqsToUpdate = paperQuestionsList.filter(pq => pq.section === oldName);
      for (const pq of pqsToUpdate) {
        await updatePaperQuestion(pq.id, { section: trimmedNew });
      }
    }

    // Update descriptions in headerConfig
    const existingDescs = { ...(paper.headerConfig?.sectionDescriptions || {}) };
    if (oldName !== trimmedNew) {
      delete existingDescs[oldName];
    }
    existingDescs[trimmedNew] = description;

    // Also update customSections list if needed
    let customSections = [...(paper.headerConfig?.customSections || [])];
    if (oldName !== trimmedNew) {
      customSections = customSections.map(s => s === oldName ? trimmedNew : s);
      if (!customSections.includes(trimmedNew)) {
        customSections.push(trimmedNew);
      }
    }

    await handleUpdateHeaderConfig({
      sectionDescriptions: existingDescs,
      customSections,
    });

    showToastMessage('Section updated');
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
    setDraftCourseId(paper?.courseId || '');
    setDraftSubjectId(paper?.subjectId || '');
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
        cognitiveLevel: 'understand',
        subNumberingStyle: undefined,
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

  const handleCancelDraft = () => {
    setDraftType(null);
    setDraftContent('');
    setDraftOptions(['', '', '', '']);
    setDraftSubquestions([]);
    setEditingQuestionId(null);
    setEditingPQId(null);
    setQParentId('');
    setDraftMarks(1);
    setDraftIsOptional(false);
    setDraftCourseId(paper?.courseId || '');
    setDraftSubjectId(paper?.subjectId || '');
    setDraftCognitiveLevel(DEFAULT_COGNITIVE_LEVEL);
    setDraftChapterId('');
    setDraftTopicId('');
    setDraftCategoryId('');
    setDraftSubNumberingStyle('');
    setIsAddingChapter(false);
    setIsAddingTopic(false);
    setIsAddingCategory(false);
    setActiveView('tree');
  };

  const handleAddDraftToPaper = async () => {
    if (!id || !draftType || !draftContent.trim()) return;

    if (paper?.maxMarks && !draftIsOptional) {
      let proposedTotal = totalMarks;
      if (editingQuestionId && editingPQId) {
        const oldPQ = paperQuestionsList.find(pq => pq.id === editingPQId);
        if (oldPQ && !oldPQ.parentId && !oldPQ.isOptional) {
          proposedTotal = proposedTotal - oldPQ.marks + (draftType === 'text' ? 0 : draftMarks);
        }
      } else {
        if (!qParentId) {
          proposedTotal += (draftType === 'text' ? 0 : draftMarks);
        }
      }
      if (proposedTotal > paper.maxMarks) {
        window.alert(`Error: Total marks (${proposedTotal}) cannot exceed the maximum marks provided in the paper settings (${paper.maxMarks}).`);
        return;
      }
    }

    setSaving(true);
    if (editingImage) {
      setEditingImage(null);
    }
    try {
      const options = draftType === 'mcq' ? draftOptions.filter(o => o.trim()) : [];
      let currentParentId = qParentId || undefined;
      const finalMarks = draftType === 'text' ? 0 : draftMarks;
      const cleanedDraftContent = cleanImageHtml(draftContent.trim());

      const resolvedCourseId = draftCourseId || paper?.courseId;
      const resolvedSubjectId = draftSubjectId || paper?.subjectId;

      const meta: QuestionMeta = {
        courseId: resolvedCourseId,
        subjectId: resolvedSubjectId,
        classId: paper?.classId,
        chapterId: draftChapterId || undefined,
        topicId: draftTopicId || undefined,
        categoryId: draftCategoryId || undefined,
        cognitiveLevel: draftCognitiveLevel,
      };

      // If we are editing an existing question, update it instead of creating a new one
      if (editingQuestionId && editingPQId) {
        await updateQuestion(editingQuestionId, {
          content: cleanedDraftContent,
          questionType: draftType,
          options: options.length > 0 ? options : [],
          difficulty: draftDifficulty,
          typeHeader: draftTypeHeader || undefined,
          courseId: resolvedCourseId,
          subjectId: resolvedSubjectId,
          classId: paper?.classId,
          chapterId: draftChapterId || undefined,
          topicId: draftTopicId || undefined,
          categoryId: draftCategoryId || undefined,
          cognitiveLevel: draftCognitiveLevel,
          subNumberingStyle: draftSubNumberingStyle || undefined,
        });
        await updatePaperQuestion(editingPQId, {
          marks: finalMarks,
          section: draftSection,
          parentId: currentParentId || null,
          isOptional: draftIsOptional,
          chapterId: draftChapterId || undefined,
          topicId: draftTopicId || undefined,
          categoryId: draftCategoryId || undefined,
          cognitiveLevel: draftCognitiveLevel,
          subNumberingStyle: draftSubNumberingStyle || undefined,
        });
        currentParentId = editingPQId;
      } else {
        // Creating a new question
        const result = await createAndAddQuestion(
          id,
          cleanedDraftContent,
          draftType,
          options.length > 0 ? options : undefined,
          draftSection,
          currentParentId,
          finalMarks,
          resolvedCourseId,
          resolvedSubjectId,
          paper?.classId,
          draftDifficulty,
          undefined,
          undefined,
          draftTypeHeader || undefined,
          draftIsOptional,
          undefined,
          'ORIGINAL',
          meta,
          draftSubNumberingStyle || undefined
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
        const cleanedSqContent = cleanImageHtml(sq.content.trim());
        if (!cleanedSqContent) continue;
        const sqOptions = sq.type === 'mcq' ? sq.options.filter(o => o.trim()) : [];
        const sqMarks = sq.type === 'text' ? 0 : sq.marks;
        if (sq.questionId && sq.pqId) {
          // Update existing
          await updateQuestion(sq.questionId, {
            content: cleanedSqContent,
            questionType: sq.type,
            options: sqOptions.length > 0 ? sqOptions : [],
            difficulty: sq.difficulty,
            cognitiveLevel: sq.cognitiveLevel || 'understand',
            subNumberingStyle: sq.subNumberingStyle || undefined,
          });
          await updatePaperQuestion(sq.pqId, {
            marks: sqMarks,
            isOptional: sq.isOptional || false,
            cognitiveLevel: sq.cognitiveLevel || 'understand',
            subNumberingStyle: sq.subNumberingStyle || undefined,
          });
        } else {
          // Create new
          const sqMeta: QuestionMeta = {
            courseId: resolvedCourseId,
            subjectId: resolvedSubjectId,
            classId: paper?.classId,
            chapterId: draftChapterId || undefined,
            topicId: draftTopicId || undefined,
            categoryId: draftCategoryId || undefined,
            cognitiveLevel: sq.cognitiveLevel || 'understand',
          };
          await createAndAddQuestion(
            id,
            cleanedSqContent,
            sq.type,
            sqOptions.length > 0 ? sqOptions : undefined,
            draftSection,
            currentParentId,
            sqMarks,
            resolvedCourseId,
            resolvedSubjectId,
            paper?.classId,
            sq.difficulty,
            undefined,
            undefined,
            undefined,
            sq.isOptional || false,
            undefined,
            'ORIGINAL',
            sqMeta,
            sq.subNumberingStyle || undefined
          );
        }
      }

      showToastMessage(editingQuestionId ? 'Question updated!' : 'Question added!');
      setDraftType(null);
      setDraftContent('');
      setDraftOptions(['', '', '', '']);
      setDraftSubquestions([]);
      setDraftIsOptional(false);
      setDraftCognitiveLevel(DEFAULT_COGNITIVE_LEVEL);
      setDraftChapterId('');
      setDraftTopicId('');
      setDraftCategoryId('');
      setDraftSubNumberingStyle('');
      setEditingQuestionId(null);
      setEditingPQId(null);
      setQParentId('');
      setActiveView('tree');
      setIsConstructorOpen(false);
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

  const handleCopyQuestion = async (pqId: string) => {
    if (!id) return;
    const targetPQ = paperQuestionsList.find(pq => pq.id === pqId);
    if (!targetPQ) return;

    const collectSubtreeIds = (rootId: string): string[] => {
      const children = paperQuestionsList.filter(pq => pq.parentId === rootId);
      const ids = [rootId];
      for (const child of children) {
        ids.push(...collectSubtreeIds(child.id));
      }
      return ids;
    };

    const originalSubtreeIds = collectSubtreeIds(pqId);
    const createdPQIds: string[] = [];

    const cloneNode = async (sourcePQ: PaperQuestion, newParentId?: string): Promise<string | null> => {
      const sourceQ = questions.find(q => q.id === sourcePQ.questionId);
      if (!sourceQ) return null;

      const meta: QuestionMeta = {
        courseId: sourceQ.courseId || paper?.courseId,
        subjectId: sourceQ.subjectId || paper?.subjectId,
        classId: sourceQ.classId || paper?.classId,
        chapterId: sourcePQ.chapterId || sourceQ.chapterId,
        topicId: sourcePQ.topicId || sourceQ.topicId,
        categoryId: sourcePQ.categoryId || sourceQ.categoryId,
        cognitiveLevel: sourcePQ.cognitiveLevel || sourceQ.cognitiveLevel || DEFAULT_COGNITIVE_LEVEL,
      };

      const newPQId = await createAndAddQuestion(
        id,
        sourceQ.content,
        sourceQ.questionType,
        sourceQ.options && sourceQ.options.length > 0 ? [...sourceQ.options] : undefined,
        sourcePQ.section,
        newParentId,
        sourcePQ.marks,
        meta.courseId,
        meta.subjectId,
        meta.classId,
        sourceQ.difficulty || 'medium',
        undefined,
        undefined,
        sourceQ.typeHeader,
        sourcePQ.isOptional || false,
        undefined,
        'ORIGINAL',
        meta,
        sourcePQ.subNumberingStyle || sourceQ.subNumberingStyle
      );

      if (newPQId) {
        createdPQIds.push(newPQId);
        const childPQs = paperQuestionsList.filter(pq => pq.parentId === sourcePQ.id);
        for (const childPQ of childPQs) {
          await cloneNode(childPQ, newPQId);
        }
      }
      return newPQId;
    };

    await cloneNode(targetPQ, targetPQ.parentId || undefined);

    if (createdPQIds.length > 0) {
      const currentPaperPQs = [
        ...(useStore.getState().paperQuestions.get(id) || []),
      ];

      const createdSet = new Set(createdPQIds);
      const withoutCreated = currentPaperPQs.filter(pq => !createdSet.has(pq.id));
      const createdNodes = createdPQIds
        .map(cid => currentPaperPQs.find(pq => pq.id === cid))
        .filter((pq): pq is PaperQuestion => Boolean(pq));

      const lastOrigId = originalSubtreeIds[originalSubtreeIds.length - 1];
      const insertAfterIdx = withoutCreated.findIndex(pq => pq.id === lastOrigId);
      if (insertAfterIdx !== -1) {
        const reordered = [
          ...withoutCreated.slice(0, insertAfterIdx + 1),
          ...createdNodes,
          ...withoutCreated.slice(insertAfterIdx + 1),
        ];
        await reorderPaperQuestions(id, reordered);
      }
      showToastMessage('Question copied!');
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
    setDraftIsOptional(pq.isOptional || false);
    setDraftCourseId(q.courseId || paper?.courseId || '');
    setDraftSubjectId(q.subjectId || paper?.subjectId || '');
    setDraftCognitiveLevel(q.cognitiveLevel || pq.cognitiveLevel || DEFAULT_COGNITIVE_LEVEL);
    setDraftChapterId(q.chapterId || pq.chapterId || '');
    setDraftTopicId(q.topicId || pq.topicId || '');
    setDraftCategoryId(q.categoryId || pq.categoryId || '');
    setDraftSubNumberingStyle(pq.subNumberingStyle || q.subNumberingStyle || '');

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
        isOptional: childPq.isOptional || false,
        isExpanded: false,
        cognitiveLevel: childQ?.cognitiveLevel || childPq.cognitiveLevel || 'understand',
        subNumberingStyle: childPq.subNumberingStyle || childQ?.subNumberingStyle,
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
    return paperQuestionsList
      .filter(pq => !pq.parentId && !pq.isOptional)
      .reduce((sum, pq) => sum + (pq.marks || 0), 0);
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
    showToastMessage('Generating PDF...');

    let clonedCache: Node | null = null;
    const paperElement = document.getElementById('printable-paper');
    const editorCanvas = paperElement?.closest('.editor-canvas') as HTMLElement | null;
    const prevScrollTop = editorCanvas ? editorCanvas.scrollTop : 0;

    try {
      if (!paperElement) throw new Error('Paper container not found');

      // Scroll editor canvas to top for accurate coordinate capturing
      if (editorCanvas) {
        editorCanvas.scrollTop = 0;
      }

      // 1. Typeset MathJax formulas first
      await renderMath();
      await new Promise(r => setTimeout(r, 120));

      // 2. Ensure all images inside paper are completely loaded
      const imgElements = Array.from(paperElement.querySelectorAll('img'));
      await Promise.all(
        imgElements.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        })
      );

      // Temporarily add preview active class
      paperElement.classList.add('preview-active');

      // If a global SVG cache exists, clone into paperElement so all math SVGs resolve during html2canvas cloning
      const globalSvgCache = document.getElementById('MJX-SVG-global-cache');
      if (globalSvgCache && !paperElement.querySelector('#MJX-SVG-global-cache')) {
        clonedCache = globalSvgCache.cloneNode(true);
        paperElement.appendChild(clonedCache);
      }

      // 3. Render high-resolution canvas (scale 2.5 gives vector-grade crispness without excessive memory)
      const canvas = await html2canvas(paperElement, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: paperElement.scrollWidth,
        height: paperElement.scrollHeight,
        windowWidth: paperElement.scrollWidth,
        windowHeight: paperElement.scrollHeight,
        scrollY: 0,
        scrollX: 0
      });

      // 4. A4 dimensions in mm: 210 x 297 with tight 4mm margin (reduced from 8mm to eliminate dead borders)
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfPageWidth = 210;
      const pdfPageHeight = 297;
      const margin = 4; // 4mm margin
      const contentWidth = pdfPageWidth - (margin * 2); // 202mm
      const contentHeight = pdfPageHeight - (margin * 2); // 289mm

      // Height of one content page in canvas pixels
      const pageCanvasHeight = (canvas.width * contentHeight) / contentWidth;

      // 5. Smart page cut calculation: query atomic unbreakable blocks to prevent cutting questions, tables, text & images
      const paperRect = paperElement.getBoundingClientRect();
      const paperHeight = paperElement.scrollHeight || paperRect.height;
      const scaleY = canvas.height / paperHeight;

      interface Box {
        top: number;
        bottom: number;
        height: number;
      }

      // Priority 1: Top-level questions. Keeping whole questions intact is the primary goal for exam papers.
      const questionElements = Array.from(
        paperElement.querySelectorAll<HTMLElement>('.rendered-question-item')
      );

      const questionBoxes: Box[] = questionElements
        .map(el => {
          const rect = el.getBoundingClientRect();
          const top = (rect.top - paperRect.top) * scaleY;
          const bottom = (rect.bottom - paperRect.top) * scaleY;
          return { top, bottom, height: bottom - top };
        })
        .filter(b => b.height > 4);

      questionBoxes.sort((a, b) => a.top - b.top);

      // Priority 2: Atomic elements inside questions that MUST NEVER be sliced across (tables, images, options, etc.)
      const tableElements = Array.from(paperElement.querySelectorAll<HTMLElement>('table'));
      const innerAtomicElements = Array.from(
        paperElement.querySelectorAll<HTMLElement>(
          'img, .section-divider, .q-options, .q-row, p, li, blockquote'
        )
      );

      const innerBoxes: Box[] = [];

      for (const table of tableElements) {
        const rect = table.getBoundingClientRect();
        const top = (rect.top - paperRect.top) * scaleY;
        const bottom = (rect.bottom - paperRect.top) * scaleY;
        const height = bottom - top;

        // Any table that fits on a single page (< 90% of page height) is strictly UNBREAKABLE
        if (height < pageCanvasHeight * 0.90) {
          innerBoxes.push({ top, bottom, height });
        } else {
          // Extremely tall multi-page table fallback: keep individual rows intact
          const rows = Array.from(table.querySelectorAll<HTMLElement>('tr'));
          for (const row of rows) {
            const rRect = row.getBoundingClientRect();
            const rTop = (rRect.top - paperRect.top) * scaleY;
            const rBottom = (rRect.bottom - paperRect.top) * scaleY;
            innerBoxes.push({ top: rTop, bottom: rBottom, height: rBottom - rTop });
          }
        }
      }

      for (const el of innerAtomicElements) {
        // Skip elements inside normal tables (since the table itself is already treated as an atomic block)
        const parentTable = el.closest('table');
        if (parentTable) {
          const tRect = parentTable.getBoundingClientRect();
          const tHeight = (tRect.bottom - tRect.top) * scaleY;
          if (tHeight < pageCanvasHeight * 0.90) continue;
        }

        const rect = el.getBoundingClientRect();
        const top = (rect.top - paperRect.top) * scaleY;
        const bottom = (rect.bottom - paperRect.top) * scaleY;
        const height = bottom - top;

        if (height > 4 && height < pageCanvasHeight * 0.90) {
          innerBoxes.push({ top, bottom, height });
        }
      }

      innerBoxes.sort((a, b) => a.top - b.top);

      let currentCanvasY = 0;
      let pageIndex = 0;

      while (currentCanvasY < canvas.height - 4) {
        if (pageIndex > 0) pdf.addPage();
        pageIndex++;

        const remainingCanvasHeight = canvas.height - currentCanvasY;

        // If remaining content fits on this page, output and finish
        if (remainingCanvasHeight <= pageCanvasHeight + 4) {
          const sliceHeight = remainingCanvasHeight;
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeight;
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, sliceHeight);
            ctx.drawImage(
              canvas,
              0, currentCanvasY, canvas.width, sliceHeight,
              0, 0, pageCanvas.width, sliceHeight
            );

            // Lossless PNG for crisp, artifact-free text & math rendering
            const pageImgData = pageCanvas.toDataURL('image/png');
            const renderHeight = (sliceHeight * contentWidth) / canvas.width;
            pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, renderHeight);
          }
          break;
        }

        // Nominal end of this page
        const nominalCutY = currentCanvasY + pageCanvasHeight;
        let bestCutY = nominalCutY;

        // Step A: Priority 1 - Question-level pagination
        // If a question straddles the page boundary, move the whole question to the next page,
        // provided it fits on a single page and the current page already has preceding content.
        let questionCutFound = false;
        for (const qBox of questionBoxes) {
          if (qBox.top < nominalCutY - 4 && qBox.bottom > nominalCutY + 4) {
            const fitsOnOnePage = qBox.height < pageCanvasHeight * 0.95;
            const hasPriorContentOnPage = qBox.top > currentCanvasY + Math.min(80, pageCanvasHeight * 0.10);

            if (fitsOnOnePage && hasPriorContentOnPage) {
              bestCutY = Math.floor(qBox.top) - 1;
              questionCutFound = true;
              break;
            }
          }
        }

        // Step B: Priority 2 - If question-level cut wasn't applied (e.g. question is huge, or starts at page top),
        // find a clean cut between internal atomic elements (e.g. before a table, image, subquestion, or paragraph)
        // so that tables, images, and text lines are never sliced in half.
        if (!questionCutFound) {
          let foundIntersecting = true;
          let iterations = 0;

          while (foundIntersecting && iterations < 15) {
            iterations++;
            foundIntersecting = false;

            for (const box of innerBoxes) {
              // Check if box is split by current bestCutY
              if (box.top < bestCutY - 2 && box.bottom > bestCutY + 2) {
                // As long as pushing this element doesn't empty the page:
                if (box.top > currentCanvasY + 40) {
                  bestCutY = Math.floor(box.top) - 1;
                  foundIntersecting = true;
                  break;
                }
              }
            }
          }
        }

        // Safety fallback if no valid split point was found or cut is pushed too close to top
        if (bestCutY <= currentCanvasY + 40) {
          bestCutY = nominalCutY;
        }

        const sliceHeight = bestCutY - currentCanvasY;
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, sliceHeight);
          ctx.drawImage(
            canvas,
            0, currentCanvasY, canvas.width, sliceHeight,
            0, 0, pageCanvas.width, sliceHeight
          );

          // Lossless PNG for sharp text and math formulas
          const pageImgData = pageCanvas.toDataURL('image/png');
          const renderHeight = (sliceHeight * contentWidth) / canvas.width;
          pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, renderHeight);
        }

        currentCanvasY = bestCutY;
      }

      pdf.save(`${paper?.title || 'question-paper'}.pdf`);
      showToastMessage('PDF generated successfully!');
    } catch (err) {
      console.error('Print Error:', err);
      showToastMessage('Failed to generate PDF');
    } finally {
      if (editorCanvas) {
        editorCanvas.scrollTop = prevScrollTop;
      }
      if (clonedCache && paperElement && clonedCache.parentNode === paperElement) {
        paperElement.removeChild(clonedCache);
      }
      paperElement?.classList.remove('preview-active');
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
    const renderedSectionsInCurrentRange = new Set<string>();

    return topLevel.map((pq, idx) => {
      const q = getQuestion(pq.questionId);
      if (!q) return null;

      let showSectionHeader: string | undefined;

      // Ensure each section header only displays once per contiguous/first occurrence on canvas
      if (pq.section && !renderedSectionsInCurrentRange.has(pq.section)) {
        renderedSectionsInCurrentRange.add(pq.section);
        showSectionHeader = pq.section;
      }

      // Question number calculation: skip counting questions of type 'text' (passages/scenarios)
      let questionNumber = 1;
      if (paper?.headerConfig?.continuousNumbering) {
        questionNumber = topLevel
          .slice(0, idx + 1)
          .filter(p => {
            const currQ = getQuestion(p.questionId);
            return currQ && currQ.questionType !== 'text';
          }).length;
      } else {
        const currentSectionTopLevels = topLevel.slice(0, idx + 1).filter(p => p.section === pq.section);
        questionNumber = currentSectionTopLevels.filter(p => {
          const currQ = getQuestion(p.questionId);
          return currQ && currQ.questionType !== 'text';
        }).length;
      }

      const secIdx = showSectionHeader ? distinctSections.indexOf(showSectionHeader) : -1;
      const sectionNumber = secIdx !== -1 ? secIdx + 1 : 1;
      const sectionMarks = showSectionHeader ? (sectionTotalMarks[showSectionHeader] || 0) : 0;
      const canMoveSectionUp = secIdx > 0;
      const canMoveSectionDown = secIdx !== -1 && secIdx < distinctSections.length - 1;
      const sectionDescription = showSectionHeader && paper?.headerConfig?.sectionDescriptions
        ? paper.headerConfig.sectionDescriptions[showSectionHeader]
        : undefined;

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
          sectionDescription={sectionDescription}
          onEditSection={(sec) => {
            const desc = paper?.headerConfig?.sectionDescriptions?.[sec] || '';
            setEditingSection({ oldName: sec, name: sec, description: desc });
          }}
          canMoveSectionUp={canMoveSectionUp}
          canMoveSectionDown={canMoveSectionDown}
          onMoveSectionUp={(sec) => handleMoveSection(sec, 'up')}
          onMoveSectionDown={(sec) => handleMoveSection(sec, 'down')}
          canMoveUp={idx > 0}
          canMoveDown={idx < topLevel.length - 1}
          onMoveUp={() => handleMoveTopLevelQuestion(pq.id, 'up')}
          onMoveDown={() => handleMoveTopLevelQuestion(pq.id, 'down')}
          onAddSubQuestion={() => handleAddSubQuestion(pq)}
          onSelect={() => { setSelectedPQId(pq.id); setDraftType(null); }}
          onRemove={() => handleRemovePQ(pq.id, pq.questionId)}
          onEdit={() => { handleEditQuestion(pq.id); setIsConstructorOpen(true); setActiveView('add-question'); }}
          onCopy={() => { void handleCopyQuestion(pq.id); }}
          subQuestions={subs}
          onEditSubQuestion={(pqId) => { handleEditQuestion(pqId); setIsConstructorOpen(true); setActiveView('add-question'); }}
          onCopySubQuestion={(pqId) => { void handleCopyQuestion(pqId); }}
          onRemoveSubQuestion={(pqId, qId) => handleRemovePQ(pqId, qId)}
          onMoveSubQuestionUp={(pqId) => handleMoveSubQuestion(pqId, 'up')}
          onMoveSubQuestionDown={(pqId) => handleMoveSubQuestion(pqId, 'down')}
          onAddSubSubQuestion={(pq) => handleAddSubQuestion(pq)}
          subQuestionNumberingStyle={paper?.headerConfig?.subQuestionNumberingStyle || 'letters_paren'}
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

      {(!paper.headerConfig?.visibleHeaderFields || paper.headerConfig.visibleHeaderFields.schoolName !== false) && (
        <h1 className="paper-school-name">{user?.schoolName || 'Institution Name'}</h1>
      )}
      {(!paper.headerConfig?.visibleHeaderFields || paper.headerConfig.visibleHeaderFields.examTitle !== false) && (
        <h2 className="paper-exam-title">{paper.title}</h2>
      )}
      <div className="paper-info">
        {(!paper.headerConfig?.visibleHeaderFields || paper.headerConfig.visibleHeaderFields.course !== false) && (
          <span>Course: {getCourse(paper.courseId)?.name || '-'}</span>
        )}
        {(!paper.headerConfig?.visibleHeaderFields || paper.headerConfig.visibleHeaderFields.subject !== false) && (
          <span>Subject: {getSubject(paper.subjectId)?.name || '-'}</span>
        )}
        {(!paper.headerConfig?.visibleHeaderFields || paper.headerConfig.visibleHeaderFields.gradeClass !== false) && (
          <span>Class: {getClass(paper.classId)?.name || '-'}</span>
        )}
        {(!paper.headerConfig?.visibleHeaderFields || paper.headerConfig.visibleHeaderFields.date !== false) && paper.date && (
          <span>Date: {new Date(paper.date).toLocaleDateString()}</span>
        )}
        {(!paper.headerConfig?.visibleHeaderFields || paper.headerConfig.visibleHeaderFields.duration !== false) && paper.duration && (
          <span>Duration: {paper.duration} min</span>
        )}
        {(!paper.headerConfig?.visibleHeaderFields || paper.headerConfig.visibleHeaderFields.totalMarks !== false) && (
          <span>Total Marks: {totalMarks}</span>
        )}
      </div>
      {(!paper.headerConfig?.visibleHeaderFields || paper.headerConfig.visibleHeaderFields.instructions !== false) && paper.instructions && (
        <div className="paper-instructions">
          <strong>Instructions:</strong>
          <div className="paper-instructions-body" dangerouslySetInnerHTML={{ __html: paper.instructions }} />
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
          <button
            className={`toolbar-btn-outlined ${isQuestionBankOpen ? 'active' : ''}`}
            onClick={() => setIsQuestionBankOpen(!isQuestionBankOpen)}
            title="Shared & My Questions Bank"
          >
            <BookOpen size={14} /> Question Bank
          </button>

          <button
            className={`toolbar-btn-outlined ${showPaperSettings ? 'active' : ''}`}
            onClick={() => setShowPaperSettings(!showPaperSettings)}
            title="Paper Settings"
          >
            <Settings size={14} /> Paper Settings
          </button>
          <button
            className={`toolbar-btn-outlined ${isConstructorOpen ? 'active' : ''}`}
            onClick={() => { setIsConstructorOpen(true); setActiveView('tree'); }}
          >
            <Layers size={14} /> Edit/View Questions
          </button>
          <button className="toolbar-btn-outlined" onClick={exportPDF} disabled={isExporting} title="Export as PDF">
            {isExporting ? <Loader2 size={14} className="spin" /> : <Printer size={14} />}
            {isExporting ? 'Generating...' : 'Export PDF'}
          </button>
        </div>
      </div>

      <style>
        {`
          #printable-paper {
            --font-serif: ${paper.headerConfig?.fontFamily || "'Noto Serif', serif"};
            --spacing-section-top: ${paper.headerConfig?.spacing?.sectionTop ?? 14}px;
            --spacing-section-desc-gap: ${paper.headerConfig?.spacing?.sectionDescGap ?? 2}px;
            --spacing-section-bottom: ${paper.headerConfig?.spacing?.sectionBottom ?? 8}px;
            --spacing-question-gap: ${paper.headerConfig?.spacing?.questionGap ?? 14}px;
            --spacing-subq-gap: ${paper.headerConfig?.spacing?.subQuestionGap ?? 8}px;
            --paper-line-height: ${Math.min(2.4, Math.max(1.2, paper.headerConfig?.spacing?.lineHeight ?? 1.45))};
          }
          
          #printable-paper .clean-question, #printable-paper .q-number {
            font-size: ${paper.headerConfig?.bodyFontSize || paper.headerConfig?.fontSize || 14}px !important;
            line-height: var(--paper-line-height) !important;
          }
          #printable-paper .clean-question * {
            line-height: inherit;
          }
          #printable-paper .q-text, #printable-paper .q-text p, #printable-paper .q-text div {
            line-height: var(--paper-line-height) !important;
          }
          #printable-paper .marks-inline, #printable-paper .q-options {
            font-size: ${Math.max(10, (paper.headerConfig?.bodyFontSize || paper.headerConfig?.fontSize || 14) - 1)}px !important;
            line-height: var(--paper-line-height) !important;
          }
          #printable-paper .section-title {
            font-size: ${paper.headerConfig?.sectionTitleFontSize || (paper.headerConfig?.fontSize ? paper.headerConfig.fontSize + 2 : 16)}px !important;
          }
          #printable-paper .paper-school-name {
            font-size: ${paper.headerConfig?.schoolNameFontSize || (paper.headerConfig?.fontSize ? paper.headerConfig.fontSize + 10 : 24)}px !important;
          }
          #printable-paper .paper-exam-title {
            font-size: ${paper.headerConfig?.titleFontSize || (paper.headerConfig?.fontSize ? paper.headerConfig.fontSize + 2 : 16)}px !important;
          }
          #printable-paper .paper-info {
            font-size: ${paper.headerConfig?.infoFontSize || Math.max(10, (paper.headerConfig?.fontSize || 14) - 1)}px !important;
          }
          #printable-paper .paper-instructions {
            font-size: ${paper.headerConfig?.instructionsFontSize || Math.max(10, (paper.headerConfig?.fontSize || 14) - 1)}px !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
            box-sizing: border-box !important;
            max-width: 100% !important;
          }
          #printable-paper .section-divider {
            margin-top: var(--spacing-section-top) !important;
            margin-bottom: var(--spacing-section-bottom) !important;
            gap: var(--spacing-section-desc-gap) !important;
          }
          #printable-paper .section-divider > span, #printable-paper .section-divider-top > span {
            font-size: ${paper.headerConfig?.sectionTitleFontSize || (paper.headerConfig?.fontSize ? paper.headerConfig.fontSize + 1 : 15)}px !important;
          }
          #printable-paper .section-description-text {
            padding-top: var(--spacing-section-desc-gap) !important;
            padding-bottom: 2px !important;
            line-height: var(--paper-line-height) !important;
          }
          #printable-paper .rendered-question-item {
            margin-bottom: var(--spacing-question-gap) !important;
          }
          #printable-paper .q-row {
            margin-top: var(--spacing-subq-gap) !important;
          }
        `}
      </style>

      {/* PAPER DETAILS & PRINT RIBBON BAR */}
      <div className="paper-ribbon-bar">
        <div className="paper-ribbon-title">
          <Eye size={13} />
          <span>Show on Print:</span>
        </div>
        <div className="paper-ribbon-items">
          {HEADER_FIELD_CONFIG.map(({ key, label }) => {
            const isVisible = paper.headerConfig?.visibleHeaderFields?.[key] !== false;
            return (
              <button
                key={key}
                type="button"
                className={`ribbon-chip ${isVisible ? 'active' : ''}`}
                onClick={() => {
                  handleUpdateHeaderConfig({
                    visibleHeaderFields: {
                      ...(paper.headerConfig?.visibleHeaderFields || {}),
                      [key]: !isVisible,
                    },
                  });
                }}
                title={`${isVisible ? 'Hide' : 'Show'} ${label} on print/PDF`}
              >
                <span className="ribbon-chip-icon">
                  {isVisible ? <Check size={10} strokeWidth={2.8} /> : <span className="ribbon-chip-dot" />}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* QUESTION BANK DRAWER - SLIDES FROM LEFT (NO BLUR OVERLAY, REAL-TIME VISIBILITY) */}
      {isQuestionBankOpen && (
        <div className="drawer-panel drawer-left" onClick={(e) => e.stopPropagation()}>
          <QuestionBankSidebar
            isOpen={isQuestionBankOpen}
            onClose={() => setIsQuestionBankOpen(false)}
            sharedQuestions={sharedQuestions}
            myQuestions={questions}
            paperSubjectName={getSubject(paper.subjectId)?.name}
            paperClassName={getClass(paper.classId)?.name}
            sections={sections}
            onInsertSharedQuestion={async (sq, targetSec, parentQId, isOpt) => {
              const sec = targetSec || draftSection || sections[0]?.title || 'Section A';
              await importSharedQuestionToPaper(paper.id, sq, sec, 1, parentQId, isOpt);
              showToastMessage(parentQId ? 'Added as subquestion!' : 'Question added to paper!');
            }}
            onInsertMyQuestion={async (mq, targetSec, parentQId, isOpt) => {
              const sec = targetSec || draftSection || sections[0]?.title || 'Section A';
              await createAndAddQuestion(
                paper.id,
                mq.content,
                mq.questionType,
                mq.options,
                sec,
                parentQId,
                1,
                undefined,
                paper.subjectId,
                paper.classId,
                mq.difficulty || 'medium',
                undefined,
                undefined,
                undefined,
                isOpt
              );
              showToastMessage(parentQId ? 'Added as subquestion!' : 'Question added to paper!');
            }}
            onInsertQuestionSet={async (parentQ, selectedSubqIds, isShared) => {
              if (!paper) return;
              const sec = draftSection || sections[0]?.title || 'Section A';
              const subqs = parentQ.subquestions || [];
              const selectedSubqs = subqs.filter(sq => selectedSubqIds.includes(sq.id));
              const totalSelectedMarks = selectedSubqs.reduce((acc, s) => acc + (s.marks || 1), 0);

              let parentPqId = '';
              if (isShared) {
                parentPqId = await importSharedQuestionToPaper(
                  paper.id,
                  { ...(parentQ as any), marks: totalSelectedMarks },
                  sec,
                  totalSelectedMarks
                );
              } else {
                const myQ = parentQ as Question;
                parentPqId = await createAndAddQuestion(
                  paper.id,
                  myQ.content,
                  myQ.questionType,
                  myQ.options,
                  sec,
                  undefined,
                  totalSelectedMarks,
                  paper.courseId,
                  paper.subjectId,
                  paper.classId,
                  myQ.difficulty || 'medium',
                  myQ.explanation,
                  myQ.imageUrl,
                  myQ.typeHeader,
                  false,
                  undefined,
                  'ORIGINAL',
                  {
                    courseId: myQ.courseId,
                    subjectId: myQ.subjectId,
                    classId: myQ.classId,
                    chapterId: myQ.chapterId,
                    topicId: myQ.topicId,
                    categoryId: myQ.categoryId,
                    cognitiveLevel: myQ.cognitiveLevel,
                  }
                );
              }

              for (const sq of selectedSubqs) {
                await createAndAddQuestion(
                  paper.id,
                  sq.content,
                  sq.questionType || 'subjective',
                  sq.options,
                  sec,
                  parentPqId,
                  sq.marks || 1,
                  paper.courseId,
                  paper.subjectId,
                  paper.classId,
                  sq.difficulty || 'medium',
                  sq.explanation,
                  undefined,
                  undefined,
                  false,
                  undefined,
                  isShared ? 'SHARED' : 'ORIGINAL',
                  {
                    cognitiveLevel: sq.cognitiveLevel,
                  }
                );
              }

              showToastMessage(`Question and ${selectedSubqs.length} subquestions added to paper!`);
            }}
            onInsertStandaloneSubquestion={async (subq, isShared) => {
              if (!paper) return;
              const sec = draftSection || sections[0]?.title || 'Section A';

              await createAndAddQuestion(
                paper.id,
                subq.content,
                subq.questionType || 'subjective',
                subq.options,
                sec,
                undefined,
                subq.marks || 1,
                paper.courseId,
                paper.subjectId,
                paper.classId,
                subq.difficulty || 'medium',
                subq.explanation,
                undefined,
                undefined,
                false,
                undefined,
                isShared ? 'SHARED' : 'ORIGINAL',
                {
                  cognitiveLevel: subq.cognitiveLevel,
                }
              );

              showToastMessage('Question Inserted');
            }}
            onViewQuestion={(q) => setViewingQuestion(q)}
          />
        </div>
      )}

      {/* CENTER - Clean HTML Paper (WYSIWYG) */}
      <div className="editor-canvas">
        <div 
          className="paper-container" 
          ref={paperRef} 
          id="printable-paper"
          onMouseDown={handlePaperImageMouseDown}
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
                      <div className="q-text" dangerouslySetInnerHTML={{ __html: preprocessMathHtml(q.content) }} />
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
          <div className="print-footer">Created using QuestForma</div>
          <div className="print-spacer" />
        </div>

        {/* Inline image drag, alignment, resize & crop overlay (outside printable-paper so it works on paper & in modals without printing) */}
        {editingImage && imageOverlayRect && (
          <div className="hide-on-print">
            {/* Draggable Selection Surface & Border Box */}
            <div
              className="image-drag-surface"
              onMouseDown={(e) => startImageDrag(e)}
              title="Drag to move image"
              style={{
                position: 'fixed',
                top: imageOverlayRect.top,
                left: imageOverlayRect.left,
                width: imageOverlayRect.width,
                height: imageOverlayRect.height,
                border: '2px solid var(--accent, #f97316)',
                cursor: 'grab',
                zIndex: 11200,
                boxSizing: 'border-box',
                borderRadius: 2,
                opacity: (imageOverlayRect.top > imageOverlayRect.clipBottom || imageOverlayRect.top + imageOverlayRect.height < imageOverlayRect.clipTop) ? 0 : 1,
                pointerEvents: (imageOverlayRect.top > imageOverlayRect.clipBottom || imageOverlayRect.top + imageOverlayRect.height < imageOverlayRect.clipTop) ? 'none' : 'auto',
              }}
            />

            {/* Corner resize handles */}
            {['nw', 'ne', 'sw', 'se'].map(corner => {
              const isRight = corner.includes('e');
              const isBottom = corner.includes('s');
              const top = isBottom ? imageOverlayRect.top + imageOverlayRect.height - 5 : imageOverlayRect.top - 5;
              const left = isRight ? imageOverlayRect.left + imageOverlayRect.width - 5 : imageOverlayRect.left - 5;

              if (top < imageOverlayRect.clipTop || top > imageOverlayRect.clipBottom || left < imageOverlayRect.clipLeft || left > imageOverlayRect.clipRight) {
                return null;
              }

              return (
                <div
                  key={corner}
                  className="rnd-handle"
                  onMouseDown={startResize}
                  style={{
                    position: 'fixed',
                    top,
                    left,
                    width: 11,
                    height: 11,
                    background: 'var(--accent, #f97316)',
                    border: '2px solid white',
                    borderRadius: 2,
                    cursor: (corner === 'nw' || corner === 'se') ? 'nwse-resize' : 'nesw-resize',
                    zIndex: 11202,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                />
              );
            })}

            {/* Floating Image Action Toolbar (Drag handle, Left/Center/Right align, Crop) */}
            <div
              className="image-overlay-toolbar crop-btn"
              style={{
                position: 'fixed',
                top: Math.max(imageOverlayRect.clipTop + 6, imageOverlayRect.top - 34 < imageOverlayRect.clipTop ? imageOverlayRect.top + 6 : imageOverlayRect.top - 34),
                left: Math.max(imageOverlayRect.clipLeft + 6, Math.min(imageOverlayRect.clipRight - 220, imageOverlayRect.left)),
                background: 'white',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '3px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 11203,
                opacity: (imageOverlayRect.top > imageOverlayRect.clipBottom || imageOverlayRect.top + imageOverlayRect.height < imageOverlayRect.clipTop) ? 0 : 1,
                pointerEvents: (imageOverlayRect.top > imageOverlayRect.clipBottom || imageOverlayRect.top + imageOverlayRect.height < imageOverlayRect.clipTop) ? 'none' : 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span
                onMouseDown={(e) => startImageDrag(e)}
                title="Drag to reposition image"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#334155',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: '#f1f5f9',
                  cursor: 'grab',
                  userSelect: 'none',
                }}
              >
                <Move size={12} /> Drag
              </span>
              <button
                type="button"
                onClick={() => alignSelectedImage('left')}
                title="Align Image Left"
                style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'transparent', color: '#475569', border: '1px solid #e2e8f0' }}
              >
                Left
              </button>
              <button
                type="button"
                onClick={() => alignSelectedImage('center')}
                title="Center Image"
                style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'transparent', color: '#475569', border: '1px solid #e2e8f0' }}
              >
                Center
              </button>
              <button
                type="button"
                onClick={() => alignSelectedImage('right')}
                title="Align Image Right"
                style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'transparent', color: '#475569', border: '1px solid #e2e8f0' }}
              >
                Right
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowCropModal(true); }}
                title="Crop Image"
                style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }}
              >
                ✂ Crop
              </button>
            </div>
          </div>
        )}

        {/* Crop modal — only shown when user clicks Crop */}
        {showCropModal && editingImage && (
          <div className="modal-overlay" style={{ zIndex: 13000 }}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Crop Image</h3>
                <button className="modal-close-btn" onClick={() => { setShowCropModal(false); setCrop(undefined); setCompletedCrop(undefined); }} title="Close">
                  <X size={18} />
                </button>
              </div>
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
                    await applyImageEdit(croppedSrc, completedCrop.width);
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

      {/* CREATOR HUB MODAL */}
      {showCreatorHub && (
        <div className="modal-overlay">
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
        <div className="modal-overlay">
          <div className="modal question-editor-modal" style={{ maxWidth: '780px', height: '85vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h2 className="modal-title">Test Paper Constructor</h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Configure sections, questions, and nested subquestions
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => { setIsConstructorOpen(false); handleCancelDraft(); }}>
                <X size={18} />
              </button>
            </div>

            {sections.length > 0 && (
              <div style={{ display: 'flex', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className={`btn ${activeView === 'tree' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveView('tree')} style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center' }}>
                  <Layers size={14} style={{ marginRight: 6 }} /> Tree View
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginLeft: 6 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Sub-questions:</span>
                  <select
                    className="property-input"
                    style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
                    value={paper?.headerConfig?.subQuestionNumberingStyle || 'letters_paren'}
                    onChange={(e) => {
                      handleUpdateHeaderConfig({
                        subQuestionNumberingStyle: e.target.value as SubQuestionNumberingStyle,
                      });
                    }}
                    title="Default sub-question numbering format for the paper"
                  >
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

                <div style={{ flex: 1 }} />

                <button className={`btn ${activeView === 'add-question' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => {
                  if (sections.length > 0 && !draftSection) setDraftSection(sections[0].id);
                  if (!draftType) setDraftType('subjective');
                  setEditingQuestionId(null);
                  setEditingPQId(null);
                  setDraftContent('');
                  setDraftOptions(['', '', '', '']);
                  setDraftSubquestions([]);
                  setDraftCourseId(paper?.courseId || '');
                  setDraftSubjectId(paper?.subjectId || '');
                  setDraftCognitiveLevel(DEFAULT_COGNITIVE_LEVEL);
                  setDraftChapterId('');
                  setDraftTopicId('');
                  setDraftCategoryId('');
                  setDraftSubNumberingStyle('');
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
                                        <div className="tree-node-text" dangerouslySetInnerHTML={{ __html: preprocessMathHtml(node.text || '<em>Empty</em>') }} />
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
                                          setDraftCourseId(paper?.courseId || '');
                                          setDraftSubjectId(paper?.subjectId || '');
                                          setDraftCognitiveLevel(DEFAULT_COGNITIVE_LEVEL);
                                          setDraftChapterId('');
                                          setDraftTopicId('');
                                          setDraftCategoryId('');
                                          setActiveView('add-question');
                                        }}>
                                          <GitFork size={12} style={{ transform: 'rotate(90deg)' }} /> Sub
                                        </button>
                                        <div className="tree-act-divider" />
                                        <button className="tree-act-icon" onClick={() => { handleEditQuestion(node.id); setActiveView('add-question'); }} title="Edit">
                                          <Pencil size={13} />
                                        </button>
                                        <button className="tree-act-icon" onClick={() => { void handleCopyQuestion(node.id); }} title="Copy">
                                          <Copy size={13} />
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
                    <button className="btn btn-secondary" onClick={() => setActiveView('tree')}>Cancel</button>
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
                <div style={{ width: '100%' }}>
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

                  <div style={{ display: 'flex', gap: 12, marginBottom: 15, alignItems: 'flex-end' }}>
                    <div className="property-field" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="property-label">Question Type</label>
                      <select className="property-input" value={draftType} onChange={(e) => setDraftType(e.target.value as any)}>
                        <option value="subjective">Subjective</option>
                        <option value="mcq">Multiple Choice</option>
                        <option value="text">Text / Reading Passage (No Marks)</option>
                      </select>
                    </div>
                    {draftType !== 'text' && (
                      <div className="property-field" style={{ flex: 1, marginBottom: 0 }}>
                        <label className="property-label">Marks</label>
                        <input type="number" className="property-input" value={draftMarks} onChange={(e) => setDraftMarks(parseInt(e.target.value) || 1)} min={1} />
                      </div>
                    )}
                    <div className="property-field" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="property-label">Difficulty</label>
                      <select className="property-input" value={draftDifficulty} onChange={(e) => setDraftDifficulty(e.target.value as Difficulty)}>
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

                  {/* QUESTION CLASSIFICATION & TAXONOMY (Requirements 5, 6, 7) */}
                  <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    marginBottom: 15,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                        Question Classification & Taxonomy
                      </span>
                      <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>
                        Course & Subject pre-selected from Paper Details
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      {/* Course Dropdown (Pre-selected from Paper Details) */}
                      <div>
                        <label className="property-label" style={{ fontSize: 11, marginBottom: 2 }}>Course / Board</label>
                        <select
                          className="property-input"
                          style={{ fontSize: 12, padding: '5px 8px' }}
                          value={draftCourseId}
                          onChange={(e) => setDraftCourseId(e.target.value)}
                        >
                          <option value="">No Course (Default: {getCourse(paper?.courseId)?.name || 'None'})</option>
                          {courses.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Subject Dropdown (Pre-selected from Paper Details) */}
                      <div>
                        <label className="property-label" style={{ fontSize: 11, marginBottom: 2 }}>Subject</label>
                        <select
                          className="property-input"
                          style={{ fontSize: 12, padding: '5px 8px' }}
                          value={draftSubjectId}
                          onChange={(e) => {
                            setDraftSubjectId(e.target.value);
                            if (draftChapterId) {
                              const ch = chapters.find(c => c.id === draftChapterId);
                              if (ch && ch.subjectId && ch.subjectId !== e.target.value) {
                                setDraftChapterId('');
                                setDraftTopicId('');
                              }
                            }
                          }}
                        >
                          <option value="">No Subject (Default: {getSubject(paper?.subjectId)?.name || 'None'})</option>
                          {subjects.map(s => (
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
                                  const cId = await createChapter(newChapterName.trim(), draftSubjectId || paper?.subjectId);
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
                              className="btn btn-primary"
                              style={{ padding: '4px 8px', fontSize: 11 }}
                              onClick={async () => {
                                if (newChapterName.trim()) {
                                  const cId = await createChapter(newChapterName.trim(), draftSubjectId || paper?.subjectId);
                                  if (cId) setDraftChapterId(cId);
                                }
                                setIsAddingChapter(false);
                                setNewChapterName('');
                              }}
                            >Save</button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 6px', fontSize: 11 }}
                              onClick={() => { setIsAddingChapter(false); setNewChapterName(''); }}
                            >✕</button>
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
                                  const tp = topics.find(t => t.id === draftTopicId);
                                  if (tp && tp.chapterId && tp.chapterId !== e.target.value) {
                                    setDraftTopicId('');
                                  }
                                }
                              }
                            }}
                          >
                            <option value="">Select Chapter (Optional)</option>
                            {chapters
                              .filter(ch => !draftSubjectId || !ch.subjectId || ch.subjectId === draftSubjectId)
                              .map(ch => (
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
                            >Save</button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 6px', fontSize: 11 }}
                              onClick={() => { setIsAddingTopic(false); setNewTopicName(''); }}
                            >✕</button>
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
                              .filter(tp => !draftChapterId || !tp.chapterId || tp.chapterId === draftChapterId)
                              .map(tp => (
                                <option key={tp.id} value={tp.id}>{tp.name}</option>
                              ))}
                            <option value="__ADD_NEW__">+ Add New Topic...</option>
                          </select>
                        )}
                      </div>

                      {/* Category / Stream */}
                      <div>
                        <label className="property-label" style={{ fontSize: 11 }}>Category / Stream</label>
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
                            >Save</button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 6px', fontSize: 11 }}
                              onClick={() => { setIsAddingCategory(false); setNewCategoryName(''); }}
                            >✕</button>
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
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                            <option value="__ADD_NEW__">+ Add New Stream/Category...</option>
                          </select>
                        )}
                      </div>

                      {/* Cognitive Level Dropdown (Requirement 6) */}
                      <div>
                        <label className="property-label" style={{ fontSize: 11 }}>Cognitive Level (Bloom's)</label>
                        <select
                          className="property-input"
                          style={{ fontSize: 12, padding: '5px 8px' }}
                          value={draftCognitiveLevel}
                          onChange={(e) => setDraftCognitiveLevel(e.target.value as CognitiveLevel)}
                        >
                          {COGNITIVE_LEVELS.map(cl => (
                            <option key={cl.value} value={cl.value}>
                              {cl.label}{cl.value === 'understand' ? ' (Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Sub-question Numbering Style (Requirement 5) */}
                      <div>
                        <label className="property-label" style={{ fontSize: 11 }}>Sub-question Numbering</label>
                        <select
                          className="property-input"
                          style={{ fontSize: 12, padding: '5px 8px' }}
                          value={draftSubNumberingStyle}
                          onChange={(e) => setDraftSubNumberingStyle(e.target.value as SubQuestionNumberingStyle)}
                        >
                          <option value="">Inherit from paper ({paper?.headerConfig?.subQuestionNumberingStyle || 'letters_paren'})</option>
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

                  <div className="property-field" style={{ marginBottom: 15 }}>
                    <label className="property-label">{draftType === 'text' ? 'Passage / Text Content' : 'Question Content'}</label>
                    <FullQuill value={draftContent} onChange={setDraftContent} placeholder={draftType === 'text' ? 'Enter reading passage or instructions...' : 'Enter your question...'} openMathDialog={openMathDialog} toolbarId="question-toolbar" onImageClick={handleQuillImageClick} />
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
                            {sq.isOptional && (
                              <span className="optional-badge" style={{ fontSize: 10, padding: '1px 6px' }}>Optional</span>
                            )}
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
                            <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                              <div className="property-field" style={{ flex: 1, minWidth: 120, marginBottom: 0 }}>
                                <label className="property-label">Question Type</label>
                                <select className="property-input" value={sq.type} onChange={(e) => handleUpdateDraftSubquestion(sq.id, 'type', e.target.value)}>
                                  <option value="subjective">Subjective</option>
                                  <option value="mcq">Multiple Choice</option>
                                  <option value="text">Text / Reading Passage</option>
                                </select>
                              </div>
                              {sq.type !== 'text' && (
                                <div className="property-field" style={{ flex: 1, minWidth: 80, marginBottom: 0 }}>
                                  <label className="property-label">Marks</label>
                                  <input type="number" className="property-input" value={sq.marks} onChange={(e) => handleUpdateDraftSubquestion(sq.id, 'marks', parseInt(e.target.value) || 1)} min={1} />
                                </div>
                              )}
                              <div className="property-field" style={{ flex: 1, minWidth: 130, marginBottom: 0 }}>
                                <label className="property-label">Cognitive Level</label>
                                <select
                                  className="property-input"
                                  value={sq.cognitiveLevel || 'understand'}
                                  onChange={(e) => handleUpdateDraftSubquestion(sq.id, 'cognitiveLevel', e.target.value as CognitiveLevel)}
                                >
                                  {COGNITIVE_LEVELS.map(cl => (
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
                <button className="btn btn-secondary" onClick={handleCancelDraft}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAddDraftToPaper} disabled={saving || !draftContent.trim()}>
                  {saving ? (editingQuestionId ? 'Updating...' : 'Saving...') : (editingQuestionId ? 'Update & Save All' : 'Save Question & Subquestions')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAPER SETTINGS DRAWER - SLIDES FROM RIGHT (NO BLUR OVERLAY, REAL-TIME VISIBILITY) */}
      {showPaperSettings && (
        <div className="drawer-panel drawer-right" onClick={(e) => e.stopPropagation()}>
          <div className="drawer-header">
            <div className="drawer-title">
              <Settings size={18} color="#2563eb" />
              <span>Paper Settings</span>
            </div>
            <button className="drawer-close-btn" onClick={() => setShowPaperSettings(false)} title="Close Paper Settings">
              <X size={18} />
            </button>
          </div>
            <div className="drawer-content">
              <div className="drawer-section-divider" style={{ marginTop: 0 }}>Paper Details</div>
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

              <div className="drawer-section-divider">Typography & Sizing</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="property-field">
                  <label className="property-label">Base Font Size (px)</label>
                  <LazyNumberInput
                    className="property-input"
                    value={paper.headerConfig?.fontSize || 14}
                    onChange={(val) => handleUpdateHeaderConfig({ fontSize: val })}
                    placeholder="14"
                    fallback={14}
                  />
                </div>
                <div className="property-field">
                  <label className="property-label">Body Font Size (px)</label>
                  <LazyNumberInput
                    className="property-input"
                    value={paper.headerConfig?.bodyFontSize || paper.headerConfig?.fontSize || 14}
                    onChange={(val) => handleUpdateHeaderConfig({ bodyFontSize: val })}
                    fallback={14}
                  />
                </div>
                <div className="property-field">
                  <label className="property-label">School Name Size (px)</label>
                  <LazyNumberInput
                    className="property-input"
                    value={paper.headerConfig?.schoolNameFontSize || 24}
                    onChange={(val) => handleUpdateHeaderConfig({ schoolNameFontSize: val })}
                    fallback={24}
                  />
                </div>
                <div className="property-field">
                  <label className="property-label">Paper Title Size (px)</label>
                  <LazyNumberInput
                    className="property-input"
                    value={paper.headerConfig?.titleFontSize || 16}
                    onChange={(val) => handleUpdateHeaderConfig({ titleFontSize: val })}
                    fallback={16}
                  />
                </div>
                <div className="property-field">
                  <label className="property-label">Section Title Size (px)</label>
                  <LazyNumberInput
                    className="property-input"
                    value={paper.headerConfig?.sectionTitleFontSize || 16}
                    onChange={(val) => handleUpdateHeaderConfig({ sectionTitleFontSize: val })}
                    fallback={16}
                  />
                </div>
                <div className="property-field">
                  <label className="property-label">Instructions Size (px)</label>
                  <LazyNumberInput
                    className="property-input"
                    value={paper.headerConfig?.instructionsFontSize || 13}
                    onChange={(val) => handleUpdateHeaderConfig({ instructionsFontSize: val })}
                    fallback={13}
                  />
                </div>
                <div className="property-field">
                  <label className="property-label">Meta Info Size (px)</label>
                  <LazyNumberInput
                    className="property-input"
                    value={paper.headerConfig?.infoFontSize || 13}
                    onChange={(val) => handleUpdateHeaderConfig({ infoFontSize: val })}
                    fallback={13}
                  />
                </div>
                <div className="property-field">
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

              <div className="drawer-section-divider">Vertical Spacing Controls (Print & Layout)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="property-field">
                  <label className="property-label">Section Top Spacing (px)</label>
                  <LazyNumberInput
                    className="property-input"
                    value={paper.headerConfig?.spacing?.sectionTop ?? 14}
                    onChange={(val) => handleUpdateHeaderConfig({
                      spacing: { ...(paper.headerConfig?.spacing || {}), sectionTop: val }
                    })}
                    fallback={14}
                  />
                </div>
                <div className="property-field">
                  <label className="property-label">Section to Description Gap (px)</label>
                  <LazyNumberInput
                    className="property-input"
                    value={paper.headerConfig?.spacing?.sectionDescGap ?? 2}
                    onChange={(val) => handleUpdateHeaderConfig({
                      spacing: { ...(paper.headerConfig?.spacing || {}), sectionDescGap: val }
                    })}
                    fallback={2}
                  />
                </div>
                <div className="property-field">
                  <label className="property-label">Section Bottom Spacing (px)</label>
                  <LazyNumberInput
                    className="property-input"
                    value={paper.headerConfig?.spacing?.sectionBottom ?? 8}
                    onChange={(val) => handleUpdateHeaderConfig({
                      spacing: { ...(paper.headerConfig?.spacing || {}), sectionBottom: val }
                    })}
                    fallback={8}
                  />
                </div>
                <div className="property-field">
                  <label className="property-label">Question Spacing (px)</label>
                  <LazyNumberInput
                    className="property-input"
                    value={paper.headerConfig?.spacing?.questionGap ?? 14}
                    onChange={(val) => handleUpdateHeaderConfig({
                      spacing: { ...(paper.headerConfig?.spacing || {}), questionGap: val }
                    })}
                    fallback={14}
                  />
                </div>
                <div className="property-field">
                  <label className="property-label">Sub-question Spacing (px)</label>
                  <LazyNumberInput
                    className="property-input"
                    value={paper.headerConfig?.spacing?.subQuestionGap ?? 8}
                    onChange={(val) => handleUpdateHeaderConfig({
                      spacing: { ...(paper.headerConfig?.spacing || {}), subQuestionGap: val }
                    })}
                    fallback={8}
                  />
                </div>
                {/* VERTICAL TEXT SPACING (LINE HEIGHT) SLIDER */}
                <div
                  className="property-field"
                  style={{
                    gridColumn: '1 / -1',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label className="property-label" style={{ fontWeight: 700, margin: 0, fontSize: 12.5, color: '#1e293b' }}>
                        Vertical Text Spacing
                      </label>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '1px 6px',
                          background: '#ecfdf5',
                          color: '#059669',
                          borderRadius: 4,
                          border: '1px solid #a7f3d0'
                        }}
                      >
                        Bounded
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#2563eb',
                          background: '#eff6ff',
                          padding: '2px 8px',
                          borderRadius: 6,
                          border: '1px solid #bfdbfe',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {(Math.min(2.40, Math.max(1.20, paper.headerConfig?.spacing?.lineHeight ?? 1.45))).toFixed(2)}x
                      </span>
                    </div>
                  </div>

                  {/* Range Slider with strict bounds */}
                  <div style={{ position: 'relative', width: '100%', paddingTop: 2 }}>
                    <input
                      type="range"
                      min="1.20"
                      max="2.40"
                      step="0.05"
                      value={Math.min(2.40, Math.max(1.20, paper.headerConfig?.spacing?.lineHeight ?? 1.45))}
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value);
                        const val = Math.min(2.40, Math.max(1.20, Number.isFinite(raw) ? raw : 1.45));
                        handleUpdateHeaderConfig({
                          spacing: { ...(paper.headerConfig?.spacing || {}), lineHeight: Math.round(val * 100) / 100 }
                        });
                      }}
                      style={{
                        width: '100%',
                        accentColor: '#2563eb',
                        cursor: 'pointer',
                        height: 6,
                        borderRadius: 4,
                      }}
                    />
                  </div>

                  {/* Min / Max Labels */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#64748b', fontWeight: 500, marginTop: -2 }}>
                    <span>Min: 1.20x <span style={{ color: '#059669', fontSize: 9.5 }}>(Anti-overlap limit)</span></span>
                    <span>1.45x (Standard)</span>
                    <span>Max: 2.40x</span>
                  </div>

                  {/* Anti-Overlap Helper Info */}
                  <div
                    style={{
                      fontSize: 11,
                      lineHeight: 1.35,
                      color: '#0369a1',
                      background: '#f0f9ff',
                      border: '1px solid #e0f2fe',
                      borderRadius: 6,
                      padding: '6px 8px',
                    }}
                  >
                    <strong>Overlap Protection:</strong> Lower limit is fixed at 1.20x to prevent mathematical formulas, subscripts, fractions, and adjacent lines from colliding or overlapping.
                  </div>

                  {/* Quick Preset Buttons */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                    {[
                      { label: 'Compact', val: 1.25 },
                      { label: 'Standard', val: 1.45 },
                      { label: 'Relaxed', val: 1.75 },
                      { label: 'Spacious', val: 2.00 },
                    ].map((preset) => {
                      const currentVal = Math.min(2.40, Math.max(1.20, paper.headerConfig?.spacing?.lineHeight ?? 1.45));
                      const isSelected = Math.abs(currentVal - preset.val) < 0.03;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                          style={{
                            padding: '3px 6px',
                            fontSize: 10.5,
                            flex: 1,
                            justifyContent: 'center',
                            fontWeight: isSelected ? 700 : 500,
                            borderRadius: 6,
                          }}
                          onClick={() => {
                            handleUpdateHeaderConfig({
                              spacing: { ...(paper.headerConfig?.spacing || {}), lineHeight: preset.val }
                            });
                          }}
                        >
                          {preset.label} ({preset.val}x)
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="drawer-section-divider">Institution</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 4px 0' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>Show Institution on Paper</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Display institution heading on paper</div>
                </div>
                <input
                  type="checkbox"
                  checked={paper.headerConfig?.visibleHeaderFields?.schoolName !== false}
                  onChange={(e) => handleUpdateHeaderConfig({
                    visibleHeaderFields: {
                      ...(paper.headerConfig?.visibleHeaderFields || {}),
                      schoolName: e.target.checked
                    }
                  })}
                  style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#2563eb' }}
                />
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

              <div className="drawer-section-divider">Exam Details</div>
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
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label">Duration (min)</label>
                  <LazyNumberInput
                    className="property-input"
                    value={paper.duration || 0}
                    onChange={(val) => updateQuestionPaper(paper.id, { duration: val })}
                    fallback={0}
                  />
                </div>
                <div className="property-field" style={{ flex: 1 }}>
                  <label className="property-label">Max Marks</label>
                  <LazyNumberInput
                    className="property-input"
                    value={paper.maxMarks || 0}
                    onChange={(val) => updateQuestionPaper(paper.id, { maxMarks: val })}
                    fallback={0}
                  />
                </div>
              </div>

              <div className="drawer-section-divider">Instructions</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 4px 0' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>Show Instructions on Paper</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Display exam instructions below the header</div>
                </div>
                <input
                  type="checkbox"
                  checked={paper.headerConfig?.visibleHeaderFields?.instructions !== false}
                  onChange={(e) => handleUpdateHeaderConfig({
                    visibleHeaderFields: {
                      ...(paper.headerConfig?.visibleHeaderFields || {}),
                      instructions: e.target.checked
                    }
                  })}
                  style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#2563eb' }}
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
            <div className="drawer-footer">
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowPaperSettings(false)}>Done</button>
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
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, zIndex: 10001 }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title">Insert Math Formula</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                <button
                  className="modal-close-btn"
                  onClick={() => {
                    if (window.mathVirtualKeyboard) window.mathVirtualKeyboard.hide();
                    setShowMathDialog(false);
                  }}
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
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

      {/* QUESTION VIEW PREVIEW MODAL */}
      {viewingQuestion && (
        <QuestionViewModal
          question={viewingQuestion}
          isOpen={!!viewingQuestion}
          onClose={() => setViewingQuestion(null)}
          onInsert={async (vq) => {
            const targetSection = vq.targetSection || draftSection || sections[0]?.title || 'Section A';
            const parentId = vq.parentQuestionId || undefined;
            const isOpt = vq.isOptional || false;
            const matchedShared = sharedQuestions.find(sq => sq.id === vq.parentSharedId || sq.id === vq.id);
            if (matchedShared) {
              await importSharedQuestionToPaper(paper.id, matchedShared, targetSection, 1, parentId, isOpt);
            } else {
              await createAndAddQuestion(
                paper.id,
                vq.content,
                vq.questionType,
                vq.options,
                targetSection,
                parentId,
                vq.marks || 1,
                undefined,
                paper.subjectId,
                paper.classId,
                vq.difficulty || 'medium',
                undefined,
                vq.parentSharedId || undefined,
                undefined,
                isOpt
              );
            }
            setViewingQuestion(null);
            showToastMessage(parentId ? 'Added as subquestion!' : 'Question added to paper!');
          }}
        />
      )}

      {/* SECTION EDIT & DESCRIPTION MODAL */}
      {editingSection && (
        <SectionEditModal
          isOpen={!!editingSection}
          sectionName={editingSection.name}
          sectionDescription={editingSection.description}
          onClose={() => setEditingSection(null)}
          onSave={(newName, newDesc) => {
            handleSaveSectionEdit(editingSection.oldName, newName, newDesc);
            setEditingSection(null);
          }}
        />
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
