import ast
import inspect
from pathlib import Path

import pytest
from docx import Document

from src.service import question_bank_import_parser as parser
from src.service.question_bank_import_parser import QuestionBankParseError, parse_question_bank_document, parse_question_bank_text


VALID_DOCUMENT = """QUESTION BANK
Simple format for Teacher -> Administrator import

SUBJECT
Subject ID: DS310
Subject Name: Fundamentals of Data Science
Description: A foundation
 for data science.

CHAPTER: Introduction to Data Science

QUESTION 1
Type: Multiple Choice
Difficulty: Easy
Learning Objectives: Understand the role of Data Science | Identify the Data Science workflow | Understand the role of Data Science
Content: Which description best
 defines Data Science?

A. Using data to derive useful insights
B. Only storing files
C. Avoiding analysis
D. Removing all data
Answer: A, C

QUESTION 2
Type: True/False
Difficulty: Medium
Learning Objectives: Identify the Data Science workflow
Content: Data cleaning is commonly part of a Data Science workflow.
Answer: True

CHAPTER: Data Visualization
QUESTION 3
Type: Essay
Difficulty: Hard
Learning Objectives: Explain visualization choices
Content: Explain why a chart choice matters.

End of Question Bank
"""


def _write_docx(path: Path, content: str) -> None:
    document = Document()
    for line in content.splitlines():
        document.add_paragraph(line)
    document.save(path)


def _write_text_pdf(path: Path, content: str) -> None:
    # A tiny valid PDF with a text content stream. It avoids adding a PDF writer
    # dependency just for this focused parser test.
    escaped_lines = [line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for line in content.splitlines()]
    stream = "BT /F1 9 Tf 72 760 Td " + " ".join(f"({line}) Tj 0 -12 Td" for line in escaped_lines) + " ET"
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        f"<< /Length {len(stream.encode('latin-1'))} >>\nstream\n{stream}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n{obj}\nendobj\n".encode("latin-1"))
    xref = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii"))
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii"))
    path.write_bytes(pdf)


def test_valid_docx_normalizes_multiple_question_types_and_multiple_los(tmp_path):
    source = tmp_path / "questions.docx"
    _write_docx(source, VALID_DOCUMENT)

    result = parse_question_bank_document(source)

    assert result.subject.subject_id == "DS310"
    assert result.subject.description == "A foundation for data science."
    assert len(result.questions) == 3
    mcq, true_false, essay = result.questions
    assert mcq.question_type == "MCQ"
    assert mcq.learning_objective_names == ["Understand the role of Data Science", "Identify the Data Science workflow"]
    assert mcq.question_text == "Which description best defines Data Science?"
    assert [option.label for option in mcq.options if option.is_correct] == ["A", "C"]
    assert true_false.question_type == "true-false"
    assert [(option.option_text, option.is_correct) for option in true_false.options] == [("True", True), ("False", False)]
    assert essay.question_type == "essay"
    assert essay.options == []
    assert essay.chapter_name == "Data Visualization"


def test_valid_text_pdf_and_single_lo(tmp_path):
    source = tmp_path / "questions.pdf"
    _write_text_pdf(source, VALID_DOCUMENT)

    result = parse_question_bank_document(source)

    assert result.questions[1].learning_objective_names == ["Identify the Data Science workflow"]


@pytest.mark.parametrize(
    ("replacement", "field", "reason"),
    [
        ("Type: Matching", "Type", "Multiple Choice"),
        ("Difficulty: Impossible", "Difficulty", "Easy"),
        ("Answer: A, Z", "Answer", "do not exist"),
    ],
)
def test_invalid_question_format_returns_question_field_and_reason(replacement, field, reason):
    text = VALID_DOCUMENT.replace("Type: Multiple Choice" if field == "Type" else "Difficulty: Easy" if field == "Difficulty" else "Answer: A, C", replacement, 1)

    with pytest.raises(QuestionBankParseError) as error:
        parse_question_bank_text(text)

    assert error.value.question_number == 1
    assert error.value.field == field
    assert reason in error.value.reason


def test_missing_mcq_answer_is_rejected():
    text = VALID_DOCUMENT.replace("Answer: A, C\n", "", 1)

    with pytest.raises(QuestionBankParseError, match="Question 1 - Answer"):
        parse_question_bank_text(text)


def test_overlength_question_is_rejected():
    text = VALID_DOCUMENT.replace("Which description best\n defines Data Science?", "x" * 256)

    with pytest.raises(QuestionBankParseError) as error:
        parse_question_bank_text(text)

    assert error.value.question_number == 1
    assert error.value.field == "Content"


def test_scanned_or_image_only_pdf_is_rejected(tmp_path):
    source = tmp_path / "scanned.pdf"
    _write_text_pdf(source, "")

    with pytest.raises(QuestionBankParseError, match="scanned/image-only"):
        parse_question_bank_document(source)


def test_malformed_docx_is_rejected(tmp_path):
    source = tmp_path / "malformed.docx"
    source.write_bytes(b"not a zip document")

    with pytest.raises(QuestionBankParseError, match="not a valid DOCX"):
        parse_question_bank_document(source)


def test_parser_is_pure_and_does_not_depend_on_database():
    source = inspect.getsource(parser)
    imports = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            imports.append(node.module or "")

    assert not any(name == "database" or name.startswith("database.") for name in imports)
    assert not any(name == "sqlalchemy" or name.startswith("sqlalchemy.") for name in imports)
