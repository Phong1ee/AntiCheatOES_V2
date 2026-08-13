-- =========================================================================
-- GENERATED FILE - do not edit by hand.
--
-- Source of truth: backend/src/a_db_config/__init__.py (SQLAlchemy models).
-- Regenerate with:  cd backend && python ../database/Create/generate_schema.py
--
-- Note: every foreign key to a user references user.school_id (VARCHAR(30)),
-- not user.id. The older create_table_v*.sql scripts in this folder predate
-- that change and cannot build a working database.
-- =========================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `mcq_answers`;
DROP TABLE IF EXISTS `exam_pool_question`;
DROP TABLE IF EXISTS `essay_answers`;
DROP TABLE IF EXISTS `exam_pool_rule`;
DROP TABLE IF EXISTS `exam_event`;
DROP TABLE IF EXISTS `attempt_question`;
DROP TABLE IF EXISTS `student_exam`;
DROP TABLE IF EXISTS `student_class`;
DROP TABLE IF EXISTS `question_revision`;
DROP TABLE IF EXISTS `options`;
DROP TABLE IF EXISTS `lo_question`;
DROP TABLE IF EXISTS `exam_setting`;
DROP TABLE IF EXISTS `exam_question`;
DROP TABLE IF EXISTS `exam_pool_config`;
DROP TABLE IF EXISTS `chapter_question`;
DROP TABLE IF EXISTS `chapter_lo`;
DROP TABLE IF EXISTS `attempt`;
DROP TABLE IF EXISTS `teacher_subject`;
DROP TABLE IF EXISTS `question`;
DROP TABLE IF EXISTS `exam`;
DROP TABLE IF EXISTS `class`;
DROP TABLE IF EXISTS `chapter`;
DROP TABLE IF EXISTS `user`;
DROP TABLE IF EXISTS `subject`;
DROP TABLE IF EXISTS `lo`;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE lo (
	lo_id INTEGER NOT NULL AUTO_INCREMENT,
	lo_name VARCHAR(100) NOT NULL,
	lo_description VARCHAR(255) NOT NULL,
	PRIMARY KEY (lo_id)
);

CREATE TABLE subject (
	subject_id VARCHAR(20) NOT NULL,
	subject_name VARCHAR(100) NOT NULL,
	subject_description VARCHAR(255) NOT NULL,
	PRIMARY KEY (subject_id)
);

CREATE TABLE user (
	id INTEGER NOT NULL AUTO_INCREMENT,
	school_id VARCHAR(30) NOT NULL,
	full_name VARCHAR(100) NOT NULL,
	email VARCHAR(100) NOT NULL,
	password_hash VARCHAR(255) NOT NULL,
	`role` ENUM('student','teacher','admin'),
	phone VARCHAR(20),
	date_of_birth DATE,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	is_locked BOOL NOT NULL DEFAULT 0,
	locked_at DATETIME,
	locked_by VARCHAR(30),
	deleted_at DATETIME,
	deleted_by VARCHAR(30),
	PRIMARY KEY (id),
	UNIQUE (school_id),
	UNIQUE (email),
	FOREIGN KEY(locked_by) REFERENCES user (school_id) ON DELETE SET NULL,
	FOREIGN KEY(deleted_by) REFERENCES user (school_id) ON DELETE SET NULL
);

CREATE TABLE chapter (
	chapter_id INTEGER NOT NULL AUTO_INCREMENT,
	chapter_name VARCHAR(100) NOT NULL,
	chapter_description VARCHAR(255) NOT NULL,
	subject_id VARCHAR(20),
	PRIMARY KEY (chapter_id),
	FOREIGN KEY(subject_id) REFERENCES subject (subject_id) ON DELETE CASCADE
);

CREATE TABLE class (
	class_id INTEGER NOT NULL AUTO_INCREMENT,
	class_name VARCHAR(100) NOT NULL,
	subject_id VARCHAR(20) NOT NULL,
	teacher_id VARCHAR(30) NOT NULL,
	PRIMARY KEY (class_id),
	FOREIGN KEY(subject_id) REFERENCES subject (subject_id),
	FOREIGN KEY(teacher_id) REFERENCES user (school_id)
);

