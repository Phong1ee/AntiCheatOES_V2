USE online_exam_db;

-- =========================
-- 1. USERS TEST
-- Password:
-- student: Student@123
-- teacher: Teacher@123
-- admin:   Admin@123
-- =========================

-- =========================
-- 2. SUBJECT
-- =========================

INSERT INTO subject
(subject_id, subject_name, subject_description)
VALUES
(
    'IT4409',
    'Web Technologies and Online Services',
    'Basic web development, backend API, frontend, and online services.'
)
ON DUPLICATE KEY UPDATE
    subject_name = VALUES(subject_name),
    subject_description = VALUES(subject_description);


-- =========================
-- 3. LEARNING OUTCOMES
-- =========================

INSERT INTO lo
(lo_id, lo_name, lo_description)
VALUES
(1, 'LO1', 'Understand web application architecture.'),
(2, 'LO2', 'Understand HTTP, API, and client-server communication.'),
(3, 'LO3', 'Apply JavaScript and frontend logic.'),
(4, 'LO4', 'Apply backend and database logic.')
ON DUPLICATE KEY UPDATE
    lo_name = VALUES(lo_name),
    lo_description = VALUES(lo_description);


-- =========================
-- 4. CHAPTERS
-- =========================

INSERT INTO chapter
(chapter_id, chapter_name, chapter_description, subject_id)
VALUES
(1, 'Introduction to Web', 'Overview of web systems and online services.', 'IT4409'),
(2, 'HTML and CSS', 'Structure and style of web pages.', 'IT4409'),
(3, 'JavaScript Basics', 'JavaScript syntax, DOM, and events.', 'IT4409'),
(4, 'Backend API', 'API, authentication, database, and server logic.', 'IT4409')
ON DUPLICATE KEY UPDATE
    chapter_name = VALUES(chapter_name),
    chapter_description = VALUES(chapter_description),
    subject_id = VALUES(subject_id);


-- =========================
-- 5. CHAPTER - LO
-- =========================

INSERT IGNORE INTO chapter_lo
(chapter_id, lo_id)
VALUES
(1, 1),
(2, 1),
(3, 3),
(4, 2),
(4, 4);


-- =========================
-- 6. EXAMS
-- =========================

INSERT INTO exam
(manage_by, title, examcode, max_attempt, description, duration_minutes, start_time, end_time, result_visibility)
VALUES
(
    (SELECT id FROM `user` WHERE school_id = 'T000001'),
    'IT4409 Midterm Exam',
    'IT4409-MID',
    3,
    'Midterm exam for Web Technologies and Online Services.',
    45,
    DATE_SUB(NOW(), INTERVAL 1 DAY),
    DATE_ADD(NOW(), INTERVAL 7 DAY),
    'full'
),
(
    (SELECT id FROM `user` WHERE school_id = 'T000001'),
    'IT4409 Final Practice',
    'IT4409-FINAL',
    2,
    'Final practice exam for students.',
    60,
    DATE_SUB(NOW(), INTERVAL 1 DAY),
    DATE_ADD(NOW(), INTERVAL 14 DAY),
    'score-only'
)
ON DUPLICATE KEY UPDATE
    title = VALUES(title),
    max_attempt = VALUES(max_attempt),
    description = VALUES(description),
    duration_minutes = VALUES(duration_minutes),
    start_time = VALUES(start_time),
    end_time = VALUES(end_time),
    result_visibility = VALUES(result_visibility);


-- =========================
-- 7. QUESTIONS
-- =========================

