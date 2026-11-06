import type { QuestionPaper, QuestionType, Difficulty } from '../../types';

export function formatDate(dateStr?: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', opts);
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function relativeTime(ts: number) {
  const diffSec = Math.round((ts - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), 'day');
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Days from today until the exam date (0 = today, negative = past). null if no date. */
export function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - startOfToday()) / 86400000);
}

export type ExamStatus = 'upcoming' | 'today' | 'completed' | 'unscheduled';

export function examStatus(paper: QuestionPaper): ExamStatus {
  const days = daysUntil(paper.date);
  if (days === null) return 'unscheduled';
  if (days === 0) return 'today';
  return days > 0 ? 'upcoming' : 'completed';
}

export const STATUS_LABEL: Record<ExamStatus, string> = {
  upcoming: 'Upcoming',
  today: 'Today',
  completed: 'Completed',
  unscheduled: 'No date',
};

export function countdownLabel(dateStr?: string) {
  const days = daysUntil(dateStr);
  if (days === null) return '';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `In ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function formatDuration(mins?: number) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** Stable, tasteful accent colour per subject so papers are scannable at a glance. */
const SUBJECT_PALETTE = [
  { fg: 'light-dark(#034089, #7db4ff)', bg: 'light-dark(#e8f0fb, rgba(59, 130, 246, 0.16))' },
  { fg: 'light-dark(#0f766e, #5eead4)', bg: 'light-dark(#e6f6f4, rgba(20, 184, 166, 0.16))' },
  { fg: 'light-dark(#7c3aed, #c4b5fd)', bg: 'light-dark(#f1ebfe, rgba(139, 92, 246, 0.18))' },
  { fg: 'light-dark(#c2410c, #fdba74)', bg: 'light-dark(#fdf0e7, rgba(249, 115, 22, 0.16))' },
  { fg: 'light-dark(#be123c, #fda4af)', bg: 'light-dark(#fdebef, rgba(244, 63, 94, 0.16))' },
  { fg: 'light-dark(#4d7c0f, #bef264)', bg: 'light-dark(#eef6e3, rgba(132, 204, 22, 0.16))' },
  { fg: 'light-dark(#0369a1, #7dd3fc)', bg: 'light-dark(#e6f3fb, rgba(14, 165, 233, 0.16))' },
  { fg: 'light-dark(#a16207, #fde047)', bg: 'light-dark(#fbf4dc, rgba(234, 179, 8, 0.16))' },
];

export function subjectColor(key?: string) {
  if (!key) return { fg: 'light-dark(#475569, #94a3b8)', bg: 'light-dark(#f1f5f9, rgba(148, 163, 184, 0.14))' };
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return SUBJECT_PALETTE[h % SUBJECT_PALETTE.length];
}

export function stripHtml(html: string) {
  if (!html) return '';
  const withLatex = html.replace(
    /<span[^>]*class=["'][^"']*ql-formula[^"']*["'][^>]*data-value=["']([^"']*)["'][^>]*>[\s\S]*?<\/span>/gi,
    ' \\($1\\) '
  ).replace(
    /<span[^>]*data-value=["']([^"']*)["'][^>]*class=["'][^"']*ql-formula[^"']*["'][^>]*>[\s\S]*?<\/span>/gi,
    ' \\($1\\) '
  );
  const tmp = document.createElement('div');
  tmp.innerHTML = withLatex;
  return (tmp.textContent || '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

export function cleanNotificationMessage(msg: string): string {
  if (!msg) return '';
  return msg
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  mcq: 'Multiple choice',
  subjective: 'Subjective',
  fillblank: 'Fill in the blank',
  truefalse: 'True / False',
  match: 'Match the following',
  text: 'Text',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export function initials(name?: string) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'U';
}

