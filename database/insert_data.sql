USE online_exam_db;

-- Tạo 1 exam
INSERT INTO exams (title, description, duration_minutes, is_public)
VALUES (
  'Intro to Databases - Quiz',
  'Basic multiple-choice quiz about database concepts',
  20,
  1
);

-- thêm examcode
UPDATE exams
SET exam_code = 'DB2025A'
WHERE id = 1;
-- thêm subject
UPDATE exams
SET subject = 'Database Systems'
WHERE id = 1;


SET @exam_id := LAST_INSERT_ID();

---------------------------------------------------
-- Q1
INSERT INTO questions (exam_id, question_text, question_type, points)
VALUES (
  @exam_id,
  'What does SQL stand for?',
  'multiple-choice',
  1
);
SET @q1 := LAST_INSERT_ID();

INSERT INTO options (question_id, option_text, is_correct) VALUES
(@q1, 'Structured Query Language', 1),
(@q1, 'Simple Query Language', 0),
(@q1, 'Sequential Question Language', 0),
(@q1, 'System Query Logic', 0);

---------------------------------------------------
-- Q2
INSERT INTO questions (exam_id, question_text, question_type, points)
VALUES (
  @exam_id,
  'Which of the following is a relational database management system (RDBMS)?',
  'multiple-choice',
  1
);
SET @q2 := LAST_INSERT_ID();

INSERT INTO options (question_id, option_text, is_correct) VALUES
(@q2, 'MySQL', 1),
(@q2, 'HTML', 0),
(@q2, 'CSS', 0),
(@q2, 'JavaScript', 0);

---------------------------------------------------
-- Q3
INSERT INTO questions (exam_id, question_text, question_type, points)
VALUES (
  @exam_id,
  'Which SQL command is used to retrieve data from a table?',
  'multiple-choice',
  1
);
SET @q3 := LAST_INSERT_ID();

INSERT INTO options (question_id, option_text, is_correct) VALUES
(@q3, 'SELECT', 1),
(@q3, 'INSERT', 0),
(@q3, 'UPDATE', 0),
(@q3, 'DELETE', 0);

---------------------------------------------------
-- Q4
INSERT INTO questions (exam_id, question_text, question_type, points)
VALUES (
  @exam_id,
  'Which keyword is used to remove duplicate rows in a SELECT result?',
  'multiple-choice',
  1
);
SET @q4 := LAST_INSERT_ID();

INSERT INTO options (question_id, option_text, is_correct) VALUES
(@q4, 'DISTINCT', 1),
(@q4, 'UNIQUE', 0),
(@q4, 'GROUP BY', 0),
(@q4, 'ORDER BY', 0);

---------------------------------------------------
-- Q5
INSERT INTO questions (exam_id, question_text, question_type, points)
VALUES (
  @exam_id,
  'What is a primary key?',
  'multiple-choice',
  1
);
SET @q5 := LAST_INSERT_ID();

INSERT INTO options (question_id, option_text, is_correct) VALUES
(@q5, 'A column that uniquely identifies each row in a table', 1),
(@q5, 'A column that can contain NULL values', 0),
(@q5, 'A column that stores duplicate values only', 0),
(@q5, 'A column used only for sorting', 0);

---------------------------------------------------
-- Q6
INSERT INTO questions (exam_id, question_text, question_type, points)
VALUES (
  @exam_id,
  'Which SQL clause is used to filter records?',
  'multiple-choice',
  1
);
SET @q6 := LAST_INSERT_ID();

INSERT INTO options (question_id, option_text, is_correct) VALUES
(@q6, 'WHERE', 1),
(@q6, 'FROM', 0),
(@q6, 'JOIN', 0),
(@q6, 'ORDER BY', 0);

---------------------------------------------------
-- Q7
INSERT INTO questions (exam_id, question_text, question_type, points)
VALUES (
  @exam_id,
  'Which command is used to add a new row into a table?',
  'multiple-choice',
  1
);
SET @q7 := LAST_INSERT_ID();

INSERT INTO options (question_id, option_text, is_correct) VALUES
(@q7, 'INSERT INTO', 1),
(@q7, 'ADD ROW', 0),
(@q7, 'NEW', 0),
(@q7, 'CREATE ROW', 0);

---------------------------------------------------
-- Q8
INSERT INTO questions (exam_id, question_text, question_type, points)
VALUES (
  @exam_id,
  'Which join returns only the rows that have matching values in both tables?',
  'multiple-choice',
  1
);
SET @q8 := LAST_INSERT_ID();

INSERT INTO options (question_id, option_text, is_correct) VALUES
(@q8, 'INNER JOIN', 1),
(@q8, 'LEFT JOIN', 0),
(@q8, 'RIGHT JOIN', 0),
(@q8, 'FULL OUTER JOIN', 0);

---------------------------------------------------
-- Q9
INSERT INTO questions (exam_id, question_text, question_type, points)
VALUES (
  @exam_id,
  'Which SQL statement is used to change existing data in a table?',
  'multiple-choice',
  1
);
SET @q9 := LAST_INSERT_ID();

INSERT INTO options (question_id, option_text, is_correct) VALUES
(@q9, 'UPDATE', 1),
(@q9, 'ALTER', 0),
(@q9, 'MODIFY', 0),
(@q9, 'REPLACE', 0);

---------------------------------------------------
-- Q10
INSERT INTO questions (exam_id, question_text, question_type, points)
VALUES (
  @exam_id,
  'Which SQL aggregate function returns the number of rows?',
  'multiple-choice',
  1
);
SET @q10 := LAST_INSERT_ID();

INSERT INTO options (question_id, option_text, is_correct) VALUES
(@q10, 'COUNT()', 1),
(@q10, 'SUM()', 0),
(@q10, 'AVG()', 0),
(@q10, 'MAX()', 0);

INSERT INTO students (user_id, student_code, phone, date_of_birth)
VALUES(1, 'STU0001', '0123456789', '2003-05-10');
