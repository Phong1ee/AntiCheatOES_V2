import importlib.util
import unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from alembic.config import Config
from alembic.script import ScriptDirectory
from src.service.scoring_service import normalize_score


class _ExamMigrationOperations:
    def __init__(self):
        self.statuses = ["published", "archived", "draft", "archived"]
        self.allowed = {"draft", "published", "archived"}
        self.statements: list[str] = []

    def execute(self, statement):
        sql = " ".join(str(statement).split())
        self.statements.append(sql)
        if sql.startswith("UPDATE exam SET status"):
            self.statuses = ["draft" if status == "archived" else status for status in self.statuses]
        elif "ENUM('draft', 'published')" in sql:
            if any(status not in {"draft", "published"} for status in self.statuses):
                raise AssertionError("Enum was reduced before archived rows were converted")
            self.allowed = {"draft", "published"}
        elif "ENUM('draft', 'published', 'archived')" in sql:
            self.allowed = {"draft", "published", "archived"}


class ExamDataMigrationTests(unittest.TestCase):
    @staticmethod
    def _load(filename: str):
        path = Path(__file__).parents[1] / "alembic" / "versions" / filename
        spec = importlib.util.spec_from_file_location(filename.removesuffix(".py"), path)
        module = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(module)
        return module

    def test_archived_rows_are_converted_before_enum_is_reduced(self):
        migration = self._load("c4e8a1d2f903_reduce_exam_status_values.py")
        operations = _ExamMigrationOperations()
        with patch.object(migration, "op", operations):
            migration.upgrade()
        self.assertEqual(operations.statuses, ["published", "draft", "draft", "draft"])
        self.assertEqual(operations.allowed, {"draft", "published"})
        self.assertTrue(operations.statements[0].startswith("UPDATE exam"))

        with patch.object(migration, "op", operations):
            migration.downgrade()
        self.assertEqual(operations.allowed, {"draft", "published", "archived"})
        self.assertNotIn("archived", operations.statuses)

    def test_blank_essay_backfill_is_narrow_and_normalizes_scores(self):
        migration = self._load("d5f9b2e3a014_backfill_blank_essay_scores.py")
        statements: list[str] = []

        class Operations:
            @staticmethod
            def execute(statement):
                statements.append(" ".join(str(statement).split()))

        with patch.object(migration, "op", Operations()):
            migration.upgrade()
        sql = statements[0]
        self.assertIn("SET answer_text = '', score = 0", sql)
        self.assertIn("WHERE score IS NULL", sql)
        self.assertIn("COALESCE(answer_text, '')", sql)
        self.assertIn("CHAR(9)", sql)
        self.assertIn("CHAR(10)", sql)
        self.assertIn("CHAR(13)", sql)

    def test_exam_code_blanks_are_cleared_before_column_becomes_nullable(self):
        migration = self._load("b8d4f2a6c105_make_exam_code_optional.py")
        statements: list[str] = []

        class Operations:
            @staticmethod
            def execute(statement):
                statements.append(" ".join(str(statement).split()))

        with patch.object(migration, "op", Operations()):
            migration.upgrade()
        self.assertEqual(len(statements), 2)
        self.assertIn("SET examcode = NULL", statements[0])
        self.assertIn("TRIM(examcode) = ''", statements[0])
        self.assertIn("VARCHAR(20) NULL", statements[1])

        statements.clear()
        with patch.object(migration, "op", Operations()):
            migration.downgrade()
        self.assertIn("WHERE examcode IS NULL", statements[0])
        self.assertIn("VARCHAR(20) NOT NULL", statements[1])

    def test_ten_point_migration_is_versioned_and_preserves_attempt_snapshots(self):
        path = (
            Path(__file__).parents[1]
            / "alembic"
            / "versions"
            / "e2a7c4d91b30_normalize_exam_scores_to_ten.py"
        )
        source = path.read_text(encoding="utf-8")
        self.assertIn('down_revision: Union[str, Sequence[str], None] = "b8d4f2a6c105"', source)
        self.assertIn("WHERE a.score_scale_version = 1", source)
        self.assertIn("target.score_scale_version = 2", source)
        self.assertIn("JSON_TABLE", source)
        self.assertIn("COALESCE(aq.question_point_snapshot, aq.question_point, 0)", source)
        self.assertNotIn("UPDATE attempt_question SET", source)
        self.assertIn("skipped_zero_denominator_attempts", source)
        self.assertIn("invalid_or_missing_exam_scores_using_5.00_fallback", source)

    def test_legacy_hundred_and_non_hundred_totals_normalize_consistently(self):
        self.assertEqual(normalize_score(50, 100), Decimal("50.00"))
        self.assertEqual(normalize_score(24, 80), Decimal("30.00"))
        self.assertEqual(normalize_score(72, 120), Decimal("60.00"))

    def test_anti_cheat_migration_backfills_legacy_thresholds_and_has_one_head(self):
        migration = self._load("c9d1e8f2a4b6_expand_anti_cheat_settings_and_events.py")
        calls: list[tuple[str, object]] = []

        class Operations:
            def __getattr__(self, name):
                def record(*args, **kwargs):
                    calls.append((name, args))
                return record

        with patch.object(migration, "op", Operations()):
            migration.upgrade()
            migration.downgrade()

        upgrade_sql = next(args[0] for name, args in calls if name == "execute")
        self.assertIn("anti_cheat_enabled = CASE", upgrade_sql)
        self.assertIn("GREATEST", upgrade_sql)
        self.assertIn("COALESCE(force_fullscreen_thresh, 0)", upgrade_sql)
        self.assertIn("COALESCE(tab_switch_thresh, 0)", upgrade_sql)
        self.assertIn("COALESCE(copy_paste_thresh, 0)", upgrade_sql)
        self.assertIn("1,", upgrade_sql)
        self.assertIn("ELSE 5", upgrade_sql)
        self.assertIn("force_fullscreen_thresh > 0", upgrade_sql)
        self.assertIn("tab_switch_thresh > 0", upgrade_sql)
        self.assertIn("copy_paste_thresh > 0", upgrade_sql)
        self.assertIn(("create_unique_constraint", ("uq_exam_event_attempt_client_event", "exam_event", ["attempt_id", "client_event_id"])), calls)

        config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
        script = ScriptDirectory.from_config(config)
        self.assertEqual(script.get_heads(), ["d14c8a1e9f02"])


if __name__ == "__main__":
    unittest.main()
