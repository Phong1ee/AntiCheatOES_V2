AGENTS.md

Project Name

AntiCheatOES_V2_new - Online Examination System with Anti-Cheat Mechanisms.

Technology Stack

Use only technologies, languages, libraries, and project structure already present in this repository, except for the explicitly approved Multiuser Reliability additions defined below.

Backend:

Python 3.12

FastAPI

Uvicorn

Pydantic

SQLAlchemy if already used in the current backend

Alembic if already used for migrations

mysql-connector-python where it is already used

python-dotenv / dotenv

PyJWT

Werkzeug security / Passlib bcrypt if already used

MySQL

Frontend:

React 18

TypeScript

Vite

Radix UI components

lucide-react

sonner

Existing CSS/Tailwind-like utility classes already used in the project

Do not migrate the backend to Node.js or Express.

Do not add a new frontend framework.

Use the database access approach already present in the related module.

Do not introduce a second ORM or migrate existing SQLAlchemy code to anotherdatabase layer.

Before changing models or migrations, inspect the existing SQLAlchemy modelsand Alembic migration history.

Multiuser Reliability Architecture — Explicitly Approved Additions

The AntiCheatOES_V2 Multiuser / Reliability roadmap is an explicitly approved cross-role architecture task covering Student, Teacher, and Admin.

These approvals apply only when the current prompt explicitly references AntiCheatOES_V2_Implementation_Runbook_All_Roles, the Multiuser / Reliability roadmap, or one of its numbered implementation phases. They do not authorize unrelated infrastructure changes outside that scope.

For those roadmap tasks, the following additions are approved even if they are not currently present in the repository.

Approved infrastructure:

Docker

Docker Compose

Nginx as reverse proxy / load balancer

Redis, using the existing Redis Python dependency where applicable

RabbitMQ as the message broker

Approved backend dependency additions:

Exactly one Python RabbitMQ client may be added when the RabbitMQ phase requires it.

Do not add multiple RabbitMQ clients or messaging frameworks for the same purpose.

Do not add Celery unless a later explicit task specifically approves it.

Do not add Kafka or another message broker.

Do not introduce a new ORM for this roadmap.

Approved load-testing tooling:

Use exactly one external load-testing tool when the load-test phase requires it: Locust OR k6.

Load-testing scripts and dependencies must remain development/test tooling and must not become application runtime dependencies unless explicitly required.

Approved shared architecture modules may include:

Redis client / CacheService

RabbitMQ connection and topology module

Transactional Outbox publisher

Background workers

Health and readiness endpoints

Request-ID / structured logging middleware

Dockerfiles

Docker Compose configuration

Nginx configuration

Load and failure test scripts

Approved database infrastructure may be added only when the current roadmap phase explicitly requires it and only after checking that no equivalent already exists. Examples include:

outbox_event

background_job

audit_log

revision, version, or cache-version fields

processed-event or idempotency metadata when required

focused UNIQUE constraints or indexes required for concurrency correctness

Do not create any approved table, column, service, worker, middleware, queue, cache layer, endpoint, or infrastructure component blindly.

For every Multiuser Reliability phase:

Inspect the current source, active schema, Alembic migrations, and existing tests first.

Search for an existing implementation or equivalent mechanism before changing code.

If the required capability already exists and is correct, keep it and verify it with focused tests.

Only implement, refactor, or migrate the missing or incorrect portion.

Do not recreate an equivalent table, endpoint, service, migration, worker, cache layer, route, or business flow from scratch.

Preserve existing correct business behavior and API compatibility unless the current phase explicitly changes the contract.

Do not automatically implement later phases. Complete only the current phase, run its focused regression tests, and report the result before moving to the next phase.

Backend Dependency Source of Truth

When backend/pyproject.toml and backend/uv.lock are present and maintained, use them as the canonical backend dependency definition for roadmap work.

Use uv sync / uv run for the canonical backend workflow unless the current repository explicitly documents another source of truth.

If backend/requirements.txt exists but is stale, do not silently treat it as more authoritative than pyproject.toml and uv.lock. Either synchronize it in a focused dependency-management task or document the canonical uv workflow.

Do not commit secrets or real environment credentials. Use example/template environment files for new infrastructure configuration.

Current Project Structure

Backend:

backend/main.py

backend/src/a_db_config/

backend/src/route/

backend/src/controller/

backend/src/models/

backend/src/middleware/

Frontend:

frontend/src/components/

frontend/src/services/

frontend/src/services/api.ts

frontend/src/contexts/

frontend/src/data/

frontend/src/types/

