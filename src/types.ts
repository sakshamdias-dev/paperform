export type QuestionType = 'mcq' | 'subjective' | 'fillblank' | 'truefalse' | 'match' | 'text';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type PaperSection = string;

/** Bloom's taxonomy cognitive levels (ordered low → high). */
export type CognitiveLevel = 'remember' | 'understand' | 'apply' | 'analyse' | 'evaluate' | 'create';

export const COGNITIVE_LEVELS: { value: CognitiveLevel; label: string }[] = [
  { value: 'remember', label: 'Remember' },
  { value: 'understand', label: 'Understand' },
  { value: 'apply', label: 'Apply' },
  { value: 'analyse', label: 'Analyse' },
  { value: 'evaluate', label: 'Evaluate' },
  { value: 'create', label: 'Create' },
];

export const DEFAULT_COGNITIVE_LEVEL: CognitiveLevel = 'understand';

export interface User {
  id: string;
  email: string;
  fullName: string;
  schoolName?: string;
  keepQuestionsPrivate?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Course {
  id: string;
  teacherId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Subject {
  id: string;
  teacherId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Class {
  id: string;
  teacherId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Chapter {
  id: string;
  teacherId: string;
  name: string;
  subjectId?: string;
  createdAt: number;
}

export interface Topic {
  id: string;
  teacherId: string;
  name: string;
  chapterId?: string;
  createdAt: number;
}

export interface Category {
  id: string;
  teacherId: string;
  name: string;
  createdAt: number;
}

/** Classification metadata attached to every question (all optional). */
export interface QuestionMeta {
  courseId?: string;
  subjectId?: string;
  classId?: string;
  chapterId?: string;
  topicId?: string;
  categoryId?: string;
  cognitiveLevel?: CognitiveLevel;
}

export interface BankSubQuestion {
  id: string;
  content: string;
  marks: number;
  questionType?: QuestionType;
  options?: string[];
  difficulty?: Difficulty;
  cognitiveLevel?: CognitiveLevel;
  explanation?: string;
}

export interface Question {
  id: string;
  teacherId: string;
  content: string;
  courseId?: string;
  subjectId?: string;
  classId?: string;
  questionType: QuestionType;
  options: string[];
  difficulty: Difficulty;
  explanation?: string;
  imageUrl?: string;
  typeHeader?: string;
  chapterId?: string;
  topicId?: string;
  categoryId?: string;
  cognitiveLevel?: CognitiveLevel;
  subNumberingStyle?: SubQuestionNumberingStyle;
  marks?: number;
  subquestions?: BankSubQuestion[];
  parentId?: string;
  createdAt: number;
  updatedAt: number;
}

export type SubQuestionNumberingStyle =
  | 'letters_paren'       // (a), (b), (c)
  | 'roman_paren'         // (i), (ii), (iii)
  | 'numbers_paren'       // 1), 2), 3)
  | 'letters_dot'         // a., b., c.
  | 'roman_dot'           // i., ii., iii.
  | 'numbers_paren_both'  // (1), (2), (3)
  | 'letters_upper_dot'   // A., B., C.
  | 'letters_upper_paren'; // (A), (B), (C)

export interface VisibleHeaderFields {
  schoolName?: boolean;
  title?: boolean;
  examTitle?: boolean; // alias for title
  course?: boolean;
  subject?: boolean;
  class?: boolean;
  gradeClass?: boolean; // alias for class
  date?: boolean;
  duration?: boolean;
  totalMarks?: boolean;
  instructions?: boolean;
  logo?: boolean;
  qpCode?: boolean;
}

export interface HeaderConfig {
  logoUrl?: string;
  logoSize?: number;
  logoPos?: { x: number; y: number };
  barcodePos?: { x: number; y: number };
  showBarcode?: boolean;
  customSections?: string[];
  continuousNumbering?: boolean;
  fontSize?: number;
  titleFontSize?: number;
  schoolNameFontSize?: number;
  infoFontSize?: number;
  instructionsFontSize?: number;
  sectionTitleFontSize?: number;
  bodyFontSize?: number;
  fontFamily?: string;
  visibleHeaderFields?: VisibleHeaderFields;
  subQuestionNumberingStyle?: SubQuestionNumberingStyle;
  sectionDescriptions?: Record<string, string>; // section name -> rich text html description
  spacing?: PaperSpacing;
}

/** User-controllable vertical spacing for the printed paper (all values in px except lineHeight). */
export interface PaperSpacing {
  sectionTop?: number;        // space above a section header
  sectionDescGap?: number;    // gap between section name and its description
  sectionBottom?: number;     // gap between section header block and first question
  questionGap?: number;       // vertical gap between questions
  subQuestionGap?: number;    // vertical gap between sub-questions
  lineHeight?: number;        // body line-height multiplier
}

export interface QuestionPaper {
  id: string;
  qpCode: string;
  teacherId: string;
  title: string;
  date?: string;
  maxMarks?: number;
  courseId?: string;
  subjectId?: string;
  classId?: string;
  instructions?: string;
  isPublished: boolean;
  totalMarks: number;
  duration?: number;
  headerConfig?: HeaderConfig;
  createdAt: number;
  updatedAt: number;
}

export interface PaperQuestion {
  id: string;
  paperId: string;
  questionId: string;
  section: string;
  parentId?: string | null;
  marks: number;
  orderIndex: number;
  parentSharedId?: string | null;
  originType?: 'ORIGINAL' | 'SHARED' | 'FORKED';
  isOptional?: boolean;
  chapterId?: string;
  topicId?: string;
  categoryId?: string;
  cognitiveLevel?: CognitiveLevel;
  /** Numbering style applied to this question's direct children. Falls back to the paper default. */
  subNumberingStyle?: SubQuestionNumberingStyle | null;
  createdAt: number;
  updatedAt: number;
}

export interface SharedQuestion {
  id: string;
  content: string;
  contentHash: string;
  createdByUserId: string;
  authorName: string;
  courseId?: string;
  subjectId?: string;
  classId?: string;
  topic?: string;
  questionType: QuestionType;
  options: string[];
  difficulty: Difficulty;
  typeHeader?: string;
  usageCount: number;
  // Name-based metadata (shared across teachers, so IDs from private lookup tables are not meaningful)
  courseName?: string;
  subjectName?: string;
  className?: string;
  chapter?: string;
  category?: string;
  cognitiveLevel?: CognitiveLevel;
  marks?: number;
  subquestions?: BankSubQuestion[];
  parentId?: string;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  senderId?: string;
  senderName: string;
  title: string;
  message: string;
  questionContent: string;
  createdAt: number;
  read: boolean;
}

export type AnyBlock = SectionBlock | MCQBlock | ShortBlock | LongBlock | FillBlankBlock;

export interface SectionBlock {
  id: string;
  type: 'section';
  title: string;
  instruction: string;
}

export interface MCQBlock {
  id: string;
  type: 'mcq';
  question: string;
  options: string[];
  correctAnswer: number;
  marks: number;
}

export interface ShortBlock {
  id: string;
  type: 'short';
  question: string;
  lines: number;
  marks: number;
}

export interface LongBlock {
  id: string;
  type: 'long';
  question: string;
  marks: number;
}

export interface FillBlankBlock {
  id: string;
  type: 'fillblank';
  text: string;
  answers: string;
  marks: number;
}