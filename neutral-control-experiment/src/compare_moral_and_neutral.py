from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

from .analyze_controls import condition_type
from .common import RESULTS_DIR, configure_utf8_console
from .diagnostics import CLEAN_CSV


REQUIRED_MORAL_COLUMNS = [
    "item_id",
    "model_key",
    "condition_id",
    "input_language",
    "scenario_version",
    "response_language",
    "rating",
]


def compare(moral_csv: Path, neutral_csv: Path, output: Path) -> pd.DataFrame:
    moral = pd.read_csv(moral_csv)
    missing = [column for column in REQUIRED_MORAL_COLUMNS if column not in moral.columns]
    if missing:
        raise ValueError(f"Moral-results CSV is missing columns: {missing}")
    neutral = pd.read_csv(neutral_csv)
    moral["dataset"] = "moral"
    neutral = neutral.rename(columns={"control_id": "item_id", "parsed_rating": "rating"})
    neutral["dataset"] = "neutral"
    common = REQUIRED_MORAL_COLUMNS + ["dataset"]
    combined = pd.concat([moral[common], neutral[common]], ignore_index=True)
    combined["rating"] = pd.to_numeric(combined["rating"], errors="raise")
    combined["condition_type"] = combined.apply(condition_type, axis=1)
    summary = (
        combined.groupby(["dataset", "model_key", "condition_type"], as_index=False)["rating"]
        .agg(n="count", mean="mean", median="median", standard_deviation="std")
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    summary.to_csv(output, index=False)
    return summary


def main() -> int:
    configure_utf8_console()
    parser = argparse.ArgumentParser(
        description="Prepare descriptive moral-versus-neutral comparisons."
    )
    parser.add_argument("--moral-csv", type=Path, required=True)
    parser.add_argument("--neutral-csv", type=Path, default=CLEAN_CSV)
    parser.add_argument(
        "--output",
        type=Path,
        default=RESULTS_DIR / "moral_neutral_comparison.csv",
    )
    args = parser.parse_args()
    try:
        result = compare(args.moral_csv, args.neutral_csv, args.output)
    except (FileNotFoundError, ValueError, KeyError) as error:
        print(error, file=sys.stderr)
        return 1
    print(f"Wrote {len(result)} descriptive comparison rows to {args.output}")
    print("No moral-versus-neutral interaction was inferred automatically.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
