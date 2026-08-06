"""Drop legacy per-type anti-cheat thresholds.

Downgrade recreates the columns with zero defaults only; historical per-type
values cannot be reconstructed after their shared violation limit migration.
"""
from alembic import op
import sqlalchemy as sa

revision = "f3b8d2a7c5e1"
down_revision = "c9d1e8f2a4b6"
branch_labels = None
depends_on = None

_CONSTRAINTS = (
    "ck_exam_setting_force_fullscreen_thresh_nonnegative",
    "ck_exam_setting_tab_switch_thresh_nonnegative",
    "ck_exam_setting_copy_paste_thresh_nonnegative",
)

def upgrade():
    for name in _CONSTRAINTS:
        op.drop_constraint(name, "exam_setting", type_="check")
    op.drop_column("exam_setting", "force_fullscreen_thresh")
    op.drop_column("exam_setting", "tab_switch_thresh")
    op.drop_column("exam_setting", "copy_paste_thresh")

def downgrade():
    op.add_column("exam_setting", sa.Column("force_fullscreen_thresh", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("exam_setting", sa.Column("tab_switch_thresh", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("exam_setting", sa.Column("copy_paste_thresh", sa.Integer(), nullable=False, server_default="0"))
    for name, column in zip(_CONSTRAINTS, ("force_fullscreen_thresh", "tab_switch_thresh", "copy_paste_thresh")):
        op.create_check_constraint(name, "exam_setting", f"{column} >= 0")
