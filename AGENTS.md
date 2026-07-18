# AGENTS.md

## Project Name

AntiCheatOES_V2_main - Online Examination System with Anti-Cheat Mechanisms.

## Technology Stack

Use only technologies, languages, libraries, and project structure already
present in this repository.

Backend:

* Python 3.12
* FastAPI
* Uvicorn
* Pydantic
* SQLAlchemy if already used in the current backend
* Alembic if already used for migrations
* mysql-connector-python where it is already used
* python-dotenv / dotenv
* PyJWT
* Werkzeug security / Passlib bcrypt if already used
* MySQL

Frontend:

* React 18
* TypeScript
* Vite
* Radix UI components
* lucide-react
* sonner
* Existing CSS/Tailwind-like utility classes already used in the project

Do not migrate the backend to Node.js or Express.

Do not add a new frontend framework.

Use the database access approach already present in the related module.

Do not introduce a second ORM or migrate existing SQLAlchemy code to another
database layer.

Before changing models or migrations, inspect the existing SQLAlchemy models
and Alembic migration history.

## Current Project Structure

Backend:

* backend/main.py
* backend/src/a_db_config/
* backend/src/route/
* backend/src/controller/
* backend/src/models/
* backend/src/middleware/

Frontend:

* frontend/src/components/
* frontend/src/services/
* frontend/src/services/api.ts
* frontend/src/contexts/
* frontend/src/data/
* frontend/src/types/

Database:

* database/Create/creat_table_v3.sql
* Existing SQLAlchemy models
* Existing Alembic migrations, if present

## Database Rules

`database/Create/creat_table_v3.sql` is the original database baseline.

The current SQLAlchemy models, Alembic migrations, and active project database
may contain later approved changes.

Do not revert the current schema back to `creat_table_v3.sql`.

Before making a database change:

1. Inspect the current models.
2. Inspect existing Alembic migrations.
3. Check whether the required table, column, enum, relationship, index, or
   constraint already exists.
4. Do not recreate an existing table, enum, relationship, or constraint.
5. Create a focused migration only when the current task requires it.
6. Do not delete, replace, or reset existing database data unless explicitly
   requested.
7. Do not modify seed data unless the current task explicitly requests seed
   changes.
8. Do not manually renumber existing primary keys or foreign keys.

Use only the following project tables unless the current task explicitly
introduces an approved new table:

* user
* subject
* teacher_subject
* lo
* chapter
* chapter_lo
* exam
* question
* options
* exam_question
* chapter_question
* lo_question
* question_revision
* student_exam
* attempt
* attempt_question
* mcq_answers
* essay_answers
* exam_event

Do not use these table names from other projects:

* users
* exams
* exam_students
* submissions
* answers

Important schema notes:

* `user.id` is the internal numeric primary key.
* `user.school_id` is the external student, teacher, or admin identifier.
* `student_exam.student_id` references `user.school_id`.
* `attempt.student_id` references `user.id`.
* `exam.examcode` stores the code students must enter before taking an exam.
* `exam.result_visibility` controls whether students can view results.
* `exam_event` is used for anti-cheat logging.
* `teacher_subject.teacher_id` references `user.id`.
* `teacher_subject.subject_id` references `subject.subject_id`.
* `question.created_by` references the internal authenticated `user.id`.
* `question.subject_id` identifies the Subject of a reusable question.
* `chapter_question` stores the many-to-many relationship between Question and
  Chapter.
* `lo_question` stores the many-to-many relationship between Question and
  Learning Objective.
* `chapter_lo` stores the relationship between Chapter and Learning Objective.
* `question_revision` stores snapshots of approved questions before a Teacher
  edits them.

Question Bank relationship rules:

