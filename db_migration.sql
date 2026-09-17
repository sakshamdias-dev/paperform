-- Migration to support Custom Sections and Subquestions
ALTER TABLE public.paper_questions ALTER COLUMN section TYPE VARCHAR(255);
ALTER TABLE public.paper_questions ALTER COLUMN section DROP DEFAULT;
ALTER TABLE public.paper_questions ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.paper_questions(id) ON DELETE CASCADE;
