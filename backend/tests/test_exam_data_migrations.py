import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch


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


if __name__ == "__main__":
    unittest.main()
