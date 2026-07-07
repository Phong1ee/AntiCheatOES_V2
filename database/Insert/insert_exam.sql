INSERT INTO exam (
    manage_by,
    title,
    examcode,
    max_attempt,
    description,
    duration_minutes,
    start_time,
    end_time,
    result_visibility
)
VALUES (
    NULL,
    'DSA Midterm Exam',
    'DSA-MID-001',
    3,
    'Midterm examination for Data Structures and Algorithms',
    90,
    '2026-05-10 09:00:00',
    '2026-05-10 10:30:00',
    'full'
);

INSERT INTO exam_question (
    exam_id,
    question_id,
    question_point
)
VALUES
(1, 1, 10),
(1, 2, 10),
(1, 3, 10),
(1, 4, 10),
(1, 5, 10),
(1, 6, 10),
(1, 7, 10),
(1, 8, 10),
(1, 9, 10),
(1, 10, 10);


INSERT INTO student_exam (student_id, exam_id) VALUES ('S000001', '1');