Database:

database/Create/creat_table_v3.sql

Existing SQLAlchemy models

Existing Alembic migrations, if present

Database Rules

database/Create/creat_table_v3.sql is the original database baseline.

The current SQLAlchemy models, Alembic migrations, and active project databasemay contain later approved changes.

Do not revert the current schema back to creat_table_v3.sql.

Before making a database change:

Inspect the current models.

Inspect existing Alembic migrations.

Check whether the required table, column, enum, relationship, index, orconstraint already exists.

Do not recreate an existing table, enum, relationship, or constraint.

Create a focused migration only when the current task requires it.

Do not delete, replace, or reset existing database data unless explicitlyrequested.

Do not modify seed data unless the current task explicitly requests seedchanges.

Do not manually renumber existing primary keys or foreign keys.

Required Alembic Workflow

For every database schema change, including adding, changing, or removing acolumn, index, constraint, enum, or table, complete and report this workflow:

Run uv run alembic current, uv run alembic heads, and uv run alembic history from backend before creating a migration.

Create one focused migration whose down_revision is the actual current Alembic head; never hard-code a revision supplied by a database dump when the repository head differs.

Read the generated migration and verify its upgrade and downgrade operations before applying it.

Run uv run alembic heads and confirm that the repository has exactly one head.

Run uv run alembic upgrade head against the configured project database.

Run uv run alembic current and verify the intended schema change in the database.

If any command cannot run, do not claim the schema changed; report the exact blocking error and do not treat source-model changes as a database migration.

Do not remove a migration file after it may have been applied to any shared orconfigured database. Create a new focused migration to reverse the schemachange instead.

Use the existing project tables and do not introduce a new table unless the current task explicitly approves it. The current SQLAlchemy model set includes:

user

subject

teacher_subject

lo

chapter

chapter_lo

class

student_class

exam

exam_setting

exam_pool_config

exam_pool_rule

exam_pool_question

question

options

exam_question

chapter_question

lo_question

question_revision

student_exam

attempt

attempt_question

mcq_answers

essay_answers

exam_event

Anti-cheat changes must extend the existing exam_setting, attempt, andexam_event tables. Do not create a separate anti-cheat table.

Do not use these table names from other projects:

users

exams

exam_students

submissions

answers

Important schema notes:

user.id is the internal numeric primary key.

user.school_id is the external student, teacher, or admin identifier.

student_exam.student_id references user.school_id.

attempt.student_id references user.school_id.

exam.examcode stores the code students must enter before taking an exam.

exam.result_visibility controls whether students can view results.

exam_event is used for anti-cheat logging.

teacher_subject.teacher_id references user.school_id.

teacher_subject.subject_id references subject.subject_id.

question.created_by references the authenticated user's user.school_id.

question.subject_id identifies the Subject of a reusable question.

chapter_question stores the many-to-many relationship between Question andChapter.

lo_question stores the many-to-many relationship between Question andLearning Objective.

chapter_lo stores the relationship between Chapter and Learning Objective.

question_revision stores snapshots of approved questions before a Teacheredits them.

User Reference Convention

user.id remains the internal INT AUTO_INCREMENT primary key. Do notchange its type or use it for these cross-table user references. The followingcolumns are VARCHAR(30) foreign keys to user.school_id:

attempt.student_id

student_class.student_id

class.teacher_id

teacher_subject.teacher_id

teacher_subject.assigned_by

question.created_by

question_revision.edited_by

question_revision.approved_by

user.locked_by

user.deleted_by

student_exam.student_id and exam.manage_by also referenceuser.school_id.

When joining any of these columns, compare against User.school_id, notUser.id. Student attempt, result, and ownership flows must pass theauthenticated user's school_id to queries that filter these columns. Keepinternal user.id only for user-management endpoints or logic that explicitlyuses the User table primary key.

Question Bank relationship rules:

Question–Subject uses question.subject_id.

Question–Chapter uses chapter_question.

Question–LO uses lo_question.

Chapter–LO uses chapter_lo.

A Question may belong to multiple Chapters.

A Question may belong to multiple Learning Objectives.

Do not store chapter_id directly in question.

Do not store lo_id directly in question.

Reusable Question Bank questions do not require exam_id.

Reusable Question Bank questions do not require question_point.

Exam-specific points and placement belong to exam_question.

Task Scope Precedence

The explicit task in the current user prompt determines the active module.

Multiuser Reliability Task Scope

When the current prompt explicitly references AntiCheatOES_V2_Implementation_Runbook_All_Roles, the Multiuser Reliability roadmap, or one of its numbered phases, that prompt is a cross-role architecture task and takes precedence over the general Student Module Roadmap for its own scope.

