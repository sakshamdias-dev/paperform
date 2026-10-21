-- ============================================================================
-- QuestForma: Shared Question Bank & Feature Migration
-- ============================================================================

-- 1. Profiles Table: Add privacy setting
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS keep_questions_private BOOLEAN DEFAULT false;

-- 2. Shared Questions Table (Global shared question bank)
CREATE TABLE IF NOT EXISTS public.shared_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT DEFAULT 'Educator',
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  topic TEXT,
  question_type VARCHAR(50) NOT NULL DEFAULT 'subjective',
  options JSONB DEFAULT '[]'::jsonb,
  difficulty VARCHAR(50) DEFAULT 'medium',
  type_header TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shared_questions_hash ON public.shared_questions(content_hash);
CREATE INDEX IF NOT EXISTS idx_shared_questions_type ON public.shared_questions(question_type);
CREATE INDEX IF NOT EXISTS idx_shared_questions_user ON public.shared_questions(created_by_user_id);

ALTER TABLE public.shared_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shared questions"
  ON public.shared_questions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert shared questions"
  ON public.shared_questions FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Creators can update their shared questions"
  ON public.shared_questions FOR UPDATE
  USING (auth.uid() = created_by_user_id);

-- 3. Paper Questions Table additions: parent_shared_id, origin_type, is_optional
ALTER TABLE public.paper_questions ADD COLUMN IF NOT EXISTS parent_shared_id UUID REFERENCES public.shared_questions(id) ON DELETE SET NULL;
ALTER TABLE public.paper_questions ADD COLUMN IF NOT EXISTS origin_type VARCHAR(20) DEFAULT 'ORIGINAL';
ALTER TABLE public.paper_questions ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT false;

-- 4. Question Usage Logs Table
CREATE TABLE IF NOT EXISTS public.question_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_question_id UUID NOT NULL REFERENCES public.shared_questions(id) ON DELETE CASCADE,
  used_by_teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_owner ON public.question_usage_logs(owner_teacher_id);

ALTER TABLE public.question_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert question usage logs"
  ON public.question_usage_logs FOR INSERT
  WITH CHECK (auth.uid() = used_by_teacher_id);

CREATE POLICY "Owners can view their usage logs"
  ON public.question_usage_logs FOR SELECT
  USING (auth.uid() = owner_teacher_id OR auth.uid() = used_by_teacher_id);

-- 5. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name TEXT DEFAULT 'Another Educator',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  question_content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = recipient_id);

CREATE POLICY "Users can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = recipient_id);
