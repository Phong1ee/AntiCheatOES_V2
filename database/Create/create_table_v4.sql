-- =========================
-- DROP OLD TABLES
-- =========================

DROP TABLE IF EXISTS exam_event;
DROP TABLE IF EXISTS mcq_answers;
DROP TABLE IF EXISTS essay_answers;
DROP TABLE IF EXISTS attempt_question;
DROP TABLE IF EXISTS attempt;
DROP TABLE IF EXISTS student_exam;
DROP TABLE IF EXISTS lo_question;
DROP TABLE IF EXISTS exam_question;
DROP TABLE IF EXISTS options;
DROP TABLE IF EXISTS question;
DROP TABLE IF EXISTS exam;
DROP TABLE IF EXISTS chapter_lo;
DROP TABLE IF EXISTS chapter;
DROP TABLE IF EXISTS teacher;
DROP TABLE IF EXISTS student;
DROP TABLE IF EXISTS lo;
DROP TABLE IF EXISTS subject;
DROP TABLE IF EXISTS user;


-- =========================
-- Adding class to subject
-- Recheck the ERD on the drive for better understanding of the relationships
-- =========================

CREATE TABLE user(
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id VARCHAR(30) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'teacher', 'admin'),
    phone VARCHAR(20),
    date_of_birth DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


CREATE TABLE subject(
    subject_id VARCHAR(20) PRIMARY KEY,
    subject_name VARCHAR(100) NOT NULL,
    subject_description VARCHAR(255) NOT NULL
);

-- CREATE TABLE class(
--     class_id INT PRIMARY KEY,
--     class_name VARCHAR(100) NOT NULL,
--     class_description VARCHAR(255) NOT NULL
-- );

-- New
CREATE TABLE class (
    class_id INT PRIMARY KEY AUTO_INCREMENT,
    class_name VARCHAR(100) NOT NULL,
    subject_id VARCHAR(20) NOT NULL,
    teacher_id INT NOT NULL,

    FOREIGN KEY (subject_id) REFERENCES subject(subject_id),
    FOREIGN KEY (teacher_id) REFERENCES user(id)
);


-- New
CREATE TABLE student_class (
    student_id INT,
    class_id INT,

    PRIMARY KEY(student_id, class_id),

    FOREIGN KEY(student_id) REFERENCES user(id),
    FOREIGN KEY(class_id) REFERENCES class(class_id)
);


CREATE TABLE lo(
    lo_id INT PRIMARY KEY,
    lo_name VARCHAR(100) NOT NULL,
    lo_description VARCHAR(255) NOT NULL
);

CREATE TABLE chapter(
    chapter_id INT PRIMARY KEY,
    chapter_name VARCHAR(100) NOT NULL,
    chapter_description VARCHAR(255) NOT NULL,
    subject_id VARCHAR(20),

    FOREIGN KEY (subject_id)
        REFERENCES subject(subject_id)
        ON DELETE CASCADE
);

CREATE TABLE chapter_lo(
    chapter_id INT,
    lo_id INT,

    PRIMARY KEY (chapter_id, lo_id),

    FOREIGN KEY (chapter_id)
        REFERENCES chapter(chapter_id)
        ON DELETE CASCADE,

    FOREIGN KEY (lo_id)
        REFERENCES lo(lo_id)
        ON DELETE CASCADE
);

CREATE TABLE exam(
    exam_id INT AUTO_INCREMENT PRIMARY KEY,
    manage_by INT NULL,
    title VARCHAR(255) NOT NULL,
    examcode VARCHAR(20) NOT NULL UNIQUE,
    max_attempt INT,
    description TEXT,
    duration_minutes INT DEFAULT 90,
    start_time DATETIME,
    end_time DATETIME,
    result_visibility ENUM('hidden', 'score-only', 'full') DEFAULT 'full',

    FOREIGN KEY (manage_by)
        REFERENCES user(id)
        ON DELETE SET NULL
);

CREATE TABLE question(
    question_id INT PRIMARY KEY,
    question_text VARCHAR(255) NOT NULL,
    question_difficulties ENUM('easy', 'medium', 'hard') NOT NULL,
    question_type ENUM('MCQ', 'essay'),
    chapter_id INT,
    created_by INT NULL,
    question_status ENUM('draft', 'pending', 'approved', 'rejected'),

    FOREIGN KEY (chapter_id)
        REFERENCES chapter(chapter_id)
        ON DELETE CASCADE,

    FOREIGN KEY (created_by)
        REFERENCES user(id)
        ON DELETE SET NULL
);

CREATE TABLE options(
    options_id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT,
    options_text VARCHAR(255) NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,

    FOREIGN KEY (question_id)
        REFERENCES question(question_id)
        ON DELETE CASCADE
);

CREATE TABLE exam_question(
    exam_id INT,
    question_id INT,
    question_point INT NOT NULL,

    PRIMARY KEY (exam_id, question_id),

    FOREIGN KEY (exam_id)
        REFERENCES exam(exam_id)
        ON DELETE CASCADE,

    FOREIGN KEY (question_id)
        REFERENCES question(question_id)
        ON DELETE CASCADE
);

CREATE TABLE lo_question(
    lo_id INT,
    question_id INT,

    PRIMARY KEY (lo_id, question_id),

    FOREIGN KEY (lo_id)
        REFERENCES lo(lo_id)
        ON DELETE CASCADE,

    FOREIGN KEY (question_id)
        REFERENCES question(question_id)
        ON DELETE CASCADE
);


CREATE TABLE student_exam(
    student_id VARCHAR(30),
    exam_id INT,

    PRIMARY KEY (student_id, exam_id),

    FOREIGN KEY (student_id)
        REFERENCES user(school_id)
        ON DELETE CASCADE,

    FOREIGN KEY (exam_id)
        REFERENCES exam(exam_id)
        ON DELETE CASCADE
);

CREATE TABLE attempt(
    attempt_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT,
    student_id INT,
    attempt_no INT,
    score DECIMAL(5,2),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    submitted_at TIMESTAMP,

    FOREIGN KEY (exam_id)
        REFERENCES exam(exam_id),

    FOREIGN KEY (student_id)
        REFERENCES user(id)
);

CREATE TABLE attempt_question(
    attempt_id INT,
    question_id INT,
    display_order INT,

    PRIMARY KEY (attempt_id, question_id),

    FOREIGN KEY (attempt_id)
        REFERENCES attempt(attempt_id),

    FOREIGN KEY (question_id)
        REFERENCES question(question_id)
);

CREATE TABLE essay_answers(
    essay_answer_id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT,
    question_id INT,
    answer_text TEXT,
    score INT,

    FOREIGN KEY (attempt_id, question_id)
        REFERENCES attempt_question(attempt_id, question_id),

    UNIQUE (attempt_id, question_id)
);

CREATE TABLE mcq_answers(
    mcq_answer_id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT,
    question_id INT,
    selected_option_id INT,

    FOREIGN KEY (attempt_id, question_id)
        REFERENCES attempt_question(attempt_id, question_id),

    FOREIGN KEY (selected_option_id)
        REFERENCES options(options_id)
);

CREATE TABLE exam_event(
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT,
    event_type VARCHAR(50),
    event_timestamp TIMESTAMP,
    details TEXT,

    FOREIGN KEY (attempt_id)
        REFERENCES attempt(attempt_id)
);