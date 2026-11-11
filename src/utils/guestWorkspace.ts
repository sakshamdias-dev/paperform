import type {
  Category,
  Chapter,
  Class,
  Course,
  PaperQuestion,
  Question,
  QuestionPaper,
  Subject,
  Topic,
  User,
} from '../types';

export const GUEST_USER_ID = '00000000-0000-4000-8000-000000000001';
const GUEST_WORKSPACE_KEY = 'questforma_guest_workspace_v1';

export const isGuestUser = (u?: { id?: string } | null): boolean =>
  Boolean(u && u.id === GUEST_USER_ID);

export function createGuestUser(): User {
  const now = Date.now();
  return {
    id: GUEST_USER_ID,
    email: '',
    fullName: 'Guest Teacher',
    schoolName: 'Greenfield International School',
    keepQuestionsPrivate: false,
    createdAt: now,
    updatedAt: now,
  };
}

export interface GuestWorkspaceSnapshot {
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

function defaultGuestWorkspace(): GuestWorkspaceSnapshot {
  const now = Date.now();
  return {
    courses: [
      { id: '10000000-0000-4000-8000-000000000001', teacherId: GUEST_USER_ID, name: 'CBSE', createdAt: now, updatedAt: now },
      { id: '10000000-0000-4000-8000-000000000002', teacherId: GUEST_USER_ID, name: 'ICSE', createdAt: now, updatedAt: now },
      { id: '10000000-0000-4000-8000-000000000003', teacherId: GUEST_USER_ID, name: 'Foundation', createdAt: now, updatedAt: now },
    ],
    subjects: [
      { id: '20000000-0000-4000-8000-000000000001', teacherId: GUEST_USER_ID, name: 'Mathematics', createdAt: now, updatedAt: now },
      { id: '20000000-0000-4000-8000-000000000002', teacherId: GUEST_USER_ID, name: 'Physics', createdAt: now, updatedAt: now },
      { id: '20000000-0000-4000-8000-000000000003', teacherId: GUEST_USER_ID, name: 'Chemistry', createdAt: now, updatedAt: now },
      { id: '20000000-0000-4000-8000-000000000004', teacherId: GUEST_USER_ID, name: 'Biology', createdAt: now, updatedAt: now },
      { id: '20000000-0000-4000-8000-000000000005', teacherId: GUEST_USER_ID, name: 'English', createdAt: now, updatedAt: now },
    ],
    classes: [
      { id: '30000000-0000-4000-8000-000000000001', teacherId: GUEST_USER_ID, name: 'Grade 9', createdAt: now, updatedAt: now },
      { id: '30000000-0000-4000-8000-000000000002', teacherId: GUEST_USER_ID, name: 'Grade 10', createdAt: now, updatedAt: now },
      { id: '30000000-0000-4000-8000-000000000003', teacherId: GUEST_USER_ID, name: 'Grade 11', createdAt: now, updatedAt: now },
      { id: '30000000-0000-4000-8000-000000000004', teacherId: GUEST_USER_ID, name: 'Grade 12', createdAt: now, updatedAt: now },
    ],
    chapters: [],
    topics: [],
    categories: [],
    questionPapers: [],
    questions: [],
    paperQuestionsEntries: [],
  };
}

export function loadGuestWorkspace(): GuestWorkspaceSnapshot {
  try {
    const raw = localStorage.getItem(GUEST_WORKSPACE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GuestWorkspaceSnapshot>;
      const fallback = defaultGuestWorkspace();
      return {
        courses: parsed.courses?.length ? parsed.courses : fallback.courses,
        subjects: parsed.subjects?.length ? parsed.subjects : fallback.subjects,
        classes: parsed.classes?.length ? parsed.classes : fallback.classes,
        chapters: parsed.chapters || [],
        topics: parsed.topics || [],
        categories: parsed.categories || [],
        questionPapers: parsed.questionPapers || [],
        questions: parsed.questions || [],
        paperQuestionsEntries: parsed.paperQuestionsEntries || [],
      };
    }
  } catch { /* ignore */ }
  const initial = defaultGuestWorkspace();
  saveGuestWorkspace(initial);
  return initial;
}

export function saveGuestWorkspace(snapshot: GuestWorkspaceSnapshot) {
  try {
    localStorage.setItem(GUEST_WORKSPACE_KEY, JSON.stringify(snapshot));
  } catch { /* ignore */ }
}

export function hasGuestWorkspaceData(): boolean {
  try {
    const raw = localStorage.getItem(GUEST_WORKSPACE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<GuestWorkspaceSnapshot>;
    return Boolean((parsed.questionPapers && parsed.questionPapers.length > 0) || (parsed.questions && parsed.questions.length > 0));
  } catch {
    return false;
  }
}

export function clearGuestWorkspace() {
  try {
    localStorage.removeItem(GUEST_WORKSPACE_KEY);
  } catch { /* ignore */ }
}

