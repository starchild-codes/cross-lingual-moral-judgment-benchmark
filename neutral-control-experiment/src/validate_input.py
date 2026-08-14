from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd

from .common import (
    CONTROL_IDS,
    INPUT_WORKBOOK,
    LANGUAGES,
    NON_ENGLISH_LANGUAGES,
    configure_utf8_console,
)


EXPECTED_COLUMNS = [
    "control_id",
    "title",
    "language_code",
    "language",
    "version",
    "scenario_text",
    "question",
    "validation_status",
    "native_review_status",
    "notes",
]


class InputValidationError(ValueError):
    """Raised when the frozen input workbook is not experiment-ready."""


def read_controls(workbook: Path = INPUT_WORKBOOK) -> pd.DataFrame:
    if not workbook.exists():
        raise InputValidationError(f"Input workbook not found: {workbook}")
    try:
        frame = pd.read_excel(workbook, sheet_name="Controls_Long", dtype=str, keep_default_na=False)
    except ValueError as error:
        raise InputValidationError("Workbook must contain a sheet named Controls_Long") from error
    frame.columns = [str(column).strip() for column in frame.columns]
    return frame


def _is_approved_status(value: str) -> bool:
    normalized = " ".join(value.casefold().replace("_", " ").split())
    if any(blocked in normalized for blocked in ("pending", "not reviewed", "rejected", "fail")):
        return False
    return any(token in normalized for token in ("approved", "review complete", "reviewed", "passed"))


def _validate_arabic_unicode(frame: pd.DataFrame, errors: list[str]) -> None:
    arabic = frame[frame["language_code"] == "ar"]
    arabic_pattern = re.compile(r"[\u0600-\u06ff]")
    bidi_controls = {"RLO", "LRO", "RLE", "LRE", "PDF", "RLI", "LRI", "FSI", "PDI"}
    for index, row in arabic.iterrows():
        for field in ("scenario_text", "question"):
            value = str(row[field])
            if not arabic_pattern.search(value):
                errors.append(f"Row {index + 2} {field} does not contain Arabic-script text")
            if "\ufffd" in value:
                errors.append(f"Row {index + 2} {field} contains a Unicode replacement character")
            if any(unicodedata.bidirectional(character) in bidi_controls for character in value):
                errors.append(f"Row {index + 2} {field} contains explicit bidi override/control characters")


def validate_frame(frame: pd.DataFrame, require_native_approval: bool = True) -> pd.DataFrame:
    errors: list[str] = []
    missing_columns = [column for column in EXPECTED_COLUMNS if column not in frame.columns]
    if missing_columns:
        errors.append(f"Missing required columns: {', '.join(missing_columns)}")
    if errors:
        raise InputValidationError("\n".join(errors))

    frame = frame[EXPECTED_COLUMNS].copy()
    for column in EXPECTED_COLUMNS:
        frame[column] = frame[column].astype(str)

    controls = sorted(frame["control_id"].unique())
    if controls != CONTROL_IDS:
        errors.append(f"Expected controls {CONTROL_IDS}; found {controls}")
    if frame["control_id"].nunique() != 5:
        errors.append(f"Expected exactly 5 unique controls; found {frame['control_id'].nunique()}")

    languages = sorted(frame["language_code"].unique())
    if languages != sorted(LANGUAGES):
        errors.append(f"Expected language codes {LANGUAGES}; found {languages}")

    duplicates = frame.duplicated(["control_id", "language_code", "version"], keep=False)
    if duplicates.any():
        keys = frame.loc[duplicates, ["control_id", "language_code", "version"]].drop_duplicates()
        errors.append(f"Duplicate control-language-version combinations: {keys.to_dict('records')}")

    blank_scenarios = frame["scenario_text"].str.strip().eq("")
    blank_questions = frame["question"].str.strip().eq("")
    if blank_scenarios.any():
        errors.append(f"Blank scenario text in rows: {(frame.index[blank_scenarios] + 2).tolist()}")
    if blank_questions.any():
        errors.append(f"Blank question text in rows: {(frame.index[blank_questions] + 2).tolist()}")

    for control_id in CONTROL_IDS:
        subset = frame[frame["control_id"] == control_id]
        english = subset[(subset["language_code"] == "en") & (subset["version"] == "baseline")]
        if len(english) != 1:
            errors.append(f"{control_id}: expected exactly one English baseline row; found {len(english)}")
        invalid_english = subset[
            (subset["language_code"] == "en") & (subset["version"] != "baseline")
        ]
        if not invalid_english.empty:
            errors.append(f"{control_id}: English rows must use version baseline")
        for language in NON_ENGLISH_LANGUAGES:
            language_rows = subset[subset["language_code"] == language]
            versions = language_rows["version"].value_counts().to_dict()
            if versions != {"literal": 1, "adapted": 1}:
                errors.append(
                    f"{control_id}/{language}: expected one literal and one adapted row; found {versions}"
                )

    invalid_non_english_versions = frame[
        frame["language_code"].isin(NON_ENGLISH_LANGUAGES)
        & ~frame["version"].isin(["literal", "adapted"])
    ]
    if not invalid_non_english_versions.empty:
        errors.append("Non-English rows must use version literal or adapted")

    if require_native_approval:
        non_english = frame[frame["language_code"].isin(NON_ENGLISH_LANGUAGES)]
        unapproved = non_english[~non_english["native_review_status"].map(_is_approved_status)]
        if not unapproved.empty:
            counts = unapproved["native_review_status"].value_counts().to_dict()
            errors.append(
                "Non-English rows are not all approved following native-speaker review. "
                f"Unapproved status counts: {counts}"
            )

    _validate_arabic_unicode(frame, errors)

    if errors:
        raise InputValidationError("Workbook validation failed:\n- " + "\n- ".join(errors))
    return frame


def validate_workbook(
    workbook: Path = INPUT_WORKBOOK, require_native_approval: bool = True
) -> pd.DataFrame:
    return validate_frame(read_controls(workbook), require_native_approval=require_native_approval)


def main() -> int:
    configure_utf8_console()
    parser = argparse.ArgumentParser(description="Validate the neutral-control input workbook.")
    parser.add_argument("--workbook", type=Path, default=INPUT_WORKBOOK)
    args = parser.parse_args()
    try:
        frame = validate_workbook(args.workbook)
    except InputValidationError as error:
        print(error, file=sys.stderr)
        return 1
    print(
        f"Workbook validation passed: {frame['control_id'].nunique()} controls, "
        f"{frame['language_code'].nunique()} languages, {len(frame)} source rows."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
