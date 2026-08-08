"""Pure DOCX/PDF parser for the future Admin Question Bank import flow.

This module intentionally knows nothing about SQLAlchemy or the application
database.  It turns the agreed import document format into validated,
normalized data; a later import workflow can decide how to persist it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import re

from docx import Document
from pypdf import PdfReader


SUBJECT_ID_LIMIT = 20
SUBJECT_NAME_LIMIT = 100
SUBJECT_DESCRIPTION_LIMIT = 255
CHAPTER_NAME_LIMIT = 100
LO_NAME_LIMIT = 100
QUESTION_TEXT_LIMIT = 255
OPTION_TEXT_LIMIT = 255

_QUESTION_MARKER = re.compile(r"^QUESTION\s+(\d+)\s*$", re.IGNORECASE)
_CHAPTER_MARKER = re.compile(r"^CHAPTER\s*:\s*(.*)$", re.IGNORECASE)
_OPTION_MARKER = re.compile(r"^([A-F])\.\s*(.*)$", re.IGNORECASE)
_FIELD_MARKER = re.compile(
    r"^(Subject ID|Subject Name|Description|Type|Difficulty|Learning Objectives|Content|Answer)\s*:\s*(.*)$",
    re.IGNORECASE,
)
_IGNORED_LINES = {
    "question bank",
    "simple format for teacher -> administrator import",
    "simple format for teacher - administrator import",
    "end of question bank",
}


class QuestionBankParseError(ValueError):
    """A user-correctable document format error.

    ``question_number`` is ``None`` for top-level Subject metadata errors.
    ``str(error)`` is deliberately suitable for a future API validation error.
    """

    def __init__(self, field: str, reason: str, question_number: int | None = None):
        self.question_number = question_number
        self.field = field
        self.reason = reason
        prefix = f"Question {question_number}" if question_number is not None else "Subject"
        super().__init__(f"{prefix} - {field}: {reason}")


@dataclass(frozen=True)
class ParsedSubject:
    subject_id: str
    subject_name: str
    description: str


@dataclass(frozen=True)
class ParsedOption:
    label: str
    option_text: str
    is_correct: bool


@dataclass(frozen=True)
class ParsedQuestion:
    question_number: int
    chapter_name: str
    learning_objective_names: list[str]
    question_type: str
    difficulty: str
    question_text: str
    options: list[ParsedOption]


@dataclass(frozen=True)
class ParsedQuestionBank:
    subject: ParsedSubject
    questions: list[ParsedQuestion]


@dataclass
class _RawQuestion:
    number: int
    chapter_name: str | None
    fields: dict[str, str] = field(default_factory=dict)
    options: dict[str, str] = field(default_factory=dict)


def _normalize(value: str) -> str:
    return " ".join(value.split())


def _append(existing: str, continuation: str) -> str:
    return _normalize(f"{existing} {continuation}")


def _require_within_limit(value: str, limit: int, field_name: str, question_number: int | None = None) -> str:
    if not value:
        raise QuestionBankParseError(field_name, "is required", question_number)
    if len(value) > limit:
        raise QuestionBankParseError(field_name, f"must be at most {limit} characters", question_number)
    return value


def _normalized_type(value: str, question_number: int) -> str:
    compact = _normalize(value).casefold()
    mapping = {
        "multiple choice": "MCQ",
        "mcq": "MCQ",
        "true/false": "true-false",
        "true false": "true-false",
        "true-false": "true-false",
        "essay": "essay",
    }
    if compact not in mapping:
        raise QuestionBankParseError("Type", "must be Multiple Choice, True/False, or Essay", question_number)
    return mapping[compact]


def _normalized_difficulty(value: str, question_number: int) -> str:
    normalized = _normalize(value).casefold()
    if normalized not in {"easy", "medium", "hard"}:
        raise QuestionBankParseError("Difficulty", "must be Easy, Medium, or Hard", question_number)
    return normalized


def _learning_objectives(value: str, question_number: int) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for raw_name in value.split("|"):
        name = _normalize(raw_name)
        if not name:
            raise QuestionBankParseError("Learning Objectives", "contains an empty learning objective", question_number)
        _require_within_limit(name, LO_NAME_LIMIT, "Learning Objectives", question_number)
        # Exact duplicates are removed after whitespace normalization.  Different
        # spelling/case remains meaningful to the future taxonomy matching step.
        if name not in seen:
            seen.add(name)
            names.append(name)
    if not names:
        raise QuestionBankParseError("Learning Objectives", "is required", question_number)
    return names


def _answer_labels(value: str, question: _RawQuestion) -> set[str]:
    if not value:
        raise QuestionBankParseError("Answer", "is required for MCQ", question.number)
    labels = {_normalize(item).upper() for item in value.split(",") if _normalize(item)}
    if not labels:
        raise QuestionBankParseError("Answer", "is required for MCQ", question.number)
    invalid = sorted(labels - set(question.options))
    if invalid:
        raise QuestionBankParseError("Answer", f"references option(s) that do not exist: {', '.join(invalid)}", question.number)
    return labels


def _build_question(question: _RawQuestion) -> ParsedQuestion:
    number = question.number
    chapter_name = _normalize(question.chapter_name or "")
    _require_within_limit(chapter_name, CHAPTER_NAME_LIMIT, "Chapter", number)

    question_type = _normalized_type(question.fields.get("type", ""), number)
    difficulty = _normalized_difficulty(question.fields.get("difficulty", ""), number)
    learning_objective_names = _learning_objectives(question.fields.get("learning_objectives", ""), number)
    question_text = _require_within_limit(_normalize(question.fields.get("content", "")), QUESTION_TEXT_LIMIT, "Content", number)
    answer = _normalize(question.fields.get("answer", ""))

    if question_type == "MCQ":
        if len(question.options) < 2:
            raise QuestionBankParseError("Options", "MCQ requires at least 2 options", number)
        correct_labels = _answer_labels(answer, question)
        options = [
            ParsedOption(label, _require_within_limit(_normalize(text), OPTION_TEXT_LIMIT, f"Option {label}", number), label in correct_labels)
            for label, text in question.options.items()
        ]
    elif question_type == "true-false":
        if question.options:
            raise QuestionBankParseError("Options", "True/False must not include A-F options", number)
        correct_value = answer.casefold()
        if correct_value not in {"true", "false"}:
            raise QuestionBankParseError("Answer", "must be True or False for a True/False question", number)
        options = [
            ParsedOption("A", "True", correct_value == "true"),
            ParsedOption("B", "False", correct_value == "false"),
        ]
    else:
        if question.options:
            raise QuestionBankParseError("Options", "Essay questions do not accept options", number)
        if answer:
            raise QuestionBankParseError("Answer", "Essay questions do not accept an answer", number)
        options = []

    return ParsedQuestion(
        question_number=number,
        chapter_name=chapter_name,
        learning_objective_names=learning_objective_names,
        question_type=question_type,
        difficulty=difficulty,
        question_text=question_text,
        options=options,
    )


def parse_question_bank_text(text: str) -> ParsedQuestionBank:
    """Parse normalized import content without opening files or touching the DB."""

    if not _normalize(text):
        raise QuestionBankParseError("Document", "does not contain meaningful text")

    subject_fields: dict[str, str] = {}
    questions: list[ParsedQuestion] = []
    current_question: _RawQuestion | None = None
    current_chapter: str | None = None
    active_target: tuple[str, str] | None = None

    def finalize_question() -> None:
        nonlocal current_question, active_target
        if current_question is not None:
            questions.append(_build_question(current_question))
        current_question = None
        active_target = None

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        normalized_line = _normalize(line).casefold()
        if normalized_line in _IGNORED_LINES:
            continue

        question_match = _QUESTION_MARKER.match(line)
        if question_match:
            finalize_question()
            current_question = _RawQuestion(number=int(question_match.group(1)), chapter_name=current_chapter)
            continue

        chapter_match = _CHAPTER_MARKER.match(line)
        if chapter_match:
            finalize_question()
            current_chapter = _normalize(chapter_match.group(1))
            active_target = ("chapter", "")
            continue

        field_match = _FIELD_MARKER.match(line)
        if field_match:
            name = field_match.group(1).casefold()
            value = _normalize(field_match.group(2))
            subject_key = {"subject id": "subject_id", "subject name": "subject_name", "description": "description"}.get(name)
            question_key = {
                "type": "type",
                "difficulty": "difficulty",
                "learning objectives": "learning_objectives",
                "content": "content",
                "answer": "answer",
            }.get(name)
            if subject_key:
                if current_question is not None:
                    raise QuestionBankParseError(field_match.group(1), "must appear before the first Question")
                subject_fields[subject_key] = value
                active_target = ("subject", subject_key)
            elif question_key:
                if current_question is None:
                    raise QuestionBankParseError(field_match.group(1), "must appear inside a Question")
                current_question.fields[question_key] = value
                active_target = ("question", question_key)
            continue

        option_match = _OPTION_MARKER.match(line)
        if option_match:
            if current_question is None:
                raise QuestionBankParseError("Option", "must appear inside a Question")
            label = option_match.group(1).upper()
            if label in current_question.options:
                raise QuestionBankParseError(f"Option {label}", "is duplicated", current_question.number)
            current_question.options[label] = _normalize(option_match.group(2))
            active_target = ("option", label)
            continue

        if active_target is None:
            # Decorative prose outside a recognized section is intentionally ignored.
            continue
        target_kind, key = active_target
        if target_kind == "subject":
            subject_fields[key] = _append(subject_fields.get(key, ""), line)
        elif target_kind == "question" and current_question is not None:
            current_question.fields[key] = _append(current_question.fields.get(key, ""), line)
        elif target_kind == "option" and current_question is not None:
            current_question.options[key] = _append(current_question.options.get(key, ""), line)
        elif target_kind == "chapter":
            current_chapter = _append(current_chapter or "", line)

    finalize_question()

    subject = ParsedSubject(
        subject_id=_require_within_limit(_normalize(subject_fields.get("subject_id", "")), SUBJECT_ID_LIMIT, "Subject ID"),
        subject_name=_require_within_limit(_normalize(subject_fields.get("subject_name", "")), SUBJECT_NAME_LIMIT, "Subject Name"),
        description=_normalize(subject_fields.get("description", "")),
    )
    if len(subject.description) > SUBJECT_DESCRIPTION_LIMIT:
        raise QuestionBankParseError("Description", f"must be at most {SUBJECT_DESCRIPTION_LIMIT} characters")
    if not questions:
        raise QuestionBankParseError("Questions", "at least one Question is required")
    return ParsedQuestionBank(subject=subject, questions=questions)


def _extract_docx_text(path: Path) -> str:
    try:
        document = Document(path)
    except Exception as exc:  # python-docx has several format-specific exception types.
        raise QuestionBankParseError("Document", "is not a valid DOCX file") from exc
    return "\n".join(paragraph.text for paragraph in document.paragraphs)


def _extract_pdf_text(path: Path) -> str:
    try:
        reader = PdfReader(path)
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:
        raise QuestionBankParseError("Document", "is not a readable text-based PDF") from exc
    if len(re.sub(r"\s+", "", text)) < 10:
        raise QuestionBankParseError("Document", "PDF has no meaningful extractable text; scanned/image-only PDFs are not supported")
    return text


def parse_question_bank_document(path: str | Path) -> ParsedQuestionBank:
    """Read a supported document and return parsed data without any DB writes."""

    document_path = Path(path)
    if not document_path.is_file():
        raise QuestionBankParseError("Document", "file was not found")
    suffix = document_path.suffix.casefold()
    if suffix == ".docx":
        return parse_question_bank_text(_extract_docx_text(document_path))
    if suffix == ".pdf":
        return parse_question_bank_text(_extract_pdf_text(document_path))
    raise QuestionBankParseError("Document", "only .docx and text-based .pdf files are supported")
