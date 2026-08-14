from __future__ import annotations

from src.build_conditions import generate_conditions
from src.common import MODEL_KEYS, NON_ENGLISH_LANGUAGES
from src.run_experiment import work_units


def test_exact_condition_counts(approved_frame):
    conditions = generate_conditions(approved_frame)
    assert len(conditions) == 125
    assert conditions.groupby("control_id").size().eq(25).all()
    assert not conditions.duplicated(["control_id", "condition_id"]).any()


def test_exact_model_work_units(approved_frame):
    conditions = generate_conditions(approved_frame)
    assert len(work_units(conditions, MODEL_KEYS)) == 375


def test_condition_languages_and_exclusions(approved_frame):
    conditions = generate_conditions(approved_frame)
    assert set(conditions[conditions.condition_id == "en_en"].response_language) == {"en"}
    assert not conditions.condition_id.str.contains("explanation").any()
    assert not (
        (conditions.input_language == "en") & (conditions.scenario_version != "baseline")
    ).any()
    for language in NON_ENGLISH_LANGUAGES:
        subset = conditions[conditions.input_language == language]
        assert set(subset.response_language) == {"en", language}
        assert set(subset.scenario_version) == {"literal", "adapted"}


def test_english_baseline_first_per_control(approved_frame):
    conditions = generate_conditions(approved_frame)
    first = conditions.groupby("control_id", sort=False).first()
    assert first["condition_id"].eq("en_en").all()

