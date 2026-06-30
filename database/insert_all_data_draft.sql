-- 1. Populate 'user' Table
INSERT INTO `user` (`id`, `school_id`, `full_name`, `email`, `password_hash`, `role`, `phone`, `date_of_birth`) VALUES
(1, 'ADM001', 'Alice Johnson', 'alice.admin@school.edu', 'hash_admin_123', 'admin', '555-0100', '1985-04-12'),
(2, 'TCH001', 'Bob Smith', 'bob.teacher@school.edu', 'hash_teacher_123', 'teacher', '555-0101', '1978-09-23'),
(3, 'TCH002', 'Clara Oswald', 'clara.t@school.edu', 'hash_clara_123', 'teacher', '555-0102', '1988-11-05'),
(4, 'STU001', 'David Miller', 'david.stu@school.edu', 'hash_david_123', 'student', '555-0103', '2005-01-15'),
(5, 'STU002', 'Emily Watson', 'emily.stu@school.edu', 'hash_emily_123', 'student', '555-0104', '2005-06-20'),
(6, 'STU003', 'Frank Castle', 'frank.stu@school.edu', 'hash_frank_123', 'student', '555-0105', '2004-12-01');

-- 2. Populate 'subject' Table
INSERT INTO `subject` (`subject_id`, `subject_name`, `subject_description`) VALUES
('CS101', 'Introduction to Computer Science', 'Foundations of programming and computer logic.'),
('MATH201', 'Calculus I', 'Limits, derivatives, and integral operations.');

-- 3. Populate 'class' Table
INSERT INTO `class` (`class_id`, `class_name`, `subject_id`, `teacher_id`) VALUES
(1, 'CS101-Morning Track', 'CS101', 2),
(2, 'MATH201-Advanced', 'MATH201', 3);

-- 4. Populate 'student_class' Table
INSERT INTO `student_class` (`student_id`, `class_id`) VALUES
(4, 1), -- David in CS101
(5, 1), -- Emily in CS101
(5, 2), -- Emily in MATH201
(6, 2); -- Frank in MATH201

-- 5. Populate 'chapter' Table
INSERT INTO `chapter` (`chapter_id`, `chapter_name`, `chapter_description`, `subject_id`) VALUES
(101, 'Variables & Control Flow', 'Learning conditional blocks and variable assignments.', 'CS101'),
(102, 'Functions & Scopes', 'Understanding execution blocks and variable scopes.', 'CS101'),
(201, 'Limits and Continuity', 'Introduction to theoretical limits.', 'MATH201');

-- 6. Populate 'lo' (Learning Objectives) Table
INSERT INTO `lo` (`lo_id`, `lo_name`, `lo_description`) VALUES
(10, 'Understand Loops', 'Ability to implement and debug structured loops.'),
(20, 'Calculate Derivatives', 'Apply the power rule to standard polynomial equations.');

-- 7. Populate 'chapter_lo' Table
INSERT INTO `chapter_lo` (`chapter_id`, `lo_id`) VALUES
(101, 10),
(201, 20);

-- 8. Populate 'exam' Table
INSERT INTO `exam` (`exam_id`, `manage_by`, `title`, `examcode`, `max_attempt`, `description`, `duration_minutes`, `start_time`, `end_time`, `result_visibility`, `subject_id`) VALUES
(1, 'ADM001', 'CS101 Midterm', 'EXAM-CS-MID', 2, 'Covers chapters 1 and 2.', 60, '2026-07-10 09:00:00', '2026-07-10 17:00:00', 'full', 'CS101'),
(2, 'TCH002', 'Calculus Quiz 1', 'EXAM-MATH-Q1', 1, 'Quick check on limits.', 30, '2026-07-11 10:00:00', '2026-07-11 12:00:00', 'score-only', 'MATH201');

-- 9. Populate 'student_exam' Table
INSERT INTO `student_exam` (`student_id`, `exam_id`) VALUES
('STU001', 1),
('STU002', 1),
('STU002', 2),
('STU003', 2);

-- 10. Populate 'question' Table
INSERT INTO `question` (`question_id`, `question_text`, `question_difficulties`, `question_type`, `chapter_id`, `created_by`, `question_status`) VALUES
(501, 'What is the output of: for i in range(3): print(i)?', 'easy', 'MCQ', 101, 2, 'approved'),
(502, 'Explain the difference between global and local scope variables.', 'medium', 'essay', 102, 2, 'approved'),
(503, 'Find the derivative of f(x) = 3x^2 + 5.', 'medium', 'MCQ', 201, 3, 'approved');

-- 11. Populate 'lo_question' Table
INSERT INTO `lo_question` (`lo_id`, `question_id`) VALUES
(10, 501),
(20, 503);

-- 12. Populate 'exam_question' Table
INSERT INTO `exam_question` (`exam_id`, `question_id`, `question_point`) VALUES
(1, 501, 5),
(1, 502, 15),
(2, 503, 10);

-- 13. Populate 'options' Table (For MCQ type questions)
INSERT INTO `options` (`options_id`, `question_id`, `options_text`, `is_correct`) VALUES
(1, 501, '0 1 2', 1),
(2, 501, '1 2 3', 0),
(3, 501, '0 1 2 3', 0),
(4, 503, '6x', 1),
(5, 503, '3x', 0),
(6, 503, '6x + 5', 0);

-- 14. Populate 'attempt' Table (Simulating Student Exam sessions)
INSERT INTO `attempt` (`attempt_id`, `exam_id`, `student_id`, `attempt_no`, `score`, `start_time`, `end_time`, `submitted_at`) VALUES
(1, 1, 4, 1, 18.50, '2026-07-10 09:15:00', '2026-07-10 10:15:00', '2026-07-10 10:10:00'),
(2, 1, 5, 1, NULL, '2026-07-10 09:30:00', '2026-07-10 10:30:00', NULL), -- Ongoing attempt
(3, 2, 6, 1, 10.00, '2026-07-11 10:05:00', '2026-07-11 10:35:00', '2026-07-11 10:25:00');

-- 15. Populate 'attempt_question' Table
INSERT INTO `attempt_question` (`attempt_id`, `question_id`, `display_order`) VALUES
(1, 501, 1),
(1, 502, 2),
(2, 501, 2),
(2, 502, 1),
(3, 503, 1);

-- 16. Populate 'mcq_answers' Table (Student responses to MCQs)
INSERT INTO `mcq_answers` (`mcq_answer_id`, `attempt_id`, `question_id`, `selected_option_id`) VALUES
(1, 1, 501, 1), -- David answered correctly
(2, 3, 503, 4); -- Frank answered correctly

-- 17. Populate 'essay_answers' Table (Student responses to Essays)
INSERT INTO `essay_answers` (`essay_answer_id`, `attempt_id`, `question_id`, `answer_text`, `score`) VALUES
(1, 1, 502, 'Global variables can be accessed anywhere. Local variables are confined to functions.', 14);

-- 18. Populate 'exam_event' Table (Proctoring logs / tracking)
INSERT INTO `exam_event` (`event_id`, `attempt_id`, `event_type`, `event_timestamp`, `details`) VALUES
(1, 1, 'TAB_LOST_FOCUS', '2026-07-10 09:42:11', 'Student left the browser tab for 5 seconds.'),
(2, 1, 'EXAM_SUBMITTED', '2026-07-10 10:10:00', 'Submitted via normal workflow UI.');