* Question–Subject uses `question.subject_id`.
* Question–Chapter uses `chapter_question`.
* Question–LO uses `lo_question`.
* Chapter–LO uses `chapter_lo`.
* A Question may belong to multiple Chapters.
* A Question may belong to multiple Learning Objectives.
* Do not store `chapter_id` directly in `question`.
* Do not store `lo_id` directly in `question`.
* Reusable Question Bank questions do not require `exam_id`.
* Reusable Question Bank questions do not require `question_point`.
* Exam-specific points and placement belong to `exam_question`.

## Task Scope Precedence

The explicit task in the current user prompt determines the active module.

The Student Module Roadmap applies only when the current task belongs to the
Student module.

A clearly scoped Teacher module task may be implemented without completing the
remaining Student roadmap items first.

Do not implement Admin functionality unless the current task explicitly
requests it.

When a task explicitly limits the scope to Teacher:

* Do not create Admin pages.
* Do not create Admin routes.
* Do not create Admin services.
* Do not create Admin tests.
* Do not create approve or reject workflows.
* Do not expand the task into unrelated Student or Exam work.

## Development Rules

### Before editing

1. Read this `AGENTS.md`.
2. Read the related backend and frontend files first.
3. Inspect existing models, schemas, routes, controllers, services, types, and
   tests related to the task.
4. List the files that will be changed.
5. Explain the planned changes briefly.
6. Confirm whether a migration is actually necessary.
7. Do not modify files until the current module task is clear.
8. Do not stop after analysis when the user has explicitly asked for
   implementation.

### When editing

1. Make small, focused changes.
2. Do not rewrite the whole project.
3. Do not change `.env`.
4. Do not hard-code secrets, tokens, database passwords, user IDs, Subject IDs,
   or ownership values.
5. Do not change database schema unless explicitly required by the task.
6. Keep existing Student and Exam API responses backward-compatible.
7. New Teacher Question Bank endpoints may use dedicated response schemas.
8. When extending an existing endpoint, do not remove or rename fields already
   consumed by the frontend unless every usage is updated in the same task.
9. Do not reuse Exam Question payloads that require `exam_id` or
   `question_point` for reusable Question Bank APIs.
10. Use transactions for operations that update multiple related tables.
11. Roll back all related database changes when any step fails.
12. Do not commit partial Question, Option, Chapter, LO, status, or revision
    updates.
13. Do not create duplicate models, enums, route modules, services, or
    components.
14. Do not introduce mock data when the module is required to use the database.
15. Do not replace existing architecture with a different pattern unless
    explicitly requested.
16. Do not expose server-controlled fields for modification by the frontend.

### Correct-answer security

Never expose correct answers through Student exam-taking endpoints while an
attempt is in progress.

Authenticated Teacher Question Bank detail endpoints may return option
`is_correct` values because Teachers need to review reusable questions.

Do not reuse Teacher Question Detail response schemas for Student exam-taking
responses.

Question Bank list responses should normally return summary information such
as `option_count`, not full answer options.

Full options and correct-answer values should be returned only by an authorized
Teacher Question Detail endpoint or another explicitly authorized workflow.

### After editing

1. Summarize changed files.
2. Explain how to test the feature.
3. List the commands that were actually run.
4. Report the real result of each command.
5. Mention remaining issues, if any.
6. Do not claim that tests or builds passed unless they were actually run and
   passed.
7. Clearly separate existing unrelated errors from errors caused by the current
   changes.

## Backend Commands

Run backend:

```bash
cd backend
uv run python main.py
```

Check Python syntax:

```bash
cd backend
uv run python -m py_compile main.py
```

Run backend tests if a test suite exists:

```bash
cd backend
uv run pytest
```

Run a focused backend test file when appropriate:

```bash
cd backend
uv run pytest path/to/test_file.py
```

Check Alembic current revision if Alembic is present:

```bash
cd backend
uv run alembic current
```

Check Alembic heads if Alembic is present:

```bash
cd backend
uv run alembic heads
```

Do not run `alembic upgrade head` without first inspecting the generated
migration.

## Frontend Commands

Run frontend:

```bash
cd frontend
npm run dev
```

Build frontend:

```bash
cd frontend
npm run build
```

