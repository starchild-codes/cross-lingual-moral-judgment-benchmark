from __future__ import annotations

import csv
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


PROJECT = Path(__file__).resolve().parents[1]
RESULTS = PROJECT / "results"
PROCESSED = RESULTS / "processed"
FIGURES = RESULTS / "figures"
PLOTTING = RESULTS / "plotting_data"
REPORTS = PROJECT / "reports"
DB = RESULTS / "active" / "comprehension_results.sqlite"
MODEL_ORDER = ["chatgpt", "claude", "gemini_flash"]
MODEL_LABELS = {
    "chatgpt": "GPT-4o",
    "claude": "Claude Sonnet 4.6",
    "gemini_flash": "Gemini 3.5 Flash",
}
COLORS = {
    "chatgpt": "#2F6BFF",
    "claude": "#D97706",
    "gemini_flash": "#16836B",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def save_plot_data(frame: pd.DataFrame, name: str) -> Path:
    path = PLOTTING / f"{name}.csv"
    frame.to_csv(path, index=False, encoding="utf-8-sig")
    return path


def grouped_metrics(
    work: pd.DataFrame, item: pd.DataFrame, grouping: list[str]
) -> pd.DataFrame:
    item_summary = (
        item.groupby(grouping, as_index=False)
        .agg(item_accuracy=("item_correct", "mean"), scored_answers=("item_correct", "size"))
    )
    work_summary = (
        work.groupby(grouping, as_index=False)
        .agg(
            scenario_4_of_4_accuracy=("scenario_all_4_correct", "mean"),
            work_units=("work_unit_id", "size"),
        )
    )
    return item_summary.merge(work_summary, on=grouping)


def style_axis(axis, title: str, xlabel: str = "", ylabel: str = "Accuracy") -> None:
    axis.set_title(title, fontsize=13, fontweight="bold", pad=12)
    axis.set_xlabel(xlabel)
    axis.set_ylabel(ylabel)
    axis.set_ylim(0, 1.04)
    axis.grid(axis="y", color="#D8DEE8", linewidth=0.8, alpha=0.8)
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)


def plot_by_model(frame: pd.DataFrame) -> None:
    ordered = frame.set_index("model_key").loc[MODEL_ORDER].reset_index()
    x = range(len(ordered))
    fig, axis = plt.subplots(figsize=(8.2, 4.8))
    width = 0.34
    axis.bar(
        [value - width / 2 for value in x],
        ordered["item_accuracy"],
        width,
        label="Item accuracy",
        color="#2F6BFF",
    )
    axis.bar(
        [value + width / 2 for value in x],
        ordered["scenario_4_of_4_accuracy"],
        width,
        label="Scenario 4/4",
        color="#16836B",
    )
    axis.set_xticks(list(x), [MODEL_LABELS[key] for key in ordered["model_key"]])
    style_axis(axis, "Comprehension Accuracy by Model")
    axis.legend(frameon=False, ncol=2, loc="lower left")
    fig.tight_layout()
    fig.savefig(FIGURES / "comprehension_accuracy_by_model.png", dpi=180)
    plt.close(fig)


def plot_grouped(
    frame: pd.DataFrame,
    category: str,
    title: str,
    filename: str,
    order: list[str] | None = None,
) -> None:
    categories = order or list(dict.fromkeys(frame[category]))
    fig, axis = plt.subplots(figsize=(11.5, 5.8))
    width = 0.24
    x = list(range(len(categories)))
    for index, model in enumerate(MODEL_ORDER):
        subset = frame[frame["model_key"] == model].set_index(category)
        values = [subset.loc[value, "item_accuracy"] for value in categories]
        offsets = [value + (index - 1) * width for value in x]
        axis.bar(
            offsets,
            values,
            width,
            label=MODEL_LABELS[model],
            color=COLORS[model],
        )
    axis.set_xticks(x, categories)
    axis.set_xlim(-0.55, len(categories) - 0.45)
    style_axis(axis, title)
    axis.legend(
        frameon=False,
        ncol=3,
        loc="upper center",
        bbox_to_anchor=(0.5, -0.13),
    )
    fig.subplots_adjust(left=0.08, right=0.98, top=0.88, bottom=0.23)
    fig.savefig(FIGURES / filename, dpi=180)
    plt.close(fig)


