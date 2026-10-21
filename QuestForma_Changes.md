## QuestForma

## Changes

## Window : Dashboard

- 1) Redesign the dashboard in a cool , plate whitish blue colour scheme. Reduce the card sizes.

- 2) Collapsable menus – Papers [Paper Details], Account Settings , Log Out.

- 3) Filters to search papers based on [Class , Course , Chapters (check box) , Year] – all 3 not needed to be satisfied always.

- 4) Duplication of paper files must work.

- 5) Add Notification Tab

## New Policy

For Course Type : K-12 , Classes 1 , 2 , 3, …. 12 ,must be predefined and default with the subjects and chapters. Teachers can add more subjects to a specific class based on the requirements.

## Window : Settings

Add a toggle “Keep my questions private” – (off by default) … this feature will allow sharing of questions to other teachers.

## Notification :

If any teacher uses another teacher’s questions. Send the teacher a email + a notification on app.

Content of Message :

\___________________________________________________________________________

## Hi [Teacher B's Name],

Great news! Another educator on [Your Platform Name] just selected one of your shared questions for their test paper:

## Question:

"What is resistance of a conductor?"

Thank you for contributing to the shared question bank and helping fellow teachers save time on test formatting!

Keep up the great work,

## QuestForma | ExamFriendly


## Question Paper Editor View

- Based on the class and course and subject and list of topics (in case of K-12) , show a question bank at the side. A view button on each question , so that teacher can view the full question in a model. The question bank must have two tabs – “My Questions” , “Shared Questions”.

My Question – Shows only the users questions added to the papers.

Shared Questions – Shows all over shared questions by other teachers on the topic.

- [Fix] Question and Sub Question rearrangement, make it proper. The subquestion arrow buttons for rearranging are not working properly. No Duplicate section insertion on canvas if a section is already created.

- [Add] Edit Section Name and Add Section description. [Enable text formatting]

- [Fix] Tables and model focus.

- [Fix] Increase Question model size.

- [Fix] Render Latex in PDF as it is rendered on Canvas. Proper margins and no content stripping at the bottom of pdf.

- [New] Add a ribbon that asks which paper details to show on pdf or print.

- [New] In Question model , add a 
text
 type. This adds a text paragraph in between questions.

- [Fix] Replace PaperForm with QuestForma

- [New] Numbering formatting Give following choices for sub question numbering


- In questions model , add a check box  Optional Question
. That removes it from getting marked in actual grand total of marks.


## Shared Question Bank Architecture.

## Database Schema (Example Case)

-- Global shared question bank

CREATE TABLE shared_questions (

id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

content TEXT NOT NULL,


```
content_hash VARCHAR(64) NOT NULL, -- MD5/SHA256 for fast exact lookup
embedding VECTOR(1536), -- Vector embeddings for semantic search (pgvector)
created_by_user_id UUID NOT NULL REFERENCES users(id),
created_at TIMESTAMP DEFAULT NOW()
);
-- Questions attached to an individual teacher's test paper
CREATE TABLE paper_questions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
paper_id UUID NOT NULL,
parent_shared_id UUID REFERENCES shared_questions(id) ON DELETE SET NULL,
content TEXT NOT NULL,
origin_type VARCHAR(20) DEFAULT 'ORIGINAL', -- 'ORIGINAL', 'SHARED', or
'FORKED'
updated_at TIMESTAMP DEFAULT NOW()
);
-- Usage tracking log to prevent spamming notification emails
CREATE TABLE question_usage_logs (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
shared_question_id UUID NOT NULL REFERENCES shared_questions(id),
used_by_teacher_id UUID NOT NULL REFERENCES users(id),
owner_teacher_id UUID NOT NULL REFERENCES users(id),
notified_at TIMESTAMP DEFAULT NOW()
);
```


| Problem |   | Technical Strategy Key Implementation Detail |
| --- | --- | --- |
| 1. Deduplication | Hybrid Deduplication (Exact Hash + Vector Similarity) | Run checks only when publishing/sharing to the public bank. Exact string matches use MD5 hashes; context matches use Pgvector Cosine Similarity (>95% threshold). |
| 2. Detaching Edits | Copy-on-Write (Forking) | Keep shared_questions and paper_questions in separate tables. If a teacher backspaces/edits imported text, flag the row as 'FORKED'/'ORIGINAL' and set parent_shared_id = NULL. |
| 3. Autosave Loop | 1.5s Debounce + onBlur | Perform edits in local JavaScript state. Send payload to backend only when typing stops for 1.5s or focus is lost. |
| 4. Contributor Emails | Async Event Worker | When parent_shared_id is linked to a paper by another user, record a log in question_usage_logs and asynchronously send a thank-you email to the original author. |