Run TypeScript type checking if the project defines a typecheck script:

```bash
cd frontend
npm run typecheck
```

Run lint if configured:

```bash
cd frontend
npm run lint
```

Do not add a new frontend test framework only for a single task unless
explicitly requested.

## Student Module Roadmap

Implement Student features in this exact order only when the active task is a
Student module task:

0. Create fresh seed data for testing
1. Add `/db-check`
2. Debug register/login response
3. Add `GET /api/auth/me`
4. Complete `GET /api/exams`
5. Complete `GET /api/exams/{exam_id}`
6. Add `POST /api/exams/{exam_id}/verify-code`
7. Add `POST /api/exams/{exam_id}/start`
8. Add anti-cheat event logging
9. Add `POST /api/exams/{exam_id}/submit`
10. Add `GET /api/results`
11. Add `GET /api/results/{attempt_id}`
12. Add profile APIs
13. Run full Student end-to-end test

## Required Student Flow

The final Student flow must be:

1. Student registers or logs in.
2. Student opens dashboard.
3. Student views assigned exams.
4. Student views exam details.
5. Student enters exam code.
6. Backend verifies exam code and attempt limit.
7. Student starts the exam.
8. System creates an attempt.
9. Frontend loads questions.
10. Anti-cheat monitoring starts.
11. Student answers MCQ and Essay questions.
12. Anti-cheat events are logged to backend.
13. Student submits manually or timer auto-submits.
14. Backend saves answers.
15. Backend auto-grades MCQ.
16. Essay answers wait for manual grading.
17. Student views result depending on `result_visibility`.

## API Prefix Rules

### Auth

* `/api/auth/register`
* `/api/auth/login`
* `/api/auth/logout`
* `/api/auth/me`

### Exams

* `/api/exams`
* `/api/exams/{exam_id}`
* `/api/exams/{exam_id}/verify-code`
* `/api/exams/{exam_id}/start`
* `/api/exams/{exam_id}/events`
* `/api/exams/{exam_id}/submit`

### Results

* `/api/results`
* `/api/results/{attempt_id}`

### Profile

* `/api/profile/me`
* `/api/profile/change-password`

### Teacher Question Bank

* `GET /api/teacher/question-bank`
* `GET /api/teacher/question-bank/mine`
* `GET /api/teacher/question-bank/subjects`
* `GET /api/teacher/question-bank/subjects/{subject_id}/chapters`
* `GET /api/teacher/question-bank/chapters/{chapter_id}/learning-objectives`
* `GET /api/teacher/question-bank/{question_id}`
* `POST /api/teacher/question-bank`
* `PUT /api/teacher/question-bank/{question_id}`
* `POST /api/teacher/question-bank/{question_id}/submit`
* `DELETE /api/teacher/question-bank/{question_id}`

Declare fixed paths such as `/mine`, `/subjects`, and `/chapters` before
dynamic routes such as `/{question_id}`, or otherwise ensure that dynamic
routing cannot capture the fixed paths incorrectly.

Do not create `/api/admin/question-bank/*` unless the current task explicitly
requests Admin functionality.

## Anti-Cheat Requirements

Frontend may detect:

* fullscreen exit
* tab switch
* window blur
* copy
* paste
* cut
* right click
* blocked keyboard shortcuts
* suspicious behavior

Backend must save anti-cheat logs in:

```text
exam_event
```

Do not create a new anti-cheat table.

Each event should include:

* attempt_id
* event_type
* event_timestamp
* details

## Teacher Question Bank Rules

### Scope and page structure

* Question Bank lists approved questions from all Teachers.
* Your Questions lists only questions created by the current authenticated
  Teacher.
* Question Bank and Your Questions are top-level tabs.
* Your Questions must not be added as an item in the Subject sidebar.
* Do not display the old global `View Only Mode` banner for Teachers.
* Do not use one global `readOnly` flag to block all Teacher Question Bank
  actions.
* Do not implement Admin Question Bank pages, routes, services, or tests unless
  explicitly requested.