A Multiuser Reliability phase may update the shared infrastructure and the Student, Teacher, or Admin modules explicitly named by that phase.

Do not require unrelated Student roadmap items to be completed first.

Do not expand a phase into unrelated Teacher or Admin features that the current phase does not request.

Do not automatically implement later roadmap phases.

Complete only the current numbered phase, run its focused regression tests, and report the result before moving to the next phase.

Existing Correct Implementation Rule

Before implementing any requirement in a Multiuser Reliability phase:

Search the current repository for an existing implementation.

Inspect the active schema and Alembic history when the requirement is database-related.

Inspect existing focused tests.

If an equivalent implementation already exists and satisfies the requirement, do not rewrite it.

Verify it with tests and preserve it.

Add or modify code only where a verified gap exists.

Do not create duplicate abstractions or parallel implementations merely because the Runbook contains an example name.

When the Runbook suggests a table, column, route, service, worker, version field, or constraint, first determine whether the current project already has an equivalent mechanism that safely satisfies the same requirement.

Preserve existing correct business behavior and API compatibility unless the current phase explicitly requires a contract change.

The Student Module Roadmap applies only when the current task belongs to the Student module.

A clearly scoped Teacher module task may be implemented without completing the remaining Student roadmap items first.

Do not implement Admin functionality unless the current task explicitly requests it.

When a task explicitly limits the scope to Teacher:

Do not create Admin pages.

Do not create Admin routes.

Do not create Admin services.

Do not create Admin tests.

Do not create approve or reject workflows.

Do not expand the task into unrelated Student or Exam work.

Anti-Cheat Task Scope

An explicitly scoped anti-cheat task is a cross-module task. It may update the Teacher settings UI, Student exam flow, backend routes/controllers/models, Alembic migrations, services, types, and focused tests required by that task.

The numbered anti-cheat implementation prompts take precedence over the general Student Module Roadmap for their own scope. Do not require unrelated Studentroadmap items, Admin functionality, fresh seed data, or unrelated refactors before completing an anti-cheat prompt.

Implement only the current anti-cheat phase. Do not automatically implement later phases unless the current prompt explicitly requests them.

Development Rules

Before editing

Read this AGENTS.md.

Read the related backend and frontend files first.

Inspect existing models, schemas, routes, controllers, services, types, andtests related to the task.

List the files that will be changed.

Explain the planned changes briefly.

Confirm whether a migration is actually necessary.

Do not modify files until the current module task is clear.

Do not stop after analysis when the user has explicitly asked forimplementation.

When editing

Make small, focused changes.

Do not rewrite the whole project.

Do not change .env.

Do not hard-code secrets, tokens, database passwords, user IDs, Subject IDs,or ownership values.

Do not change database schema unless explicitly required by the task.

Keep existing Student and Exam API responses backward-compatible.

New Teacher Question Bank endpoints may use dedicated response schemas.

When extending an existing endpoint, do not remove or rename fields alreadyconsumed by the frontend unless every usage is updated in the same task.

Do not reuse Exam Question payloads that require exam_id orquestion_point for reusable Question Bank APIs.

Use transactions for operations that update multiple related tables.

Roll back all related database changes when any step fails.

Do not commit partial Question, Option, Chapter, LO, status, or revisionupdates.

Do not create duplicate models, enums, route modules, services, orcomponents.

Do not introduce mock data when the module is required to use the database.

Do not replace existing architecture with a different pattern unlessexplicitly requested.

Do not expose server-controlled fields for modification by the frontend.

Correct-answer security

Never expose correct answers through Student exam-taking endpoints while anattempt is in progress.

Authenticated Teacher Question Bank detail endpoints may return optionis_correct values because Teachers need to review reusable questions.

Do not reuse Teacher Question Detail response schemas for Student exam-takingresponses.

Question Bank list responses should normally return summary information suchas option_count, not full answer options.

Full options and correct-answer values should be returned only by an authorizedTeacher Question Detail endpoint or another explicitly authorized workflow.

After editing

Summarize changed files.

Explain how to test the feature.

List the commands that were actually run.

Report the real result of each command.

Mention remaining issues, if any.

Do not claim that tests or builds passed unless they were actually run andpassed.

Clearly separate existing unrelated errors from errors caused by the currentchanges.

Backend Commands

Run backend:

cd backenduv run python main.py

Check Python syntax:

cd backenduv run python -m py_compile main.py

Run backend tests if a test suite exists:

cd backenduv run pytest

Run a focused backend test file when appropriate:

cd backenduv run pytest path/to/test_file.py

Check Alembic current revision if Alembic is present:

cd backenduv run alembic current

Check Alembic heads if Alembic is present:

cd backenduv run alembic heads

Do not run alembic upgrade head without first inspecting the generatedmigration.

Frontend Commands

Run frontend:

cd frontendnpm run dev

Build frontend:

cd frontendnpm run build

Run TypeScript type checking if the project defines a typecheck script:

cd frontendnpm run typecheck

Run lint if configured:

cd frontendnpm run lint

Do not add a new frontend test framework only for a single task unlessexplicitly requested.

Student Module Roadmap

Use this order only for general Student roadmap work. An explicitly scopedanti-cheat task follows the Anti-Cheat Task Scope and its numbered phase instead:

Create fresh seed data for testing

Add /db-check

Debug register/login response

Add GET /api/auth/me

Complete GET /api/exams

Complete GET /api/exams/{exam_id}

Add POST /api/exams/{exam_id}/verify-code

Add POST /api/exams/{exam_id}/start

Add anti-cheat event logging

Add POST /api/exams/{exam_id}/submit

Add GET /api/results

Add GET /api/results/{attempt_id}

Add profile APIs

Run full Student end-to-end test

Required Student Flow

The final Student flow must be:

Student registers or logs in.

Student opens Dashboard and views assigned Exams.

Student opens Exam details and enters the Exam code when required.

Backend verifies the Exam code, schedule, ownership, and attempt limit.

Backend returns antiCheatEnabled, violationLimit, and resume state.

If anti-cheat is disabled, keep the normal start/resume flow and do notrequest camera, microphone, or fullscreen.

If anti-cheat is enabled, show Rules & Security before start or resume.

Student grants live camera and microphone access and enters fullscreen.

Only after successful preflight, create a new attempt or resume the existingin-progress attempt on the bound device.

Frontend loads questions and starts monitoring only for an activeanti-cheat attempt.

Student answers MCQ and Essay questions; answers are autosaved using thevalid attempt session.

Frontend sends anti-cheat events to the backend; backend owns the persistentviolation count and termination decision.

Student submits manually, timer auto-submits, or backend terminates the current attempt when its violation limit is reached.

Normal submission follows existing grading behavior. A terminatedanti-cheat attempt receives score 0 and only that attempt is affected.

Student views results according to result_visibility and Essay gradingstate.

API Prefix Rules

Auth

/api/auth/register

/api/auth/login

/api/auth/logout

/api/auth/me

Exams

GET /api/exams

GET /api/exams/{exam_id}

POST /api/exams/{exam_id}/verify-code

POST /api/exams/{exam_id}/start

POST /api/exams/{exam_id}/events

POST /api/exams/{exam_id}/attempts/{attempt_id}/resume

POST /api/exams/{exam_id}/attempts/{attempt_id}/heartbeat

POST /api/exams/{exam_id}/submit

Do not create duplicate start, restore, resume, save-answer, submit, terminate,or event routes when an equivalent route already exists. Extend or refactor theexisting route and update all consumers in the same task.

Results

/api/results

/api/results/{attempt_id}

Profile

/api/profile/me

/api/profile/change-password

Teacher Question Bank

GET /api/teacher/question-bank

GET /api/teacher/question-bank/mine

GET /api/teacher/question-bank/subjects

GET /api/teacher/question-bank/subjects/{subject_id}/chapters

GET /api/teacher/question-bank/chapters/{chapter_id}/learning-objectives

GET /api/teacher/question-bank/{question_id}

POST /api/teacher/question-bank

PUT /api/teacher/question-bank/{question_id}

POST /api/teacher/question-bank/{question_id}/submit

DELETE /api/teacher/question-bank/{question_id}

Declare fixed paths such as /mine, /subjects, and /chapters beforedynamic routes such as /{question_id}, or otherwise ensure that dynamicrouting cannot capture the fixed paths incorrectly.

Do not create /api/admin/question-bank/\* unless the current task explicitly requests Admin functionality.

Teacher Anti-Cheat Monitor

GET /api/teacher/anti-cheat/subjects

GET /api/teacher/anti-cheat/subjects/{subject_id}/exams

GET /api/teacher/anti-cheat/exams/{exam_id}/attempts

GET /api/teacher/anti-cheat/attempts/{attempt_id}

Teacher anti-cheat routes must enforce that the authenticated Teacher managesor is authorized for the requested Subject and Exam. Do not expose attempts orevents from unrelated Subjects.

