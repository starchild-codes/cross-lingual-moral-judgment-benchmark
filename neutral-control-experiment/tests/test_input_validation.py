from __future__ import annotations

import pytest

from src.common import CONTROL_IDS, LANGUAGES, NON_ENGLISH_LANGUAGES
from src.validate_input import InputValidationError, read_controls, validate_frame


def test_workbook_has_expected_structure(structural_frame):
    assert sorted(structural_frame["control_id"].unique()) == CONTROL_IDS
    assert sorted(structural_frame["language_code"].unique()) == sorted(LANGUAGES)
    assert len(structural_frame) == 65
    for control_id in CONTROL_IDS:
        subset = structural_frame[structural_frame["control_id"] == control_id]
        assert len(subset[(subset.language_code == "en") & (subset.version == "baseline")]) == 1
        for language in NON_ENGLISH_LANGUAGES:
            versions = set(subset[subset.language_code == language]["version"])
            assert versions == {"literal", "adapted"}


def test_attached_workbook_passes_native_review_gate():
    frame = validate_frame(read_controls(), require_native_approval=True)
    non_english = frame[frame["language_code"] != "en"]
    assert set(non_english["native_review_status"]) == {"Approved"}


def test_pending_native_review_status_fails(approved_frame):
    broken = approved_frame.copy()
    broken.loc[
        broken["language_code"] != "en", "native_review_status"
    ] = "Pending native-speaker review"
    with pytest.raises(InputValidationError, match="not all approved"):
        validate_frame(broken, require_native_approval=True)


def test_approved_fixture_passes(approved_frame):
    assert len(approved_frame) == 65


def test_blank_text_fails(approved_frame):
    broken = approved_frame.copy()
    broken.loc[0, "scenario_text"] = ""
    with pytest.raises(InputValidationError, match="Blank scenario"):
        validate_frame(broken)
