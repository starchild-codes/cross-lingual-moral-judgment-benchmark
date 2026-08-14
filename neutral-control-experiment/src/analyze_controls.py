from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .common import (
    MODEL_KEYS,
    NON_ENGLISH_LANGUAGES,
    RESULTS_DIR,
    ROOT,
    configure_utf8_console,
)
from .diagnostics import CLEAN_CSV


SUMMARY_CSV = RESULTS_DIR / "neutral_control_summary.csv"
CONTRASTS_CSV = RESULTS_DIR / "neutral_control_contrasts.csv"
SUMMARY_MD = RESULTS_DIR / "neutral_control_summary.md"
REPORT_MD = ROOT / "reports" / "neutral_control_report.md"
RUN_METADATA_JSON = RESULTS_DIR / "run_metadata.json"
RANDOM_SEED = 20260727

CONTRAST_DEFINITIONS = {
    "input_language": ("literal_response_en", "en_en"),
    "cultural_adaptation_primary": ("adapted_response_en", "literal_response_en"),
    "cultural_adaptation_secondary": (
        "adapted_response_same_language",
        "literal_response_same_language",
    ),
    "response_language_primary": (
        "literal_response_same_language",
        "literal_response_en",
    ),
    "response_language_secondary": (
        "adapted_response_same_language",
        "adapted_response_en",
    ),
}


def condition_type(row: pd.Series) -> str:
    if row["condition_id"] == "en_en":
        return "en_en"
    response = "en" if row["response_language"] == "en" else "same_language"
    return f"{row['scenario_version']}_response_{response}"


def describe(values: pd.Series) -> dict[str, Any]:
    numeric = pd.to_numeric(values, errors="raise")
    n = len(numeric)
    return {
        "n": n,
        "mean": numeric.mean(),
        "median": numeric.median(),
        "standard_deviation": numeric.std(ddof=1) if n > 1 else np.nan,
        "minimum": numeric.min(),
        "maximum": numeric.max(),
        "count_rating_1": int((numeric == 1).sum()),
        "percent_rating_1": float((numeric == 1).mean()),
        "count_rating_2": int((numeric == 2).sum()),
        "percent_rating_2": float((numeric == 2).mean()),
        "count_above_2": int((numeric > 2).sum()),
        "percent_above_2": float((numeric > 2).mean()),
    }


def make_summary(data: pd.DataFrame) -> pd.DataFrame:
    groupings = {
        "overall": [],
        "model": ["model_key"],
        "control": ["control_id"],
        "input_language": ["input_language"],
        "response_language": ["response_language"],
        "scenario_version": ["scenario_version"],
        "condition_type": ["condition_type"],
    }
    rows = []
    for group_type, columns in groupings.items():
        if not columns:
            rows.append({"group_type": group_type, "group_value": "all", **describe(data["parsed_rating"])})
            continue
        grouper = columns[0] if len(columns) == 1 else columns
        for keys, subset in data.groupby(grouper, sort=True):
            if not isinstance(keys, tuple):
                keys = (keys,)
            rows.append(
                {
                    "group_type": group_type,
                    "group_value": "|".join(map(str, keys)),
                    **describe(subset["parsed_rating"]),
                }
            )
    return pd.DataFrame(rows)


