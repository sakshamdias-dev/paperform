import { create } from 'zustand';
import type {
  Course,
  Subject,
  Class,
  Question,
  QuestionPaper,
  PaperQuestion,
  User,
  QuestionType,
  Difficulty,
  PaperSection,
  SharedQuestion,
  AppNotification,
  Chapter,
  Topic,
  Category,
  QuestionMeta,
} from './types';
import { DEFAULT_COGNITIVE_LEVEL } from './types';
import { supabase } from './supabase';
import { computeContentHash, calculateTextSimilarity } from './utils/sharedBank';
import { INITIAL_SHARED_QUESTIONS } from './utils/seedSharedQuestions';

const LOCAL_SHARED_QUESTIONS_KEY = 'questforma_shared_questions_v1';
const LOCAL_NOTIFICATIONS_KEY = 'questforma_notifications_v1';
const LOCAL_LOOKUPS_KEY = 'questforma_lookups_v1';

/**
 * Columns introduced by `classification_migration.sql`. If the migration has not been
 * applied yet, PostgREST rejects the whole write; we retry without these columns so
 * the core data (question text, marks, etc.) is never lost.
 */
const MIGRATION_OPTIONAL_COLUMNS = new Set([
  'chapter_id', 'topic_id', 'category_id', 'cognitive_level', 'marks',
  'sub_numbering_style', 'course_name', 'subject_name', 'class_name', 'chapter', 'category',
  'subquestions', 'parent_id',
]);

type WriteResult = PromiseLike<{ error: { code?: string; message: string } | null }>;

async function resilientWrite(
  op: (row: Record<string, unknown>) => WriteResult,
  row: Record<string, unknown>,
  label: string,
) {
  let { error } = await op(row);
  if (error && (error.code === 'PGRST204' || error.code === '42703')) {
    const stripped = Object.fromEntries(
      Object.entries(row).filter(([k]) => !MIGRATION_OPTIONAL_COLUMNS.has(k)),
    );
    ({ error } = await op(stripped));
    if (!error) {
      console.warn(`[${label}] Saved without classification fields — run classification_migration.sql in Supabase.`);
    }
  }
  if (error) console.error(`[${label}]`, error.message);
  return error;
}

interface LocalLookups { chapters: Chapter[]; topics: Topic[]; categories: Category[] }