CREATE TABLE exam (
	exam_id INTEGER NOT NULL AUTO_INCREMENT,
	manage_by VARCHAR(30),
	title VARCHAR(255) NOT NULL,
	examcode VARCHAR(20),
	max_attempt INTEGER,
	description TEXT,
	duration_minutes INTEGER,
	start_time DATETIME,
	end_time DATETIME,
	status ENUM('draft','published') NOT NULL DEFAULT 'draft',
	result_visibility ENUM('hidden','score-only','full'),
	subject_id VARCHAR(20),
	total_points INTEGER DEFAULT 100,
	passing_score NUMERIC(5, 2) DEFAULT 50.00,
	question_selection_mode ENUM('manual','fixed_randomization','pool') NOT NULL DEFAULT 'manual',
	PRIMARY KEY (exam_id),
	FOREIGN KEY(manage_by) REFERENCES user (school_id) ON DELETE SET NULL,
	UNIQUE (examcode),
	FOREIGN KEY(subject_id) REFERENCES subject (subject_id)
);

CREATE TABLE question (
	question_id INTEGER NOT NULL AUTO_INCREMENT,
	question_text VARCHAR(255) NOT NULL,
	question_difficulties ENUM('easy','medium','hard'),
	question_type ENUM('MCQ','essay','true-false'),
	subject_id VARCHAR(20),
	created_by VARCHAR(30),
	question_status ENUM('draft','pending','approved','rejected'),
	source_question_id INTEGER,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (question_id),
	FOREIGN KEY(subject_id) REFERENCES subject (subject_id) ON DELETE RESTRICT,
	FOREIGN KEY(created_by) REFERENCES user (school_id) ON DELETE SET NULL,
	FOREIGN KEY(source_question_id) REFERENCES question (question_id) ON DELETE SET NULL
);

CREATE TABLE teacher_subject (
	teacher_id VARCHAR(30) NOT NULL,
	subject_id VARCHAR(20) NOT NULL,
	assigned_by VARCHAR(30),
	assigned_at DATETIME,
	is_active BOOL NOT NULL DEFAULT 1,
	PRIMARY KEY (teacher_id, subject_id),
	FOREIGN KEY(teacher_id) REFERENCES user (school_id) ON DELETE CASCADE,
	FOREIGN KEY(subject_id) REFERENCES subject (subject_id) ON DELETE CASCADE,
	FOREIGN KEY(assigned_by) REFERENCES user (school_id) ON DELETE SET NULL
);

CREATE TABLE attempt (
	attempt_id INTEGER NOT NULL AUTO_INCREMENT,
	exam_id INTEGER,
	student_id VARCHAR(30),
	attempt_no INTEGER,
	score NUMERIC(5, 2),
	score_scale_version SMALLINT NOT NULL DEFAULT 3,
	start_time DATETIME,
	end_time DATETIME,
	submitted_at DATETIME,
	status ENUM('in_progress','submitted','terminated') NOT NULL DEFAULT 'in_progress',
	last_saved_at DATETIME,
	termination_reason VARCHAR(255),
	violation_count INTEGER NOT NULL DEFAULT 0,
	last_violation_at DATETIME,
	device_id_hash VARCHAR(64),
	session_token_hash VARCHAR(64),
	last_heartbeat_at DATETIME,
	PRIMARY KEY (attempt_id),
	CONSTRAINT uq_attempt_exam_student_no UNIQUE (exam_id, student_id, attempt_no),
	CONSTRAINT ck_attempt_violation_count_nonnegative CHECK (violation_count >= 0),
	FOREIGN KEY(exam_id) REFERENCES exam (exam_id),
	FOREIGN KEY(student_id) REFERENCES user (school_id)
);

CREATE TABLE chapter_lo (
	chapter_id INTEGER NOT NULL,
	lo_id INTEGER NOT NULL,
	PRIMARY KEY (chapter_id, lo_id),
	FOREIGN KEY(chapter_id) REFERENCES chapter (chapter_id) ON DELETE CASCADE,
	FOREIGN KEY(lo_id) REFERENCES lo (lo_id) ON DELETE CASCADE
);

CREATE TABLE chapter_question (
	chapter_id INTEGER NOT NULL,
	question_id INTEGER NOT NULL,
	PRIMARY KEY (chapter_id, question_id),
	FOREIGN KEY(chapter_id) REFERENCES chapter (chapter_id) ON DELETE CASCADE,
	FOREIGN KEY(question_id) REFERENCES question (question_id) ON DELETE CASCADE
);