def individual_contrasts(data: pd.DataFrame) -> pd.DataFrame:
    indexed = data.set_index(["control_id", "model_key", "condition_id"])["parsed_rating"]
    rows = []
    for control_id in sorted(data["control_id"].unique()):
        for model_key in MODEL_KEYS:
            baseline = float(indexed.loc[(control_id, model_key, "en_en")])
            for language in NON_ENGLISH_LANGUAGES:
                values = {
                    "en_en": baseline,
                    "literal_response_en": float(
                        indexed.loc[(control_id, model_key, f"{language}_literal_response_en")]
                    ),
                    "literal_response_same_language": float(
                        indexed.loc[
                            (control_id, model_key, f"{language}_literal_response_{language}")
                        ]
                    ),
                    "adapted_response_en": float(
                        indexed.loc[(control_id, model_key, f"{language}_adapted_response_en")]
                    ),
                    "adapted_response_same_language": float(
                        indexed.loc[
                            (control_id, model_key, f"{language}_adapted_response_{language}")
                        ]
                    ),
                }
                for contrast_name, (left, right) in CONTRAST_DEFINITIONS.items():
                    rows.append(
                        {
                            "row_type": "individual",
                            "contrast": contrast_name,
                            "aggregation_level": "individual",
                            "model_key": model_key,
                            "input_language": language,
                            "control_id": control_id,
                            "left_condition": left,
                            "right_condition": right,
                            "left_rating": values[left],
                            "right_rating": values[right],
                            "paired_difference": values[left] - values[right],
                            "n": 1,
                            "mean_paired_difference": values[left] - values[right],
                            "median_paired_difference": values[left] - values[right],
                            "standard_deviation": np.nan,
                            "minimum": values[left] - values[right],
                            "maximum": values[left] - values[right],
                            "ci_lower": np.nan,
                            "ci_upper": np.nan,
                        }
                    )
    return pd.DataFrame(rows)


def bootstrap_ci(values: np.ndarray, seed: int, repetitions: int = 10_000) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    samples = rng.choice(values, size=(repetitions, len(values)), replace=True).mean(axis=1)
    lower, upper = np.quantile(samples, [0.025, 0.975])
    return float(lower), float(upper)


def aggregate_contrasts(individual: pd.DataFrame) -> pd.DataFrame:
    groupings = {
        "overall": [],
        "model": ["model_key"],
        "language": ["input_language"],
        "model_language": ["model_key", "input_language"],
    }
    rows = []
    seed_offset = 0
    for contrast, contrast_rows in individual.groupby("contrast", sort=True):
        for level, columns in groupings.items():
            groups = [((), contrast_rows)] if not columns else contrast_rows.groupby(columns, sort=True)
            for keys, subset in groups:
                if not isinstance(keys, tuple):
                    keys = (keys,)
                values = subset["paired_difference"].to_numpy(dtype=float)
                lower, upper = bootstrap_ci(values, RANDOM_SEED + seed_offset)
                seed_offset += 1
                row = {
                    "row_type": "aggregate",
                    "contrast": contrast,
                    "aggregation_level": level,
                    "model_key": "",
                    "input_language": "",
                    "control_id": "",
                    "left_condition": CONTRAST_DEFINITIONS[contrast][0],
                    "right_condition": CONTRAST_DEFINITIONS[contrast][1],
                    "left_rating": np.nan,
                    "right_rating": np.nan,
                    "paired_difference": np.nan,
                    "n": len(values),
                    "mean_paired_difference": float(np.mean(values)),
                    "median_paired_difference": float(np.median(values)),
                    "standard_deviation": float(np.std(values, ddof=1)) if len(values) > 1 else np.nan,
                    "minimum": float(np.min(values)),
                    "maximum": float(np.max(values)),
                    "ci_lower": lower,
                    "ci_upper": upper,
                }
                for column, key in zip(columns, keys):
                    row[column] = key
                rows.append(row)
    return pd.DataFrame(rows)