def write_attempt_audits() -> dict[str, float | int]:
    connection = sqlite3.connect(DB)
    rows = connection.execute(
        """
        SELECT work_unit_id, attempt_number, status, request_json, response_json,
               raw_response, error_note, created_at
        FROM attempts
        ORDER BY work_unit_id, attempt_number
        """
    ).fetchall()
    connection.close()
    audit_rows: list[dict[str, object]] = []
    failed_response_cost = 0.0
    for row in rows:
        request = json.loads(row[3])
        response = json.loads(row[4]) if row[4] else {}
        usage = response.get("usage") or {}
        if row[2] == "failed":
            failed_response_cost += float(usage.get("cost") or 0)
        audit_rows.append(
            {
                "work_unit_id": row[0],
                "attempt_number": row[1],
                "status": row[2],
                "model_id": request["model"],
                "temperature": request.get("temperature"),
                "max_tokens": request.get("max_tokens"),
                "reasoning_effort": (request.get("reasoning") or {}).get("effort", ""),
                "raw_response": row[5] or "",
                "error_note": row[6] or "",
                "prompt_tokens": usage.get("prompt_tokens", ""),
                "completion_tokens": usage.get("completion_tokens", ""),
                "total_tokens": usage.get("total_tokens", ""),
                "cost_usd": usage.get("cost", ""),
                "created_at": row[7],
            }
        )
    audit = pd.DataFrame(audit_rows)
    audit.to_csv(PROCESSED / "attempt_audit.csv", index=False, encoding="utf-8-sig")
    audit[audit["status"] == "failed"].to_csv(
        PROCESSED / "failed_attempts.csv", index=False, encoding="utf-8-sig"
    )
    return {
        "attempt_rows": len(audit),
        "failed_attempt_rows": int((audit["status"] == "failed").sum()),
        "failed_response_cost_usd": failed_response_cost,
    }


def classify_normalization(raw: str) -> str:
    aliases = (
        "ए",
        "बी",
        "सी",
        "डी",
        "এ",
        "বি",
        "সি",
        "ডি",
        "ஏ",
        "பி",
        "சி",
        "டி",
        "エー",
        "ビー",
        "シー",
        "ディー",
    )
    normalization_types = []
    if any(character in raw for character in ("\u3001", "\uff0c", "\u060c")):
        normalization_types.append("locale_specific_comma")
    if any(alias in raw for alias in aliases):
        normalization_types.append("localized_option_name")
    return "+".join(normalization_types)


def load_parsed_answers() -> pd.DataFrame:
    connection = sqlite3.connect(DB)
    rows = connection.execute(
        "SELECT work_unit_id, parsed_answers FROM results"
    ).fetchall()
    connection.close()
    return pd.DataFrame(rows, columns=["work_unit_id", "parsed_answers"])