function getStoredLookups(userId: string): LocalLookups {
  try {
    const raw = localStorage.getItem(`${LOCAL_LOOKUPS_KEY}_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { chapters: [], topics: [], categories: [] };
}

function saveLookups(userId: string, data: LocalLookups) {
  try {
    localStorage.setItem(`${LOCAL_LOOKUPS_KEY}_${userId}`, JSON.stringify(data));
  } catch {}
}

function getStoredLocalSharedQuestions(): SharedQuestion[] {
  try {
    const raw = localStorage.getItem(LOCAL_SHARED_QUESTIONS_KEY);
    if (raw) {
      const parsed: SharedQuestion[] = JSON.parse(raw);
      // Ensure seed multi-part questions exist in stored list
      const hasEcosystem = parsed.some(q => q.id === 'shared-q-ecosystem');
      if (!hasEcosystem) {
        const merged = [...INITIAL_SHARED_QUESTIONS, ...parsed.filter(p => !INITIAL_SHARED_QUESTIONS.some(i => i.id === p.id))];
        saveLocalSharedQuestions(merged);
        return merged;
      }
      return parsed;
    }
  } catch {}
  return INITIAL_SHARED_QUESTIONS;
}

function saveLocalSharedQuestions(list: SharedQuestion[]) {
  try {
    localStorage.setItem(LOCAL_SHARED_QUESTIONS_KEY, JSON.stringify(list));
  } catch {}
}

function getStoredLocalNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalNotifications(list: AppNotification[]) {
  try {
    localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(list));
  } catch {}
}

interface AppState {
  user: User | null;
  courses: Course[];
  subjects: Subject[];
  classes: Class[];
  chapters: Chapter[];
  topics: Topic[];
  categories: Category[];
  questionPapers: QuestionPaper[];
  questions: Question[];
  paperQuestions: Map<string, PaperQuestion[]>;
  sharedQuestions: SharedQuestion[];
  notifications: AppNotification[];
  currentPaperId: string | null;
  loading: boolean;
  
  setUser: (user: User | null) => void;
  setCurrentPaper: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  
  fetchCourses: () => Promise<void>;
  fetchSubjects: () => Promise<void>;
  fetchClasses: () => Promise<void>;
  fetchQuestionPapers: () => Promise<void>;
  fetchQuestions: () => Promise<void>;
  fetchPaperQuestions: (paperId: string) => Promise<void>;
  fetchSharedQuestions: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  toggleKeepQuestionsPrivate: (value?: boolean) => Promise<void>;
  
  createCourse: (name: string) => Promise<string>;
  updateCourse: (id: string, name: string) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  
  createSubject: (name: string) => Promise<string>;
  updateSubject: (id: string, name: string) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  
  createClass: (name: string) => Promise<string>;
  updateClass: (id: string, name: string) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;

  fetchLookups: () => Promise<void>;
  createChapter: (name: string, subjectId?: string) => Promise<string>;
  deleteChapter: (id: string) => Promise<void>;
  createTopic: (name: string, chapterId?: string) => Promise<string>;
  deleteTopic: (id: string) => Promise<void>;
  createCategory: (name: string) => Promise<string>;
  deleteCategory: (id: string) => Promise<void>;
  
  createQuestionPaper: (title: string, date?: string, maxMarks?: number, courseId?: string, subjectId?: string, classId?: string, instructions?: string, duration?: number) => Promise<string>;
  updateQuestionPaper: (id: string, updates: Partial<QuestionPaper>) => Promise<void>;
  deleteQuestionPaper: (id: string) => Promise<void>;
  duplicateQuestionPaper: (id: string) => string;
  
  createQuestion: (content: string, questionType: QuestionType, options?: string[], courseId?: string, subjectId?: string, classId?: string, difficulty?: Difficulty, explanation?: string, imageUrl?: string) => Promise<string>;
  updateQuestion: (id: string, updates: Partial<Question>) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
  
  addQuestionToPaper: (paperId: string, questionId: string, section?: PaperSection, marks?: number, parentId?: string, isOptional?: boolean, parentSharedId?: string, originType?: 'ORIGINAL' | 'SHARED' | 'FORKED') => Promise<string>;
  updatePaperQuestion: (id: string, updates: Partial<PaperQuestion>) => Promise<void>;
  removeQuestionFromPaper: (paperId: string, questionId: string) => Promise<void>;
  reorderPaperQuestions: (paperId: string, paperQuestionsList: PaperQuestion[]) => Promise<void>;
  createAndAddQuestion: (
    paperId: string,
    content: string,
    questionType: QuestionType,
    options?: string[],
    section?: string,
    parentId?: string,
    marks?: number,
    courseId?: string,
    subjectId?: string,
    classId?: string,
    difficulty?: Difficulty,
    explanation?: string,
    imageUrl?: string,
    typeHeader?: string,
    isOptional?: boolean,
    parentSharedId?: string,
    originType?: 'ORIGINAL' | 'SHARED' | 'FORKED',
    meta?: QuestionMeta,
    subNumberingStyle?: PaperQuestion['subNumberingStyle']
  ) => Promise<string>;

  shareQuestionToBank: (question: { content: string; questionType: QuestionType; options?: string[]; difficulty?: Difficulty; typeHeader?: string; topic?: string; meta?: QuestionMeta; marks?: number; subquestions?: SharedQuestion['subquestions'] }) => Promise<string | null>;
  importSharedQuestionToPaper: (paperId: string, sharedQ: SharedQuestion, section?: string, marks?: number, parentId?: string, isOptional?: boolean) => Promise<string>;
  sendQuestionUsageNotification: (sharedQ: SharedQuestion) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
}

const generateId = () => crypto.randomUUID();

export const useStore = create<AppState>()((set, get) => ({
  user: null,
  courses: [],
  subjects: [],
  classes: [],
  chapters: [],
  topics: [],
  categories: [],
  questionPapers: [],
  questions: [],
  paperQuestions: new Map(),
  sharedQuestions: getStoredLocalSharedQuestions(),
  notifications: getStoredLocalNotifications(),
  currentPaperId: null,
  loading: false,

  setUser: (user) => set({ user }),
  setCurrentPaper: (id) => set({ currentPaperId: id }),
  setLoading: (loading) => set({ loading }),
  logout: () => {
    set({
      user: null,
      courses: [],
      subjects: [],
      classes: [],
      chapters: [],
      topics: [],
      categories: [],
      questionPapers: [],
      questions: [],
      paperQuestions: new Map(),
      sharedQuestions: INITIAL_SHARED_QUESTIONS,
      notifications: [],
      currentPaperId: null,
    });
  },

  toggleKeepQuestionsPrivate: async (value?: boolean) => {
    const { user } = get();
    if (!user) return;
    const nextVal = value !== undefined ? value : !user.keepQuestionsPrivate;
    set({ user: { ...user, keepQuestionsPrivate: nextVal } });
    try {
      localStorage.setItem('questforma_privacy_pref', String(nextVal));
      await supabase.from('profiles').update({ keep_questions_private: nextVal }).eq('id', user.id);
    } catch (e) {
      console.warn('Could not persist privacy toggle to database:', e);
    }
  },

  fetchCourses: async () => {
    const { user } = get();
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('teacher_id', user.id)
      .order('name');
    
    if (error) {
      console.error('Error fetching courses:', error);
      return;
    }
    
    if (data) {
      const courses: Course[] = data.map(c => ({
        id: c.id,
        teacherId: c.teacher_id,
        name: c.name,
        createdAt: new Date(c.created_at).getTime(),
        updatedAt: new Date(c.updated_at).getTime(),
      }));
      set({ courses });
    }
  },

  fetchSubjects: async () => {
    const { user } = get();
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('teacher_id', user.id)
      .order('name');
    
    if (!error && data) {
      const subjects: Subject[] = data.map(s => ({
        id: s.id,
        teacherId: s.teacher_id,
        name: s.name,
        createdAt: new Date(s.created_at).getTime(),
        updatedAt: new Date(s.updated_at).getTime(),
      }));
      set({ subjects });
    }
  },

  fetchClasses: async () => {
    const { user } = get();
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', user.id)
      .order('name');
    
    if (!error && data) {
      const classes: Class[] = data.map(c => ({
        id: c.id,
        teacherId: c.teacher_id,
        name: c.name,
        createdAt: new Date(c.created_at).getTime(),
        updatedAt: new Date(c.updated_at).getTime(),
      }));
      set({ classes });
    }
  },

  fetchQuestionPapers: async () => {
    const { user } = get();
    if (!user?.id) return;
    
    set({ loading: true });
    const { data, error } = await supabase
      .from('qp_metadata')
      .select('*')
      .eq('teacher_id', user.id)
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching papers:', error);
      set({ loading: false });
      return;
    }
    
    if (data) {
      const questionPapers: QuestionPaper[] = data.map(qp => ({
        id: qp.id,
        qpCode: qp.qp_code,
        teacherId: qp.teacher_id,
        title: qp.title,
        date: qp.date,
        maxMarks: qp.max_marks,
        courseId: qp.course_id,
        subjectId: qp.subject_id,
        classId: qp.class_id,
        instructions: qp.instructions,
        isPublished: qp.is_published || false,
        totalMarks: qp.max_marks || 0,
        duration: qp.duration || 0,
        headerConfig: qp.header_config || {},
        createdAt: new Date(qp.created_at).getTime(),
        updatedAt: new Date(qp.updated_at).getTime(),
      }));
      set({ questionPapers });
    }
    set({ loading: false });
  },

  fetchQuestions: async () => {
    const { user } = get();
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const questions: Question[] = data.map(q => ({
        id: q.id,
        teacherId: q.teacher_id,
        content: q.content,
        courseId: q.course_id,
        subjectId: q.subject_id,
        classId: q.class_id,
        questionType: q.question_type,
        options: q.options || [],
        difficulty: q.difficulty,
        explanation: q.explanation,
        imageUrl: q.image_url,
        typeHeader: q.type_header,
        chapterId: q.chapter_id || undefined,
        topicId: q.topic_id || undefined,
        categoryId: q.category_id || undefined,
        cognitiveLevel: q.cognitive_level || DEFAULT_COGNITIVE_LEVEL,
        marks: q.marks ?? undefined,
        createdAt: new Date(q.created_at).getTime(),
        updatedAt: new Date(q.updated_at).getTime(),
      }));
      set({ questions });
    }
  },

  fetchPaperQuestions: async (paperId: string) => {
    const { data, error } = await supabase
      .from('paper_questions')
      .select('*')
      .eq('paper_id', paperId)
      .order('order_index', { ascending: true });

    if (!error && data) {
      const pq: PaperQuestion[] = data.map(item => ({
        id: item.id,
        paperId: item.paper_id,
        questionId: item.question_id,
        section: item.section || '',
        parentId: item.parent_id,
        marks: item.marks || 0,
        orderIndex: item.order_index,
        parentSharedId: item.parent_shared_id || null,
        originType: item.origin_type || 'ORIGINAL',
        isOptional: item.is_optional || false,
        subNumberingStyle: item.sub_numbering_style || null,
        createdAt: new Date(item.created_at).getTime(),
        updatedAt: new Date(item.updated_at).getTime(),
      }));
      set((state) => {
        const newPaperQuestions = new Map(state.paperQuestions);
        newPaperQuestions.set(paperId, pq);
        return { paperQuestions: newPaperQuestions };
      });
    }
  },

  fetchSharedQuestions: async () => {
    const localStored = getStoredLocalSharedQuestions();
    try {
      const { data, error } = await supabase
        .from('shared_questions')
        .select('*')
        .order('usage_count', { ascending: false });

      if (!error && data && data.length > 0) {
        const dbList: SharedQuestion[] = data.map(row => {
          const matchingLocal =
            localStored.find(lq => lq.id === row.id || (row.content_hash && lq.contentHash === row.content_hash)) ||
            INITIAL_SHARED_QUESTIONS.find(iq => iq.id === row.id || (row.content_hash && iq.contentHash === row.content_hash));
          const rowSubqs = Array.isArray(row.subquestions) && row.subquestions.length > 0
            ? row.subquestions
            : matchingLocal?.subquestions;
          return {
            id: row.id,
            content: row.content,
            contentHash: row.content_hash,
            createdByUserId: row.created_by_user_id,
            authorName: row.author_name || 'Fellow Educator',
            courseId: row.course_id,
            subjectId: row.subject_id,
            classId: row.class_id,
            topic: row.topic,
            questionType: row.question_type,
            options: row.options || [],
            difficulty: row.difficulty || 'medium',
            typeHeader: row.type_header,
            usageCount: row.usage_count || 0,
            courseName: row.course_name || undefined,
            subjectName: row.subject_name || undefined,
            className: row.class_name || undefined,
            chapter: row.chapter || undefined,
            category: row.category || undefined,
            cognitiveLevel: row.cognitive_level || DEFAULT_COGNITIVE_LEVEL,
            marks: row.marks ?? matchingLocal?.marks ?? undefined,
            subquestions: rowSubqs && rowSubqs.length > 0 ? rowSubqs : undefined,
            parentId: row.parent_id || matchingLocal?.parentId || undefined,
            createdAt: new Date(row.created_at).getTime(),
          };
        });

        // Ensure seeded multi-part shared questions with subquestions are also available
        const existingIds = new Set(dbList.map(q => q.id));
        const existingHashes = new Set(dbList.map(q => q.contentHash).filter(Boolean));
        const seededMissing = INITIAL_SHARED_QUESTIONS.filter(
          iq => !existingIds.has(iq.id) && (!iq.contentHash || !existingHashes.has(iq.contentHash))
        );
        const list = [...seededMissing, ...dbList];
        set({ sharedQuestions: list });
        saveLocalSharedQuestions(list);
        return;
      }
    } catch {}

    // Fallback to local storage / seeded list
    set({ sharedQuestions: localStored });
  },

  fetchNotifications: async () => {
    const { user } = get();
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const notifs: AppNotification[] = data.map(n => ({
          id: n.id,
          recipientId: n.recipient_id,
          senderId: n.sender_id,
          senderName: n.sender_name || 'Educator',
          title: n.title,
          message: n.message,
          questionContent: n.question_content,
          createdAt: new Date(n.created_at).getTime(),
          read: n.read || false,
        }));
        set({ notifications: notifs });
        saveLocalNotifications(notifs);
        return;
      }
    } catch {}

    const stored = getStoredLocalNotifications().filter(n => n.recipientId === user.id || !n.recipientId);
    set({ notifications: stored });
  },

  markNotificationAsRead: async (id: string) => {
    set((state) => {
      const updated = state.notifications.map(n => n.id === id ? { ...n, read: true } : n);
      saveLocalNotifications(updated);
      return { notifications: updated };
    });
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    } catch {}
  },

  clearNotifications: async () => {
    const { user } = get();
    set({ notifications: [] });
    saveLocalNotifications([]);
    if (user?.id) {
      try {
        await supabase.from('notifications').delete().eq('recipient_id', user.id);
      } catch {}
    }
  },

  createCourse: async (name: string) => {
    const { user } = get();
    if (!user?.id) return '';
    const id = generateId();
    set((state) => ({ courses: [...state.courses, {
      id,
      teacherId: user.id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }] }));

    await supabase.from('courses').insert({ id, teacher_id: user.id, name });
    return id;
  },

  updateCourse: async (id: string, name: string) => {
    set((state) => ({
      courses: state.courses.map(c => c.id === id ? { ...c, name, updatedAt: Date.now() } : c),
    }));
    await supabase.from('courses').update({ name }).eq('id', id);
  },

  deleteCourse: async (id: string) => {
    set((state) => ({ courses: state.courses.filter(c => c.id !== id) }));
    await supabase.from('courses').delete().eq('id', id);
  },

  createSubject: async (name: string) => {
    const { user } = get();
    if (!user?.id) return '';
    const id = generateId();
    set((state) => ({ subjects: [...state.subjects, {
      id,
      teacherId: user.id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }] }));

    await supabase.from('subjects').insert({ id, teacher_id: user.id, name });
    return id;
  },

  updateSubject: async (id: string, name: string) => {
    set((state) => ({
      subjects: state.subjects.map(s => s.id === id ? { ...s, name, updatedAt: Date.now() } : s),
    }));
    await supabase.from('subjects').update({ name }).eq('id', id);
  },

  deleteSubject: async (id: string) => {
    set((state) => ({ subjects: state.subjects.filter(s => s.id !== id) }));
    await supabase.from('subjects').delete().eq('id', id);
  },

  createClass: async (name: string) => {
    const { user } = get();
    if (!user?.id) return '';
    const id = generateId();
    set((state) => ({ classes: [...state.classes, {
      id,
      teacherId: user.id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }] }));

    await supabase.from('classes').insert({ id, teacher_id: user.id, name });
    return id;
  },

  updateClass: async (id: string, name: string) => {
    set((state) => ({
      classes: state.classes.map(c => c.id === id ? { ...c, name, updatedAt: Date.now() } : c),
    }));
    await supabase.from('classes').update({ name }).eq('id', id);
  },

  deleteClass: async (id: string) => {
    set((state) => ({ classes: state.classes.filter(c => c.id !== id) }));
    await supabase.from('classes').delete().eq('id', id);
  },

  fetchLookups: async () => {
    const { user } = get();
    if (!user?.id) return;
    const local = getStoredLookups(user.id);

    const [chRes, tpRes, ctRes] = await Promise.all([
      supabase.from('chapters').select('*').eq('teacher_id', user.id).order('name'),
      supabase.from('topics').select('*').eq('teacher_id', user.id).order('name'),
      supabase.from('categories').select('*').eq('teacher_id', user.id).order('name'),
    ]);

    const chapters: Chapter[] = !chRes.error && chRes.data
      ? chRes.data.map(r => ({ id: r.id, teacherId: r.teacher_id, name: r.name, subjectId: r.subject_id || undefined, createdAt: new Date(r.created_at).getTime() }))
      : local.chapters;
    const topics: Topic[] = !tpRes.error && tpRes.data
      ? tpRes.data.map(r => ({ id: r.id, teacherId: r.teacher_id, name: r.name, chapterId: r.chapter_id || undefined, createdAt: new Date(r.created_at).getTime() }))
      : local.topics;
    const categories: Category[] = !ctRes.error && ctRes.data
      ? ctRes.data.map(r => ({ id: r.id, teacherId: r.teacher_id, name: r.name, createdAt: new Date(r.created_at).getTime() }))
      : local.categories;

    set({ chapters, topics, categories });
    saveLookups(user.id, { chapters, topics, categories });
  },

  createChapter: async (name: string, subjectId?: string) => {
    const { user } = get();
    if (!user?.id) return '';
    const existing = get().chapters.find(c => c.name.toLowerCase() === name.toLowerCase() && (c.subjectId || '') === (subjectId || ''));
    if (existing) return existing.id;
    const id = generateId();
    const chapter: Chapter = { id, teacherId: user.id, name, subjectId, createdAt: Date.now() };
    set((s) => ({ chapters: [...s.chapters, chapter].sort((a, b) => a.name.localeCompare(b.name)) }));
    const { chapters, topics, categories } = get();
    saveLookups(user.id, { chapters, topics, categories });
    const { error } = await supabase.from('chapters').insert({ id, teacher_id: user.id, name, subject_id: subjectId || null });
    if (error) console.warn('Chapter saved locally only:', error.message);
    return id;
  },

  deleteChapter: async (id: string) => {
    const { user } = get();
    set((s) => ({ chapters: s.chapters.filter(c => c.id !== id) }));
    if (user?.id) {
      const { chapters, topics, categories } = get();
      saveLookups(user.id, { chapters, topics, categories });
    }
    await supabase.from('chapters').delete().eq('id', id);
  },

  createTopic: async (name: string, chapterId?: string) => {
    const { user } = get();
    if (!user?.id) return '';
    const existing = get().topics.find(t => t.name.toLowerCase() === name.toLowerCase() && (t.chapterId || '') === (chapterId || ''));
    if (existing) return existing.id;
    const id = generateId();
    const topic: Topic = { id, teacherId: user.id, name, chapterId, createdAt: Date.now() };
    set((s) => ({ topics: [...s.topics, topic].sort((a, b) => a.name.localeCompare(b.name)) }));
    const { chapters, topics, categories } = get();
    saveLookups(user.id, { chapters, topics, categories });
    const { error } = await supabase.from('topics').insert({ id, teacher_id: user.id, name, chapter_id: chapterId || null });
    if (error) console.warn('Topic saved locally only:', error.message);
    return id;
  },

  deleteTopic: async (id: string) => {
    const { user } = get();
    set((s) => ({ topics: s.topics.filter(t => t.id !== id) }));
    if (user?.id) {
      const { chapters, topics, categories } = get();
      saveLookups(user.id, { chapters, topics, categories });
    }
    await supabase.from('topics').delete().eq('id', id);
  },

  createCategory: async (name: string) => {
    const { user } = get();
    if (!user?.id) return '';
    const existing = get().categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const id = generateId();
    const category: Category = { id, teacherId: user.id, name, createdAt: Date.now() };
    set((s) => ({ categories: [...s.categories, category].sort((a, b) => a.name.localeCompare(b.name)) }));
    const { chapters, topics, categories } = get();
    saveLookups(user.id, { chapters, topics, categories });
    const { error } = await supabase.from('categories').insert({ id, teacher_id: user.id, name });
    if (error) console.warn('Category saved locally only:', error.message);
    return id;
  },

  deleteCategory: async (id: string) => {
    const { user } = get();
    set((s) => ({ categories: s.categories.filter(c => c.id !== id) }));
    if (user?.id) {
      const { chapters, topics, categories } = get();
      saveLookups(user.id, { chapters, topics, categories });
    }
    await supabase.from('categories').delete().eq('id', id);
  },

  createQuestionPaper: async (title: string, date?: string, maxMarks?: number, courseId?: string, subjectId?: string, classId?: string, instructions?: string, duration?: number) => {
    const { user } = get();
    if (!user?.id) return '';
    const id = generateId();
    const newPaper: QuestionPaper = {
      id,
      qpCode: '',
      teacherId: user.id,
      title,
      date,
      maxMarks,
      courseId,
      subjectId,
      classId,
      instructions,
      isPublished: false,
      totalMarks: 0,
      duration,
      headerConfig: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((state) => ({ questionPapers: [newPaper, ...state.questionPapers], currentPaperId: id }));

    const { error } = await supabase.from('qp_metadata').insert({
      id,
      teacher_id: user.id,
      title,
      date,
      max_marks: maxMarks,
      course_id: courseId,
      subject_id: subjectId,
      class_id: classId,
      instructions: instructions || '',
      is_published: false,
      duration,
    });

    if (error) {
      console.error('Failed to save paper to Supabase:', error.message);
    }

    return id;
  },

  updateQuestionPaper: async (id: string, updates: Partial<QuestionPaper>) => {
    set((state) => ({
      questionPapers: state.questionPapers.map(qp =>
        qp.id === id ? { ...qp, ...updates, updatedAt: Date.now() } : qp
      ),
    }));

    const supabaseUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.title !== undefined) supabaseUpdates.title = updates.title;
    if (updates.date !== undefined) supabaseUpdates.date = updates.date;
    if (updates.maxMarks !== undefined) supabaseUpdates.max_marks = updates.maxMarks;
    if (updates.courseId !== undefined) supabaseUpdates.course_id = updates.courseId;
    if (updates.subjectId !== undefined) supabaseUpdates.subject_id = updates.subjectId;
    if (updates.classId !== undefined) supabaseUpdates.class_id = updates.classId;
    if (updates.instructions !== undefined) supabaseUpdates.instructions = updates.instructions;
    if (updates.isPublished !== undefined) supabaseUpdates.is_published = updates.isPublished;
    if (updates.duration !== undefined) supabaseUpdates.duration = updates.duration;
    if (updates.headerConfig !== undefined) supabaseUpdates.header_config = updates.headerConfig;

    await supabase.from('qp_metadata').update(supabaseUpdates).eq('id', id);
  },

  deleteQuestionPaper: async (id: string) => {
    set((state) => ({
      questionPapers: state.questionPapers.filter(qp => qp.id !== id),
      currentPaperId: state.currentPaperId === id ? null : state.currentPaperId,
    }));
    await supabase.from('qp_metadata').delete().eq('id', id);
  },

  duplicateQuestionPaper: (id: string) => {
    const paper = get().questionPapers.find(qp => qp.id === id);
    if (!paper) return '';
    const newId = generateId();
    const newPaper: QuestionPaper = {
      ...paper,
      id: newId,
      title: `${paper.title} (Copy)`,
      qpCode: '',
      isPublished: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({ questionPapers: [newPaper, ...state.questionPapers] }));
    return newId;
  },

  createQuestion: async (content: string, questionType: QuestionType, options?: string[], courseId?: string, subjectId?: string, classId?: string, difficulty?: Difficulty, explanation?: string, imageUrl?: string) => {
    const { user } = get();
    if (!user?.id) return '';
    const id = generateId();
    const newQuestion: Question = {
      id,
      teacherId: user.id,
      content,
      courseId,
      subjectId,
      classId,
      questionType,
      options: options || [],
      difficulty: difficulty || 'medium',
      explanation,
      imageUrl,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((state) => ({ questions: [newQuestion, ...state.questions] }));

    await supabase.from('questions').insert({
      id,
      teacher_id: user.id,
      content,
      course_id: courseId,
      subject_id: subjectId,
      class_id: classId,
      question_type: questionType,
      options: options || [],
      difficulty: difficulty || 'medium',
    });

    return id;
  },

  updateQuestion: async (id: string, updates: Partial<Question>) => {
    const { questions, paperQuestions } = get();
    const oldQ = questions.find(q => q.id === id);

    set((state) => ({
      questions: state.questions.map(q =>
        q.id === id ? { ...q, ...updates, updatedAt: Date.now() } : q
      ),
    }));

    // Copy-on-Write check: If content was edited and question originated from shared bank, fork it!
    if (updates.content && oldQ && oldQ.content !== updates.content) {
      for (const [, pqs] of paperQuestions.entries()) {
        for (const pq of pqs) {
          if (pq.questionId === id && pq.originType === 'SHARED') {
            void get().updatePaperQuestion(pq.id, {
              originType: 'FORKED',
              parentSharedId: null,
            });
          }
        }
      }
    }

    const supabaseUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.content !== undefined) supabaseUpdates.content = updates.content;
    if (updates.questionType !== undefined) supabaseUpdates.question_type = updates.questionType;
    if (updates.options !== undefined) supabaseUpdates.options = updates.options;
    if (updates.courseId !== undefined) supabaseUpdates.course_id = updates.courseId;
    if (updates.subjectId !== undefined) supabaseUpdates.subject_id = updates.subjectId;
    if (updates.classId !== undefined) supabaseUpdates.class_id = updates.classId;
    if (updates.difficulty !== undefined) supabaseUpdates.difficulty = updates.difficulty;
    if (updates.explanation !== undefined) supabaseUpdates.explanation = updates.explanation;
    if (updates.imageUrl !== undefined) supabaseUpdates.image_url = updates.imageUrl;
    if (updates.typeHeader !== undefined) supabaseUpdates.type_header = updates.typeHeader;
    if (updates.chapterId !== undefined) supabaseUpdates.chapter_id = updates.chapterId || null;
    if (updates.topicId !== undefined) supabaseUpdates.topic_id = updates.topicId || null;
    if (updates.categoryId !== undefined) supabaseUpdates.category_id = updates.categoryId || null;
    if (updates.cognitiveLevel !== undefined) supabaseUpdates.cognitive_level = updates.cognitiveLevel;
    if (updates.marks !== undefined) supabaseUpdates.marks = updates.marks;
    // Normalise empty-string foreign keys to NULL
    for (const k of ['course_id', 'subject_id', 'class_id']) {
      if (supabaseUpdates[k] === '') supabaseUpdates[k] = null;
    }

    await resilientWrite((row) => supabase.from('questions').update(row).eq('id', id), supabaseUpdates, 'updateQuestion');
  },

  deleteQuestion: async (id: string) => {
    set((state) => {
      const newPaperQuestions = new Map(state.paperQuestions);
      for (const [paperId, pqs] of newPaperQuestions) {
        newPaperQuestions.set(paperId, pqs.filter(pq => pq.questionId !== id));
      }
      return {
        questions: state.questions.filter(q => q.id !== id),
        paperQuestions: newPaperQuestions,
      };
    });

    await supabase.from('questions').delete().eq('id', id);
  },

  addQuestionToPaper: async (
    paperId: string,
    questionId: string,
    section: PaperSection = '',
    marks: number = 1,
    parentId?: string,
    isOptional: boolean = false,
    parentSharedId?: string,
    originType: 'ORIGINAL' | 'SHARED' | 'FORKED' = 'ORIGINAL'
  ) => {
    const id = generateId();
    const paperQuestionsList = get().paperQuestions.get(paperId) || [];
    const orderIndex = paperQuestionsList.length;

    const newPQ: PaperQuestion = {
      id,
      paperId,
      questionId,
      section,
      parentId,
      marks,
      orderIndex,
      isOptional,
      parentSharedId,
      originType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((state) => {
      const newPaperQuestions = new Map(state.paperQuestions);
      newPaperQuestions.set(paperId, [...paperQuestionsList, newPQ]);
      return { paperQuestions: newPaperQuestions };
    });

    await supabase.from('paper_questions').insert({
      id,
      paper_id: paperId,
      question_id: questionId,
      section,
      parent_id: parentId || null,
      marks,
      order_index: orderIndex,
      is_optional: isOptional,
      parent_shared_id: parentSharedId || null,
      origin_type: originType,
    });

    return id;
  },

  updatePaperQuestion: async (id: string, updates: Partial<PaperQuestion>) => {
    set((state) => {
      const newPaperQuestions = new Map(state.paperQuestions);
      for (const [paperId, pqs] of newPaperQuestions) {
        const updated = pqs.map(pq =>
          pq.id === id ? { ...pq, ...updates, updatedAt: Date.now() } : pq
        );
        newPaperQuestions.set(paperId, updated);
      }
      return { paperQuestions: newPaperQuestions };
    });

    const supabaseUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.section !== undefined) supabaseUpdates.section = updates.section;
    if (updates.parentId !== undefined) supabaseUpdates.parent_id = updates.parentId;
    if (updates.marks !== undefined) supabaseUpdates.marks = updates.marks;
    if (updates.orderIndex !== undefined) supabaseUpdates.order_index = updates.orderIndex;
    if (updates.isOptional !== undefined) supabaseUpdates.is_optional = updates.isOptional;
    if (updates.parentSharedId !== undefined) supabaseUpdates.parent_shared_id = updates.parentSharedId;
    if (updates.originType !== undefined) supabaseUpdates.origin_type = updates.originType;
    if (updates.subNumberingStyle !== undefined) supabaseUpdates.sub_numbering_style = updates.subNumberingStyle || null;

    await resilientWrite((row) => supabase.from('paper_questions').update(row).eq('id', id), supabaseUpdates, 'updatePaperQuestion');
  },

  removeQuestionFromPaper: async (paperId: string, questionId: string) => {
    set((state) => {
      const newPaperQuestions = new Map(state.paperQuestions);
      const pqs = newPaperQuestions.get(paperId) || [];
      const pqToRemove = pqs.find(pq => pq.questionId === questionId || pq.id === questionId);
      if (!pqToRemove) return state;

      const idsToRemove = new Set<string>([pqToRemove.id]);
      let added = true;
      while (added) {
        added = false;
        for (const pq of pqs) {
          if (pq.parentId && idsToRemove.has(pq.parentId) && !idsToRemove.has(pq.id)) {
            idsToRemove.add(pq.id);
            added = true;
          }
        }
      }

      newPaperQuestions.set(paperId, pqs.filter(pq => !idsToRemove.has(pq.id)));
      return { paperQuestions: newPaperQuestions };
    });

    await supabase.from('paper_questions')
      .delete()
      .eq('paper_id', paperId)
      .or(`question_id.eq.${questionId},id.eq.${questionId}`);
  },

  reorderPaperQuestions: async (paperId: string, paperQuestionsList: PaperQuestion[]) => {
    set((state) => {
      const newPaperQuestions = new Map(state.paperQuestions);
      newPaperQuestions.set(paperId, paperQuestionsList);
      return { paperQuestions: newPaperQuestions };
    });

    const updates = paperQuestionsList.map((pq, i) => ({
      id: pq.id,
      order_index: i,
    }));

    await supabase.from('paper_questions').upsert(updates);
  },

  createAndAddQuestion: async (
    paperId: string,
    content: string,
    questionType: QuestionType,
    options?: string[],
    section?: string,
    parentId?: string,
    marks?: number,
    courseId?: string,
    subjectId?: string,
    classId?: string,
    difficulty?: Difficulty,
    explanation?: string,
    imageUrl?: string,
    typeHeader?: string,
    isOptional?: boolean,
    parentSharedId?: string,
    originType: 'ORIGINAL' | 'SHARED' | 'FORKED' = 'ORIGINAL',
    meta?: QuestionMeta,
    subNumberingStyle?: PaperQuestion['subNumberingStyle']
  ) => {
    const { user, questionPapers, shareQuestionToBank } = get();
    if (!user?.id) return '';

    const questionId = generateId();
    const pqId = generateId();
    const paper = questionPapers.find(qp => qp.id === paperId);
    const paperQuestionsList = get().paperQuestions.get(paperId) || [];
    const orderIndex = paperQuestionsList.length;
    const finalMarks = questionType === 'text' ? 0 : (marks ?? 1);

    // Course / Subject / Class default to the paper details unless explicitly chosen
    const resolvedCourseId = meta?.courseId || courseId || paper?.courseId || undefined;
    const resolvedSubjectId = meta?.subjectId || subjectId || paper?.subjectId || undefined;
    const resolvedClassId = meta?.classId || classId || paper?.classId || undefined;
    const cognitiveLevel = meta?.cognitiveLevel || DEFAULT_COGNITIVE_LEVEL;

    const newQuestion: Question = {
      id: questionId,
      teacherId: user.id,
      content,
      courseId: resolvedCourseId,
      subjectId: resolvedSubjectId,
      classId: resolvedClassId,
      questionType,
      options: options || [],
      difficulty: difficulty || 'medium',
      explanation,
      imageUrl,
      typeHeader,
      chapterId: meta?.chapterId,
      topicId: meta?.topicId,
      categoryId: meta?.categoryId,
      cognitiveLevel,
      marks: finalMarks,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const newPQ: PaperQuestion = {
      id: pqId,
      paperId,
      questionId,
      section: section ?? '',
      parentId,
      marks: finalMarks,
      orderIndex,
      isOptional: Boolean(isOptional),
      parentSharedId: parentSharedId || null,
      originType,
      subNumberingStyle: subNumberingStyle || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((state) => ({
      questions: [newQuestion, ...state.questions],
      paperQuestions: new Map(state.paperQuestions).set(paperId, [...paperQuestionsList, newPQ]),
    }));

    await resilientWrite((row) => supabase.from('questions').insert(row), {
      id: questionId,
      teacher_id: user.id,
      content,
      course_id: resolvedCourseId || null,
      subject_id: resolvedSubjectId || null,
      class_id: resolvedClassId || null,
      question_type: questionType,
      options: options || [],
      difficulty: difficulty || 'medium',
      explanation,
      image_url: imageUrl,
      type_header: typeHeader,
      chapter_id: meta?.chapterId || null,
      topic_id: meta?.topicId || null,
      category_id: meta?.categoryId || null,
      cognitive_level: cognitiveLevel,
      marks: finalMarks,
    }, 'createQuestion');

    await resilientWrite((row) => supabase.from('paper_questions').insert(row), {
      id: pqId,
      paper_id: paperId,
      question_id: questionId,
      section: section ?? '',
      parent_id: parentId || null,
      marks: finalMarks,
      order_index: orderIndex,
      is_optional: isOptional || false,
      parent_shared_id: parentSharedId || null,
      origin_type: originType,
      sub_numbering_style: subNumberingStyle || null,
    }, 'addPaperQuestion');

    // Shared Question Bank: Auto-contribute if user's questions are NOT private
    if (originType === 'ORIGINAL' && !user.keepQuestionsPrivate && content.trim().length > 10) {
      if (!parentId) {
        void shareQuestionToBank({
          content,
          questionType,
          options,
          difficulty,
          typeHeader,
          meta: { ...meta, courseId: resolvedCourseId, subjectId: resolvedSubjectId, classId: resolvedClassId, cognitiveLevel },
          marks: finalMarks,
        });
      } else {
        // Attach this subquestion to the parent SharedQuestion in the shared bank
        const allPQsForPaper = get().paperQuestions.get(paperId) || [];
        const parentPQ = allPQsForPaper.find(p => p.id === parentId);
        const parentQ = parentPQ ? get().questions.find(q => q.id === parentPQ.questionId) : undefined;
        if (parentQ) {
          const childPQs = allPQsForPaper.filter(p => p.parentId === parentId);
          const bankSubqs = childPQs.map(cpq => {
            const cq = get().questions.find(q => q.id === cpq.questionId);
            return {
              id: cpq.questionId,
              content: cq?.content || '',
              marks: cpq.marks || 1,
              questionType: cq?.questionType || 'subjective',
              options: cq?.options || [],
              difficulty: cq?.difficulty || 'medium',
              cognitiveLevel: cq?.cognitiveLevel || DEFAULT_COGNITIVE_LEVEL,
              explanation: cq?.explanation,
            };
          });
          void shareQuestionToBank({
            content: parentQ.content,
            questionType: parentQ.questionType,
            options: parentQ.options,
            difficulty: parentQ.difficulty,
            typeHeader: parentQ.typeHeader,
            meta: {
              courseId: parentQ.courseId || resolvedCourseId,
              subjectId: parentQ.subjectId || resolvedSubjectId,
              classId: parentQ.classId || resolvedClassId,
              chapterId: parentQ.chapterId,
              topicId: parentQ.topicId,
              categoryId: parentQ.categoryId,
              cognitiveLevel: parentQ.cognitiveLevel || DEFAULT_COGNITIVE_LEVEL,
            },
            marks: parentPQ?.marks || parentQ.marks,
            subquestions: bankSubqs,
          });
        }
      }
    }

    return pqId;
  },

  shareQuestionToBank: async ({
    content,
    questionType,
    options,
    difficulty,
    typeHeader,
    topic,
    meta,
    marks,
    subquestions,
  }) => {
    const { user, sharedQuestions, courses, subjects, classes, chapters, topics, categories } = get();
    if (!user || user.keepQuestionsPrivate) return null;

    const nameOf = <T extends { id: string; name: string }>(list: T[], id?: string) => (id ? list.find(x => x.id === id)?.name : undefined);
    const topicName = topic || nameOf(topics, meta?.topicId);
    const names = {
      courseName: nameOf(courses, meta?.courseId),
      subjectName: nameOf(subjects, meta?.subjectId),
      className: nameOf(classes, meta?.classId),
      chapter: nameOf(chapters, meta?.chapterId),
      category: nameOf(categories, meta?.categoryId),
    };
    const cognitiveLevel = meta?.cognitiveLevel || DEFAULT_COGNITIVE_LEVEL;

    const hash = await computeContentHash(content);

    // Flowchart: Vector / MD5 similarity check
    // If exact match or > 95% similarity, link to existing
    const existing = sharedQuestions.find(sq => {
      if (sq.contentHash === hash) return true;
      return calculateTextSimilarity(sq.content, content) >= 0.95;
    });

    if (existing) {
      if (subquestions && subquestions.length > 0) {
        const updatedList = sharedQuestions.map(sq =>
          sq.id === existing.id
            ? { ...sq, subquestions, marks: marks ?? sq.marks }
            : sq
        );
        set({ sharedQuestions: updatedList });
        saveLocalSharedQuestions(updatedList);
        await resilientWrite(
          (row) => supabase.from('shared_questions').update(row).eq('id', existing.id),
          { subquestions, marks: marks ?? existing.marks ?? null },
          'updateSharedQuestionSubquestions'
        );
      }
      return existing.id;
    }

    const newSharedId = generateId();
    const newSharedQ: SharedQuestion = {
      id: newSharedId,
      content,
      contentHash: hash,
      createdByUserId: user.id,
      authorName: user.fullName || 'Teacher',
      topic: topicName || 'General',
      questionType,
      options: options || [],
      difficulty: difficulty || 'medium',
      typeHeader,
      usageCount: 0,
      courseName: names.courseName,
      subjectName: names.subjectName,
      className: names.className,
      chapter: names.chapter,
      category: names.category,
      cognitiveLevel,
      marks: marks ?? undefined,
      subquestions: subquestions && subquestions.length > 0 ? subquestions : undefined,
      createdAt: Date.now(),
    };

    const updated = [newSharedQ, ...sharedQuestions];
    set({ sharedQuestions: updated });
    saveLocalSharedQuestions(updated);

    await resilientWrite((row) => supabase.from('shared_questions').insert(row), {
      id: newSharedId,
      content,
      content_hash: hash,
      created_by_user_id: user.id,
      author_name: user.fullName || 'Teacher',
      topic: topicName || 'General',
      question_type: questionType,
      options: options || [],
      difficulty: difficulty || 'medium',
      type_header: typeHeader,
      usage_count: 0,
      course_name: names.courseName || null,
      subject_name: names.subjectName || null,
      class_name: names.className || null,
      chapter: names.chapter || null,
      category: names.category || null,
      cognitive_level: cognitiveLevel,
      marks: marks ?? null,
      subquestions: subquestions && subquestions.length > 0 ? subquestions : null,
    }, 'shareQuestionToBank');

    return newSharedId;
  },

  importSharedQuestionToPaper: async (paperId: string, sharedQ: SharedQuestion, section: string = '', marks: number = 1, parentId?: string, isOptional: boolean = false) => {
    const { user, createAndAddQuestion, sendQuestionUsageNotification, courses, subjects, classes, chapters, topics, categories } = get();
    if (!user?.id) return '';

    // If shared question has name-based metadata, find matching IDs in current teacher's library
    const matchedCourse = sharedQ.courseName ? courses.find(c => c.name.toLowerCase() === sharedQ.courseName?.toLowerCase()) : undefined;
    const matchedSubject = sharedQ.subjectName ? subjects.find(s => s.name.toLowerCase() === sharedQ.subjectName?.toLowerCase()) : undefined;
    const matchedClass = sharedQ.className ? classes.find(c => c.name.toLowerCase() === sharedQ.className?.toLowerCase()) : undefined;
    const matchedChapter = sharedQ.chapter ? chapters.find(c => c.name.toLowerCase() === sharedQ.chapter?.toLowerCase()) : undefined;
    const matchedTopic = sharedQ.topic ? topics.find(t => t.name.toLowerCase() === sharedQ.topic?.toLowerCase()) : undefined;
    const matchedCategory = sharedQ.category ? categories.find(c => c.name.toLowerCase() === sharedQ.category?.toLowerCase()) : undefined;

    const pqId = await createAndAddQuestion(
      paperId,
      sharedQ.content,
      sharedQ.questionType,
      sharedQ.options,
      section,
      parentId,
      sharedQ.marks ?? marks,
      sharedQ.courseId || matchedCourse?.id,
      sharedQ.subjectId || matchedSubject?.id,
      sharedQ.classId || matchedClass?.id,
      sharedQ.difficulty,
      undefined,
      undefined,
      sharedQ.typeHeader,
      isOptional,
      sharedQ.id,
      'SHARED',
      {
        courseId: sharedQ.courseId || matchedCourse?.id,
        subjectId: sharedQ.subjectId || matchedSubject?.id,
        classId: sharedQ.classId || matchedClass?.id,
        chapterId: matchedChapter?.id,
        topicId: matchedTopic?.id,
        categoryId: matchedCategory?.id,
        cognitiveLevel: sharedQ.cognitiveLevel || DEFAULT_COGNITIVE_LEVEL,
      }
    );

    // Update shared question usage count
    set((state) => {
      const updated = state.sharedQuestions.map(sq =>
        sq.id === sharedQ.id ? { ...sq, usageCount: (sq.usageCount || 0) + 1 } : sq
      );
      saveLocalSharedQuestions(updated);
      return { sharedQuestions: updated };
    });

    // Log Usage to Database & trigger notification email + in-app notification
    void sendQuestionUsageNotification(sharedQ);

    return pqId;
  },

  sendQuestionUsageNotification: async (sharedQ: SharedQuestion) => {
    const { user } = get();
    const senderName = user?.fullName || 'Another Educator';
    const cleanContent = sharedQ.content.replace(/<[^>]*>/g, '').trim().substring(0, 100);

    const notifId = generateId();
    const newNotif: AppNotification = {
      id: notifId,
      recipientId: sharedQ.createdByUserId,
      senderId: user?.id,
      senderName,
      title: 'Your shared question was selected!',
      message: `Great news! Another educator on QuestForma just selected one of your shared questions for their test paper: "${cleanContent}"\n\nThank you for contributing to the shared question bank and helping fellow teachers save time on test formatting!\n\nKeep up the great work,\nQuestForma | ExamFriendly`,
      questionContent: sharedQ.content,
      createdAt: Date.now(),
      read: false,
    };

    // Save notification locally
    const currentNotifs = getStoredLocalNotifications();
    const updatedNotifs = [newNotif, ...currentNotifs];
    saveLocalNotifications(updatedNotifs);
    if (sharedQ.createdByUserId === user?.id) {
      set({ notifications: [newNotif, ...get().notifications] });
    }

    // Persist to Supabase if available
    try {
      await supabase.from('question_usage_logs').insert({
        shared_question_id: sharedQ.id,
        used_by_teacher_id: user?.id,
        owner_teacher_id: sharedQ.createdByUserId,
      });

      await supabase.from('notifications').insert({
        id: notifId,
        recipient_id: sharedQ.createdByUserId,
        sender_id: user?.id,
        sender_name: senderName,
        title: newNotif.title,
        message: newNotif.message,
        question_content: sharedQ.content,
        read: false,
      });

      await supabase.rpc('increment_shared_usage', { q_id: sharedQ.id });
    } catch {}
  },
}));