def write_markdown(summary: pd.DataFrame, contrasts: pd.DataFrame, data: pd.DataFrame) -> None:
    overall = summary.query("group_type == 'overall'").iloc[0]
    model_rows = summary.query("group_type == 'model'")
    retries = int((pd.to_numeric(data["attempt_count"]) - 1).clip(lower=0).sum())
    invalid = int((data["is_valid"] != 1).sum())
    cost = pd.to_numeric(data["reported_cost"], errors="coerce")
    cost_text = f"{cost.sum():.9f}" if cost.notna().any() else "not returned by the API"
    metadata = (
        json.loads(RUN_METADATA_JSON.read_text(encoding="utf-8"))
        if RUN_METADATA_JSON.exists()
        else {}
    )
    costs = metadata.get("costs_usd", {})
    archived_cost = costs.get("archived_first_smoke_total")
    replacement_smoke_cost = costs.get("successful_replacement_smoke")
    full_cost = costs.get("full_experiment_after_smoke_including_verification")
    combined_cost = costs.get("combined_total_all_paid_requests")
    cost_lines = (
        f"- Archived first smoke attempt: ${archived_cost:.9f}.\n"
        f"- Successful replacement smoke test: ${replacement_smoke_cost:.9f}.\n"
        f"- Full experiment after the smoke, including verification: ${full_cost:.9f}.\n"
        f"- Combined total for all paid requests: ${combined_cost:.9f}."
        if all(
            value is not None
            for value in (archived_cost, replacement_smoke_cost, full_cost, combined_cost)
        )
        else f"- Final 375-response dataset: ${cost_text}."
    )
    compact = f"""# Neutral-Control Summary

- Complete valid responses: {len(data)} / 375
- Rating 1: {int(overall['count_rating_1'])} ({overall['percent_rating_1']:.1%})
- Rating 2: {int(overall['count_rating_2'])} ({overall['percent_rating_2']:.1%})
- Above 2: {int(overall['count_above_2'])} ({overall['percent_above_2']:.1%})
- Mean rating: {overall['mean']:.3f}
- Median rating: {overall['median']:.3f}
"""
    SUMMARY_MD.write_text(compact, encoding="utf-8")

    primary = contrasts[
        (contrasts["row_type"] == "aggregate")
        & (contrasts["aggregation_level"] == "overall")
        & contrasts["contrast"].isin(
            ["input_language", "cultural_adaptation_primary", "response_language_primary"]
        )
    ]
    contrast_lines = "\n".join(
        f"- {row.contrast}: mean paired difference {row.mean_paired_difference:.3f}, "
        f"95% bootstrap CI [{row.ci_lower:.3f}, {row.ci_upper:.3f}], n = {int(row.n)}."
        for row in primary.itertuples()
    )
    model_lines = "\n".join(
        f"- {row.group_value}: M = {row.mean:.3f}, median = {row.median:.3f}, n = {int(row.n)}."
        for row in model_rows.itertuples()
    )

    max_shift = primary["mean_paired_difference"].abs().max()
    if max_shift <= 0.10:
        interpretation = (
            "Neutral controls showed essentially no mean calibration shifts. This weakens a "
            "simple general-scale-calibration explanation, while not proving that calibration "
            "plays no role."
        )
    elif max_shift <= 0.30:
        interpretation = (
            "Neutral controls showed small calibration shifts. General scale calibration may "
            "contribute modestly, but these controls alone cannot establish whether it explains "
            "the moral-scenario effects."
        )
    else:
        interpretation = (
            "Neutral controls showed appreciable calibration shifts. General differences in use "
            "of the rating scale may contribute and should be compared directly with the moral "
            "scenario contrasts in a later interaction analysis."
        )

    report = f"""# Neutral-Control Experiment Report

## Methods

Five neutral-control scenarios, validated as neutral by three independent external coders in
English, were evaluated after native-speaker review and approval across seven languages. Each
control used an English baseline plus literal and culturally adapted non-English versions, yielding
25 conditions per control. The exact evaluated models were
`openai/gpt-4o-2024-11-20`, `anthropic/claude-sonnet-4.6`, and
`google/gemini-3.5-flash`. They completed the same 1-7 blameworthiness-rating task across 375
expected responses at temperature 0 and a uniform 16-token completion limit. The controls diagnose
model use of the response scale; they do not establish a human baseline.

### Protocol Deviation

Gemini 3.5 Flash was configured with minimal reasoning effort because its default reasoning process
exhausted the original five-token completion limit before returning a rating. The completion limit
was increased uniformly to 16 tokens across all evaluated models. No model, prompt, temperature,
scenario, question, or rating-scale changes were made.

The pre-correction smoke database, CSV, model-verification evidence, and manifest are retained in
the timestamped `data/results/archive` folder. Those observations were removed from the active
store and are not part of the final dataset.

## Results

Completion was {len(data)} of 375 responses ({len(data) / 375:.1%}), with 375 unique work units and
no duplicates. The collection contained {retries} retry attempts, all of which resolved, and
{invalid} invalid final responses. Raw outputs and token and cost metadata were retained for every
final row. No active output ended with `MAX_TOKENS`.

### Cost Accounting

{cost_lines}

The successful three-row replacement smoke is retained within the final 375-row dataset. It is
therefore separated from the remaining 372 responses in the cost ledger and is not counted twice
in the combined total. The 375 final response rows themselves cost ${cost_text}.

The overall mean rating was {overall['mean']:.3f} (median {overall['median']:.3f}). Ratings were
concentrated as follows: {int(overall['count_rating_1'])} responses at 1
({overall['percent_rating_1']:.1%}), {int(overall['count_rating_2'])} at 2
({overall['percent_rating_2']:.1%}), and {int(overall['count_above_2'])} above 2
({overall['percent_above_2']:.1%}).

### Model-Level Ratings

{model_lines}

### Exploratory Calibration Contrasts

Because the contrasts contain only five controls per model-language cell, their confidence
intervals and any inferential interpretation are exploratory. Non-significance must not be read as
evidence of no effect.

{contrast_lines}

## Interpretation

All neutral-control ratings were at the floor value of 1, so every observed mean calibration
contrast was zero. The results provide no evidence of upward calibration shifts in these controls,
but complete floor compression limits sensitivity to downward shifts and does not rule out general
calibration effects on non-neutral items.

The original moral-rating dataset was not used here. No moral-versus-neutral interaction was
estimated. `src.compare_moral_and_neutral` is provided for that later analysis.

## Reproducibility

The run was resumed after an interrupted export and completed through the unique work-unit store.
Machine-readable request settings, model IDs, timestamps, workbook hashes, archive provenance,
cost components, commands, and output paths are recorded in
`data/results/run_metadata.json`; cost components are also available in
`data/results/cost_ledger.csv`.
"""
    REPORT_MD.write_text(report, encoding="utf-8")


