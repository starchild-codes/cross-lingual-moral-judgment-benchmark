from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import pandas as pd

from .common import (
    DATABASE_PATH,
    MODEL_KEYS,
    RESULTS_DIR,
    configure_utf8_console,
    ensure_directories,
)
from .storage import RAW_COLUMNS, ResultStore


EXPECTED_TOTAL = 375
CLEAN_CSV = RESULTS_DIR / "neutral_control_ratings_clean.csv"
DIAGNOSTICS_CSV = RESULTS_DIR / "neutral_control_diagnostics.csv"


def diagnostic_rows(
    responses: pd.DataFrame, attempts: pd.DataFrame
) -> tuple[list[dict[str, Any]], bool]:
    metrics: list[dict[str, Any]] = []

    def add(metric: str, value: Any, dimension: str = "overall", category: str = "all") -> None:
        metrics.append(
            {"dimension": dimension, "category": category, "metric": metric, "value": value}
        )

    valid = responses[
        responses["is_valid"].eq(1)
        & responses["parsed_rating"].between(1, 7, inclusive="both")
    ].copy()
    duplicate_count = int(responses["unique_key"].duplicated().sum())
    add("expected_total", EXPECTED_TOTAL)
    add("total_raw_rows", len(responses))
    add("total_unique_work_units", responses["unique_key"].nunique())
    add("valid_final_rows", len(valid))
    add("duplicate_unique_keys", duplicate_count)
    add("missing_or_invalid_work_units", EXPECTED_TOTAL - len(valid))
    add("malformed_attempt_outputs", int((attempts["http_status"].eq(200) & attempts["is_valid"].eq(0)).sum()))
    add("unresolved_failures", int((responses["is_valid"].eq(0)).sum()))
    add("total_tokens_available", int(pd.to_numeric(responses["total_tokens"], errors="coerce").sum()))
    cost = pd.to_numeric(responses["reported_cost"], errors="coerce")
    add("total_reported_cost", float(cost.sum()) if cost.notna().any() else "")

    for model_key in MODEL_KEYS:
        subset = valid[valid["model_key"] == model_key]
        add("valid_rows", len(subset), "model", model_key)
        retries = pd.to_numeric(
            responses.loc[responses["model_key"] == model_key, "attempt_count"], errors="coerce"
        ).fillna(0)
        add("retry_attempts", int((retries - 1).clip(lower=0).sum()), "model", model_key)

    for control_id, subset in valid.groupby("control_id"):
        add("valid_rows", len(subset), "control", control_id)
    for (control_id, model_key), subset in valid.groupby(["control_id", "model_key"]):
        add("valid_rows", len(subset), "control_model", f"{control_id}|{model_key}")

    for column in ("input_language", "response_language", "scenario_version"):
        for category, subset in responses.groupby(column):
            retries = pd.to_numeric(subset["attempt_count"], errors="coerce").fillna(0)
            add("retry_attempts", int((retries - 1).clip(lower=0).sum()), column, str(category))

    model_complete = all(
        len(valid[valid["model_key"] == model_key]) == 125 for model_key in MODEL_KEYS
    )
    control_complete = all(
        len(valid[valid["control_id"] == control_id]) == 75
        for control_id in sorted(valid["control_id"].unique())
    ) and valid["control_id"].nunique() == 5
    pairs_complete = (
        valid.groupby(["control_id", "model_key"]).size().eq(25).all()
        and valid.groupby(["control_id", "model_key"]).ngroups == 15
    )
    ratings_valid = (
        valid["parsed_rating"].apply(lambda value: float(value).is_integer()).all()
        if len(valid)
        else False
    )
    complete = bool(
        len(valid) == EXPECTED_TOTAL
        and responses["unique_key"].nunique() == EXPECTED_TOTAL
        and duplicate_count == 0
        and model_complete
        and control_complete
        and pairs_complete
        and ratings_valid
    )
    add("dataset_complete", str(complete).lower())
    return metrics, complete


def run_diagnostics(
    database: Path = DATABASE_PATH,
    clean_output: Path = CLEAN_CSV,
    diagnostics_output: Path = DIAGNOSTICS_CSV,
) -> bool:
    ensure_directories()
    if not database.exists():
        raise FileNotFoundError(f"Results database not found: {database}")
    store = ResultStore(database)
    responses = pd.DataFrame(store.rows(), columns=RAW_COLUMNS)
    attempts = pd.DataFrame(store.attempts())
    if responses.empty:
        raise RuntimeError("Results database contains no response rows")
    metrics, complete = diagnostic_rows(responses, attempts)
    valid = responses[
        responses["is_valid"].eq(1)
        & responses["parsed_rating"].between(1, 7, inclusive="both")
    ].drop_duplicates("unique_key", keep="last")
    valid.to_csv(clean_output, index=False, encoding="utf-8")
    pd.DataFrame(metrics).to_csv(diagnostics_output, index=False, encoding="utf-8")
    return complete


def main() -> int:
    configure_utf8_console()
    parser = argparse.ArgumentParser(description="Validate experiment completeness.")
    parser.add_argument("--database", type=Path, default=DATABASE_PATH)
    args = parser.parse_args()
    try:
        complete = run_diagnostics(args.database)
    except (FileNotFoundError, RuntimeError) as error:
        print(error, file=sys.stderr)
        return 1
    print(f"Diagnostics written to {DIAGNOSTICS_CSV}")
    if not complete:
        print("Dataset is incomplete; see diagnostics for missing or invalid work units.", file=sys.stderr)
        return 1
    print("Dataset is complete: 375 unique valid responses.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
