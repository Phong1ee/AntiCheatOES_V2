-- =========================
-- DATABASE
-- =========================
CREATE DATABASE online_exam_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE online_exam_db;

-- =========================
-- 1. BASE TABLES (NO FK)
-- =========================

CREATE TABLE user(
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'teacher', 'admin') DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE subject(
    subject_id VARCHAR(20) PRIMARY KEY,
    subject_name VARCHAR(100) NOT NULL,
    subject_description VARCHAR(255) NOT NULL
);

CREATE TABLE lo(
    lo_id INT PRIMARY KEY,
    lo_name VARCHAR(100) NOT NULL,
    lo_description VARCHAR(255) NOT NULL
);

-- =========================
-- 2. USER EXTENSIONS
-- =========================

CREATE TABLE student(
    student_id VARCHAR(20) PRIMARY KEY,
    user_id INT NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE teacher(
    teacher_id VARCHAR(20) PRIMARY KEY,
    user_id INT NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,

    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- =========================
-- 3. CONTENT STRUCTURE
-- =========================

CREATE TABLE chapter(
    chapter_id INT PRIMARY KEY,
    chapter_name VARCHAR(100) NOT NULL,
    chapter_description VARCHAR(255) NOT NULL,
    subject_id VARCHAR(20),

    FOREIGN KEY (subject_id) REFERENCES subject(subject_id) ON DELETE CASCADE
);

CREATE TABLE chapter_lo (
    chapter_id INT,
    lo_id INT,
    PRIMARY KEY (chapter_id, lo_id),

    FOREIGN KEY (chapter_id) REFERENCES chapter(chapter_id) ON DELETE CASCADE,
    FOREIGN KEY (lo_id) REFERENCES lo(lo_id) ON DELETE CASCADE
);

-- =========================
-- 4. EXAM + QUESTION CORE
-- =========================

CREATE TABLE exam(
    exam_id INT AUTO_INCREMENT PRIMARY KEY,
    manage_by VARCHAR(20),
    title VARCHAR(255) NOT NULL,
    examcode VARCHAR(20) NOT NULL UNIQUE,
    max_attempt INT,
    description TEXT,
    duration_minutes INT DEFAULT 90,
    start_time DATETIME,
    end_time DATETIME,
    result_visibility ENUM('hidden', 'score-only', 'full') DEFAULT 'full',

    FOREIGN KEY (manage_by) REFERENCES teacher(teacher_id)
);

CREATE TABLE question(
    question_id INT PRIMARY KEY,
    question_text VARCHAR(255) NOT NULL,
    question_difficulties ENUM('easy', 'medium', 'hard') NOT NULL,
    question_type ENUM('MCQ', 'essay'),
    created_by VARCHAR(20),
    question_status ENUM('draft', 'pending', 'approved', 'rejected'),

    FOREIGN KEY (created_by) REFERENCES teacher(teacher_id)
);

CREATE TABLE options (
    options_id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT,
    options_text VARCHAR(255) NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,

    FOREIGN KEY (question_id) REFERENCES question(question_id) ON DELETE CASCADE
);

-- =========================
-- 5. RELATION TABLES
-- =========================

CREATE TABLE exam_question (
    exam_id INT,
    question_id INT,
    question_point INT NOT NULL,
    PRIMARY KEY (exam_id, question_id),

    FOREIGN KEY (exam_id) REFERENCES exam(exam_id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES question(question_id) ON DELETE CASCADE
);

CREATE TABLE lo_question(
    lo_id INT,
    question_id INT,
    PRIMARY KEY (lo_id, question_id),

    FOREIGN KEY (lo_id) REFERENCES lo(lo_id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES question(question_id) ON DELETE CASCADE
);

-- =========================
-- 6. ATTEMPT
-- =========================

CREATE TABLE attempt(
    attempt_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT,
    attempt_no INT,
    score DECIMAL(5,2),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    submitted_at TIMESTAMP,

    FOREIGN KEY (exam_id) REFERENCES exam(exam_id)
);

CREATE TABLE attempt_question (
    attempt_id INT,
    question_id INT,
    display_order INT,

    PRIMARY KEY (attempt_id, question_id),

    FOREIGN KEY (attempt_id) REFERENCES attempt(attempt_id),
    FOREIGN KEY (question_id) REFERENCES question(question_id)
);

-- =========================
-- 7. ANSWERS (PHỤ THUỘC attempt_question + options)
-- =========================

CREATE TABLE essay_answers (
    essay_answer_id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT,
    question_id INT,
    answer_text TEXT,
    score INT,

    FOREIGN KEY (attempt_id, question_id)
        REFERENCES attempt_question(attempt_id, question_id),

    UNIQUE (attempt_id, question_id)
);

CREATE TABLE mcq_answers (
    mcq_answer_id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT,
    question_id INT,
    selected_option_id INT,

    FOREIGN KEY (attempt_id, question_id)
        REFERENCES attempt_question(attempt_id, question_id),

    FOREIGN KEY (selected_option_id)
        REFERENCES options(options_id)
);

-- =========================
-- 8. EVENTS (CUỐI CÙNG)
-- =========================

CREATE TABLE exam_event(
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT,
    event_type VARCHAR(50),
    event_timestamp TIMESTAMP,
    details TEXT,

    FOREIGN KEY (attempt_id) REFERENCES attempt(attempt_id)
);