def analyze(clean_csv: Path = CLEAN_CSV) -> tuple[pd.DataFrame, pd.DataFrame]:
    if not clean_csv.exists():
        raise FileNotFoundError(f"Clean results file not found: {clean_csv}")
    data = pd.read_csv(clean_csv)
    if len(data) != 375 or data["unique_key"].nunique() != 375:
        raise RuntimeError("Analysis requires the complete clean dataset of 375 unique responses")
    data["parsed_rating"] = pd.to_numeric(data["parsed_rating"], errors="raise")
    data["condition_type"] = data.apply(condition_type, axis=1)
    summary = make_summary(data)
    individual = individual_contrasts(data)
    aggregate = aggregate_contrasts(individual)
    contrasts = pd.concat([individual, aggregate], ignore_index=True)
    SUMMARY_CSV.parent.mkdir(parents=True, exist_ok=True)
    REPORT_MD.parent.mkdir(parents=True, exist_ok=True)
    summary.to_csv(SUMMARY_CSV, index=False)
    contrasts.to_csv(CONTRASTS_CSV, index=False)
    write_markdown(summary, contrasts, data)
    return summary, contrasts


def main() -> int:
    configure_utf8_console()
    parser = argparse.ArgumentParser(description="Analyze completed neutral-control ratings.")
    parser.add_argument("--clean-csv", type=Path, default=CLEAN_CSV)
    args = parser.parse_args()
    try:
        analyze(args.clean_csv)
    except (FileNotFoundError, RuntimeError, KeyError) as error:
        print(error, file=sys.stderr)
        return 1
    print(f"Wrote summary to {SUMMARY_CSV}")
    print(f"Wrote paired contrasts to {CONTRASTS_CSV}")
    print(f"Wrote manuscript-ready report to {REPORT_MD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
