export type QuestionType = 'mcq' | 'subjective' | 'fillblank' | 'truefalse' | 'match' | 'text';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type PaperSection = string;

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