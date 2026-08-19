"""Decides what an imported question means against the existing Question Bank.

A teacher preparing an exam offline will re-type questions that already exist.
Creating a fresh copy each time silently grows duplicates in the bank, so an
imported question is matched by text first:

* every attribute equal  -> it *is* that bank question; attach it, create nothing
* only the text equal    -> it is an edit of that question; propose the change
* no text match          -> genuinely new; create it as a draft and attach it

"Every attribute" means the ones the document carries about the question itself:
type, difficulty and the option set. Chapter and Learning Objective place a
question in the taxonomy rather than define it, and are resolved separately.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Literal

from src.a_db_config import Question
from src.service.question_bank_import_parser import ParsedQuestion


MatchKind = Literal["reuse", "edit", "create"]


def normalize_text(value: str) -> str:
    """Same rule the Admin import uses, so both agree on what "the same" means."""
    return " ".join(value.split()).casefold()


def _value(item) -> str | None:
    return item.value if hasattr(item, "value") else (str(item) if item is not None else None)


def option_signature(options: Iterable[tuple[str, bool]]) -> frozenset[tuple[str, bool]]:
    """Order-independent: reordering A-D is not a different question."""
    return frozenset((normalize_text(text), bool(is_correct)) for text, is_correct in options)


def parsed_signature(question: ParsedQuestion) -> tuple:
    return (
        _value(question.question_type),
        _value(question.difficulty),
        option_signature((option.option_text, option.is_correct) for option in question.options),
    )


def existing_signature(question: Question) -> tuple:
    return (
        _value(question.question_type),
        _value(question.question_difficulties),
        option_signature((option.options_text, option.is_correct) for option in question.options),
    )


@dataclass(frozen=True)
class ImportMatch:
    kind: MatchKind
    question: Question | None = None

    @property
    def question_id(self) -> int | None:
        return self.question.question_id if self.question is not None else None


def match_imported_question(
    parsed: ParsedQuestion,
    candidates_by_text: dict[str, list[Question]],
) -> ImportMatch:
    """Resolve one imported question against the bank questions of the subject."""
    matches = candidates_by_text.get(normalize_text(parsed.question_text), [])
    if not matches:
        return ImportMatch("create")

    wanted = parsed_signature(parsed)
    for candidate in matches:
        if existing_signature(candidate) == wanted:
            return ImportMatch("reuse", candidate)

    # Same wording, different content: an edit of the first match rather than a
    # near-duplicate sitting beside it in the bank.
    return ImportMatch("edit", matches[0])


def index_by_text(questions: Iterable[Question]) -> dict[str, list[Question]]:
    index: dict[str, list[Question]] = {}
    for question in questions:
        index.setdefault(normalize_text(question.question_text), []).append(question)
    return index


# ---- Applying an import ---------------------------------------------------

from decimal import Decimal  # noqa: E402

from sqlalchemy import func  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from src.a_db_config import (  # noqa: E402
    Chapter,
    ChapterLO,
    ChapterQuestion,
    Exam,
    ExamQuestion,
    LO,
    LOQuestion,
    Option,
    QuestionRevision,
    User,
)


DEFAULT_QUESTION_POINT = Decimal("1.00")


class ImportTaxonomyError(ValueError):
    """A name the import cannot resolve to exactly one Chapter or Objective."""


def candidate_questions(db: Session, subject_id: str, teacher_school_id: str) -> list[Question]:
    """Bank questions this teacher can match against, within the exam's subject.

    Approved questions are the shared bank. The teacher's own questions are
    included too, so re-importing a corrected file edits the draft it already
    created instead of stacking copies beside it.
    """
    return (
        db.query(Question)
        .filter(
            Question.subject_id == subject_id,
            (Question.question_status == "approved") | (Question.created_by == teacher_school_id),
        )
        .all()
    )


def _resolve_chapter(db: Session, subject_id: str, chapter_name: str, cache: dict) -> Chapter:
    key = normalize_text(chapter_name)
    if key in cache:
        return cache[key]
    matches = [
        item
        for item in db.query(Chapter).filter(Chapter.subject_id == subject_id).all()
        if normalize_text(item.chapter_name) == key
    ]
    if len(matches) > 1:
        raise ImportTaxonomyError(f"Chapter {chapter_name!r} is ambiguous in this subject")
    if matches:
        chapter = matches[0]
    else:
        chapter = Chapter(chapter_name=chapter_name, chapter_description=chapter_name, subject_id=subject_id)
        db.add(chapter)
        db.flush()
    cache[key] = chapter
    return chapter


def _resolve_los(db: Session, chapter: Chapter, lo_names: list[str], cache: dict) -> list[LO]:
    resolved: list[LO] = []
    for lo_name in lo_names:
        key = (chapter.chapter_id, normalize_text(lo_name))
        if key in cache:
            resolved.append(cache[key])
            continue
        matches = [
            item
            for item in (
                db.query(LO)
                .join(ChapterLO, ChapterLO.lo_id == LO.lo_id)
                .filter(ChapterLO.chapter_id == chapter.chapter_id)
                .all()
            )
            if normalize_text(item.lo_name) == key[1]
        ]
        if len(matches) > 1:
            raise ImportTaxonomyError(
                f"Learning Objective {lo_name!r} is ambiguous for chapter {chapter.chapter_name!r}"
            )
        if matches:
            lo = matches[0]
        else:
            lo = LO(lo_name=lo_name, lo_description=lo_name)
            db.add(lo)
            db.flush()
            db.add(ChapterLO(chapter_id=chapter.chapter_id, lo_id=lo.lo_id))
        cache[key] = lo
        resolved.append(lo)
    return resolved


def _revision_values(parsed: ParsedQuestion, subject_id: str, chapter: Chapter, los: list[LO]) -> dict:
    return {
        "question_text": parsed.question_text.strip(),
        "question_type": _value(parsed.question_type),
        "question_difficulties": _value(parsed.difficulty),
        "subject_id": subject_id,
        "options_snapshot": [
            {"options_id": None, "options_text": option.option_text.strip(), "is_correct": option.is_correct}
            for option in parsed.options
        ],
        "chapter_ids_snapshot": [chapter.chapter_id],
        "lo_ids_snapshot": [lo.lo_id for lo in los],
    }


def _propose_edit(db: Session, question: Question, teacher: User, values: dict) -> None:
    """An approved question changes only through a proposal an Admin reviews."""
    pending = (
        db.query(QuestionRevision)
        .filter(
            QuestionRevision.question_id == question.question_id,
            QuestionRevision.edited_by == teacher.school_id,
            QuestionRevision.question_status == "pending",
        )
        .first()
    )
    if pending:
        for key, value in values.items():
            setattr(pending, key, value)
        return
    next_version = (
        db.query(func.max(QuestionRevision.version_number))
        .filter(QuestionRevision.question_id == question.question_id)
        .scalar()
        or 0
    ) + 1
    db.add(
        QuestionRevision(
            question_id=question.question_id,
            version_number=next_version,
            question_status="pending",
            edited_by=teacher.school_id,
            approved_by=None,
            approved_at=None,
            rejection_reason=None,
            **values,
        )
    )


def _apply_direct_edit(
    db: Session, question: Question, parsed: ParsedQuestion, chapter: Chapter, los: list[LO]
) -> None:
    """The teacher's own unapproved question is edited in place, as the editor does."""
    question.question_text = parsed.question_text.strip()
    question.question_type = _value(parsed.question_type)
    question.question_difficulties = _value(parsed.difficulty)
    db.query(ChapterQuestion).filter(ChapterQuestion.question_id == question.question_id).delete(
        synchronize_session=False
    )
    db.query(LOQuestion).filter(LOQuestion.question_id == question.question_id).delete(synchronize_session=False)
    db.query(Option).filter(Option.question_id == question.question_id).delete(synchronize_session=False)
    db.add(ChapterQuestion(chapter_id=chapter.chapter_id, question_id=question.question_id))
    db.add_all(LOQuestion(lo_id=lo.lo_id, question_id=question.question_id) for lo in los)
    db.add_all(
        Option(question_id=question.question_id, options_text=option.option_text.strip(), is_correct=option.is_correct)
        for option in parsed.options
    )