Anti-Cheat Requirements

Configuration

Anti-cheat is configured per Exam through the existing exam_setting table:

anti_cheat_enabled: enables or disables the complete anti-cheat flow.

violation_limit: one positive shared limit for all counted violation types.

Do not keep separate fullscreen, tab-switch, or copy/paste limits in the finalcontract. During an expand-and-contract migration, legacy threshold fields mayremain temporarily for backward compatibility, but new logic must useanti_cheat_enabled and violation_limit. Drop legacy fields only in the finalcleanup phase after all backend and frontend usages are removed.

When anti-cheat is disabled:

Do not show Anti-Cheat Rules & Security.

Do not request camera or microphone for anti-cheat.

Do not require fullscreen for anti-cheat.

Do not install anti-cheat listeners.

Do not increment violations or terminate the attempt for anti-cheat events.

Backend authority

The backend is the only source of truth for:

whether anti-cheat is enabled

the violation limit

attempt.violation_count

whether an event counts as a violation

whether the attempt is terminated

the final score of a terminated attempt

Never trust client-provided is_violation, violation count, violation limit,termination state, score, ownership, or system event type. The frontend mustnot terminate an attempt based on local state.

Persist the current count in attempt.violation_count. A page refresh,component remount, Dashboard navigation, or Resume must not reset it. A newlycreated later attempt starts with count 0.

Event storage and idempotency

Use the existing exam_event table. Do not create a new anti-cheat table.Each event should support:

attempt_id

event_type

server-generated event_timestamp

details

source

server-controlled is_violation

client_event_id

bounded JSON metadata

Use a unique constraint or unique index on (attempt_id, client_event_id) so aretry or Resume cannot count the same event twice. Multiple legacy rows with aNULL client_event_id must remain valid.

A violation request must be atomic:

Verify authenticated Student ownership and Exam/Attempt relationship.

Validate the active attempt session when session binding is implemented.

Lock the Attempt row for update.

Read the Exam anti-cheat setting.

Reject or no-op duplicate client_event_id values.

Insert the event with server-controlled classification.

Increment violation_count exactly once when applicable.

If the new count reaches the limit, terminate and score the attempt in thesame transaction.

Commit once; roll back all related changes on failure.

Events received after an Attempt is submitted or terminated must be idempotentand must not change its count, status, or score.

Counted event types

The backend must classify violation types through an explicit allowlist. Theminimum browser event types are:

TAB_HIDDEN

WINDOW_BLUR

FULLSCREEN_EXIT

COPY_ATTEMPT

PASTE_ATTEMPT

CUT_ATTEMPT

PRINT_ATTEMPT

BLOCKED_SHORTCUT

PAGE_REFRESH

The minimum camera and microphone health events are:

CAMERA_PERMISSION_DENIED

CAMERA_TRACK_MUTED

CAMERA_TRACK_ENDED

MIC_PERMISSION_DENIED

MIC_TRACK_MUTED

MIC_TRACK_ENDED

System-only event types such as ATTEMPT_SUBMITTED, ATTEMPT_TERMINATED,DEVICE_BOUND_ON_RESUME, or similar values cannot be submitted by the client.

AI event names may exist in the contract only when a real detector producesthem. Do not fabricate face, phone, speech, or second-person detections and donot add mock events to make the Teacher monitor appear populated.

Limit reached

When violation_count >= violation_limit, the backend must:

save any valid latest answers supplied by the established contract

set the current Attempt status to terminated

set score to 0.00 without reusing normal MCQ grading

set end/submission timestamps consistently

save a clear termination_reason

add one server-generated termination event

ensure Essay work for that Attempt is not left pending for grading

recalculate student_exam.final_score with the existing result strategy

Only the violating Attempt receives 0. Other completed attempts must remainunchanged. If the Exam permits another attempt, the Student may start it underthe normal attempt-limit rules.

Start, preflight, fullscreen, and media

For an anti-cheat Exam, the Student flow is:

Verify Exam code when required without creating an Attempt.

Show Rules & Security and the shared violation limit.

From a direct user action, request one live video track and one live audiotrack.

Enter fullscreen from a direct user action.

Only after successful preflight, create or Resume the Attempt.

Pass the live MediaStream into the Exam interface; do not immediately requesta second stream.

If preflight fails before a new Attempt is created, do not create the Attempt.Show a retryable error and stop any partially acquired tracks.

Do not record, upload, or store video, audio, screenshots, image blobs, or rawmedia in the database. Store only bounded event metadata. Camera UI must sayLIVE or Monitoring, not REC or Recording, unless actual recording isexplicitly implemented and approved.

