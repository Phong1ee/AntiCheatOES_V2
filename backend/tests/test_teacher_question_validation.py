import unittest

from fastapi import HTTPException

from src.models.teacher.requestModel.QuestionAddToDBRequest import QuestionAddToDBRequest
from src.models.teacher.requestModel.QuestionOptionsRequest import QuestionOptionsRequest
from src.models.teacher.requestModel.TeacherExamRequest import TeacherExamRequest
from src.route.teacherRoute.addQuestionsRoute import _validate_options


def option(text: str, correct: bool = False) -> QuestionOptionsRequest:
    return QuestionOptionsRequest(options_text=text, is_correct=correct)


class TeacherQuestionValidationTests(unittest.TestCase):
    def test_mcq_accepts_two_options(self):
        _validate_options("MCQ", [option("A", True), option("B")])

    def test_mcq_accepts_three_options(self):
        _validate_options("MCQ", [option("A"), option("B", True), option("C")])

    def test_mcq_rejects_fewer_than_two_options(self):
        with self.assertRaises(HTTPException) as raised:
            _validate_options("MCQ", [option("A", True)])
        self.assertEqual(raised.exception.status_code, 400)

    def test_true_false_preserves_external_type_and_requires_one_correct(self):
        request = QuestionAddToDBRequest(
            question_text="The sky is blue.",
            question_difficulties="easy",
            question_type="true-false",
            subject_id="SCI",
            options=[option("True", True), option("False")],
        )
        _validate_options(request.question_type, request.options)
        self.assertEqual(request.question_type, "true-false")

    def test_true_false_rejects_invalid_option_shape(self):
        with self.assertRaises(HTTPException):
            _validate_options("true-false", [option("Yes", True), option("No")])

    def test_question_accepts_no_chapter_and_no_lo(self):
        request = QuestionAddToDBRequest(
            question_text="Explain normalization.",
            question_difficulties="medium",
            question_type="essay",
            subject_id="DB",
        )
        self.assertEqual(request.chapter_ids, [])
        self.assertEqual(request.lo_ids, [])

    def test_legacy_chapter_id_is_normalized(self):
        request = QuestionAddToDBRequest(
            question_text="Pick one.",
            question_difficulties="easy",
            question_type="MCQ",
            subject_id="DB",
            chapter_id=7,
            options=[option("A", True), option("B")],
        )
        self.assertEqual(request.chapter_ids, [7])

    def test_exam_request_accepts_legacy_max_attempt_typo(self):
        request = TeacherExamRequest(
            title="Midterm",
            examcode="MID-1",
            max_attemmpt=2,
            description="Test",
            duration_minutes=60,
            result_visibility="full",
            subject_id="DB",
        )
        self.assertEqual(request.max_attempt, 2)


if __name__ == "__main__":
    unittest.main()