def apply_document_import(db: Session, exam: Exam, teacher: User, questions: list[ParsedQuestion]) -> dict:
    """Attach every parsed question to the exam, reusing or editing bank questions."""
    index = index_by_text(candidate_questions(db, exam.subject_id, teacher.school_id))
    linked = {
        row[0] for row in db.query(ExamQuestion.question_id).filter(ExamQuestion.exam_id == exam.exam_id).all()
    }
    chapter_cache: dict = {}
    lo_cache: dict = {}
    summary = {
        "reused": 0, "proposed_edit": 0, "updated_own": 0,
        "created": 0, "already_in_exam": 0, "attached": 0,
    }
    # Every question the file placed in the exam, whether newly linked or
    # already there. The caller needs these to undo a staged removal the import
    # has just contradicted.
    question_ids: list[int] = []

    for parsed in questions:
        chapter = _resolve_chapter(db, exam.subject_id, parsed.chapter_name, chapter_cache)
        los = _resolve_los(db, chapter, parsed.learning_objective_names, lo_cache)
        match = match_imported_question(parsed, index)

        if match.kind == "create":
            question = Question(
                question_text=parsed.question_text.strip(),
                question_difficulties=_value(parsed.difficulty),
                question_type=_value(parsed.question_type),
                subject_id=exam.subject_id,
                created_by=teacher.school_id,
                question_status="draft",
            )
            db.add(question)
            db.flush()
            db.add(ChapterQuestion(chapter_id=chapter.chapter_id, question_id=question.question_id))
            db.add_all(LOQuestion(lo_id=lo.lo_id, question_id=question.question_id) for lo in los)
            db.add_all(
                Option(
                    question_id=question.question_id,
                    options_text=option.option_text.strip(),
                    is_correct=option.is_correct,
                )
                for option in parsed.options
            )
            # A later question in the same file must see this one.
            index.setdefault(normalize_text(question.question_text), []).append(question)
            summary["created"] += 1
        else:
            question = match.question
            if match.kind == "edit":
                if _value(question.question_status) == "approved":
                    _propose_edit(db, question, teacher, _revision_values(parsed, exam.subject_id, chapter, los))
                    summary["proposed_edit"] += 1
                else:
                    _apply_direct_edit(db, question, parsed, chapter, los)
                    summary["updated_own"] += 1
            else:
                summary["reused"] += 1

        question_ids.append(question.question_id)

        # The exam always carries the live question: a proposed edit only takes
        # effect there once an Admin approves it.
        if question.question_id in linked:
            summary["already_in_exam"] += 1
            continue
        db.add(
            ExamQuestion(
                exam_id=exam.exam_id,
                question_id=question.question_id,
                question_point=DEFAULT_QUESTION_POINT,
            )
        )
        linked.add(question.question_id)
        summary["attached"] += 1

    return {**summary, "question_ids": question_ids}
