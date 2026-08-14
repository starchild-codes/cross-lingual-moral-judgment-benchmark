from collections import Counter
import csv
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"


def read(name):
    with (PROCESSED / name).open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def test_selected_scenarios_are_balanced():
    rows = read("selected_scenarios.csv")
    assert len(rows) == 20
    counts = Counter((row["foundation"], row["selection_tier"]) for row in rows)
    assert set(counts.values()) == {2}
    assert len(counts) == 10


def test_english_questions_have_balanced_keys():
    rows = read("english_comprehension_questions.csv")
    assert len(rows) == 80
    assert Counter(row["correct_option"] for row in rows) == Counter(
        {"A": 20, "B": 20, "C": 20, "D": 20}
    )


def test_multilingual_rows_are_complete():
    rows = read("multilingual_comprehension_questions.csv")
    assert len(rows) == 960
    required = [
        "question_id",
        "scenario_id",
        "scenario_text_final",
        "question_final",
        "option_A",
        "option_B",
        "option_C",
        "option_D",
        "correct_option",
    ]
    assert all(all(row[column] for column in required) for row in rows)


def test_manifest_has_720_unique_rows():
    rows = read("run_manifest_720.csv")
    assert len(rows) == 720
    assert len({row["work_unit_id"] for row in rows}) == 720
