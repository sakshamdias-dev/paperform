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
  SubQuestionNumberingStyle,
} from './types';
import { DEFAULT_COGNITIVE_LEVEL } from './types';
import { supabase } from './supabase';
import { computeContentHash, calculateTextSimilarity } from './utils/sharedBank';
import { INITIAL_SHARED_QUESTIONS } from './utils/seedSharedQuestions';
import {
  clearGuestWorkspace,
  createGuestUser,
  hasGuestWorkspaceData,
  isGuestUser,
  loadGuestWorkspace,
  saveGuestWorkspace,
} from './utils/guestWorkspace';

const LOCAL_SHARED_QUESTIONS_KEY = 'questforma_shared_questions_v1';
const LOCAL_NOTIFICATIONS_KEY = 'questforma_notifications_v1';
const LOCAL_LOOKUPS_KEY = 'questforma_lookups_v1';
const LOCAL_USER_KEY = 'questforma_user_v1';

function getStoredLocalUser(): User | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveLocalUser(user: User | null) {
  try {
    if (user) {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_USER_KEY);
    }
  } catch {}
}

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

function cleanTextForNotif(html: string): string {
  if (!html) return '';
  return html
    .replace(/<span[^>]*class=["'][^"']*ql-formula[^"']*["'][^>]*data-value=["']([^"']*)["'][^>]*>[\s\S]*?<\/span>/gi, ' \\($1\\) ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function getStoredLocalNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((n: AppNotification) => ({
          ...n,
          message: (n.message || '').replace(/&nbsp;/gi, ' '),
        }));
      }
    }
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
  enterGuestMode: () => void;
  syncGuestWorkspaceToAccount: (realUserId: string) => Promise<void>;
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
  updateProfile: (updates: { fullName?: string; schoolName?: string }) => Promise<boolean>;
  
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
  duplicateQuestionPaper: (id: string) => Promise<string>;
  
  createQuestion: (
    content: string,
    questionType: QuestionType,
    options?: string[],
    courseId?: string,
    subjectId?: string,
    classId?: string,
    difficulty?: Difficulty,
    explanation?: string,
    imageUrl?: string,
    meta?: QuestionMeta,
    marks?: number,
    parentId?: string,
    subquestions?: SharedQuestion['subquestions'],
    subNumberingStyle?: SubQuestionNumberingStyle
  ) => Promise<string>;
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

const USER_WORKSPACE_CACHE_PREFIX = 'questforma_workspace_cache_v1_';

interface CachedWorkspaceSnapshot {
  courses: Course[];
  subjects: Subject[];
  classes: Class[];
  chapters: Chapter[];
  topics: Topic[];
  categories: Category[];
  questionPapers: QuestionPaper[];
  questions: Question[];
  paperQuestionsEntries: [string, PaperQuestion[]][];
}