### Question Bank tab

* Question Bank returns only questions whose status is `approved`.
* Question Bank includes approved questions created by any Teacher.
* Teachers may search, filter, and view approved questions.
* Question Bank must not show:
  - New Question
  - Edit
  - Delete
  - Submit
  - Resubmit
  - Draft
  - Pending
  - Rejected
* Question Bank cards do not need to display an Approved status badge because
  every item in that tab is already approved.
* Question Bank Subject counts include approved questions only.
* Question Bank must not show a No Subject category.
* Add to Exam may appear only when the existing Exam workflow requires it.
* Reusable Question Bank questions must not require `exam_id` or
  `question_point`.

### Your Questions tab

* Your Questions returns only questions where:
  `question.created_by == current_teacher.id`.
* Your Questions may display:
  - draft
  - pending
  - approved
  - rejected
* New Question is displayed only in Your Questions.
* Your Questions may show status filters:
  - All
  - Draft
  - Pending
  - Approved
  - Rejected
* Your Questions Subject counts include only questions owned by the current
  Teacher.
* Your Questions may show No Subject for drafts whose `subject_id` is null.

### Ownership and authorization

* Teachers may only modify questions they created.
* The backend must enforce ownership for every write operation.
* Frontend visibility is not an authorization boundary.
* Never trust `created_by`, owner ID, role, or `question_status` from the
  frontend.
* `created_by` must be assigned from the authenticated user.
* Teachers cannot directly set a Question to `approved`.
* Teachers cannot directly set arbitrary status values.
* Teachers cannot access another Teacher's draft, pending, or rejected
  Question through a direct ID.
* Approved questions may be viewed by authenticated Teachers.
* Draft, pending, and rejected questions may be viewed only by their owner in
  the Teacher module.
* Teachers cannot edit, delete, submit, or resubmit another Teacher's Question.
* Teachers cannot edit another Teacher's approved Question.
* Ownership checks must protect:
  - private detail access
  - update
  - delete
  - submit
  - resubmit
  - rejected feedback access
  - approved-question editing

### Status transitions

New Question:

```text
new -> draft
```

Submit:

```text
draft -> pending
rejected -> pending
```

Edit approved:

```text
approved -> pending
```

Rules:

* New questions are created as `draft`.
* Draft and rejected questions may be submitted and become `pending`.
* Pending questions are read-only for Teachers.
* Pending questions cannot be edited by Teachers.
* Pending questions cannot be deleted by Teachers.
* Pending questions cannot be submitted again.
* Teachers cannot approve or reject questions.
* Editing an approved Question must save the previous approved version and
  change the active Question to `pending`.
* Approved questions must not be moved to pending through the ordinary submit
  endpoint; they move to pending through the approved-edit flow.

### Actions by status

Draft:

* View
* Edit
* Submit for Approval
* Delete

Pending:

* View
* Show `Pending admin review`
* No Edit
* No Delete
* No Submit

Approved in Your Questions:

* View
* Edit, only for the owner
* Show a warning that editing will submit the Question for review again

Rejected:

* View Feedback when feedback exists
* Edit
* Resubmit
* Do not fabricate rejection feedback when the database does not contain it

### Draft and submit validation

Draft requirements:

* Question text is required.
* Question type is required.
* Creator is assigned by the backend.
* Subject may be null.
* Difficulty may be null.
* Chapter selection may be empty.
* Learning Objective selection may be empty.
* Partially entered MCQ options may be saved.
* Full submission validation must not run when saving a draft.

Submit requirements:

* Question text must not be empty.
* Question type must be valid.
* Difficulty is required.
* Subject is required.
* Subject must exist.
* Chapter is optional.
* Learning Objective is optional.
* Every selected Chapter must belong to the selected Subject.
* Every selected Learning Objective must be valid according to the real
  Chapter–LO and Subject relationships.

MCQ submit validation:

* At least two non-empty options are required unless the project already has a
  stricter rule.
