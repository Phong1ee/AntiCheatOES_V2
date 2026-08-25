from src.service.text_encoding_repair import repair_cp437_mojibake, repair_json_value
from src.a_db_config import Base
from scripts.repair_vietnamese_encoding import TEXT_COLUMNS


def test_repairs_confirmed_cp437_vietnamese_mojibake():
    original = "Cơ sở dữ liệu"
    damaged = original.encode("utf-8").decode("cp437")

    assert repair_cp437_mojibake(damaged) == original


def test_leaves_normal_text_and_non_vietnamese_box_drawing_unchanged():
    assert repair_cp437_mojibake("Normal text") == "Normal text"
    assert repair_cp437_mojibake("┌───┐") == "┌───┐"


def test_repairs_json_snapshot_without_changing_structure():
    original = "Phát triển Web"
    damaged = original.encode("utf-8").decode("cp437")
    payload = {"options": [{"text": damaged}], "ids": [1, 2]}

    assert repair_json_value(payload) == {"options": [{"text": original}], "ids": [1, 2]}


def test_repair_scope_refers_to_registered_tables():
    assert set(TEXT_COLUMNS).issubset(Base.metadata.tables)