CREATE TABLE exam_pool_config (
	pool_config_id INTEGER NOT NULL AUTO_INCREMENT,
	exam_id INTEGER NOT NULL,
	subject_id VARCHAR(20) NOT NULL,
	fixed_randomization BOOL NOT NULL DEFAULT 0,
	version INTEGER NOT NULL DEFAULT 1,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (pool_config_id),
	CONSTRAINT uq_exam_pool_config_exam UNIQUE (exam_id),
	FOREIGN KEY(exam_id) REFERENCES exam (exam_id) ON DELETE CASCADE,
	FOREIGN KEY(subject_id) REFERENCES subject (subject_id) ON DELETE RESTRICT
);

CREATE TABLE exam_question (
	exam_id INTEGER NOT NULL,
	question_id INTEGER NOT NULL,
	question_point NUMERIC(10, 2) NOT NULL,
	PRIMARY KEY (exam_id, question_id),
	FOREIGN KEY(exam_id) REFERENCES exam (exam_id) ON DELETE CASCADE,
	FOREIGN KEY(question_id) REFERENCES question (question_id) ON DELETE CASCADE
);

CREATE TABLE exam_setting (
	exam_id INTEGER NOT NULL,
	shuffle_question BOOL NOT NULL DEFAULT 0,
	shuffle_answer_options BOOL NOT NULL DEFAULT 0,
	sequential_navigation BOOL NOT NULL DEFAULT 0,
	auto_submit_on_expire BOOL NOT NULL DEFAULT 1,
	grace_period INTEGER NOT NULL DEFAULT 0,
	anti_cheat_enabled BOOL NOT NULL DEFAULT 0,
	violation_limit INTEGER NOT NULL DEFAULT 5,
	auto_grade BOOL NOT NULL DEFAULT 1,
	result_strategy ENUM('highest','average','last_attempt') NOT NULL DEFAULT 'highest',
	PRIMARY KEY (exam_id),
	CONSTRAINT ck_exam_setting_grace_period_nonnegative CHECK (grace_period >= 0),
	CONSTRAINT ck_exam_setting_violation_limit_positive CHECK (violation_limit > 0),
	FOREIGN KEY(exam_id) REFERENCES exam (exam_id) ON DELETE CASCADE
);

CREATE TABLE lo_question (
	lo_id INTEGER NOT NULL,
	question_id INTEGER NOT NULL,
	PRIMARY KEY (lo_id, question_id),
	FOREIGN KEY(lo_id) REFERENCES lo (lo_id) ON DELETE CASCADE,
	FOREIGN KEY(question_id) REFERENCES question (question_id) ON DELETE CASCADE
);

CREATE TABLE options (
	options_id INTEGER NOT NULL AUTO_INCREMENT,
	question_id INTEGER,
	options_text VARCHAR(255) NOT NULL,
	is_correct BOOL NOT NULL,
	PRIMARY KEY (options_id),
	FOREIGN KEY(question_id) REFERENCES question (question_id) ON DELETE CASCADE
);

CREATE TABLE question_revision (
	revision_id INTEGER NOT NULL AUTO_INCREMENT,
	question_id INTEGER NOT NULL,
	version_number INTEGER NOT NULL,
	question_text VARCHAR(255) NOT NULL,
	question_difficulties VARCHAR(20),
	question_type VARCHAR(20),
	subject_id VARCHAR(20),
	question_status VARCHAR(20) NOT NULL,
	options_snapshot JSON,
	chapter_ids_snapshot JSON,
	lo_ids_snapshot JSON,
	edited_by VARCHAR(30),
	approved_by VARCHAR(30),
	approved_at DATETIME,
	rejection_reason VARCHAR(500),
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (revision_id),
	CONSTRAINT ck_question_revision_status CHECK (question_status IN ('pending', 'approved', 'rejected')),
	CONSTRAINT uq_question_revision_question_version UNIQUE (question_id, version_number),
	FOREIGN KEY(question_id) REFERENCES question (question_id) ON DELETE CASCADE,
	FOREIGN KEY(edited_by) REFERENCES user (school_id) ON DELETE SET NULL,
	FOREIGN KEY(approved_by) REFERENCES user (school_id) ON DELETE SET NULL
);

CREATE TABLE student_class (
	student_id VARCHAR(30) NOT NULL,
	class_id INTEGER NOT NULL,
	PRIMARY KEY (student_id, class_id),
	FOREIGN KEY(student_id) REFERENCES user (school_id),
	FOREIGN KEY(class_id) REFERENCES class (class_id)
);