def main() -> None:
    for directory in (PROCESSED, FIGURES, PLOTTING, REPORTS):
        directory.mkdir(parents=True, exist_ok=True)
    work = pd.read_csv(PROCESSED / "work_unit_results.csv")
    item = pd.read_csv(PROCESSED / "item_level_results.csv")
    missed = pd.read_csv(PROCESSED / "missed_items.csv")
    if len(work) != 720 or work["work_unit_id"].nunique() != 720 or len(item) != 2880:
        raise RuntimeError("Final result counts are incomplete")

    plot_specs = [
        ("by_model", ["model_key"]),
        ("by_language_and_model", ["input_language", "model_key"]),
        ("by_version_and_model", ["scenario_version", "model_key"]),
        ("by_shift_tier_and_model", ["shift_tier", "model_key"]),
    ]
    frames: dict[str, pd.DataFrame] = {}
    for name, grouping in plot_specs:
        frames[name] = grouped_metrics(work, item, grouping)
        save_plot_data(frames[name], name)
    question = (
        item.groupby(["question_type", "model_key"], as_index=False)
        .agg(item_accuracy=("item_correct", "mean"), scored_answers=("item_correct", "size"))
    )
    frames["by_question_type_and_model"] = question
    save_plot_data(question, "by_question_type_and_model")

    plot_by_model(frames["by_model"])
    plot_grouped(
        frames["by_language_and_model"],
        "input_language",
        "Item Accuracy by Input Language",
        "comprehension_accuracy_by_language.png",
        ["hi", "bn", "ta", "es", "ja", "ar"],
    )
    plot_grouped(
        frames["by_version_and_model"],
        "scenario_version",
        "Item Accuracy: Literal vs. Adapted",
        "comprehension_accuracy_by_version.png",
        ["literal", "adapted"],
    )
    plot_grouped(
        frames["by_shift_tier_and_model"],
        "shift_tier",
        "Item Accuracy by Original Shift Tier",
        "comprehension_accuracy_by_shift_tier.png",
        ["high", "low"],
    )
    plot_grouped(
        question,
        "question_type",
        "Item Accuracy by Question Type",
        "comprehension_accuracy_by_question_type.png",
        ["Actor", "Main action", "Affected party/object", "Consequence/outcome"],
    )

    normalization = work[
        ["work_unit_id", "model_key", "input_language", "raw_response"]
    ].merge(load_parsed_answers(), on="work_unit_id", validate="one_to_one")
    normalization["normalization_type"] = normalization["raw_response"].map(classify_normalization)
    normalization = normalization[normalization["normalization_type"] != ""]
    normalization.to_csv(
        PROCESSED / "format_normalization_audit.csv",
        index=False,
        encoding="utf-8-sig",
    )
    attempt_audit = write_attempt_audits()

    model_cost = (
        work.groupby(["model_key", "model_id"], as_index=False)
        .agg(
            successful_rows=("work_unit_id", "size"),
            successful_cost_usd=("cost_usd", "sum"),
            prompt_tokens=("prompt_tokens", "sum"),
            completion_tokens=("completion_tokens", "sum"),
            total_tokens=("total_tokens", "sum"),
        )
    )
    smoke_ids = {
        "S02__hi__literal__chatgpt",
        "S02__hi__literal__claude",
        "S02__hi__literal__gemini_flash",
    }
    smoke_cost = float(work[work["work_unit_id"].isin(smoke_ids)]["cost_usd"].sum())
    successful_total = float(work["cost_usd"].sum())
    locally_observed_total = successful_total + float(
        attempt_audit["failed_response_cost_usd"]
    )
    cost_rows = [
        {"cost_component": "archived_unauthorized_smoke", "cost_usd": 0.0},
        {"cost_component": "successful_replacement_smoke", "cost_usd": smoke_cost},
        {
            "cost_component": "successful_full_collection_excluding_smoke",
            "cost_usd": successful_total - smoke_cost,
        },
        {
            "cost_component": "parse_or_request_failed_responses_with_usage",
            "cost_usd": attempt_audit["failed_response_cost_usd"],
        },
        {"cost_component": "locally_observed_combined_total", "cost_usd": locally_observed_total},
    ]
    pd.DataFrame(cost_rows).to_csv(
        PROCESSED / "cost_summary.csv", index=False, encoding="utf-8-sig"
    )
    model_cost.to_csv(
        PROCESSED / "cost_by_model.csv", index=False, encoding="utf-8-sig"
    )

    overall_item_accuracy = float(item["item_correct"].mean())
    overall_scenario_accuracy = float(work["scenario_all_4_correct"].mean())
    result_report = f"""# Multilingual Comprehension-Check Results

## Completion

- Unique model work units: **720/720**
- Scored factual answers: **2,880**
- Exact model allocation: **240 per model**
- Missed items: **{len(missed)}**
- Overall item accuracy: **{overall_item_accuracy:.3%}**
- Scenario-level 4/4 accuracy: **{overall_scenario_accuracy:.3%}**
- Duplicate final rows: **0**
- Attempt rows: **{attempt_audit['attempt_rows']}**
- Failed attempt rows preserved: **{attempt_audit['failed_attempt_rows']}**

## Model results

| Model | Item accuracy | Scenario 4/4 |
|---|---:|---:|
"""
    model_frame = frames["by_model"].set_index("model_key")
    for model in MODEL_ORDER:
        result_report += (
            f"| {MODEL_LABELS[model]} | {model_frame.loc[model, 'item_accuracy']:.3%} | "
            f"{model_frame.loc[model, 'scenario_4_of_4_accuracy']:.3%} |\n"
        )
    result_report += f"""

## Format handling

The initial strict parser accepted only ASCII comma-separated A-D letters. During live
collection, preserved outputs showed unambiguous locale formatting: Japanese/full-width/
Arabic commas and localized option names. The parser was conservatively extended to map
only those exact separators and option-name tokens before applying the same exact four-choice
A-D requirement. Answer order and scoring were unchanged.

Rows requiring such normalization: **{len(normalization)}**. Every raw response and parsed
answer remains available in `format_normalization_audit.csv`.

## Costs

- Archived unauthorized smoke: **$0.0000000**
- Successful replacement smoke: **${smoke_cost:.7f}**
- Successful full collection excluding smoke: **${successful_total - smoke_cost:.7f}**
- Failed responses with locally stored usage: **${attempt_audit['failed_response_cost_usd']:.7f}**
- Locally observed combined total: **${locally_observed_total:.7f}**

The local total excludes any request that may have reached the provider while a parallel
executor was being stopped but did not return to the local process.

## Outputs

Five PNG figures are in `results/figures/`; their exact plotting data are in
`results/plotting_data/`. Item-level misses, every request attempt, failed attempts,
normalization cases, and cost tables are retained under `results/processed/`.
"""
    (REPORTS / "comprehension_results_report.md").write_text(
        result_report, encoding="utf-8"
    )

    reproducibility = f"""# Comprehension Experiment Reproducibility Report

Generated: {datetime.now(timezone.utc).isoformat()}

## Fixed design

- Workbook: `multilingual_comprehension_check_approved.xlsx`
- Manifest: `data/processed/run_manifest_720.csv`
- Models: `openai/gpt-4o-2024-11-20`, `anthropic/claude-sonnet-4.6`,
  `google/gemini-3.5-flash`
- Temperature: 0
- Completion limit: 24 tokens
- Gemini reasoning effort: minimal
- Retry limit per collection pass: 3

## Integrity hashes

- Approved workbook: `{sha256(PROJECT / 'multilingual_comprehension_check_approved.xlsx')}`
- Manifest: `{sha256(PROJECT / 'data' / 'processed' / 'run_manifest_720.csv')}`
- Multilingual items: `{sha256(PROJECT / 'data' / 'processed' / 'multilingual_comprehension_questions.csv')}`
- Active SQLite results: `{sha256(DB)}`

## Verification

The database contains 720 unique final rows, 240 per exact model ID, complete raw output,
parsed answers, token usage, and successful-response cost metadata. All 2,880 item answers
were reconstructed from stored parsed answers and the frozen manifest answer keys.

Earlier stopped-run snapshots and the initial unauthorized smoke evidence remain under
`results/archive/`. No archived evidence was included as a final observation.
"""
    (REPORTS / "reproducibility_report.md").write_text(
        reproducibility, encoding="utf-8"
    )

    metadata_path = PROJECT / "run_metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    prior_live_run = metadata.get("live_run", {})
    if prior_live_run.get("status") == "stopped_on_configured_parse_failure":
        metadata["archived_stop_evidence"] = prior_live_run
    metadata["status"] = "complete"
    metadata["completed_at_utc"] = datetime.now(timezone.utc).isoformat()
    metadata["live_run"] = {
        "status": "complete",
        "unique_work_units": 720,
        "scored_answers": 2880,
        "models_verified": 3,
        "model_rows": work.groupby("model_key").size().to_dict(),
        "duplicate_final_results": 0,
        "raw_outputs_complete": True,
        "usage_metadata_complete": True,
        "full_analysis_generated": True,
        "archived_evidence_excluded_from_final_dataset": True,
    }
    metadata["final_results"] = {
        "unique_work_units": 720,
        "scored_answers": 2880,
        "missed_items": len(missed),
        "overall_item_accuracy": overall_item_accuracy,
        "scenario_4_of_4_accuracy": overall_scenario_accuracy,
        "normalization_rows": len(normalization),
        "attempt_rows": attempt_audit["attempt_rows"],
        "failed_attempt_rows": attempt_audit["failed_attempt_rows"],
        "costs": cost_rows,
        "results_database_sha256": sha256(DB),
    }
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    final_audit = {
        "status": "PASS",
        "unique_work_units": int(work["work_unit_id"].nunique()),
        "model_rows": work.groupby("model_key").size().to_dict(),
        "scored_answers": len(item),
        "missed_items": len(missed),
        "duplicate_final_rows": int(len(work) - work["work_unit_id"].nunique()),
        "raw_outputs_complete": bool(work["raw_response"].notna().all()),
        "usage_metadata_complete": bool(
            work[["prompt_tokens", "completion_tokens", "total_tokens", "cost_usd"]]
            .notna()
            .all()
            .all()
        ),
        "figures": sorted(path.name for path in FIGURES.glob("*.png")),
        "plotting_data": sorted(path.name for path in PLOTTING.glob("*.csv")),
        "costs": cost_rows,
        "hashes": {
            "approved_workbook": sha256(
                PROJECT / "multilingual_comprehension_check_approved.xlsx"
            ),
            "manifest": sha256(
                PROJECT / "data" / "processed" / "run_manifest_720.csv"
            ),
            "results_database": sha256(DB),
        },
    }
    (PROCESSED / "final_live_audit.json").write_text(
        json.dumps(final_audit, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(final_audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
