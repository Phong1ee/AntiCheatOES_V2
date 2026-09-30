from decimal import Decimal
from types import SimpleNamespace

from src.route.teacherRoute.resultsRoute import _essay_response_counts, _objective_response_counts, _score_distribution


def _objective_link(attempt_id: int):
    return SimpleNamespace(
        attempt_id=attempt_id,
        question_id=7,
        options_snapshot=[
            {"id": 1, "text": "Correct", "isCorrect": True},
            {"id": 2, "text": "Incorrect", "isCorrect": False},
        ],
    )


def _essay_link(attempt_id: int):
    return SimpleNamespace(
        attempt_id=attempt_id,
        question_id=8,
        question_point_snapshot=Decimal("5"),
        question_point=Decimal("5"),
    )


def test_objective_statistics_keep_incorrect_and_blank_answers_separate():
    links = [_objective_link(1), _objective_link(2), _objective_link(3)]
    answers = {
        (1, 7): SimpleNamespace(selected_option_id=1),
        (2, 7): SimpleNamespace(selected_option_id=2),
    }

    result = _objective_response_counts(links, answers)

    assert result["correctCount"] == 1
    assert result["incorrectCount"] == 1
    assert result["unansweredCount"] == 1
    assert [selection["id"] for selection in result["selections"]] == [1, 2]


def test_essay_statistics_keep_blank_pending_and_graded_answers_separate():
    links = [_essay_link(1), _essay_link(2), _essay_link(3)]
    answers = {
        (1, 8): SimpleNamespace(answer_text="A graded response", score=Decimal("4")),
        (2, 8): SimpleNamespace(answer_text="Awaiting grading", score=None),
        (3, 8): SimpleNamespace(answer_text="   ", score=Decimal("0")),
    }

    result = _essay_response_counts(links, answers)

    assert result == {
        "answeredCount": 2,
        "unansweredCount": 1,
        "gradedCount": 1,
        "pendingGradingCount": 1,
        "averageScoreRate": 80.0,
    }


def test_score_distribution_uses_contiguous_ten_point_bands_without_double_counting():
    distribution = _score_distribution([0, 10, 10.01, 20, 100])

    assert [bucket["label"] for bucket in distribution] == [
        "0-10", "11-20", "21-30", "31-40", "41-50",
        "51-60", "61-70", "71-80", "81-90", "91-100",
    ]
    assert [bucket["count"] for bucket in distribution] == [2, 2, 0, 0, 0, 0, 0, 0, 0, 1]
