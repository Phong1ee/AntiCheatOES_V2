"""add media and password reset schema

Revision ID: d8b7e2c5a4f1
Revises: 50292736ea8d
Create Date: 2026-08-24

This brings Alembic in line with the additive SQL migrations that were
previously applied manually.  The existence checks allow the revision to stamp
an already-updated database without trying to create duplicate objects.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision = "d8b7e2c5a4f1"
down_revision = "50292736ea8d"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    return column in {item["name"] for item in sa.inspect(op.get_bind()).get_columns(table)}


def _has_index(table: str, index: str) -> bool:
    return index in {item["name"] for item in sa.inspect(op.get_bind()).get_indexes(table)}


def _create_password_reset_otp_table() -> None:
    op.create_table(
        "password_reset_otp",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("otp_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("consumed_at", sa.DateTime(), nullable=True),
        sa.Column("reset_token_hash", sa.String(length=64), nullable=True),
        sa.Column("reset_token_expires_at", sa.DateTime(), nullable=True),
        sa.Column("reset_completed_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint("attempts >= 0", name="ck_password_reset_otp_attempts_nonnegative"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user.id"], name="fk_password_reset_otp_user", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def _ensure_password_reset_otp_indexes() -> None:
    if not _has_index("password_reset_otp", "ix_password_reset_otp_user_created"):
        op.create_index(
            "ix_password_reset_otp_user_created",
            "password_reset_otp",
            ["user_id", "created_at"],
            unique=False,
        )
    if not _has_index("password_reset_otp", "ix_password_reset_otp_token"):
        op.create_index(
            "ix_password_reset_otp_token",
            "password_reset_otp",
            ["reset_token_hash"],
            unique=False,
        )


def upgrade() -> None:
    if not _has_column("question", "question_image"):
        op.add_column("question", sa.Column("question_image", mysql.MEDIUMBLOB(), nullable=True))
    if not _has_column("question", "question_image_mime"):
        op.add_column("question", sa.Column("question_image_mime", sa.String(length=100), nullable=True))

    if not _has_column("user", "avatar_image"):
        op.add_column("user", sa.Column("avatar_image", mysql.MEDIUMBLOB(), nullable=True))
    if not _has_column("user", "avatar_mime"):
        op.add_column("user", sa.Column("avatar_mime", sa.String(length=100), nullable=True))

    if not sa.inspect(op.get_bind()).has_table("password_reset_otp"):
        _create_password_reset_otp_table()
    _ensure_password_reset_otp_indexes()


def downgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("password_reset_otp"):
        op.drop_table("password_reset_otp")
    if _has_column("user", "avatar_mime"):
        op.drop_column("user", "avatar_mime")
    if _has_column("user", "avatar_image"):
        op.drop_column("user", "avatar_image")
    if _has_column("question", "question_image_mime"):
        op.drop_column("question", "question_image_mime")
    if _has_column("question", "question_image"):
        op.drop_column("question", "question_image")
