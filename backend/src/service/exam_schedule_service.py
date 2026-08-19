"""Scheduling-conflict rules for an exam's availability window.

Two exams clash only when both are open for a short enough window that a student
could not sit them separately, and the same students are assigned to both. A long
window is a take-home style availability period, not a sitting, so it never
conflicts with anything - see ``overlap_checking_enabled``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.a_db_config import Exam, StudentExam


# Above this, an exam is an availability period rather than a scheduled sitting.
MAX_SCHEDULED_WINDOW = timedelta(hours=24)


@dataclass(frozen=True)
class ScheduleConflict:
    exam_id: int
    title: str
    start_time: datetime
    end_time: datetime
    shared_participants: int


def open_duration(start_time: datetime | None, end_time: datetime | None) -> timedelta | None:
    """end - start, or None when the exam has no complete window yet."""
    if start_time is None or end_time is None:
        return None
    return end_time - start_time


def overlap_checking_enabled(start_time: datetime | None, end_time: datetime | None) -> bool:
    """Whether this exam can conflict at all. Applied before any time comparison."""
    duration = open_duration(start_time, end_time)
    return duration is not None and duration <= MAX_SCHEDULED_WINDOW


def windows_overlap(
    start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime
) -> bool:
    """Half-open comparison, so exams that merely touch end-to-start do not clash."""
    return start_a < end_b and end_a > start_b


def find_schedule_conflicts(
    db: Session,
    *,
    exam_id: int,
    start_time: datetime | None,
    end_time: datetime | None,
) -> list[ScheduleConflict]:
    """Exams that would be open at the same time for students assigned to this one."""
    if not overlap_checking_enabled(start_time, end_time):
        return []

    participants = {
        row[0]
        for row in db.query(StudentExam.student_id).filter(StudentExam.exam_id == exam_id).all()
    }
    if not participants:
        # Nobody can be double-booked yet; assignment is what introduces the clash.
        return []

    rows = (
        db.query(Exam, func.count(func.distinct(StudentExam.student_id)))
        .join(StudentExam, StudentExam.exam_id == Exam.exam_id)
        .filter(
            Exam.exam_id != exam_id,
            Exam.start_time.isnot(None),
            Exam.end_time.isnot(None),
            Exam.start_time < end_time,
            Exam.end_time > start_time,
            StudentExam.student_id.in_(participants),
        )
        .group_by(Exam.exam_id)
        .all()
    )

    # The 24-hour rule applies to the other exam too: a long-open exam is never a
    # conflict source, however much its window overlaps.
    return [
        ScheduleConflict(
            exam_id=exam.exam_id,
            title=exam.title,
            start_time=exam.start_time,
            end_time=exam.end_time,
            shared_participants=int(shared or 0),
        )
        for exam, shared in rows
        if overlap_checking_enabled(exam.start_time, exam.end_time)
    ]


def describe_conflicts(conflicts: list[ScheduleConflict]) -> str:
    """One flat string: the API error contract only forwards string details."""
    listed = "; ".join(
        f"\"{conflict.title}\" ({conflict.start_time:%d %b %Y %H:%M} - "
        f"{conflict.end_time:%d %b %Y %H:%M}, {conflict.shared_participants} shared student"
        f"{'' if conflict.shared_participants == 1 else 's'})"
        for conflict in conflicts
    )
    return (
        "Scheduling conflict: this exam would be open at the same time as "
        f"{listed}. The same students are assigned to both, so their availability "
        "cannot overlap. Change the start or end time, or assign different students."
    )