Refresh and Resume

For an in-progress anti-cheat Attempt:

F5 or browser reload returns the Student to Dashboard.

The existing Attempt remains in progress and is resumed; do not create asecond Attempt.

Resume requires camera, microphone, and fullscreen again.

PAGE_REFRESH is recorded exactly once during Resume using a persistentclient_event_id.

The violation count returned by the backend remains unchanged except for theaccepted refresh violation.

Unload-related blur, hidden, or fullscreen events must not cause one refreshto be counted multiple times.

If the refresh violation reaches the limit, Resume returns the terminatedstate and the Student must not re-enter the questions.

Device and attempt session binding

Bind a new Attempt to a browser-generated device UUID. Store only its SHA-256hash. This is browser binding for the project, not guaranteed hardwarefingerprinting.

Use a cryptographically random Attempt session token. Store only its hash androtate it on a valid Resume. Require the active session for answer save,restore, submit, event, heartbeat, and any compatible legacy terminate route.Do not expose stored hashes through APIs.

An older in-progress Attempt with no device hash may be claimed once by itsowning Student on the first valid Resume, then must remain bound to that device.

Frontend monitoring behavior

Install monitoring only while an anti-cheat Attempt is active and in progress.Use cooldown or deduplication so a single action does not generate event spam.Update warning UI from the backend response, including current count, limit,remaining violations, and terminated state.

Allow normal Shift and Caps Lock input. Do not block every Ctrl or Alt key,because that breaks text input and accessibility. Prevent supported copy,paste, cut, print, and shortcut actions only when anti-cheat is enabled.

A normal website cannot reliably block or directly detect every operatingsystem action, including Fn, Alt+Tab, PrtSc, Win+Shift+S, or DevToolsopened from browser UI. Treat browser detection as best effort. Use blur orvisibility signals where applicable and do not claim guaranteed prevention.

Teacher monitor

The Teacher Anti-Cheat Monitor must use real database data, not mock attempts,counts, events, timestamps, devices, or AI flags. The selection order isSubject, then Exam, then Attempt. Attempt detail must show the persisted count,limit, status, termination reason, and ordered real events that the Teacher isauthorized to view.

Required testing

Add focused tests for anti-cheat disabled behavior, shared counting, duplicateevents, transaction rollback, concurrent events near the limit, zero-scoretermination, Essay finalization, refresh/Resume idempotency, device mismatch,session rotation, authorization, and real Teacher monitor queries. Run and report only commands and test results that actually executed.

Teacher Question Bank Rules

Scope and page structure

Question Bank lists approved questions from all Teachers.

Your Questions lists only questions created by the current authenticatedTeacher.

Question Bank and Your Questions are top-level tabs.

Your Questions must not be added as an item in the Subject sidebar.

Do not display the old global View Only Mode banner for Teachers.

Do not use one global readOnly flag to block all Teacher Question Bankactions.

Do not implement Admin Question Bank pages, routes, services, or tests unlessexplicitly requested.

Question Bank tab

Question Bank returns only questions whose status is approved.

Question Bank includes approved questions created by any Teacher.

Teachers may search, filter, and view approved questions.

Question Bank must not show:

New Question

Edit

Delete

Submit

Resubmit

Draft

Pending

Rejected

Question Bank cards do not need to display an Approved status badge becauseevery item in that tab is already approved.

Question Bank Subject counts include approved questions only.

Question Bank must not show a No Subject category.

Add to Exam may appear only when the existing Exam workflow requires it.

Reusable Question Bank questions must not require exam_id orquestion_point.

Your Questions tab

Your Questions returns only questions where.created_by == current_teacher.school_id.

Your Questions may display:

draft

pending

approved

rejected

New Question is displayed only in Your Questions.

Your Questions may show status filters:

All

Draft

Pending

Approved

Rejected

Your Questions Subject counts include only questions owned by the currentTeacher.

Your Questions may show No Subject for drafts whose subject_id is null.

Ownership and authorization

Teachers may only modify questions they created.

The backend must enforce ownership for every write operation.

Frontend visibility is not an authorization boundary.

Never trust created_by, owner ID, role, or question_status from thefrontend.

created_by must be assigned from the authenticated user.

Teachers cannot directly set a Question to approved.

Teachers cannot directly set arbitrary status values.

Teachers cannot access another Teacher's draft, pending, or rejectedQuestion through a direct ID.

Approved questions may be viewed by authenticated Teachers.

