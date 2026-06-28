# AGENTS.md

## Project Name

AntiCheatOES_V2 - Online Examination System with Anti-Cheat Mechanisms.

## Technology Stack

Use only technologies, languages, libraries, and project structure already present in this repository.

Backend:

* Python 3.12
* FastAPI
* Uvicorn
* Pydantic
* mysql-connector-python
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

Do not migrate backend to Node.js or Express.
Do not introduce a new ORM unless explicitly requested.
Do not add new frontend frameworks.

## Current Project Structure

Backend:

* backend/main.py
* backend/src/a_db_config/config.py
* backend/src/route/
* backend/src/controller/
* backend/src/models/
* backend/src/middleware/

Frontend:

* frontend/src/components/
* frontend/src/services/api.ts
* frontend/src/contexts/
* frontend/src/data/
* frontend/src/types/

Database:

* database/Create/creat_table_v3.sql

## Database Rules

The database schema is already created exactly like `database/Create/creat_table_v3.sql`.

Use only these tables:

* user
* subject
* lo
* chapter
* chapter_lo
* exam
* question
* options
* exam_question
* lo_question
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
* `user.school_id` is the external student/teacher/admin identifier.
* `student_exam.student_id` references `user.school_id`.
* `attempt.student_id` references `user.id`.
* `exam.examcode` stores the code students must enter before taking an exam.
* `exam.result_visibility` controls whether students can view results.
* `exam_event` is used for anti-cheat logging.

## Development Rules

Before editing:

1. Read the related backend and frontend files first.
2. List the files that will be changed.
3. Explain the planned changes briefly.
4. Do not modify files until the current module task is clear.

When editing:

1. Make small, focused changes.
2. Do not rewrite the whole project.
3. Do not change `.env`.
4. Do not hard-code secrets, tokens, or database passwords.
5. Do not change database schema unless explicitly requested.
6. Keep API responses compatible with the existing frontend.
7. Do not expose correct MCQ answers while the student is taking the exam.
8. Use transactions for exam submission and answer saving.
9. Rollback database changes if submission fails.

After editing:

1. Summarize changed files.
2. Explain how to test the feature.
3. Mention remaining issues, if any.

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

## Student Module Roadmap

Implement student features in this exact order:

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
13. Run full student end-to-end test

## Required Student Flow

The final student flow must be:

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
11. Student answers MCQ and essay questions.
12. Anti-cheat events are logged to backend.
13. Student submits manually or timer auto-submits.
14. Backend saves answers.
15. Backend auto-grades MCQ.
16. Essay answers wait for manual grading.
17. Student views result depending on `result_visibility`.

## API Prefix Rules

Auth:

* `/api/auth/register`
* `/api/auth/login`
* `/api/auth/logout`
* `/api/auth/me`

Exams:

* `/api/exams`
* `/api/exams/{exam_id}`
* `/api/exams/{exam_id}/verify-code`
* `/api/exams/{exam_id}/start`
* `/api/exams/{exam_id}/events`
* `/api/exams/{exam_id}/submit`

Results:

* `/api/results`
* `/api/results/{attempt_id}`

Profile:

* `/api/profile/me`
* `/api/profile/change-password`

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

## Done Definition

A module is done only when:

1. Backend endpoint works in Swagger or browser test.
2. Frontend can call the endpoint without breaking.
3. Database uses correct AntiCheatOES_V2 table names.
4. No `.env` changes.
5. No unrelated files are rewritten.
6. The response shape is documented.
7. Test steps are provided.
