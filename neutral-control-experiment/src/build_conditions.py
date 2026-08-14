from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

from .common import (
    CONDITIONS_CSV,
    CONTROL_IDS,
    INPUT_WORKBOOK,
    NON_ENGLISH_LANGUAGES,
    configure_utf8_console,
    ensure_directories,
)
from .prompts import prompts_for
from .validate_input import InputValidationError, validate_workbook


COLUMNS = [
    "control_id",
    "control_title",
    "condition_id",
    "input_language",
    "scenario_version",
    "response_language",
    "scenario_text",
    "question_text",
    "system_prompt",
    "rating_instruction",
]


def _condition(
    row: pd.Series,
    condition_id: str,
    response_language: str,
) -> dict[str, str]:
    system_prompt, instruction, _ = prompts_for(response_language)
    return {
        "control_id": row["control_id"],
        "control_title": row["title"],
        "condition_id": condition_id,
        "input_language": row["language_code"],
        "scenario_version": row["version"],
        "response_language": response_language,
        "scenario_text": row["scenario_text"],
        "question_text": row["question"],
        "system_prompt": system_prompt,
        "rating_instruction": instruction,
    }


def generate_conditions(source: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, str]] = []
    indexed = source.set_index(
        ["control_id", "language_code", "version"], drop=False
    )
    if not indexed.index.is_unique:
        raise RuntimeError("Source rows are not unique by control, language, and version")
    for control_id in CONTROL_IDS:
        english = indexed.loc[(control_id, "en", "baseline")]
        rows.append(_condition(english, "en_en", "en"))
        for language in NON_ENGLISH_LANGUAGES:
            literal = indexed.loc[(control_id, language, "literal")]
            adapted = indexed.loc[(control_id, language, "adapted")]
            rows.extend(
                [
                    _condition(literal, f"{language}_literal_response_en", "en"),
                    _condition(literal, f"{language}_literal_response_{language}", language),
                    _condition(adapted, f"{language}_adapted_response_en", "en"),
                    _condition(adapted, f"{language}_adapted_response_{language}", language),
                ]
            )
    result = pd.DataFrame(rows, columns=COLUMNS)
    control_order = {control_id: index for index, control_id in enumerate(CONTROL_IDS)}
    language_order = {"en": 0, **{language: index + 1 for index, language in enumerate(NON_ENGLISH_LANGUAGES)}}
    version_order = {"baseline": 0, "literal": 1, "adapted": 2}
    response_order = {"en": 0, **{language: 1 for language in NON_ENGLISH_LANGUAGES}}
    result = (
        result.assign(
            _control=result["control_id"].map(control_order),
            _language=result["input_language"].map(language_order),
            _version=result["scenario_version"].map(version_order),
            _response=result["response_language"].map(response_order),
        )
        .sort_values(["_control", "_language", "_version", "_response"], kind="stable")
        .drop(columns=["_control", "_language", "_version", "_response"])
        .reset_index(drop=True)
    )
    if len(result) != 125:
        raise RuntimeError(f"Expected 125 conditions; generated {len(result)}")
    counts = result.groupby("control_id").size()
    if not counts.eq(25).all():
        raise RuntimeError(f"Expected 25 conditions per control; found {counts.to_dict()}")
    if result.duplicated(["control_id", "condition_id"]).any():
        raise RuntimeError("Generated duplicate control-condition IDs")
    return result


def build_conditions(
    workbook: Path = INPUT_WORKBOOK, output: Path = CONDITIONS_CSV
) -> pd.DataFrame:
    source = validate_workbook(workbook)
    conditions = generate_conditions(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    conditions.to_csv(temporary, index=False, encoding="utf-8")
    temporary.replace(output)
    return conditions


def main() -> int:
    configure_utf8_console()
    parser = argparse.ArgumentParser(description="Build the deterministic condition table.")
    parser.add_argument("--workbook", type=Path, default=INPUT_WORKBOOK)
    parser.add_argument("--output", type=Path, default=CONDITIONS_CSV)
    args = parser.parse_args()
    ensure_directories()
    try:
        conditions = build_conditions(args.workbook, args.output)
    except (InputValidationError, RuntimeError) as error:
        print(error, file=sys.stderr)
        return 1
    print(f"Wrote {len(conditions)} validated conditions to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