Draft, pending, and rejected questions may be viewed only by their owner inthe Teacher module.

Teachers cannot edit, delete, submit, or resubmit another Teacher's Question.

Teachers cannot edit another Teacher's approved Question.

Ownership checks must protect:

private detail access

update

delete

submit

resubmit

rejected feedback access

approved-question editing

Status transitions

New Question:

new -> draft

Submit:

draft -> pendingrejected -> pending

Edit approved:

approved -> pending

Rules:

New questions are created as draft.

Draft and rejected questions may be submitted and become pending.

Pending questions are read-only for Teachers.

Pending questions cannot be edited by Teachers.

Pending questions cannot be deleted by Teachers.

Pending questions cannot be submitted again.

Teachers cannot approve or reject questions.

Editing an approved Question must save the previous approved version andchange the active Question to pending.

Approved questions must not be moved to pending through the ordinary submitendpoint; they move to pending through the approved-edit flow.

Actions by status

Draft:

View

Edit

Submit for Approval

Delete

Pending:

View

Show Pending admin review

No Edit

No Delete

No Submit

Approved in Your Questions:

View

Edit, only for the owner

Show a warning that editing will submit the Question for review again

Rejected:

View Feedback when feedback exists

Edit

Resubmit

Do not fabricate rejection feedback when the database does not contain it

Draft and submit validation

Draft requirements:

Question text is required.

Question type is required.

Creator is assigned by the backend.

Subject may be null.

Difficulty may be null.

Chapter selection may be empty.

Learning Objective selection may be empty.

Partially entered MCQ options may be saved.

Full submission validation must not run when saving a draft.

Submit requirements:

Question text must not be empty.

Question type must be valid.

Difficulty is required.

Subject is required.

Subject must exist.

Chapter is optional.

Learning Objective is optional.

Every selected Chapter must belong to the selected Subject.

Every selected Learning Objective must be valid according to the realChapter–LO and Subject relationships.

MCQ submit validation:

At least two non-empty options are required unless the project already has astricter rule.

At least one correct answer is required.

True/False submit validation:

Exactly two options are required.

Options must represent True and False.

Exactly one option must be correct.

Essay submit validation:

Essay must not contain MCQ or True/False options.

Suggested answer or grading guide is used only when supported by the currentschema.

Taxonomy

Subject is stored in question.subject_id.

Question–Chapter relationships are stored in chapter_question.

Question–LO relationships are stored in lo_question.

Chapter–LO relationships are read from chapter_lo.

Chapter is optional.

Learning Objective is optional.

A Question may have multiple Chapters.

A Question may have multiple Learning Objectives.

Do not infer Chapters or Learning Objectives only from the Subject.

Load the actual Question relationships.

Do not store chapter_id directly in question.

Do not store lo_id directly in question.

When Subject changes, remove selected Chapters that do not belong to the newSubject.

When Subject changes, remove selected Learning Objectives that are no longervalid.

Supported cases:

Subject, Chapter, and LO selected:

question.subject_idchapter_questionlo_question

Subject and Chapter selected, no LO:

question.subject_idchapter_question

Subject selected, no Chapter or LO:

question.subject_id

Draft without Subject:

question.subject_id = NULLno chapter_question rowsno lo_question rows

Question revision

When an approved Question is edited, save a snapshot of the old approvedversion in question_revision.

A Question revision should contain at least:

revision_id

question_id

question_text

question_type

question_difficulties

subject_id

question_status

options_snapshot

chapter_ids_snapshot

lo_ids_snapshot

edited_by

created_at

JSON may be used for snapshots when supported by the existing MySQL andSQLAlchemy setup.

Do not create a duplicate question_revision table if it already exists.

Transactions

Editing an approved Question must use one database transaction:

Read the current approved Question.

Save the old Question snapshot to question_revision.

Update the Question.

Update Options.

Update chapter_question.

Update lo_question.

Change status to pending.

Commit once.

If any step fails, roll back all changes.

Do not allow these partial states:

Question updated without a revision.

Options updated without Question metadata.

Chapters updated without Learning Objectives.

Status changed before all content is saved.

Revision saved while the proposed Question update fails.

Some options committed while other options fail.

Delete rules

Teachers may delete only their own Questions.

Pending questions cannot be deleted.

By default, only draft and rejected questions may be deleted.

Before deletion, check whether the Question is used by an Exam.

Do not delete a Question that is referenced by an Exam.

Return a suitable conflict or validation error instead.

Do not break existing Exam data.

Question Card UI

Question cards are summary views optimized for scanning.

Question Bank cards should display:

Question text, limited to approximately two or three lines

Question type

Difficulty

Subject code and Subject name

Up to two Chapter chips

Up to two Learning Objective chips

+N when more Chapters or Learning Objectives exist

MCQ option count

A clearly labeled View action

Your Questions cards should additionally display:

Question status

Created or updated date when available

Actions allowed by status and ownership

Question cards must not display:

Full answer options

Correct-answer values

Fake tags

Mock usage counts

Mock creators

Mock dates

0 options for Essay

Unnecessary 2 options text for True/False

MCQ cards may display:

4 options

True/False cards do not need an option count.

Essay cards must not display an option count.

If usage count is shown:

It must come from real Exam data.

Use a clear label such as Used in 5 exams.

Do not show hard-coded values.

Question Detail UI

Selecting View should open:

A large right-side drawer; or

A dedicated detail page

Do not use a small modal for complete Question details.

Teacher Question Detail should display:

Full Question text

Question type

Difficulty

Status where relevant

Subject code and Subject name

All Chapters

All Learning Objectives

Full options for MCQ and True/False

Correct-answer indicators

Suggested answer or grading guide for Essay only when supported

Creator when available

Created date when available

Updated date when available

Real Exam usage count when available

Rejected feedback when available and authorized

Correct answers must be marked using both:

Icon or text

Visual styling

Do not rely only on color.

Question Bank list endpoints should return summary information.

Question Detail endpoints may return full options and is_correct values toauthorized Teachers.

Frontend data types

Do not represent Chapters or Learning Objectives as one string.

Use arrays, for example:

interface SubjectSummary {subject_id: string;subject_name: string;}

interface ChapterSummary {chapter_id: number;chapter_name: string;}

interface LearningObjectiveSummary {lo_id: number;lo_name: string;}

interface QuestionBankItem {question_id: number;question_text: string;question_type: QuestionType;question_difficulties: QuestionDifficulty | null;question_status: QuestionStatus;subject: SubjectSummary | null;chapters: ChapterSummary[];learning_objectives: LearningObjectiveSummary[];option_count?: number;created_at?: string | null;updated_at?: string | null;}

Adapt names to existing project conventions.

Do not use any when a specific type can be declared.

Search, filter, and pagination

Question Bank may support filtering by:

Subject

Chapter

Learning Objective

Question type

Difficulty

Search text

Your Questions may additionally filter by:

Status

When a filter or search value changes:

Reset pagination to the first page.

Remove dependent Chapter or LO selections that are no longer valid.

Do not keep stale data from the previous tab or filter.

Use search debounce when the project already has a debounce pattern.

Do not load all Question Bank records when the backend supports pagination.

Reusable Questions and Exams

Reusable Question Bank questions do not require exam_id.

Reusable Question Bank questions do not require question_point.

exam_id and question_point belong to the Exam-specific relationship.

Do not reuse a Question Bank creation type that requires Exam fields.

Do not break existing Exam Question workflows.

Do not expose Teacher correct-answer detail through Student exam-taking APIs.

Done Definition

A module is done only when:

Backend endpoint works in Swagger or another real request test.

Frontend can call the endpoint without breaking.

Database uses correct AntiCheatOES_V2 table names.

No .env changes were made.

No unrelated files were rewritten.

The response shape is documented.

Test steps are provided.

Commands reported as passed were actually run.

Remaining issues are documented.

Existing unrelated failures are clearly distinguished from failures causedby the current change.

For Teacher Question Bank, the module is done only when:

Teacher authentication is enforced by the backend.

Ownership is enforced by the backend.

Question Bank returns approved questions only.

Question Bank can include approved questions from multiple Teachers.

Your Questions returns only the authenticated Teacher's questions.

Teachers cannot modify Questions owned by another Teacher.

Teachers cannot directly set a Question to approved.

Pending questions are read-only.

Subject data comes from the real database.

Chapter data comes from chapter_question.

Learning Objective data comes from lo_question.

Chapter–LO validation uses chapter_lo.

Question cards display summary information only.

Question cards do not expose full options or correct answers.

Authorized Teacher Question Detail can display full options and correctanswers.

Draft may be saved without Subject or difficulty.

Submit performs full validation.

Approved-question edits create a revision.

Approved-question edits change status to pending.

Question, Options, Chapters, Learning Objectives, revision, and status areupdated atomically.

Questions used by Exams cannot be deleted.

Subject counts are calculated from real data.

Backend tests were run.

Frontend TypeScript checking or build was run.

Frontend build was run successfully, or any remaining failure was reportedaccurately.