function loadUserWorkspaceCache(userId?: string | null): CachedWorkspaceSnapshot | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`${USER_WORKSPACE_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedWorkspaceSnapshot>;
    return {
      courses: Array.isArray(parsed.courses) ? parsed.courses : [],
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      classes: Array.isArray(parsed.classes) ? parsed.classes : [],
      chapters: Array.isArray(parsed.chapters) ? parsed.chapters : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      questionPapers: Array.isArray(parsed.questionPapers) ? parsed.questionPapers : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      paperQuestionsEntries: Array.isArray(parsed.paperQuestionsEntries) ? parsed.paperQuestionsEntries : [],
    };
  } catch {
    return null;
  }
}

let cacheWriteTimer: ReturnType<typeof setTimeout> | null = null;

function persistWorkspaceSnapshot(state: AppState) {
  if (!state.user?.id) return;
  const snapshot: CachedWorkspaceSnapshot = {
    courses: state.courses,
    subjects: state.subjects,
    classes: state.classes,
    chapters: state.chapters,
    topics: state.topics,
    categories: state.categories,
    questionPapers: state.questionPapers,
    questions: state.questions,
    paperQuestionsEntries: Array.from(state.paperQuestions.entries()),
  };
  if (isGuestUser(state.user)) {
    saveGuestWorkspace(snapshot);
    return;
  }
  const userId = state.user.id;
  if (cacheWriteTimer) clearTimeout(cacheWriteTimer);
  cacheWriteTimer = setTimeout(() => {
    try {
      localStorage.setItem(`${USER_WORKSPACE_CACHE_PREFIX}${userId}`, JSON.stringify(snapshot));
    } catch {
      // Ignore quota exceeded errors on very large base64 payloads
    }
  }, 120);
}

const initialStoredUser = getStoredLocalUser();
const initialWorkspaceData = isGuestUser(initialStoredUser)
  ? loadGuestWorkspace()
  : loadUserWorkspaceCache(initialStoredUser?.id);

let guestMigrationPromise: Promise<void> | null = null;

const inFlightFetches = new Map<string, Promise<void>>();
const lastFetchTimestamps = new Map<string, number>();

function dedupeFetch(key: string, ttlMs: number, fn: () => Promise<void>): Promise<void> {
  const existing = inFlightFetches.get(key);
  if (existing) return existing;
  const lastAt = lastFetchTimestamps.get(key) || 0;
  if (ttlMs > 0 && Date.now() - lastAt < ttlMs) {
    return Promise.resolve();
  }
  const promise = fn().finally(() => {
    inFlightFetches.delete(key);
    lastFetchTimestamps.set(key, Date.now());
  });
  inFlightFetches.set(key, promise);
  return promise;
}

function mapDbQuestionRow(q: Record<string, any>): Question {
  return {
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
    createdAt: q.created_at ? new Date(q.created_at).getTime() : Date.now(),
    updatedAt: q.updated_at ? new Date(q.updated_at).getTime() : Date.now(),
  };
}

export const useStore = create<AppState>()((set, get) => ({
  user: initialStoredUser,
  courses: initialWorkspaceData?.courses || [],
  subjects: initialWorkspaceData?.subjects || [],
  classes: initialWorkspaceData?.classes || [],
  chapters: initialWorkspaceData?.chapters || [],
  topics: initialWorkspaceData?.topics || [],
  categories: initialWorkspaceData?.categories || [],
  questionPapers: initialWorkspaceData?.questionPapers || [],
  questions: initialWorkspaceData?.questions || [],
  paperQuestions: new Map(initialWorkspaceData?.paperQuestionsEntries || []),
  sharedQuestions: getStoredLocalSharedQuestions(),
  notifications: getStoredLocalNotifications(),
  currentPaperId: null,
  loading: false,

  setUser: (user) => {
    const prevUserId = get().user?.id;
    saveLocalUser(user);
    if (user?.id && !isGuestUser(user) && prevUserId !== user.id) {
      const cached = loadUserWorkspaceCache(user.id);
      if (cached) {
        set({
          user,
          courses: cached.courses,
          subjects: cached.subjects,
          classes: cached.classes,
          chapters: cached.chapters,
          topics: cached.topics,
          categories: cached.categories,
          questionPapers: cached.questionPapers,
          questions: cached.questions,
          paperQuestions: new Map(cached.paperQuestionsEntries),
        });
        return;
      }
    }
    set({ user });
  },
  enterGuestMode: () => {
    const existing = get().user;
    if (existing && !isGuestUser(existing)) return;
    const guestUser = isGuestUser(existing) && existing ? existing : createGuestUser();
    const guestData = loadGuestWorkspace();
    saveLocalUser(guestUser);
    set({
      user: guestUser,
      courses: guestData.courses,
      subjects: guestData.subjects,
      classes: guestData.classes,
      chapters: guestData.chapters,
      topics: guestData.topics,
      categories: guestData.categories,
      questionPapers: guestData.questionPapers,
      questions: guestData.questions,
      paperQuestions: new Map(guestData.paperQuestionsEntries),
      loading: false,
    });
  },
  syncGuestWorkspaceToAccount: async (realUserId: string) => {
    if (!hasGuestWorkspaceData()) {
      clearGuestWorkspace();
      return;
    }
    if (guestMigrationPromise) return guestMigrationPromise;

    guestMigrationPromise = (async () => {
      try {
        const guest = loadGuestWorkspace();

        // Fetch existing lookups for the target account so we never hit unique(teacher_id, name) conflicts
        const [exCoursesRes, exSubjectsRes, exClassesRes] = await Promise.all([
          supabase.from('courses').select('id, name').eq('teacher_id', realUserId),
          supabase.from('subjects').select('id, name').eq('teacher_id', realUserId),
          supabase.from('classes').select('id, name').eq('teacher_id', realUserId),
        ]);

        const courseIdMap = new Map<string, string>();
        const exCourses = exCoursesRes.data || [];
        for (const c of guest.courses) {
          const match = exCourses.find(e => e.name.toLowerCase() === c.name.toLowerCase());
          if (match) {
            courseIdMap.set(c.id, match.id);
          } else {
            const used = guest.questionPapers.some(p => p.courseId === c.id) || guest.questions.some(q => q.courseId === c.id);
            if (used) {
              const { error } = await supabase.from('courses').insert({ id: c.id, teacher_id: realUserId, name: c.name });
              courseIdMap.set(c.id, error ? c.id : c.id);
            }
          }
        }

        const subjectIdMap = new Map<string, string>();
        const exSubjects = exSubjectsRes.data || [];
        for (const s of guest.subjects) {
          const match = exSubjects.find(e => e.name.toLowerCase() === s.name.toLowerCase());
          if (match) {
            subjectIdMap.set(s.id, match.id);
          } else {
            const used = guest.questionPapers.some(p => p.subjectId === s.id) || guest.questions.some(q => q.subjectId === s.id);
            if (used) {
              await supabase.from('subjects').insert({ id: s.id, teacher_id: realUserId, name: s.name });
              subjectIdMap.set(s.id, s.id);
            }
          }
        }

        const classIdMap = new Map<string, string>();
        const exClasses = exClassesRes.data || [];
        for (const cl of guest.classes) {
          const match = exClasses.find(e => e.name.toLowerCase() === cl.name.toLowerCase());
          if (match) {
            classIdMap.set(cl.id, match.id);
          } else {
            const used = guest.questionPapers.some(p => p.classId === cl.id) || guest.questions.some(q => q.classId === cl.id);
            if (used) {
              await supabase.from('classes').insert({ id: cl.id, teacher_id: realUserId, name: cl.name });
              classIdMap.set(cl.id, cl.id);
            }
          }
        }

        // Insert custom chapters / topics / categories
        for (const ch of guest.chapters) {
          await supabase.from('chapters').upsert({
            id: ch.id,
            teacher_id: realUserId,
            name: ch.name,
            subject_id: (ch.subjectId && subjectIdMap.get(ch.subjectId)) || ch.subjectId || null,
          });
        }
        for (const tp of guest.topics) {
          await supabase.from('topics').upsert({
            id: tp.id,
            teacher_id: realUserId,
            name: tp.name,
            chapter_id: tp.chapterId || null,
          });
        }
        for (const ct of guest.categories) {
          await supabase.from('categories').upsert({
            id: ct.id,
            teacher_id: realUserId,
            name: ct.name,
          });
        }

        // Insert guest questions (parents first, then children)
        const parentQs = guest.questions.filter(q => !q.parentId);
        const childQs = guest.questions.filter(q => q.parentId);
        for (const q of [...parentQs, ...childQs]) {
          await resilientWrite((row) => supabase.from('questions').upsert(row), {
            id: q.id,
            teacher_id: realUserId,
            content: q.content,
            course_id: (q.courseId && courseIdMap.get(q.courseId)) || q.courseId || null,
            subject_id: (q.subjectId && subjectIdMap.get(q.subjectId)) || q.subjectId || null,
            class_id: (q.classId && classIdMap.get(q.classId)) || q.classId || null,
            question_type: q.questionType,
            options: q.options || [],
            difficulty: q.difficulty || 'medium',
            chapter_id: q.chapterId || null,
            topic_id: q.topicId || null,
            category_id: q.categoryId || null,
            cognitive_level: q.cognitiveLevel || DEFAULT_COGNITIVE_LEVEL,
            marks: q.marks ?? 1,
            parent_id: q.parentId || null,
            sub_numbering_style: q.subNumberingStyle || null,
            explanation: q.explanation,
            image_url: q.imageUrl,
          }, 'migrateGuestQuestion');
        }

        // Insert guest question papers & their paper_questions
        for (const qp of guest.questionPapers) {
          await supabase.from('qp_metadata').upsert({
            id: qp.id,
            teacher_id: realUserId,
            title: qp.title,
            date: qp.date,
            max_marks: qp.maxMarks,
            course_id: (qp.courseId && courseIdMap.get(qp.courseId)) || qp.courseId || null,
            subject_id: (qp.subjectId && subjectIdMap.get(qp.subjectId)) || qp.subjectId || null,
            class_id: (qp.classId && classIdMap.get(qp.classId)) || qp.classId || null,
            instructions: qp.instructions || '',
            is_published: qp.isPublished || false,
            duration: qp.duration,
            header_config: qp.headerConfig || {},
          });
        }

        for (const [, pqs] of guest.paperQuestionsEntries) {
          const parents = pqs.filter(pq => !pq.parentId);
          const children = pqs.filter(pq => pq.parentId);
          for (const pq of [...parents, ...children]) {
            await resilientWrite((row) => supabase.from('paper_questions').upsert(row), {
              id: pq.id,
              paper_id: pq.paperId,
              question_id: pq.questionId,
              section: pq.section || '',
              parent_id: pq.parentId || null,
              marks: pq.marks || 0,
              order_index: pq.orderIndex,
              is_optional: pq.isOptional || false,
              parent_shared_id: pq.parentSharedId || null,
              origin_type: pq.originType || 'ORIGINAL',
              sub_numbering_style: pq.subNumberingStyle || null,
            }, 'migrateGuestPaperQuestion');
          }
        }

        clearGuestWorkspace();
      } catch (err) {
        console.error('[syncGuestWorkspaceToAccount]', err);
      } finally {
        guestMigrationPromise = null;
      }
    })();

    return guestMigrationPromise;
  },
  setCurrentPaper: (id) => set({ currentPaperId: id }),
  setLoading: (loading) => set({ loading }),
  logout: () => {
    const prevUser = get().user;
    if (isGuestUser(prevUser)) {
      clearGuestWorkspace();
    } else if (prevUser?.id) {
      try {
        localStorage.removeItem(`${USER_WORKSPACE_CACHE_PREFIX}${prevUser.id}`);
      } catch {}
    }
    inFlightFetches.clear();
    lastFetchTimestamps.clear();
    saveLocalUser(null);
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
    const nextUser = { ...user, keepQuestionsPrivate: nextVal };
    set({ user: nextUser });
    if (isGuestUser(user)) { saveLocalUser(nextUser); return; }
    try {
      localStorage.setItem('questforma_privacy_pref', String(nextVal));
      await supabase.from('profiles').update({ keep_questions_private: nextVal }).eq('id', user.id);
    } catch (e) {
      console.warn('Could not persist privacy toggle to database:', e);
    }
  },

  updateProfile: async ({ fullName, schoolName }) => {
    const { user } = get();
    if (!user) return false;
    const next = {
      ...user,
      ...(fullName !== undefined ? { fullName } : {}),
      ...(schoolName !== undefined ? { schoolName } : {}),
      updatedAt: Date.now(),
    };
    set({ user: next });
    if (isGuestUser(user)) { saveLocalUser(next); return true; }
    const row: Record<string, string> = {};
    if (fullName !== undefined) row.full_name = fullName;
    if (schoolName !== undefined) row.school_name = schoolName;
    const { error } = await supabase.from('profiles').update(row).eq('id', user.id);
    if (error) {
      console.error('[updateProfile]', error.message);
      return false;
    }
    return true;
  },

  fetchCourses: async () => {
    const { user } = get();
    if (!user?.id || isGuestUser(user)) return;
    return dedupeFetch(`courses:${user.id}`, 8000, async () => {
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
        persistWorkspaceSnapshot(get());
      }
    });
  },

  fetchSubjects: async () => {
    const { user } = get();
    if (!user?.id || isGuestUser(user)) return;
    return dedupeFetch(`subjects:${user.id}`, 8000, async () => {
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
        persistWorkspaceSnapshot(get());
      }
    });
  },

  fetchClasses: async () => {
    const { user } = get();
    if (!user?.id || isGuestUser(user)) return;
    return dedupeFetch(`classes:${user.id}`, 8000, async () => {
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
        persistWorkspaceSnapshot(get());
      }
    });
  },

  fetchQuestionPapers: async () => {
    const { user } = get();
    if (!user?.id || isGuestUser(user)) return;
    return dedupeFetch(`papers:${user.id}`, 4000, async () => {
      const hadPapers = get().questionPapers.length > 0;
      if (!hadPapers) set({ loading: true });
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
        set({ questionPapers, loading: false });
        persistWorkspaceSnapshot(get());
        return;
      }
      set({ loading: false });
    });
  },

  fetchQuestions: async () => {
    const { user } = get();
    if (!user?.id || isGuestUser(user)) return;
    return dedupeFetch(`questions:${user.id}`, 5000, async () => {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const questions: Question[] = data.map(mapDbQuestionRow);
        set({ questions });
        persistWorkspaceSnapshot(get());
      }
    });
  },

  fetchPaperQuestions: async (paperId: string) => {
    if (isGuestUser(get().user)) return;
    return dedupeFetch(`paperQuestions:${paperId}`, 2000, async () => {
      // Join `questions(*)` so the paper's questions and their content arrive in a single fast round-trip
      let { data, error } = await supabase
        .from('paper_questions')
        .select('*, questions(*)')
        .eq('paper_id', paperId)
        .order('order_index', { ascending: true });

      if (error) {
        // Fallback if relational join is unavailable
        const fallback = await supabase
          .from('paper_questions')
          .select('*')
          .eq('paper_id', paperId)
          .order('order_index', { ascending: true });
        data = fallback.data;
        error = fallback.error;
      }

      if (!error && data) {
        const joinedQuestions: Question[] = [];
        const pq: PaperQuestion[] = data.map((item: Record<string, any>) => {
          if (item.questions && typeof item.questions === 'object' && !Array.isArray(item.questions)) {
            joinedQuestions.push(mapDbQuestionRow(item.questions));
          }
          return {
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
          };
        });
        set((state) => {
          const newPaperQuestions = new Map(state.paperQuestions);
          newPaperQuestions.set(paperId, pq);
          if (joinedQuestions.length === 0) {
            return { paperQuestions: newPaperQuestions };
          }
          const byId = new Map(state.questions.map(q => [q.id, q]));
          for (const jq of joinedQuestions) {
            byId.set(jq.id, jq);
          }
          return {
            paperQuestions: newPaperQuestions,
            questions: Array.from(byId.values()),
          };
        });
        persistWorkspaceSnapshot(get());
      }
    });
  },

  fetchSharedQuestions: async () => {
    const localStored = getStoredLocalSharedQuestions();
    if (isGuestUser(get().user)) { set({ sharedQuestions: localStored }); return; }
    return dedupeFetch('sharedQuestions', 15000, async () => {
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
    });
  },

  fetchNotifications: async () => {
    const { user } = get();
    if (!user?.id || isGuestUser(user)) return;
    return dedupeFetch(`notifications:${user.id}`, 10000, async () => {
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
            message: (n.message || '').replace(/&nbsp;/gi, ' '),
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
    });
  },

  markNotificationAsRead: async (id: string) => {
    set((state) => {
      const updated = state.notifications.map(n => n.id === id ? { ...n, read: true } : n);
      saveLocalNotifications(updated);
      return { notifications: updated };
    });
    if (isGuestUser(get().user)) return;
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    } catch {}
  },

  clearNotifications: async () => {
    const { user } = get();
    set({ notifications: [] });
    saveLocalNotifications([]);
    if (user?.id && !isGuestUser(user)) {
      try {
        await supabase.from('notifications').delete().eq('recipient_id', user.id);
      } catch {}
    }
  },

  createCourse: async (name: string) => {
    const { user } = get();
    if (!user?.id) return '';
    const existing = get().courses.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const id = generateId();
    set((state) => ({ courses: [...state.courses, {
      id,
      teacherId: user.id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }].sort((a, b) => a.name.localeCompare(b.name)) }));

    persistWorkspaceSnapshot(get());
    if (isGuestUser(user)) return id;
    await supabase.from('courses').insert({ id, teacher_id: user.id, name });
    return id;
  },

  updateCourse: async (id: string, name: string) => {
    set((state) => ({
      courses: state.courses.map(c => c.id === id ? { ...c, name, updatedAt: Date.now() } : c),
    }));
    persistWorkspaceSnapshot(get());
    if (isGuestUser(get().user)) return;
    await supabase.from('courses').update({ name }).eq('id', id);
  },

  deleteCourse: async (id: string) => {
    set((state) => ({ courses: state.courses.filter(c => c.id !== id) }));
    persistWorkspaceSnapshot(get());
    if (isGuestUser(get().user)) return;
    await supabase.from('courses').delete().eq('id', id);
  },

  createSubject: async (name: string) => {
    const { user } = get();
    if (!user?.id) return '';
    const existing = get().subjects.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const id = generateId();
    set((state) => ({ subjects: [...state.subjects, {
      id,
      teacherId: user.id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }].sort((a, b) => a.name.localeCompare(b.name)) }));

    persistWorkspaceSnapshot(get());
    if (isGuestUser(user)) return id;
    await supabase.from('subjects').insert({ id, teacher_id: user.id, name });
    return id;
  },

  updateSubject: async (id: string, name: string) => {
    set((state) => ({
      subjects: state.subjects.map(s => s.id === id ? { ...s, name, updatedAt: Date.now() } : s),
    }));
    persistWorkspaceSnapshot(get());
    if (isGuestUser(get().user)) return;
    await supabase.from('subjects').update({ name }).eq('id', id);
  },

  deleteSubject: async (id: string) => {
    set((state) => ({ subjects: state.subjects.filter(s => s.id !== id) }));
    persistWorkspaceSnapshot(get());
    if (isGuestUser(get().user)) return;
    await supabase.from('subjects').delete().eq('id', id);
  },

  createClass: async (name: string) => {
    const { user } = get();
    if (!user?.id) return '';
    const existing = get().classes.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const id = generateId();
    set((state) => ({ classes: [...state.classes, {
      id,
      teacherId: user.id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }].sort((a, b) => a.name.localeCompare(b.name)) }));

    persistWorkspaceSnapshot(get());
    if (isGuestUser(user)) return id;
    await supabase.from('classes').insert({ id, teacher_id: user.id, name });
    return id;
  },

  updateClass: async (id: string, name: string) => {
    set((state) => ({
      classes: state.classes.map(c => c.id === id ? { ...c, name, updatedAt: Date.now() } : c),
    }));
    persistWorkspaceSnapshot(get());
    if (isGuestUser(get().user)) return;
    await supabase.from('classes').update({ name }).eq('id', id);
  },

  deleteClass: async (id: string) => {
    set((state) => ({ classes: state.classes.filter(c => c.id !== id) }));
    persistWorkspaceSnapshot(get());
    if (isGuestUser(get().user)) return;
    await supabase.from('classes').delete().eq('id', id);
  },

  fetchLookups: async () => {
    const { user } = get();
    if (!user?.id || isGuestUser(user)) return;
    return dedupeFetch(`lookups:${user.id}`, 10000, async () => {
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
      persistWorkspaceSnapshot(get());
    });
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
    persistWorkspaceSnapshot(get());
    if (isGuestUser(user)) return id;
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
    if (isGuestUser(user)) { persistWorkspaceSnapshot(get()); return; }
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
    persistWorkspaceSnapshot(get());
    if (isGuestUser(user)) return id;
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
    if (isGuestUser(user)) { persistWorkspaceSnapshot(get()); return; }
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
    persistWorkspaceSnapshot(get());
    if (isGuestUser(user)) return id;
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
    if (isGuestUser(user)) { persistWorkspaceSnapshot(get()); return; }
    await supabase.from('categories').delete().eq('id', id);
  },

  createQuestionPaper: async (title: string, date?: string, maxMarks?: number, courseId?: string, subjectId?: string, classId?: string, instructions?: string, duration?: number) => {
    const { user } = get();
    if (!user?.id) return '';
    const id = generateId();
    const newPaper: QuestionPaper = {
      id,
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
    persistWorkspaceSnapshot(get());
    if (isGuestUser(user)) return id;

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

    persistWorkspaceSnapshot(get());
    if (isGuestUser(get().user)) return;
    const supabaseUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.title !== undefined) supabaseUpdates.title = updates.title;
    if (updates.date !== undefined) supabaseUpdates.date = updates.date;
    if (updates.maxMarks !== undefined) supabaseUpdates.max_marks = updates.maxMarks;
    if ('courseId' in updates) supabaseUpdates.course_id = updates.courseId || null;
    if ('subjectId' in updates) supabaseUpdates.subject_id = updates.subjectId || null;
    if ('classId' in updates) supabaseUpdates.class_id = updates.classId || null;
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
    persistWorkspaceSnapshot(get());
    if (isGuestUser(get().user)) return;
    await supabase.from('qp_metadata').delete().eq('id', id);
  },

  duplicateQuestionPaper: async (id: string) => {
    const { user, questionPapers, paperQuestions } = get();
    const paper = questionPapers.find(qp => qp.id === id);
    if (!paper) return '';
    const newId = generateId();
    const newPaper: QuestionPaper = {
      ...paper,
      id: newId,
      title: `${paper.title} (Copy)`,
      isPublished: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Make sure we have the paper's questions
    const fetchedPqs = paperQuestions.get(id);
    let srcPqs: PaperQuestion[] = fetchedPqs || [];
    if ((!fetchedPqs || fetchedPqs.length === 0) && !isGuestUser(user)) {
      const { data } = await supabase
        .from('paper_questions')
        .select('*')
        .eq('paper_id', id)
        .order('order_index', { ascending: true });
      if (data && data.length > 0) {
        srcPqs = data.map(item => ({
          id: item.id,
          paperId: item.paper_id,
          questionId: item.question_id,
          section: item.section,
          orderIndex: item.order_index,
          marks: item.marks,
          parentId: item.parent_id,
          isOptional: item.is_optional,
          subNumberingStyle: item.sub_numbering_style,
          originType: item.origin_type,
          parentSharedId: item.parent_shared_id,
          createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
          updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : Date.now(),
        }));
      } else {
        srcPqs = [];
      }
    }

    // Clone all paper questions with new IDs, preserving hierarchy (oldId -> newId)
    const oldToNewMap = new Map<string, string>();
    srcPqs.forEach(pq => {
      oldToNewMap.set(pq.id, generateId());
    });

    const newPqs: PaperQuestion[] = srcPqs.map(pq => ({
      ...pq,
      id: oldToNewMap.get(pq.id)!,
      paperId: newId,
      parentId: pq.parentId ? oldToNewMap.get(pq.parentId) : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    const newPaperQuestionsMap = new Map(paperQuestions);
    newPaperQuestionsMap.set(newId, newPqs);

    set((state) => ({
      questionPapers: [newPaper, ...state.questionPapers],
      paperQuestions: newPaperQuestionsMap,
    }));

    persistWorkspaceSnapshot(get());
    if (isGuestUser(user)) return newId;

    // Insert into Supabase qp_metadata
    const { error: metaError } = await supabase.from('qp_metadata').insert({
      id: newId,
      teacher_id: user?.id || paper.teacherId,
      title: newPaper.title,
      date: paper.date,
      max_marks: paper.maxMarks,
      course_id: paper.courseId,
      subject_id: paper.subjectId,
      class_id: paper.classId,
      instructions: paper.instructions || '',
      is_published: false,
      duration: paper.duration,
      header_config: paper.headerConfig || {},
    });

    if (metaError) {
      console.error('Failed to duplicate paper in Supabase:', metaError.message);
    }

    // Insert new paper questions if any
    if (newPqs.length > 0) {
      const rows = newPqs.map(npq => ({
        id: npq.id,
        paper_id: newId,
        question_id: npq.questionId,
        section: npq.section || '',
        order_index: npq.orderIndex,
        marks: npq.marks,
        parent_id: npq.parentId || null,
        is_optional: npq.isOptional || false,
        sub_numbering_style: npq.subNumberingStyle || null,
        origin_type: npq.originType || 'ORIGINAL',
        parent_shared_id: npq.parentSharedId || null,
      }));
      const { error: pqError } = await supabase.from('paper_questions').insert(rows);
      if (pqError) {
        console.error('Failed to duplicate paper questions in Supabase:', pqError.message);
      }
    }

    return newId;
  },

  createQuestion: async (
    content: string,
    questionType: QuestionType,
    options?: string[],
    courseId?: string,
    subjectId?: string,
    classId?: string,
    difficulty?: Difficulty,
    explanation?: string,
    imageUrl?: string,
    meta?: QuestionMeta,
    marks?: number,
    parentId?: string,
    subquestions?: SharedQuestion['subquestions'],
    subNumberingStyle?: SubQuestionNumberingStyle
  ) => {
    const { user, shareQuestionToBank } = get();
    if (!user?.id) return '';
    const id = generateId();
    const finalMarks = questionType === 'text' ? 0 : (marks ?? 1);
    const resolvedCognitive = meta?.cognitiveLevel || DEFAULT_COGNITIVE_LEVEL;

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
      chapterId: meta?.chapterId,
      topicId: meta?.topicId,
      categoryId: meta?.categoryId,
      cognitiveLevel: resolvedCognitive,
      subNumberingStyle,
      marks: finalMarks,
      parentId,
      subquestions: subquestions as any,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((state) => ({ questions: [newQuestion, ...state.questions] }));
    persistWorkspaceSnapshot(get());
    if (isGuestUser(user)) return id;

    await resilientWrite((row) => supabase.from('questions').insert(row), {
      id,
      teacher_id: user.id,
      content,
      course_id: courseId || null,
      subject_id: subjectId || null,
      class_id: classId || null,
      question_type: questionType,
      options: options || [],
      difficulty: difficulty || 'medium',
      chapter_id: meta?.chapterId || null,
      topic_id: meta?.topicId || null,
      category_id: meta?.categoryId || null,
      cognitive_level: resolvedCognitive,
      marks: finalMarks,
      parent_id: parentId || null,
      sub_numbering_style: subNumberingStyle || null,
      explanation,
      image_url: imageUrl,
    }, 'createQuestion');

    if (!user.keepQuestionsPrivate && content.trim().length > 10 && !parentId) {
      void shareQuestionToBank({
        content,
        questionType,
        options,
        difficulty: difficulty || 'medium',
        meta: { ...meta, courseId, subjectId, classId, cognitiveLevel: resolvedCognitive },
        marks: finalMarks,
        subquestions,
      });
    }

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

    persistWorkspaceSnapshot(get());
    if (isGuestUser(get().user)) return;
    const supabaseUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.content !== undefined) supabaseUpdates.content = updates.content;
    if (updates.questionType !== undefined) supabaseUpdates.question_type = updates.questionType;
    if (updates.options !== undefined) supabaseUpdates.options = updates.options;
    if ('courseId' in updates) supabaseUpdates.course_id = updates.courseId || null;
    if ('subjectId' in updates) supabaseUpdates.subject_id = updates.subjectId || null;
    if ('classId' in updates) supabaseUpdates.class_id = updates.classId || null;
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

    persistWorkspaceSnapshot(get());
    if (isGuestUser(get().user)) return;
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

    if (isGuestUser(get().user)) { persistWorkspaceSnapshot(get()); return id; }
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
    persistWorkspaceSnapshot(get());
    if (isGuestUser(get().user)) return;
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

    persistWorkspaceSnapshot(get());
    if (isGuestUser(get().user)) return;
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

    persistWorkspaceSnapshot(get());
    if (isGuestUser(get().user)) return;
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
    persistWorkspaceSnapshot(get());
    if (isGuestUser(user)) return pqId;

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
    const cleanContent = cleanTextForNotif(sharedQ.content).substring(0, 100);

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

    if (isGuestUser(user)) return;
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