* At least one correct answer is required.

True/False submit validation:

* Exactly two options are required.
* Options must represent True and False.
* Exactly one option must be correct.

Essay submit validation:

* Essay must not contain MCQ or True/False options.
* Suggested answer or grading guide is used only when supported by the current
  schema.

### Taxonomy

* Subject is stored in `question.subject_id`.
* Question–Chapter relationships are stored in `chapter_question`.
* Question–LO relationships are stored in `lo_question`.
* Chapter–LO relationships are read from `chapter_lo`.
* Chapter is optional.
* Learning Objective is optional.
* A Question may have multiple Chapters.
* A Question may have multiple Learning Objectives.
* Do not infer Chapters or Learning Objectives only from the Subject.
* Load the actual Question relationships.
* Do not store `chapter_id` directly in `question`.
* Do not store `lo_id` directly in `question`.
* When Subject changes, remove selected Chapters that do not belong to the new
  Subject.
* When Subject changes, remove selected Learning Objectives that are no longer
  valid.

Supported cases:

Subject, Chapter, and LO selected:

```text
question.subject_id
chapter_question
lo_question
```

Subject and Chapter selected, no LO:

```text
question.subject_id
chapter_question
```

Subject selected, no Chapter or LO:

```text
question.subject_id
```

Draft without Subject:

```text
question.subject_id = NULL
no chapter_question rows
no lo_question rows
```

### Question revision

When an approved Question is edited, save a snapshot of the old approved
version in `question_revision`.

A Question revision should contain at least:

* revision_id
* question_id
* question_text
* question_type
* question_difficulties
* subject_id
* question_status
* options_snapshot
* chapter_ids_snapshot
* lo_ids_snapshot
* edited_by
* created_at

JSON may be used for snapshots when supported by the existing MySQL and
SQLAlchemy setup.

Do not create a duplicate `question_revision` table if it already exists.

### Transactions

Editing an approved Question must use one database transaction:

1. Read the current approved Question.
2. Save the old Question snapshot to `question_revision`.
3. Update the Question.
4. Update Options.
5. Update `chapter_question`.
6. Update `lo_question`.
7. Change status to `pending`.
8. Commit once.

If any step fails, roll back all changes.

Do not allow these partial states:

* Question updated without a revision.
* Options updated without Question metadata.
* Chapters updated without Learning Objectives.
* Status changed before all content is saved.
* Revision saved while the proposed Question update fails.
* Some options committed while other options fail.

### Delete rules

* Teachers may delete only their own Questions.
* Pending questions cannot be deleted.
* By default, only draft and rejected questions may be deleted.
* Before deletion, check whether the Question is used by an Exam.
* Do not delete a Question that is referenced by an Exam.
* Return a suitable conflict or validation error instead.
* Do not break existing Exam data.

### Question Card UI

Question cards are summary views optimized for scanning.

Question Bank cards should display:

* Question text, limited to approximately two or three lines
* Question type
* Difficulty
* Subject code and Subject name
* Up to two Chapter chips
* Up to two Learning Objective chips
* `+N` when more Chapters or Learning Objectives exist
* MCQ option count
* A clearly labeled View action

Your Questions cards should additionally display:

* Question status
* Created or updated date when available
* Actions allowed by status and ownership

Question cards must not display:

* Full answer options
* Correct-answer values
* Fake tags
* Mock usage counts
* Mock creators
* Mock dates
* `0 options` for Essay
* Unnecessary `2 options` text for True/False

MCQ cards may display:

```text
4 options
```

True/False cards do not need an option count.

Essay cards must not display an option count.

If usage count is shown:

* It must come from real Exam data.
* Use a clear label such as `Used in 5 exams`.
* Do not show hard-coded values.

### Question Detail UI

Selecting View should open:

* A large right-side drawer; or
* A dedicated detail page

Do not use a small modal for complete Question details.

Teacher Question Detail should display:

* Full Question text
* Question type
* Difficulty
* Status where relevant
* Subject code and Subject name
* All Chapters
* All Learning Objectives
* Full options for MCQ and True/False
* Correct-answer indicators
* Suggested answer or grading guide for Essay only when supported
* Creator when available
* Created date when available
* Updated date when available
* Real Exam usage count when available
* Rejected feedback when available and authorized

Correct answers must be marked using both:

* Icon or text
* Visual styling

Do not rely only on color.

Question Bank list endpoints should return summary information.

Question Detail endpoints may return full options and `is_correct` values to
authorized Teachers.

### Frontend data types

Do not represent Chapters or Learning Objectives as one string.

Use arrays, for example:

```ts
interface SubjectSummary {
  subject_id: string;
  subject_name: string;
}

interface ChapterSummary {
  chapter_id: number;
  chapter_name: string;
}

interface LearningObjectiveSummary {
  lo_id: number;
  lo_name: string;
}

interface QuestionBankItem {
  question_id: number;
  question_text: string;
  question_type: QuestionType;
  question_difficulties: QuestionDifficulty | null;
  question_status: QuestionStatus;
  subject: SubjectSummary | null;
  chapters: ChapterSummary[];
  learning_objectives: LearningObjectiveSummary[];
  option_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
}
```

Adapt names to existing project conventions.

Do not use `any` when a specific type can be declared.

### Search, filter, and pagination

Question Bank may support filtering by:

* Subject
* Chapter
* Learning Objective
* Question type
* Difficulty
* Search text

Your Questions may additionally filter by:

* Status

When a filter or search value changes:

* Reset pagination to the first page.
* Remove dependent Chapter or LO selections that are no longer valid.
* Do not keep stale data from the previous tab or filter.

Use search debounce when the project already has a debounce pattern.

Do not load all Question Bank records when the backend supports pagination.

### Reusable Questions and Exams

* Reusable Question Bank questions do not require `exam_id`.
* Reusable Question Bank questions do not require `question_point`.
* `exam_id` and `question_point` belong to the Exam-specific relationship.
* Do not reuse a Question Bank creation type that requires Exam fields.
* Do not break existing Exam Question workflows.
* Do not expose Teacher correct-answer detail through Student exam-taking APIs.

## Done Definition

A module is done only when:

1. Backend endpoint works in Swagger or another real request test.
2. Frontend can call the endpoint without breaking.
3. Database uses correct AntiCheatOES_V2 table names.
4. No `.env` changes were made.
5. No unrelated files were rewritten.
6. The response shape is documented.
7. Test steps are provided.
8. Commands reported as passed were actually run.
9. Remaining issues are documented.
10. Existing unrelated failures are clearly distinguished from failures caused
    by the current change.

For Teacher Question Bank, the module is done only when:

1. Teacher authentication is enforced by the backend.
2. Ownership is enforced by the backend.
3. Question Bank returns approved questions only.
4. Question Bank can include approved questions from multiple Teachers.
5. Your Questions returns only the authenticated Teacher's questions.
6. Teachers cannot modify Questions owned by another Teacher.
7. Teachers cannot directly set a Question to approved.
8. Pending questions are read-only.
9. Subject data comes from the real database.
10. Chapter data comes from `chapter_question`.
11. Learning Objective data comes from `lo_question`.
12. Chapter–LO validation uses `chapter_lo`.
13. Question cards display summary information only.
14. Question cards do not expose full options or correct answers.
15. Authorized Teacher Question Detail can display full options and correct
    answers.
16. Draft may be saved without Subject or difficulty.
17. Submit performs full validation.
18. Approved-question edits create a revision.
19. Approved-question edits change status to pending.
20. Question, Options, Chapters, Learning Objectives, revision, and status are
    updated atomically.
21. Questions used by Exams cannot be deleted.
22. Subject counts are calculated from real data.
23. Backend tests were run.
24. Frontend TypeScript checking or build was run.
25. Frontend build was run successfully, or any remaining failure was reported
    accurately.