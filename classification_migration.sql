-- Classification Migration: Chapters, Topics, Categories, Cognitive Levels & Numbering Style

-- 1. Chapters Table
CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chapters_teacher ON public.chapters(teacher_id);
CREATE INDEX IF NOT EXISTS idx_chapters_subject ON public.chapters(subject_id);

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chapters"
  ON public.chapters FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "Users can insert their own chapters"
  ON public.chapters FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Users can update their own chapters"
  ON public.chapters FOR UPDATE
  USING (auth.uid() = teacher_id);

CREATE POLICY "Users can delete their own chapters"
  ON public.chapters FOR DELETE
  USING (auth.uid() = teacher_id);

-- 2. Topics Table
CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topics_teacher ON public.topics(teacher_id);
CREATE INDEX IF NOT EXISTS idx_topics_chapter ON public.topics(chapter_id);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own topics"
  ON public.topics FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "Users can insert their own topics"
  ON public.topics FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Users can update their own topics"
  ON public.topics FOR UPDATE
  USING (auth.uid() = teacher_id);

CREATE POLICY "Users can delete their own topics"
  ON public.topics FOR DELETE
  USING (auth.uid() = teacher_id);

-- 3. Categories / Streams Table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_teacher ON public.categories(teacher_id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own categories"
  ON public.categories FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "Users can insert their own categories"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Users can update their own categories"
  ON public.categories FOR UPDATE
  USING (auth.uid() = teacher_id);

CREATE POLICY "Users can delete their own categories"
  ON public.categories FOR DELETE
  USING (auth.uid() = teacher_id);

-- 4. Extend questions table with classification and cognitive levels
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS cognitive_level VARCHAR(30) DEFAULT 'understand';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS marks INTEGER DEFAULT 1;

-- 5. Extend paper_questions table with per-question sub-numbering format
ALTER TABLE public.paper_questions ADD COLUMN IF NOT EXISTS sub_numbering_style VARCHAR(40);

-- 6. Extend shared_questions table with denormalized classification & cognitive level for search/filtering
ALTER TABLE public.shared_questions ADD COLUMN IF NOT EXISTS course_name TEXT;
ALTER TABLE public.shared_questions ADD COLUMN IF NOT EXISTS subject_name TEXT;
ALTER TABLE public.shared_questions ADD COLUMN IF NOT EXISTS class_name TEXT;
ALTER TABLE public.shared_questions ADD COLUMN IF NOT EXISTS chapter TEXT;
ALTER TABLE public.shared_questions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.shared_questions ADD COLUMN IF NOT EXISTS cognitive_level VARCHAR(30) DEFAULT 'understand';
ALTER TABLE public.shared_questions ADD COLUMN IF NOT EXISTS marks INTEGER;