CREATE TABLE student_exam (
	student_id VARCHAR(30) NOT NULL,
	exam_id INTEGER NOT NULL,
	final_score NUMERIC(5, 2),
	PRIMARY KEY (student_id, exam_id),
	FOREIGN KEY(student_id) REFERENCES user (school_id) ON DELETE CASCADE,
	FOREIGN KEY(exam_id) REFERENCES exam (exam_id) ON DELETE CASCADE
);

CREATE TABLE attempt_question (
	attempt_id INTEGER NOT NULL,
	question_id INTEGER NOT NULL,
	display_order INTEGER,
	question_point NUMERIC(10, 2),
	question_text_snapshot TEXT,
	question_type_snapshot VARCHAR(30),
	question_point_snapshot NUMERIC(10, 2),
	options_snapshot JSON,
	PRIMARY KEY (attempt_id, question_id),
	FOREIGN KEY(attempt_id) REFERENCES attempt (attempt_id),
	FOREIGN KEY(question_id) REFERENCES question (question_id)
);

CREATE TABLE exam_event (
	event_id INTEGER NOT NULL AUTO_INCREMENT,
	attempt_id INTEGER,
	event_type VARCHAR(50),
	event_timestamp DATETIME,
	details TEXT,
	source VARCHAR(30) NOT NULL DEFAULT 'system',
	is_violation BOOL NOT NULL DEFAULT 0,
	client_event_id VARCHAR(64),
	metadata JSON,
	PRIMARY KEY (event_id),
	CONSTRAINT uq_exam_event_attempt_client_event UNIQUE (attempt_id, client_event_id),
	FOREIGN KEY(attempt_id) REFERENCES attempt (attempt_id)
);

CREATE TABLE exam_pool_rule (
	rule_id INTEGER NOT NULL AUTO_INCREMENT,
	pool_config_id INTEGER NOT NULL,
	chapter_id INTEGER NOT NULL,
	lo_id INTEGER,
	difficulty ENUM('easy','medium','hard') NOT NULL,
	draw_count INTEGER NOT NULL,
	max_score_per_question NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
	PRIMARY KEY (rule_id),
	CONSTRAINT uq_exam_pool_rule_taxonomy UNIQUE (pool_config_id, chapter_id, lo_id, difficulty),
	CONSTRAINT ck_exam_pool_rule_draw_positive CHECK (draw_count > 0),
	CONSTRAINT ck_exam_pool_rule_max_score_positive CHECK (max_score_per_question > 0),
	FOREIGN KEY(pool_config_id) REFERENCES exam_pool_config (pool_config_id) ON DELETE CASCADE,
	FOREIGN KEY(chapter_id) REFERENCES chapter (chapter_id) ON DELETE RESTRICT,
	FOREIGN KEY(lo_id) REFERENCES lo (lo_id) ON DELETE RESTRICT
);

CREATE TABLE essay_answers (
	essay_answer_id INTEGER NOT NULL AUTO_INCREMENT,
	attempt_id INTEGER,
	question_id INTEGER,
	answer_text TEXT,
	score NUMERIC(10, 2),
	PRIMARY KEY (essay_answer_id),
	FOREIGN KEY(attempt_id, question_id) REFERENCES attempt_question (attempt_id, question_id),
	UNIQUE (attempt_id, question_id)
);

CREATE TABLE exam_pool_question (
	rule_id INTEGER NOT NULL,
	question_id INTEGER NOT NULL,
	PRIMARY KEY (rule_id, question_id),
	FOREIGN KEY(rule_id) REFERENCES exam_pool_rule (rule_id) ON DELETE CASCADE,
	FOREIGN KEY(question_id) REFERENCES question (question_id) ON DELETE RESTRICT
);

CREATE TABLE mcq_answers (
	mcq_answer_id INTEGER NOT NULL AUTO_INCREMENT,
	attempt_id INTEGER,
	question_id INTEGER,
	selected_option_id INTEGER,
	PRIMARY KEY (mcq_answer_id),
	FOREIGN KEY(attempt_id, question_id) REFERENCES attempt_question (attempt_id, question_id),
	CONSTRAINT uq_mcq_answers_attempt_question UNIQUE (attempt_id, question_id),
	FOREIGN KEY(selected_option_id) REFERENCES options (options_id)
);
