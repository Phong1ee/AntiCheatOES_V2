"""Question rich content, immutable media, exam blocks and attempt layout.

Revision ID: 8a21c7e5b940
Revises: f2a7c9e4b106
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = "8a21c7e5b940"
down_revision = "f2a7c9e4b106"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    def has_column(table, column):
        return column in {c["name"] for c in sa.inspect(bind).get_columns(table)}
    # MySQL DDL is nontransactional. These guards also allow retrying an
    # interrupted upgrade without resetting data or changing revision markers.
    def add_column(table, column):
        if not has_column(table, column.name):
            op.add_column(table, column)
    def create_table(name, *columns):
        if not sa.inspect(bind).has_table(name):
            op.create_table(name, *columns)
    def create_index(name, table, columns):
        if name not in {i["name"] for i in sa.inspect(bind).get_indexes(table)}:
            op.create_index(name, table, columns)
    def create_foreign_key(name, table, target, columns, referred, **kwargs):
        if not any(f["constrained_columns"] == columns and f["referred_table"] == target for f in sa.inspect(bind).get_foreign_keys(table)):
            op.create_foreign_key(name, table, target, columns, referred, **kwargs)
    def create_check_constraint(name, table, expression):
        if name not in {c["name"] for c in sa.inspect(bind).get_check_constraints(table)}:
            op.create_check_constraint(name, table, expression)
    # Do not silently flatten legacy reusable-question hierarchy.
    if has_column("question", "is_group") and bind.execute(sa.text("SELECT COUNT(*) FROM question WHERE is_group = 1 OR parent_question_id IS NOT NULL")).scalar():
        raise RuntimeError("Legacy question hierarchy needs explicit exam membership reconciliation before upgrading")
    if inspector.has_table("question_media_asset"):
        # Extend the existing immutable-byte store, preserving old UUID references.
        for name in ("fk_question_image_asset", "fk_question_audio_asset"):
            if name in {f["name"] for f in sa.inspect(bind).get_foreign_keys("question")}:
                op.drop_constraint(name, "question", type_="foreignkey")
        op.alter_column("question_media_asset", "asset_id", existing_type=sa.String(36), type_=sa.String(64), existing_nullable=False)
        op.alter_column("question_media_asset", "question_id", existing_type=sa.Integer(), nullable=True)
        for name in ("image_asset_id", "audio_asset_id"):
            if has_column("question", name):
                op.alter_column("question", name, existing_type=sa.String(36), type_=sa.String(64), existing_nullable=True)
                create_foreign_key("fk_question_" + name.replace("_id", ""), "question", "question_media_asset", [name], ["asset_id"])
        add_column("question_media_asset", sa.Column("kind", sa.String(5)))
        add_column("question_media_asset", sa.Column("created_by", sa.String(30), sa.ForeignKey("user.school_id")))
        add_column("question_media_asset", sa.Column("subject_id", sa.String(20), sa.ForeignKey("subject.subject_id")))
        add_column("question_media_asset", sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False))
        op.execute("UPDATE question_media_asset m LEFT JOIN question q ON q.question_id = m.question_id SET m.kind = CASE WHEN m.mime_type LIKE 'image/%' THEN 'image' ELSE 'audio' END, m.created_by = q.created_by, m.subject_id = q.subject_id")
        op.alter_column("question_media_asset", "kind", existing_type=sa.String(5), nullable=False)
    else:
        create_table("question_media_asset",
            sa.Column("asset_id", sa.String(64), primary_key=True),
            sa.Column("question_id", sa.Integer(), nullable=True),
            sa.Column("content", mysql.MEDIUMBLOB(), nullable=False),
            sa.Column("mime_type", sa.String(100), nullable=False),
            sa.Column("kind", sa.String(5), nullable=False),
            sa.Column("created_by", sa.String(30), sa.ForeignKey("user.school_id"), nullable=True),
            sa.Column("subject_id", sa.String(20), sa.ForeignKey("subject.subject_id"), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False))
    create_table("exam_question_block",
        sa.Column("block_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("exam_id", sa.Integer(), sa.ForeignKey("exam.exam_id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("title", sa.String(300), nullable=False, server_default=""),
        sa.Column("rich_html", mysql.MEDIUMTEXT()),
        sa.Column("image_media_id", sa.String(64), sa.ForeignKey("question_media_asset.asset_id")),
        sa.Column("audio_media_id", sa.String(64), sa.ForeignKey("question_media_asset.asset_id")),
        sa.Column("image_alt", sa.String(300), nullable=False, server_default=""),
        sa.Column("keep_order", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("keep_together", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("pinned_position", sa.Integer()),
        sa.Column("structure_order", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("kind IN ('group', 'parent')", name="ck_question_block_kind"))
    create_index("ix_exam_question_block_exam_id", "exam_question_block", ["exam_id"])
    for table, column in [("question", "question_text"), ("options", "options_text")]:
        op.alter_column(table, column, existing_type=sa.String(255), type_=mysql.MEDIUMTEXT(), existing_nullable=False)
        add_column(table, sa.Column("rich_html", mysql.MEDIUMTEXT()))
        if has_column(table, "image_alt"):
            op.execute(sa.text(f"UPDATE {table} SET image_alt = '' WHERE image_alt IS NULL"))
            op.alter_column(table, "image_alt", existing_type=sa.String(255), type_=sa.String(300), nullable=False, server_default="")
        else:
            add_column(table, sa.Column("image_alt", sa.String(300), nullable=False, server_default=""))
        for kind in ("image", "audio"):
            name = f"{kind}_media_id"
            add_column(table, sa.Column(name, sa.String(64)))
            create_foreign_key(f"fk_{table}_{name}", table, "question_media_asset", [name], ["asset_id"])
    add_column("options", sa.Column("semantic_value", sa.String(5)))
    op.execute("UPDATE options o JOIN question q ON q.question_id = o.question_id SET o.semantic_value = LOWER(TRIM(o.options_text)) WHERE q.question_type = 'true-false' AND LOWER(TRIM(o.options_text)) IN ('true', 'false')")
    if not has_column("exam_setting", "questions_per_page"):
        add_column("exam_setting", sa.Column("questions_per_page", sa.Integer(), nullable=False, server_default="1"))
    if "ck_exam_setting_page_size" in {c["name"] for c in sa.inspect(bind).get_check_constraints("exam_setting")}:
        op.drop_constraint("ck_exam_setting_page_size", "exam_setting", type_="check")
    create_check_constraint("ck_questions_per_page", "exam_setting", "questions_per_page BETWEEN 1 AND 50")
    add_column("exam_question", sa.Column("block_id", sa.Integer()))
    create_foreign_key("fk_exam_question_block", "exam_question", "exam_question_block", ["block_id"], ["block_id"], ondelete="SET NULL")
    add_column("exam_question", sa.Column("structure_order", sa.Integer(), nullable=False, server_default="0"))
    add_column("exam_question", sa.Column("pinned_position", sa.Integer()))
    for column in ("content_snapshot", "layout_snapshot"):
        if not has_column("attempt_question", column):
            add_column("attempt_question", sa.Column(column, sa.JSON()))
    if not has_column("question_revision", "content_snapshot"):
        add_column("question_revision", sa.Column("content_snapshot", sa.JSON()))
    op.alter_column("question_revision", "question_text", existing_type=sa.String(255), type_=mysql.MEDIUMTEXT(), existing_nullable=False)
    op.alter_column("attempt_question", "question_text_snapshot", existing_type=sa.Text(), type_=mysql.MEDIUMTEXT(), existing_nullable=True)
    # Freeze old rows that predate option snapshots without overwriting existing snapshots.
    op.execute("""UPDATE attempt_question aq JOIN question q ON q.question_id = aq.question_id
        SET aq.question_text_snapshot = COALESCE(aq.question_text_snapshot, q.question_text),
            aq.question_type_snapshot = COALESCE(aq.question_type_snapshot, q.question_type),
            aq.question_point_snapshot = COALESCE(aq.question_point_snapshot, aq.question_point)
        WHERE aq.question_text_snapshot IS NULL OR aq.question_type_snapshot IS NULL OR aq.question_point_snapshot IS NULL""")
    op.execute("""UPDATE attempt_question aq LEFT JOIN
        (SELECT question_id, JSON_ARRAYAGG(JSON_OBJECT('id', options_id, 'text', options_text, 'isCorrect', is_correct)) AS snapshot FROM options GROUP BY question_id) o
        ON o.question_id = aq.question_id SET aq.options_snapshot = COALESCE(o.snapshot, JSON_ARRAY())
        WHERE aq.options_snapshot IS NULL""")
    # Legacy text and existing snapshots remain literal plain text (rich_html NULL).
    # Legacy image columns may be absent on databases upgraded only with Alembic.
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("question")}
    if "question_image" not in columns:
        add_column("question", sa.Column("question_image", mysql.MEDIUMBLOB()))
    if "question_image_mime" not in columns:
        add_column("question", sa.Column("question_image_mime", sa.String(100)))
    if has_column("question", "question_html"):
        from src.service.rich_content_service import sanitize_rich
        for row in bind.execute(sa.text("SELECT question_id, question_html FROM question WHERE question_html IS NOT NULL")).mappings().all():
            html, plain = sanitize_rich(row["question_html"])
            bind.execute(sa.text("UPDATE question SET rich_html = :html, question_text = :plain WHERE question_id = :qid"), {"html": html, "plain": plain, "qid": row["question_id"]})
    # Historic rows may lack owner/subject; preserve them without inventing user IDs.
    # New uploads still require a real assigned subject and authenticated owner.
    op.execute("""INSERT IGNORE INTO question_media_asset (asset_id, content, mime_type, kind, created_by, subject_id)
        SELECT SHA2(CONCAT(question_id, ':', HEX(question_image)), 256), question_image, question_image_mime,
               'image', created_by, subject_id FROM question
        WHERE question_image IS NOT NULL AND question_image_mime IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')""")
    op.execute("""UPDATE question SET image_media_id = SHA2(CONCAT(question_id, ':', HEX(question_image)), 256)
        WHERE question_image IS NOT NULL AND question_image_mime IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')""")
    op.execute("""UPDATE attempt_question aq JOIN question q ON q.question_id = aq.question_id
        JOIN attempt a ON a.attempt_id = aq.attempt_id LEFT JOIN exam_setting es ON es.exam_id = a.exam_id
        SET aq.content_snapshot = JSON_SET(COALESCE(aq.content_snapshot, JSON_OBJECT()), '$.rich_html', JSON_EXTRACT(aq.content_snapshot, '$.question_html'), '$.image_media_id', q.image_media_id, '$.audio_media_id', NULL, '$.image_alt', COALESCE(q.image_alt, '')),
            aq.layout_snapshot = JSON_OBJECT('page', COALESCE(aq.display_order, 1), 'slot', 1, 'questions_per_page', 1, 'sequential_navigation', COALESCE(es.sequential_navigation, 0))
        WHERE aq.layout_snapshot IS NULL""")


def downgrade():
    raise RuntimeError("This additive migration preserves legacy media/snapshots; export data and use a reviewed forward migration to revert it")
