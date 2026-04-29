-- =========================
-- INSERT DATA FOR DSA (Data Structures and Algorithms)
-- =========================

-- SUBJECT
INSERT INTO subject (subject_id, subject_name, subject_description)
VALUES
('DSA101', 'Data Structures and Algorithms', 'Fundamental concepts of data structures and algorithms');

-- LEARNING OUTCOMES
INSERT INTO lo (lo_id, lo_name, lo_description)
VALUES
(1, 'Arrays and Linked Lists', 'Understand and apply arrays and linked lists'),
(2, 'Stacks and Queues', 'Understand stack and queue operations'),
(3, 'Trees and Graphs', 'Understand trees, binary trees, and graph traversal'),
(4, 'Sorting Algorithms', 'Apply sorting algorithms like Bubble Sort, Merge Sort'),
(5, 'Searching Algorithms', 'Apply searching algorithms like Linear Search and Binary Search');

-- CHAPTERS
INSERT INTO chapter (chapter_id, chapter_name, chapter_description, subject_id)
VALUES
(1, 'Introduction to Arrays and Linked Lists', 'Basic linear data structures', 'DSA101'),
(2, 'Stacks and Queues', 'LIFO and FIFO data structures', 'DSA101'),
(3, 'Trees and Graphs', 'Hierarchical and network structures', 'DSA101'),
(4, 'Sorting Techniques', 'Common sorting algorithms', 'DSA101'),
(5, 'Searching Techniques', 'Common searching algorithms', 'DSA101');

-- CHAPTER_LO RELATION
INSERT INTO chapter_lo (chapter_id, lo_id)
VALUES
(1, 1),
(2, 2),
(3, 3),
(4, 4),
(5, 5);

-- =========================
-- 10 DSA QUESTIONS
-- created_by = T001
-- =========================

INSERT INTO question (
    question_id,
    question_text,
    question_difficulties,
    question_type,
    created_by,
    question_status
)
VALUES
(1, 'What is the time complexity of accessing an element in an array by index?', 'easy', 'MCQ', NULL, 'approved'),

(2, 'Which data structure follows the LIFO principle?', 'easy', 'MCQ', NULL, 'approved'),

(3, 'Which traversal method visits Root -> Left -> Right?', 'medium', 'MCQ', NULL, 'approved'),

(4, 'Which sorting algorithm repeatedly swaps adjacent elements if they are in wrong order?', 'easy', 'MCQ', NULL, 'approved'),

(5, 'What is the best-case time complexity of Binary Search?', 'medium', 'MCQ', NULL, 'approved'),

(6, 'Explain the difference between Stack and Queue.', 'medium', 'essay', NULL, 'approved'),

(7, 'Which data structure is used in Breadth First Search (BFS)?', 'medium', 'MCQ', NULL, 'approved'),

(8, 'Which sorting algorithm uses divide and conquer strategy?', 'medium', 'MCQ', NULL, 'approved'),

(9, 'What is the worst-case time complexity of Quick Sort?', 'hard', 'MCQ', NULL, 'approved'),

(10, 'Explain the concept of recursion with an example.', 'medium', 'essay', NULL, 'approved');
-- =========================
-- OPTIONS FOR MCQ
-- =========================

-- Q1
INSERT INTO options (question_id, options_text, is_correct)
VALUES
(1, 'O(1)', TRUE),
(1, 'O(n)', FALSE),
(1, 'O(log n)', FALSE),
(1, 'O(n log n)', FALSE);

-- Q2
INSERT INTO options (question_id, options_text, is_correct)
VALUES
(2, 'Queue', FALSE),
(2, 'Stack', TRUE),
(2, 'Tree', FALSE),
(2, 'Graph', FALSE);

-- Q3
INSERT INTO options (question_id, options_text, is_correct)
VALUES
(3, 'Inorder', FALSE),
(3, 'Postorder', FALSE),
(3, 'Preorder', TRUE),
(3, 'Level Order', FALSE);

-- Q4
INSERT INTO options (question_id, options_text, is_correct)
VALUES
(4, 'Merge Sort', FALSE),
(4, 'Quick Sort', FALSE),
(4, 'Bubble Sort', TRUE),
(4, 'Binary Search', FALSE);

-- Q5
INSERT INTO options (question_id, options_text, is_correct)
VALUES
(5, 'O(n)', FALSE),
(5, 'O(log n)', TRUE),
(5, 'O(n log n)', FALSE),
(5, 'O(1)', FALSE);

-- Q7
INSERT INTO options (question_id, options_text, is_correct)
VALUES
(7, 'Stack', FALSE),
(7, 'Queue', TRUE),
(7, 'Array', FALSE),
(7, 'Heap', FALSE);

-- Q8
INSERT INTO options (question_id, options_text, is_correct)
VALUES
(8, 'Bubble Sort', FALSE),
(8, 'Insertion Sort', FALSE),
(8, 'Merge Sort', TRUE),
(8, 'Selection Sort', FALSE);

-- Q9
INSERT INTO options (question_id, options_text, is_correct)
VALUES
(9, 'O(log n)', FALSE),
(9, 'O(n)', FALSE),
(9, 'O(n log n)', FALSE),
(9, 'O(n²)', TRUE);


-- =========================
-- LO QUESTION RELATION
-- =========================

INSERT INTO lo_question (lo_id, question_id)
VALUES
(1, 1),
(2, 2),
(3, 3),
(4, 4),
(5, 5),
(2, 6),
(3, 7),
(4, 8),
(4, 9),
(3, 10);