INSERT INTO question
(question_id, question_text, question_difficulties, question_type, chapter_id, created_by, question_status)
VALUES
(
    1001,
    'What does HTML stand for?',
    'easy',
    'MCQ',
    2,
    (SELECT id FROM `user` WHERE school_id = 'T000001'),
    'approved'
),
(
    1002,
    'Which HTTP method is commonly used to retrieve data from a server?',
    'easy',
    'MCQ',
    4,
    (SELECT id FROM `user` WHERE school_id = 'T000001'),
    'approved'
),
(
    1003,
    'Which JavaScript function is used to parse a JSON string into an object?',
    'medium',
    'MCQ',
    3,
    (SELECT id FROM `user` WHERE school_id = 'T000001'),
    'approved'
),
(
    1004,
    'Explain the role of frontend and backend in a web application.',
    'medium',
    'essay',
    1,
    (SELECT id FROM `user` WHERE school_id = 'T000001'),
    'approved'
),
(
    1005,
    'What is the purpose of JWT in authentication?',
    'medium',
    'MCQ',
    4,
    (SELECT id FROM `user` WHERE school_id = 'T000001'),
    'approved'
)
ON DUPLICATE KEY UPDATE
    question_text = VALUES(question_text),
    question_difficulties = VALUES(question_difficulties),
    question_type = VALUES(question_type),
    chapter_id = VALUES(chapter_id),
    created_by = VALUES(created_by),
    question_status = VALUES(question_status);


-- =========================
-- 8. OPTIONS FOR MCQ
-- Xóa options cũ của câu hỏi test để tránh bị trùng
-- =========================

DELETE FROM options WHERE question_id IN (1001, 1002, 1003, 1005);

INSERT INTO options
(question_id, options_text, is_correct)
VALUES
-- Question 1001
(1001, 'Hyper Text Markup Language', TRUE),
(1001, 'High Tech Modern Language', FALSE),
(1001, 'Home Tool Markup Language', FALSE),
(1001, 'Hyperlink Text Management Language', FALSE),

-- Question 1002
(1002, 'GET', TRUE),
(1002, 'POST', FALSE),
(1002, 'PUT', FALSE),
(1002, 'DELETE', FALSE),

-- Question 1003
(1003, 'JSON.parse()', TRUE),
(1003, 'JSON.stringify()', FALSE),
(1003, 'parse.JSON()', FALSE),
(1003, 'Object.toJSON()', FALSE),

-- Question 1005
(1005, 'To securely transmit user identity and claims between client and server', TRUE),
(1005, 'To store images in the database', FALSE),
(1005, 'To style frontend components', FALSE),
(1005, 'To replace all database queries', FALSE);


-- =========================
-- 9. EXAM - QUESTIONS
-- =========================

INSERT INTO exam_question
(exam_id, question_id, question_point)
VALUES
(
    (SELECT exam_id FROM exam WHERE examcode = 'IT4409-MID'),
    1001,
    10
),
(
    (SELECT exam_id FROM exam WHERE examcode = 'IT4409-MID'),
    1002,
    10
),
(
    (SELECT exam_id FROM exam WHERE examcode = 'IT4409-MID'),
    1003,
    10
),
(
    (SELECT exam_id FROM exam WHERE examcode = 'IT4409-MID'),
    1004,
    20
),
(
    (SELECT exam_id FROM exam WHERE examcode = 'IT4409-MID'),
    1005,
    10
),
(
    (SELECT exam_id FROM exam WHERE examcode = 'IT4409-FINAL'),
    1001,
    10
),
(
    (SELECT exam_id FROM exam WHERE examcode = 'IT4409-FINAL'),
    1002,
    10
),
(
    (SELECT exam_id FROM exam WHERE examcode = 'IT4409-FINAL'),
    1005,
    10
)
ON DUPLICATE KEY UPDATE
    question_point = VALUES(question_point);


-- =========================
-- 10. ASSIGN EXAMS TO STUDENTS
-- =========================

INSERT IGNORE INTO student_exam
(student_id, exam_id)
VALUES
(
    'S000001',
    (SELECT exam_id FROM exam WHERE examcode = 'IT4409-MID')
),
(
    'S000001',
    (SELECT exam_id FROM exam WHERE examcode = 'IT4409-FINAL')
),
(
    'S000002',
    (SELECT exam_id FROM exam WHERE examcode = 'IT4409-MID')
);