"""Repair confirmed CP437-mojibake content without changing the database schema.

Run without --apply first. The script prints only aggregate counts and performs
all updates in one transaction when explicitly approved.
"""

from __future__ import annotations

import argparse
from collections import Counter

from sqlalchemy import select, update

from database import Base, engine
from src.service.text_encoding_repair import repair_cp437_mojibake, repair_json_value


TEXT_COLUMNS = {
    "user": ("full_name",),
    "subject": ("subject_name", "subject_description"),
    "chapter": ("chapter_name", "chapter_description"),
    "lo": ("lo_name", "lo_description"),
    "class": ("class_name",),
    "exam": ("title", "description"),
    "question": ("question_text",),
    "options": ("options_text",),
    "attempt": ("termination_reason",),
    "attempt_question": ("question_text_snapshot", "options_snapshot"),
    "essay_answers": ("answer_text",),
    "exam_event": ("details",),
    "bulk_data_request": ("teacher_note", "admin_note"),
    "question_revision": ("question_text", "options_snapshot", "rejection_reason"),
}


def repaired_value(value):
    if isinstance(value, str):
        return repair_cp437_mojibake(value)
    if isinstance(value, (dict, list)):
        return repair_json_value(value)
    return value


def repair_database(apply: bool) -> Counter[str]:
    changes: Counter[str] = Counter()
    with engine.begin() as connection:
        for table_name, column_names in TEXT_COLUMNS.items():
            table = Base.metadata.tables[table_name]
            primary_keys = list(table.primary_key.columns)
            columns = [table.c[name] for name in column_names]

            for row in connection.execute(select(*primary_keys, *columns)).mappings():
                values = {}
                for column in columns:
                    repaired = repaired_value(row[column.name])
                    if repaired != row[column.name]:
                        values[column.name] = repaired
                if not values:
                    continue

                changes.update(f"{table_name}.{column_name}" for column_name in values)
                if apply:
                    predicate = [primary_key == row[primary_key.name] for primary_key in primary_keys]
                    connection.execute(update(table).where(*predicate).values(**values))

    return changes


def main() -> None:
    parser = argparse.ArgumentParser(description="Repair confirmed Vietnamese CP437 mojibake.")
    parser.add_argument("--apply", action="store_true", help="Write the audited repairs in one transaction.")
    args = parser.parse_args()

    changes = repair_database(apply=args.apply)
    mode = "APPLIED" if args.apply else "DRY RUN"
    print(f"{mode}: {sum(changes.values())} field values would be repaired.")
    for field, count in sorted(changes.items()):
        print(f"{field}: {count}")


if __name__ == "__main__":
    main()
