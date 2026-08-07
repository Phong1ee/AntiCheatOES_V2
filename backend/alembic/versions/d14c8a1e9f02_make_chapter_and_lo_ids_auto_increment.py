"""Make Chapter and Learning Objective identifiers database-generated.

Revision ID: d14c8a1e9f02
Revises: ccd8210b8297
Create Date: 2026-08-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d14c8a1e9f02"
down_revision: Union[str, Sequence[str], None] = "ccd8210b8297"
branch_labels = None
depends_on = None


_TARGETS = (("chapter", "chapter_id"), ("lo", "lo_id"))


def _referencing_foreign_keys() -> list[tuple[str, dict]]:
    """Return every FK that references a PK whose definition is being altered."""
    inspector = sa.inspect(op.get_bind())
    targets = set(_TARGETS)
    references: list[tuple[str, dict]] = []
    for table_name in inspector.get_table_names():
        for foreign_key in inspector.get_foreign_keys(table_name):
            reference = (foreign_key["referred_table"], foreign_key["referred_columns"][0])
            if reference in targets:
                references.append((table_name, foreign_key))
    return references


def _drop_foreign_keys(references: list[tuple[str, dict]]) -> None:
    for table_name, foreign_key in references:
        op.drop_constraint(foreign_key["name"], table_name, type_="foreignkey")


def _restore_foreign_keys(references: list[tuple[str, dict]]) -> None:
    for table_name, foreign_key in references:
        options = {
            key: value
            for key, value in foreign_key.get("options", {}).items()
            if key in {"ondelete", "onupdate"}
        }
        op.create_foreign_key(
            foreign_key["name"],
            table_name,
            foreign_key["referred_table"],
            foreign_key["constrained_columns"],
            foreign_key["referred_columns"],
            **options,
        )


def _set_autoincrement(enabled: bool) -> None:
    references = _referencing_foreign_keys()
    _drop_foreign_keys(references)
    try:
        for table_name, column_name in _TARGETS:
            op.alter_column(
                table_name,
                column_name,
                existing_type=sa.Integer(),
                existing_nullable=False,
                existing_autoincrement=not enabled,
                autoincrement=enabled,
            )
    finally:
        _restore_foreign_keys(references)


def upgrade() -> None:
    _set_autoincrement(True)


def downgrade() -> None:
    _set_autoincrement(False)
