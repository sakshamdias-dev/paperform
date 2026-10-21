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
} from './types';
import { supabase } from './supabase';
import { computeContentHash, calculateTextSimilarity } from './utils/sharedBank';
import { INITIAL_SHARED_QUESTIONS } from './utils/seedSharedQuestions';

const LOCAL_SHARED_QUESTIONS_KEY = 'questforma_shared_questions_v1';
const LOCAL_NOTIFICATIONS_KEY = 'questforma_notifications_v1';

function getStoredLocalSharedQuestions(): SharedQuestion[] {
  try {
    const raw = localStorage.getItem(LOCAL_SHARED_QUESTIONS_KEY);
    if (raw) return JSON.parse(raw);
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
    originType?: 'ORIGINAL' | 'SHARED' | 'FORKED'
  ) => Promise<string>;

  shareQuestionToBank: (question: { content: string; questionType: QuestionType; options?: string[]; difficulty?: Difficulty; typeHeader?: string; topic?: string }) => Promise<string | null>;
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
    try {
      const { data, error } = await supabase
        .from('shared_questions')
        .select('*')
        .order('usage_count', { ascending: false });

      if (!error && data && data.length > 0) {
        const list: SharedQuestion[] = data.map(row => ({
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
          createdAt: new Date(row.created_at).getTime(),
        }));
        set({ sharedQuestions: list });
        saveLocalSharedQuestions(list);
        return;
      }
    } catch {}

    // Fallback to local storage / seeded list
    const stored = getStoredLocalSharedQuestions();
    set({ sharedQuestions: stored });
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

    await supabase.from('questions').update(supabaseUpdates).eq('id', id);
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

    await supabase.from('paper_questions').update(supabaseUpdates).eq('id', id);
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
    originType: 'ORIGINAL' | 'SHARED' | 'FORKED' = 'ORIGINAL'
  ) => {
    const { user, questionPapers, shareQuestionToBank } = get();
    if (!user?.id) return '';

    const questionId = generateId();
    const pqId = generateId();
    const paper = questionPapers.find(qp => qp.id === paperId);
    const paperQuestionsList = get().paperQuestions.get(paperId) || [];
    const orderIndex = paperQuestionsList.length;

    const newQuestion: Question = {
      id: questionId,
      teacherId: user.id,
      content,
      courseId,
      subjectId: subjectId || paper?.subjectId,
      classId: classId || paper?.classId,
      questionType,
      options: options || [],
      difficulty: difficulty || 'medium',
      explanation,
      imageUrl,
      typeHeader,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const newPQ: PaperQuestion = {
      id: pqId,
      paperId,
      questionId,
      section: section ?? '',
      parentId,
      marks: questionType === 'text' ? 0 : (marks ?? 1),
      orderIndex,
      isOptional: Boolean(isOptional),
      parentSharedId: parentSharedId || null,
      originType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((state) => ({
      questions: [newQuestion, ...state.questions],
      paperQuestions: new Map(state.paperQuestions).set(paperId, [...paperQuestionsList, newPQ]),
    }));

    await supabase.from('questions').insert({
      id: questionId,
      teacher_id: user.id,
      content,
      course_id: courseId,
      subject_id: subjectId || paper?.subjectId,
      class_id: classId || paper?.classId,
      question_type: questionType,
      options: options || [],
      difficulty: difficulty || 'medium',
      explanation,
      image_url: imageUrl,
      type_header: typeHeader,
    });

    await supabase.from('paper_questions').insert({
      id: pqId,
      paper_id: paperId,
      question_id: questionId,
      section: section ?? '',
      parent_id: parentId || null,
      marks: questionType === 'text' ? 0 : (marks ?? 1),
      order_index: orderIndex,
      is_optional: isOptional || false,
      parent_shared_id: parentSharedId || null,
      origin_type: originType,
    });

    // Shared Question Bank: Auto-contribute if user's questions are NOT private
    if (originType === 'ORIGINAL' && !user.keepQuestionsPrivate && content.trim().length > 10) {
      void shareQuestionToBank({
        content,
        questionType,
        options,
        difficulty,
        typeHeader,
      });
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
  }) => {
    const { user, sharedQuestions } = get();
    if (!user || user.keepQuestionsPrivate) return null;

    const hash = await computeContentHash(content);

    // Flowchart: Vector / MD5 similarity check
    // If exact match or > 95% similarity, link to existing
    const existing = sharedQuestions.find(sq => {
      if (sq.contentHash === hash) return true;
      return calculateTextSimilarity(sq.content, content) >= 0.95;
    });

    if (existing) {
      return existing.id;
    }

    const newSharedId = generateId();
    const newSharedQ: SharedQuestion = {
      id: newSharedId,
      content,
      contentHash: hash,
      createdByUserId: user.id,
      authorName: user.fullName || 'Teacher',
      topic: topic || 'General',
      questionType,
      options: options || [],
      difficulty: difficulty || 'medium',
      typeHeader,
      usageCount: 0,
      createdAt: Date.now(),
    };

    const updated = [newSharedQ, ...sharedQuestions];
    set({ sharedQuestions: updated });
    saveLocalSharedQuestions(updated);

    try {
      await supabase.from('shared_questions').insert({
        id: newSharedId,
        content,
        content_hash: hash,
        created_by_user_id: user.id,
        author_name: user.fullName || 'Teacher',
        topic: topic || 'General',
        question_type: questionType,
        options: options || [],
        difficulty: difficulty || 'medium',
        type_header: typeHeader,
        usage_count: 0,
      });
    } catch {}

    return newSharedId;
  },

  importSharedQuestionToPaper: async (paperId: string, sharedQ: SharedQuestion, section: string = '', marks: number = 1, parentId?: string, isOptional: boolean = false) => {
    const { user, createAndAddQuestion, sendQuestionUsageNotification } = get();
    if (!user?.id) return '';

    // Flowchart: Branch 2:
    // Copy content and set parent_shared_id and origin_type = 'SHARED'
    const pqId = await createAndAddQuestion(
      paperId,
      sharedQ.content,
      sharedQ.questionType,
      sharedQ.options,
      section,
      parentId,
      marks,
      sharedQ.courseId,
      sharedQ.subjectId,
      sharedQ.classId,
      sharedQ.difficulty,
      undefined,
      undefined,
      sharedQ.typeHeader,
      isOptional,
      sharedQ.id,
      'SHARED'
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