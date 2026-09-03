"""Overlap rules for an exam's availability window.

The 24-hour gate is applied before any time comparison, and to both exams: an
exam open for longer than that is an availability period rather than a sitting,
so it neither raises nor receives a conflict.
"""

import unittest
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from src.a_db_config import Base, Exam, ExamStatus, StudentExam, Subject, User, UserRole
from src.service.exam_schedule_service import find_schedule_conflicts, overlap_checking_enabled, windows_overlap


class ExamScheduleOverlapTests(unittest.TestCase):
    def test_half_open_overlap_handles_equal_boundaries_and_containment(self):
        morning = datetime(2026, 8, 20, 8)
        ten_am = datetime(2026, 8, 20, 10)
        noon = datetime(2026, 8, 20, 12)
        nine_am = datetime(2026, 8, 20, 9)
        eleven_am = datetime(2026, 8, 20, 11)

        self.assertTrue(windows_overlap(morning, ten_am, morning, noon))
        self.assertTrue(windows_overlap(morning, noon, nine_am, eleven_am))
        self.assertTrue(windows_overlap(morning, noon, nine_am, noon))
        self.assertFalse(windows_overlap(morning, ten_am, ten_am, noon))

    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        for subject_id in ("SE303", "SE304"):
            self.db.add(Subject(subject_id=subject_id, subject_name=subject_id, subject_description="x"))
        for school_id in ("S1", "S2", "S9"):
            self.db.add(User(
                school_id=school_id, full_name=school_id, email=f"{school_id}@example.edu",
                password_hash="x", role=UserRole.student,
            ))
        self.db.flush()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _exam(self, title, start, end, subject_id, students):
        exam = Exam(title=title, subject_id=subject_id, start_time=start, end_time=end, status=ExamStatus.published)
        self.db.add(exam)
        self.db.flush()
        for school_id in students:
            self.db.add(StudentExam(student_id=school_id, exam_id=exam.exam_id))
        self.db.flush()
        return exam

    def _conflicts(self, exam):
        return find_schedule_conflicts(
            self.db, exam_id=exam.exam_id, start_time=exam.start_time, end_time=exam.end_time
        )

    def test_rejects_overlapping_windows_for_shared_students(self):
        first = self._exam("A", datetime(2026, 8, 20, 8), datetime(2026, 8, 20, 10), "SE303", ["S1", "S2"])
        second = self._exam("B", datetime(2026, 8, 20, 9), datetime(2026, 8, 20, 11), "SE303", ["S1", "S2"])

        conflicts = self._conflicts(second)

        self.assertEqual([conflict.exam_id for conflict in conflicts], [first.exam_id])
        self.assertEqual(conflicts[0].shared_participants, 2)
        # The rule reads the same from either exam.
        self.assertEqual([conflict.exam_id for conflict in self._conflicts(first)], [second.exam_id])

    def test_allows_windows_that_only_touch(self):
        self._exam("A", datetime(2026, 8, 20, 8), datetime(2026, 8, 20, 10), "SE303", ["S9"])
        later = self._exam("B", datetime(2026, 8, 20, 10), datetime(2026, 8, 20, 12), "SE303", ["S9"])

        self.assertEqual(self._conflicts(later), [])

    def test_allows_overlap_when_no_student_is_shared(self):
        self._exam("A", datetime(2026, 8, 20, 8), datetime(2026, 8, 20, 10), "SE303", ["S1"])
        other_class = self._exam("B", datetime(2026, 8, 20, 9), datetime(2026, 8, 20, 11), "SE304", ["S2"])

        self.assertEqual(self._conflicts(other_class), [])

    def test_ignores_an_exam_open_for_more_than_24_hours(self):
        self._exam("Long", datetime(2026, 9, 1, 8), datetime(2026, 9, 3, 8), "SE303", ["S1"])
        inside = self._exam("Short", datetime(2026, 9, 2, 9), datetime(2026, 9, 2, 11), "SE303", ["S1"])

        self.assertEqual(self._conflicts(inside), [])

    def test_an_exam_open_for_more_than_24_hours_raises_no_conflict(self):
        self._exam("Short", datetime(2026, 9, 2, 9), datetime(2026, 9, 2, 11), "SE303", ["S1"])
        long_open = self._exam("Long", datetime(2026, 9, 1, 8), datetime(2026, 9, 3, 8), "SE303", ["S1"])

        self.assertEqual(self._conflicts(long_open), [])

    def test_boundary_of_the_24_hour_rule(self):
        self.assertTrue(overlap_checking_enabled(datetime(2026, 10, 1, 8), datetime(2026, 10, 2, 8)))
        self.assertFalse(overlap_checking_enabled(datetime(2026, 10, 1, 8), datetime(2026, 10, 2, 8, 1)))

        exactly_24h = self._exam("Day", datetime(2026, 10, 1, 8), datetime(2026, 10, 2, 8), "SE303", ["S2"])
        inside = self._exam("Slot", datetime(2026, 10, 1, 9), datetime(2026, 10, 1, 11), "SE303", ["S2"])

        self.assertEqual([conflict.exam_id for conflict in self._conflicts(inside)], [exactly_24h.exam_id])

    def test_counts_only_the_shared_students(self):
        self._exam("A", datetime(2026, 12, 1, 8), datetime(2026, 12, 1, 10), "SE303", ["S1", "S2"])
        second = self._exam("B", datetime(2026, 12, 1, 9), datetime(2026, 12, 1, 11), "SE303", ["S2", "S9"])

        conflicts = self._conflicts(second)

        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0].shared_participants, 1)

    def test_skips_an_exam_without_a_complete_window(self):
        self._exam("A", datetime(2026, 8, 20, 8), datetime(2026, 8, 20, 10), "SE303", ["S1"])
        unscheduled = self._exam("Draft", None, None, "SE303", ["S1"])

        self.assertEqual(self._conflicts(unscheduled), [])

    def test_skips_an_exam_with_no_participants_yet(self):
        self._exam("A", datetime(2026, 8, 20, 8), datetime(2026, 8, 20, 10), "SE303", ["S1"])
        unassigned = self._exam("New", datetime(2026, 8, 20, 9), datetime(2026, 8, 20, 11), "SE303", [])

        self.assertEqual(self._conflicts(unassigned), [])


if __name__ == "__main__":
    unittest.main()
