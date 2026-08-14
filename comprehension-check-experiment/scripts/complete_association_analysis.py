from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import statsmodels.formula.api as smf
from scipy.stats import mannwhitneyu, spearmanr


PROJECT = Path(__file__).resolve().parents[1]
REPO = PROJECT.parent
PROCESSED = PROJECT / "results" / "processed"
PLOTTING = PROJECT / "results" / "plotting_data"
FIGURES = PROJECT / "results" / "figures"
REPORTS = PROJECT / "reports"
DB = PROJECT / "results" / "active" / "comprehension_results.sqlite"
BOOTSTRAP_REPS = 10_000
BOOTSTRAP_SEED = 20260727
MODELS = {
    "chatgpt": "openai/gpt-4o-2024-11-20",
    "claude": "anthropic/claude-sonnet-4.6",
    "gemini_flash": "google/gemini-3.5-flash",
}
MODEL_LABELS = {
    "chatgpt": "GPT-4o",
    "claude": "Claude Sonnet 4.6",
    "gemini_flash": "Gemini 3.5 Flash",
}
MODEL_ORDER = list(MODELS)
COLORS = {
    "chatgpt": "#356AF5",
    "claude": "#DF7900",
    "gemini_flash": "#1C8872",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def markdown_table(frame: pd.DataFrame) -> str:
    display = frame.copy()
    headers = [str(column) for column in display.columns]
    rows = [headers] + [
        ["" if pd.isna(value) else str(value) for value in row]
        for row in display.itertuples(index=False, name=None)
    ]
    widths = [max(len(row[index]) for row in rows) for index in range(len(headers))]
    lines = [
        "| " + " | ".join(value.ljust(widths[index]) for index, value in enumerate(rows[0])) + " |",
        "| " + " | ".join("-" * widths[index] for index in range(len(headers))) + " |",
    ]
    lines.extend(
        "| " + " | ".join(value.ljust(widths[index]) for index, value in enumerate(row)) + " |"
        for row in rows[1:]
    )
    return "\n".join(lines)


def format_accuracy_table(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    result["accuracy"] = result["accuracy"].map(lambda value: f"{value:.3%}")
    result["4_of_4_proportion"] = result["4_of_4_proportion"].map(
        lambda value: f"{value:.3%}"
    )
    return result


def audit_inputs() -> tuple[pd.DataFrame, pd.DataFrame, dict[str, object]]:
    work = pd.read_csv(PROCESSED / "work_unit_results.csv")
    item = pd.read_csv(PROCESSED / "item_level_results.csv")
    normalization = pd.read_csv(PROCESSED / "format_normalization_audit.csv")
    if (
        len(work) != 720
        or work["work_unit_id"].nunique() != 720
        or len(item) != 2880
        or int((item["item_correct"] == 0).sum()) != 105
        or not np.isclose(item["item_correct"].mean(), 0.9635416666666666)
        or not np.isclose(work["scenario_all_4_correct"].mean(), 0.8611111111111112)
    ):
        raise RuntimeError("Comprehension result audit failed")

    from comprehension_check.parsing import LOCALIZED_OPTION_ALIASES, parse_answers

    separators = ("、", "，", "،")
    trace_rows = []
    for row in normalization.itertuples(index=False):
        raw = str(row.raw_response)
        parsed = str(row.parsed_answers)
        if ",".join(parse_answers(raw)) != parsed:
            raise RuntimeError(f"Normalization cannot be reproduced for {row.work_unit_id}")
        normalized_separators = raw
        for separator in separators:
            normalized_separators = normalized_separators.replace(separator, ",")
        tokens = [token.strip() for token in normalized_separators.split(",")]
        if len(tokens) != 4:
            raise RuntimeError(f"Normalization inferred answer count for {row.work_unit_id}")
        if not all(token.upper() in set("ABCD") or token in LOCALIZED_OPTION_ALIASES for token in tokens):
            raise RuntimeError(f"Ambiguous free text found in {row.work_unit_id}")
        mapped = [LOCALIZED_OPTION_ALIASES.get(token, token).upper() for token in tokens]
        if ",".join(mapped) != parsed:
            raise RuntimeError(f"Response order changed for {row.work_unit_id}")
        trace_rows.append(
            {
                "work_unit_id": row.work_unit_id,
                "raw_response": raw,
                "parsed_answers": parsed,
                "normalization_type": row.normalization_type,
                "exactly_four_recognized_tokens": True,
                "response_order_preserved": True,
                "answer_content_inferred": False,
                "ambiguous_free_text_converted": False,
            }
        )
    trace = pd.DataFrame(trace_rows)
    if len(trace) != 150 or trace["work_unit_id"].nunique() != 150:
        raise RuntimeError("Expected exactly 150 traceable normalized outputs")
    trace.to_csv(
        PROCESSED / "normalization_integrity_audit.csv",
        index=False,
        encoding="utf-8-sig",
    )
    audit = {
        "unique_work_units": int(work["work_unit_id"].nunique()),
        "item_level_responses": len(item),
        "incorrect_items": int((item["item_correct"] == 0).sum()),
        "overall_accuracy": float(item["item_correct"].mean()),
        "work_unit_4_of_4_rate": float(work["scenario_all_4_correct"].mean()),
        "normalized_outputs": len(trace),
        "normalization_reproducible": True,
        "response_order_preserved": True,
        "answer_content_inferred": False,
        "ambiguous_free_text_converted": False,
        "raw_output_trace_complete": True,
    }
    return work, item, audit


def build_rating_merge(work: pd.DataFrame) -> pd.DataFrame:
    rating_paths = [
        REPO / "results" / "processed" / "full_1782215308316_vrq93w.ratings.csv",
        REPO / "results" / "processed" / "extension_full_1782729062659_xqetbf.ratings.csv",
    ]
    ratings = pd.concat([pd.read_csv(path) for path in rating_paths], ignore_index=True)
    ratings = ratings[
        (ratings["status"] == "succeeded")
        & ratings["parsedRating"].notna()
        & ratings["modelString"].isin(MODELS.values())
    ].copy()
    if ratings.duplicated(["scenarioId", "modelString", "conditionId"]).any():
        raise RuntimeError("Duplicate authorized rating observations found")
    lookup = ratings.set_index(["scenarioId", "modelString", "conditionId"])[
        "parsedRating"
    ].to_dict()
    merge_rows = []
    for row in work.itertuples(index=False):
        if row.model_id != MODELS[row.model_key]:
            raise RuntimeError(f"Unexpected model ID in {row.work_unit_id}")
        baseline_key = (row.scenario_id, row.model_id, "en_en")
        suffix = (
            f"{row.input_language}_translation_reason_en"
            if row.scenario_version == "literal"
            else f"{row.input_language}_adapted_reason_en"
        )
        condition_key = (row.scenario_id, row.model_id, suffix)
        if baseline_key not in lookup or condition_key not in lookup:
            raise RuntimeError(f"Missing rating match for {row.work_unit_id}")
        baseline = float(lookup[baseline_key])
        condition = float(lookup[condition_key])
        merge_rows.append(
            {
                "work_unit_id": row.work_unit_id,
                "rating_condition_id": suffix,
                "english_baseline_rating": baseline,
                "matched_condition_rating": condition,
                "absolute_rating_shift": abs(condition - baseline),
            }
        )
    shifts = pd.DataFrame(merge_rows)
    if len(shifts) != 720 or shifts["work_unit_id"].nunique() != 720:
        raise RuntimeError("Rating-shift merge is not one-to-one")
    merged = work.merge(shifts, on="work_unit_id", validate="one_to_one")
    if len(merged) != 720 or merged["absolute_rating_shift"].isna().any():
        raise RuntimeError("Not every work unit received one rating shift")
    merged["comprehension_proportion"] = merged["correct_count_0_4"] / 4
    merged["any_comprehension_error"] = 1 - merged["scenario_all_4_correct"]
    merged["shift_tier_manuscript"] = merged["shift_tier"].map(
        {"high": "Higher-shift", "low": "Lower-shift"}
    )
    merged.to_csv(
        PROCESSED / "work_unit_results_with_rating_shift.csv",
        index=False,
        encoding="utf-8-sig",
    )
    return merged


def cluster_bootstrap(
    frame: pd.DataFrame,
    statistic,
    repetitions: int = BOOTSTRAP_REPS,
    seed: int = BOOTSTRAP_SEED,
) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    scenario_ids = frame["scenario_id"].to_numpy()
    clusters = np.array(sorted(frame["scenario_id"].unique()))
    grouped_indices = [
        np.flatnonzero(scenario_ids == cluster) for cluster in clusters
    ]
    estimates = np.empty(repetitions)
    for index in range(repetitions):
        sampled = rng.integers(0, len(clusters), size=len(clusters))
        row_indices = np.concatenate(
            [grouped_indices[cluster_index] for cluster_index in sampled]
        )
        estimates[index] = statistic(row_indices)
    return tuple(np.quantile(estimates, [0.025, 0.975]))


def regression_table(result, model_name: str) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "model": model_name,
            "term": result.params.index,
            "coefficient": result.params.values,
            "clustered_se": result.bse.values,
            "ci_lower_95": result.conf_int()[0].values,
            "ci_upper_95": result.conf_int()[1].values,
            "p_value": result.pvalues.values,
            "n": int(result.nobs),
            "scenario_clusters": 20,
            "r_squared": result.rsquared,
        }
    )


def association_analyses(merged: pd.DataFrame) -> tuple[dict[str, object], pd.DataFrame]:
    rho, rho_p = spearmanr(
        merged["correct_count_0_4"], merged["absolute_rating_shift"]
    )
    scores = merged["correct_count_0_4"].to_numpy()
    shifts = merged["absolute_rating_shift"].to_numpy()
    all_correct = merged["scenario_all_4_correct"].to_numpy(dtype=bool)
    rho_ci = cluster_bootstrap(
        merged,
        lambda indices: spearmanr(scores[indices], shifts[indices]).statistic,
    )
    proportion_rho, proportion_p = spearmanr(
        merged["comprehension_proportion"], merged["absolute_rating_shift"]
    )
    full = merged[merged["scenario_all_4_correct"] == 1]["absolute_rating_shift"]
    errors = merged[merged["scenario_all_4_correct"] == 0]["absolute_rating_shift"]
    u_test = mannwhitneyu(full, errors, alternative="two-sided", method="asymptotic")

    def error_minus_full(indices: np.ndarray | None = None) -> float:
        selected_shifts = shifts if indices is None else shifts[indices]
        selected_all_correct = all_correct if indices is None else all_correct[indices]
        return float(
            selected_shifts[~selected_all_correct].mean()
            - selected_shifts[selected_all_correct].mean()
        )

    mean_difference = error_minus_full()
    mean_difference_ci = cluster_bootstrap(merged, error_minus_full, seed=BOOTSTRAP_SEED + 1)
    groups = {}
    for label, values in (("4_of_4", full), ("less_than_4_of_4", errors)):
        groups[label] = {
            "n": len(values),
            "mean": float(values.mean()),
            "median": float(values.median()),
            "standard_deviation": float(values.std(ddof=1)),
            "interquartile_range": float(values.quantile(0.75) - values.quantile(0.25)),
        }

    primary = smf.ols(
        "absolute_rating_shift ~ correct_count_0_4", data=merged
    ).fit(
        cov_type="cluster",
        cov_kwds={"groups": merged["scenario_id"], "use_correction": True},
        use_t=True,
    )
    sensitivity = smf.ols(
        "absolute_rating_shift ~ any_comprehension_error", data=merged
    ).fit(
        cov_type="cluster",
        cov_kwds={"groups": merged["scenario_id"], "use_correction": True},
        use_t=True,
    )
    adjusted = smf.ols(
        "absolute_rating_shift ~ correct_count_0_4 + C(model_key) + "
        "C(input_language) + C(scenario_version) + C(shift_tier_manuscript)",
        data=merged,
    ).fit(
        cov_type="cluster",
        cov_kwds={"groups": merged["scenario_id"], "use_correction": True},
        use_t=True,
    )
    regressions = pd.concat(
        [
            regression_table(primary, "primary_comprehension_score"),
            regression_table(sensitivity, "sensitivity_any_error"),
            regression_table(adjusted, "adjusted_diagnostic"),
        ],
        ignore_index=True,
    )
    regressions.to_csv(
        PROCESSED / "comprehension_shift_regressions.csv",
        index=False,
        encoding="utf-8-sig",
    )
    results = {
        "spearman": {
            "rho": float(rho),
            "two_sided_p_value": float(rho_p),
            "n": len(merged),
            "scenario_cluster_bootstrap_ci_95": list(rho_ci),
            "bootstrap_repetitions": BOOTSTRAP_REPS,
            "proportion_rho": float(proportion_rho),
            "proportion_two_sided_p_value": float(proportion_p),
            "rescaling_identical": bool(
                np.isclose(rho, proportion_rho) and np.isclose(rho_p, proportion_p)
            ),
        },
        "group_comparison": {
            "groups": groups,
            "mann_whitney_u": float(u_test.statistic),
            "mann_whitney_two_sided_p_value": float(u_test.pvalue),
            "mean_difference_error_minus_full": mean_difference,
            "scenario_cluster_bootstrap_ci_95": list(mean_difference_ci),
            "bootstrap_repetitions": BOOTSTRAP_REPS,
        },
        "primary_regression": regressions[
            regressions["model"] == "primary_comprehension_score"
        ].to_dict("records"),
        "sensitivity_regression": regressions[
            regressions["model"] == "sensitivity_any_error"
        ].to_dict("records"),
        "adjusted_diagnostic_regression": regressions[
            regressions["model"] == "adjusted_diagnostic"
        ].to_dict("records"),
    }
    return results, regressions


def summarize_accuracy(
    work: pd.DataFrame, item: pd.DataFrame, columns: list[str]
) -> pd.DataFrame:
    item_summary = (
        item.groupby(columns, as_index=False)
        .agg(correct_items=("item_correct", "sum"), total_items=("item_correct", "size"))
    )
    work_columns = [column for column in columns if column in work.columns]
    work_summary = (
        work.groupby(work_columns, as_index=False)
        .agg(
            work_units_4_of_4=("scenario_all_4_correct", "sum"),
            total_work_units=("work_unit_id", "size"),
        )
    )
    missing_work_columns = [column for column in columns if column not in work.columns]
    if missing_work_columns:
        dimensions = item[columns].drop_duplicates()
        work_summary = dimensions.merge(
            work_summary,
            on=work_columns,
            validate="many_to_one",
        )
    result = item_summary.merge(work_summary, on=columns, validate="one_to_one")
    result["accuracy"] = result["correct_items"] / result["total_items"]
    result["4_of_4_proportion"] = (
        result["work_units_4_of_4"] / result["total_work_units"]
    )
    return result


def subgroup_tables(
    work: pd.DataFrame, item: pd.DataFrame
) -> dict[str, pd.DataFrame]:
    work = work.copy()
    item = item.copy()
    work["shift_tier_manuscript"] = work["shift_tier"].map(
        {"high": "Higher-shift", "low": "Lower-shift"}
    )
    item["shift_tier_manuscript"] = item["shift_tier"].map(
        {"high": "Higher-shift", "low": "Lower-shift"}
    )
    specs = {
        "accuracy_by_language_and_model": ["input_language", "model_key"],
        "accuracy_by_version_and_model": ["scenario_version", "model_key"],
        "accuracy_by_question_type_and_model": ["question_type", "model_key"],
        "accuracy_by_foundation_and_model": ["foundation", "model_key"],
        "accuracy_by_shift_tier_and_model": ["shift_tier_manuscript", "model_key"],
        "accuracy_by_scenario": ["scenario_id"],
    }
    tables = {}
    for name, columns in specs.items():
        table = summarize_accuracy(work, item, columns)
        table.to_csv(PROCESSED / f"{name}.csv", index=False, encoding="utf-8-sig")
        tables[name] = table
    plotting_aliases = {
        "accuracy_by_language_and_model": "by_language_and_model.csv",
        "accuracy_by_version_and_model": "by_version_and_model.csv",
        "accuracy_by_question_type_and_model": "by_question_type_and_model.csv",
        "accuracy_by_shift_tier_and_model": "by_shift_tier_and_model.csv",
    }
    for source, target in plotting_aliases.items():
        tables[source].to_csv(PLOTTING / target, index=False, encoding="utf-8-sig")
    by_model = summarize_accuracy(work, item, ["model_key"])
    by_model.to_csv(PLOTTING / "by_model.csv", index=False, encoding="utf-8-sig")
    return tables


def error_audit(
    work: pd.DataFrame, item: pd.DataFrame
) -> tuple[dict[str, pd.DataFrame], dict[str, object]]:
    errors = item[item["item_correct"] == 0].copy()
    errors["shift_tier_manuscript"] = errors["shift_tier"].map(
        {"high": "Higher-shift", "low": "Lower-shift"}
    )
    total_errors = len(errors)
    dimensions = {
        "question_type": ["question_type"],
        "model": ["model_key"],
        "language": ["input_language"],
        "scenario": ["scenario_id"],
        "version": ["scenario_version"],
        "shift_tier": ["shift_tier_manuscript"],
    }
    tables = {}
    for name, columns in dimensions.items():
        table = (
            errors.groupby(columns, as_index=False)
            .size()
            .rename(columns={"size": "incorrect_items"})
        )
        table["percentage_of_all_errors"] = table["incorrect_items"] / total_errors
        table.to_csv(
            PROCESSED / f"errors_by_{name}.csv",
            index=False,
            encoding="utf-8-sig",
        )
        tables[name] = table

    questions = (
        item.groupby("question_id", as_index=False)
        .agg(
            incorrect_items=("item_correct", lambda values: int((values == 0).sum())),
            attempts=("item_correct", "size"),
        )
    )
    questions["error_rate"] = questions["incorrect_items"] / questions["attempts"]
    english = pd.read_csv(PROJECT / "data" / "processed" / "english_comprehension_questions.csv")
    question_detail = questions.merge(
        english[
            [
                "question_id",
                "scenario_id",
                "foundation",
                "shift_tier",
                "question_type",
                "question_en",
                "option_A",
                "option_B",
                "option_C",
                "option_D",
                "correct_option",
                "ambiguity_flag",
                "ambiguity_note",
            ]
        ],
        on="question_id",
        validate="one_to_one",
    ).sort_values(["incorrect_items", "question_id"], ascending=[False, True])
    question_detail.to_csv(
        PROCESSED / "question_error_rates.csv", index=False, encoding="utf-8-sig"
    )
    repeated = question_detail[question_detail["error_rate"] >= 0.10].copy()
    repeated.to_csv(
        PROCESSED / "questions_missed_at_least_10_percent.csv",
        index=False,
        encoding="utf-8-sig",
    )
    cumulative = question_detail["incorrect_items"].cumsum()
    questions_for_half = int((cumulative < total_errors / 2).sum() + 1)
    summary = {
        "total_errors": total_errors,
        "questions_with_any_error": int((questions["incorrect_items"] > 0).sum()),
        "questions_missed_at_least_10_percent": len(repeated),
        "questions_accounting_for_at_least_half_of_errors": questions_for_half,
        "top_question_error_share": float(
            question_detail.iloc[0]["incorrect_items"] / total_errors
        ),
    }
    return tables | {"repeated_questions": repeated}, summary


def style_axis(axis, title: str, ylabel: str) -> None:
    axis.set_title(title, fontsize=14, fontweight="bold", pad=12)
    axis.set_ylabel(ylabel)
    axis.grid(axis="y", color="#D8DEE8", linewidth=0.8)
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)


def create_figures(
    merged: pd.DataFrame, tables: dict[str, pd.DataFrame]
) -> None:
    sns.set_theme(style="whitegrid")
    tier = tables["accuracy_by_shift_tier_and_model"].copy()
    categories = ["Higher-shift", "Lower-shift"]
    fig, axis = plt.subplots(figsize=(10.5, 5.7))
    width = 0.24
    x = np.arange(len(categories))
    for model_index, model in enumerate(MODEL_ORDER):
        subset = tier[tier["model_key"] == model].set_index("shift_tier_manuscript")
        axis.bar(
            x + (model_index - 1) * width,
            [subset.loc[value, "accuracy"] for value in categories],
            width,
            label=MODEL_LABELS[model],
            color=COLORS[model],
        )
    axis.set_xticks(x, categories)
    axis.set_ylim(0, 1.04)
    axis.set_xlabel("Scenario shift tier")
    style_axis(axis, "Comprehension Accuracy by Scenario Shift Tier", "Accuracy")
    axis.legend(frameon=False, ncol=3, loc="upper center", bbox_to_anchor=(0.5, -0.15))
    fig.subplots_adjust(left=0.09, right=0.98, top=0.88, bottom=0.24)
    fig.savefig(FIGURES / "comprehension_accuracy_by_shift_tier.png", dpi=180)
    plt.close(fig)

    scatter = merged[
        [
            "work_unit_id",
            "scenario_id",
            "model_key",
            "correct_count_0_4",
            "absolute_rating_shift",
        ]
    ].copy()
    rng = np.random.default_rng(BOOTSTRAP_SEED)
    scatter["jittered_comprehension_score"] = (
        scatter["correct_count_0_4"] + rng.uniform(-0.10, 0.10, len(scatter))
    )
    scatter["model_n"] = scatter.groupby("model_key")["work_unit_id"].transform("size")
    scatter["total_n"] = len(scatter)
    scatter.to_csv(
        PLOTTING / "absolute_rating_shift_by_comprehension_score.csv",
        index=False,
        encoding="utf-8-sig",
    )
    fig, axis = plt.subplots(figsize=(9.4, 5.8))
    for model in MODEL_ORDER:
        subset = scatter[scatter["model_key"] == model]
        axis.scatter(
            subset["jittered_comprehension_score"],
            subset["absolute_rating_shift"],
            s=30,
            alpha=0.55,
            label=f"{MODEL_LABELS[model]} (n={len(subset)})",
            color=COLORS[model],
        )
    axis.set_xticks(range(5), [f"{value}/4" for value in range(5)])
    axis.set_xlabel("Comprehension score")
    style_axis(
        axis,
        "Absolute Rating Shift by Comprehension Score",
        "Absolute rating shift from English baseline",
    )
    axis.legend(frameon=False, ncol=1, loc="upper left")
    fig.tight_layout()
    fig.savefig(
        FIGURES / "absolute_rating_shift_by_comprehension_score.png", dpi=180
    )
    plt.close(fig)

    merged["comprehension_group"] = np.where(
        merged["scenario_all_4_correct"] == 1, "4/4", "<4/4"
    )
    comparison = (
        merged.groupby("comprehension_group", as_index=False)
        .agg(
            n=("work_unit_id", "size"),
            mean_absolute_rating_shift=("absolute_rating_shift", "mean"),
            median_absolute_rating_shift=("absolute_rating_shift", "median"),
        )
    )
    comparison.to_csv(
        PLOTTING / "absolute_rating_shift_by_comprehension_group.csv",
        index=False,
        encoding="utf-8-sig",
    )
    fig, axis = plt.subplots(figsize=(7.6, 5.8))
    sns.boxplot(
        data=merged,
        x="comprehension_group",
        y="absolute_rating_shift",
        order=["4/4", "<4/4"],
        color="#DDE5F3",
        width=0.5,
        showfliers=False,
        ax=axis,
    )
    sns.stripplot(
        data=merged,
        x="comprehension_group",
        y="absolute_rating_shift",
        order=["4/4", "<4/4"],
        hue="model_key",
        palette=COLORS,
        alpha=0.45,
        jitter=0.22,
        size=4,
        ax=axis,
    )
    handles, labels = axis.get_legend_handles_labels()
    axis.legend(
        handles[:3],
        [MODEL_LABELS[label] for label in labels[:3]],
        frameon=False,
        ncol=3,
        loc="upper center",
        bbox_to_anchor=(0.5, -0.15),
    )
    axis.set_xlabel("Comprehension group")
    style_axis(
        axis,
        "Absolute Rating Shift by Comprehension Group",
        "Absolute rating shift from English baseline",
    )
    fig.subplots_adjust(left=0.13, right=0.98, top=0.88, bottom=0.24)
    fig.savefig(
        FIGURES / "absolute_rating_shift_by_comprehension_group.png", dpi=180
    )
    plt.close(fig)

    distribution = (
        merged.groupby("correct_count_0_4", as_index=False)
        .agg(work_units=("work_unit_id", "size"))
        .set_index("correct_count_0_4")
        .reindex(range(5), fill_value=0)
        .reset_index()
    )
    distribution["proportion"] = distribution["work_units"] / len(merged)
    distribution.to_csv(
        PLOTTING / "comprehension_score_distribution.csv",
        index=False,
        encoding="utf-8-sig",
    )
    fig, axis = plt.subplots(figsize=(8.3, 5.3))
    bars = axis.bar(
        distribution["correct_count_0_4"],
        distribution["work_units"],
        color=["#B44C43", "#D9783D", "#E6B84D", "#4B91C4", "#1C8872"],
        width=0.7,
    )
    axis.bar_label(bars, labels=[f"n={value}" for value in distribution["work_units"]], padding=4)
    axis.set_xticks(range(5), [f"{value}/4" for value in range(5)])
    axis.set_xlabel("Comprehension score")
    style_axis(axis, "Distribution of Comprehension Scores", "Work units")
    fig.tight_layout()
    fig.savefig(FIGURES / "comprehension_score_distribution.png", dpi=180)
    plt.close(fig)


def write_reports(
    audit: dict[str, object],
    analyses: dict[str, object],
    regressions: pd.DataFrame,
    subgroups: dict[str, pd.DataFrame],
    error_tables: dict[str, pd.DataFrame],
    error_summary: dict[str, object],
) -> None:
    spearman = analyses["spearman"]
    comparison = analyses["group_comparison"]
    groups = comparison["groups"]
    primary = regressions[
        regressions["model"] == "primary_comprehension_score"
    ].set_index("term")
    sensitivity = regressions[
        regressions["model"] == "sensitivity_any_error"
    ].set_index("term")
    adjusted = regressions[
        regressions["model"] == "adjusted_diagnostic"
    ].set_index("term")
    primary_score = primary.loc["correct_count_0_4"]
    sensitivity_error = sensitivity.loc["any_comprehension_error"]
    adjusted_score = adjusted.loc["correct_count_0_4"]
    actor_error_share = float(
        error_tables["question_type"]
        .set_index("question_type")
        .loc["Actor", "percentage_of_all_errors"]
    )
    higher_shift_error_share = float(
        error_tables["shift_tier"]
        .set_index("shift_tier_manuscript")
        .loc["Higher-shift", "percentage_of_all_errors"]
    )
    interpretation = (
        "The observed association does not provide evidence that factual-comprehension "
        "errors explain the original rating shifts."
        if primary_score["p_value"] >= 0.05
        else "Comprehension score was associated with rating shift, so factual errors may "
        "contribute to some shifts; the observational design does not establish causation."
    )

    subgroup_sections = []
    labels = {
        "accuracy_by_language_and_model": "Language and Model",
        "accuracy_by_version_and_model": "Scenario Version and Model",
        "accuracy_by_question_type_and_model": "Question Type and Model",
        "accuracy_by_foundation_and_model": "Foundation and Model",
        "accuracy_by_shift_tier_and_model": "Scenario Shift Tier and Model",
        "accuracy_by_scenario": "Scenario",
    }
    for key, title in labels.items():
        subgroup_sections.append(
            f"### {title}\n\n{markdown_table(format_accuracy_table(subgroups[key]))}"
        )
    adjusted_display = regressions[
        regressions["model"] == "adjusted_diagnostic"
    ][
        ["term", "coefficient", "clustered_se", "ci_lower_95", "ci_upper_95", "p_value"]
    ].copy()
    for column in adjusted_display.columns[1:]:
        adjusted_display[column] = adjusted_display[column].map(lambda value: f"{value:.6f}")

    result_report = f"""# Multilingual Comprehension-Check Results

## Dataset Audit

- Unique work units: **{audit['unique_work_units']}**
- Item-level responses: **{audit['item_level_responses']:,}**
- Incorrect items: **{audit['incorrect_items']}**
- Overall accuracy: **{audit['overall_accuracy']:.7%}**
- Work-unit 4/4 rate: **{audit['work_unit_4_of_4_rate']:.7%}**
- Normalized outputs: **{audit['normalized_outputs']}**

All 150 normalized outputs were scored only after exact separator or localized option-label
normalization. Response order was preserved; no answer content was inferred; no ambiguous
free text was converted; and every normalized row remains linked to its raw output in
`normalization_integrity_audit.csv`.

## Rating-Shift Merge

All 720 comprehension work units received exactly one absolute moral-rating shift from the
same model and scenario. Literal rows use `*_translation_reason_en - en_en`; adapted rows
use `*_adapted_reason_en - en_en`, in absolute value. Only the three evaluated models were
included; Gemini 3.1 Pro was excluded.

## Primary Association

Spearman's rho between the 0-4 comprehension score and absolute rating shift was
**{spearman['rho']:.6f}** (two-sided p = **{spearman['two_sided_p_value']:.6g}**,
n = **{spearman['n']}**, 95% scenario-cluster bootstrap CI
**[{spearman['scenario_cluster_bootstrap_ci_95'][0]:.6f},
{spearman['scenario_cluster_bootstrap_ci_95'][1]:.6f}]**, {BOOTSTRAP_REPS:,} resamples).
Using item accuracy on the 0-1 scale gave rho = **{spearman['proportion_rho']:.6f}**
and p = **{spearman['proportion_two_sided_p_value']:.6g}**. This is mathematically
equivalent because it is a positive linear rescaling of the 0-4 score.

## Fully Comprehended Versus Error-Containing Cases

| Group | n | Mean shift | Median shift | SD | IQR |
|---|---:|---:|---:|---:|---:|
| 4/4 | {groups['4_of_4']['n']} | {groups['4_of_4']['mean']:.6f} | {groups['4_of_4']['median']:.6f} | {groups['4_of_4']['standard_deviation']:.6f} | {groups['4_of_4']['interquartile_range']:.6f} |
| <4/4 | {groups['less_than_4_of_4']['n']} | {groups['less_than_4_of_4']['mean']:.6f} | {groups['less_than_4_of_4']['median']:.6f} | {groups['less_than_4_of_4']['standard_deviation']:.6f} | {groups['less_than_4_of_4']['interquartile_range']:.6f} |

Mann-Whitney U = **{comparison['mann_whitney_u']:.3f}**, two-sided
p = **{comparison['mann_whitney_two_sided_p_value']:.6g}**. The mean difference
(`<4/4 minus 4/4`) was **{comparison['mean_difference_error_minus_full']:.6f}**,
with a 95% scenario-cluster bootstrap CI of
**[{comparison['scenario_cluster_bootstrap_ci_95'][0]:.6f},
{comparison['scenario_cluster_bootstrap_ci_95'][1]:.6f}]**.
These groups were observed, not randomly assigned.

## Clustered Regression

For `absolute_rating_shift ~ comprehension_score`, the score coefficient was
**{primary_score['coefficient']:.6f}** (scenario-clustered SE
**{primary_score['clustered_se']:.6f}**, 95% CI
**[{primary_score['ci_lower_95']:.6f}, {primary_score['ci_upper_95']:.6f}]**,
p = **{primary_score['p_value']:.6g}**). The intercept was
**{primary.loc['Intercept', 'coefficient']:.6f}**, n = **{int(primary_score['n'])}**,
20 scenario clusters, R-squared = **{primary_score['r_squared']:.6f}**.

The sensitivity model using `any_comprehension_error` produced a coefficient of
**{sensitivity_error['coefficient']:.6f}** (clustered SE
**{sensitivity_error['clustered_se']:.6f}**, 95% CI
**[{sensitivity_error['ci_lower_95']:.6f}, {sensitivity_error['ci_upper_95']:.6f}]**,
p = **{sensitivity_error['p_value']:.6g}**), intercept
**{sensitivity.loc['Intercept', 'coefficient']:.6f}**, R-squared
**{sensitivity_error['r_squared']:.6f}**.

## Adjusted Diagnostic Model

The adjusted score coefficient was **{adjusted_score['coefficient']:.6f}**
(scenario-clustered SE **{adjusted_score['clustered_se']:.6f}**, 95% CI
**[{adjusted_score['ci_lower_95']:.6f}, {adjusted_score['ci_upper_95']:.6f}]**,
p = **{adjusted_score['p_value']:.6g}**), n = **{int(adjusted_score['n'])}**,
20 clusters, R-squared = **{adjusted_score['r_squared']:.6f}**. This model adjusts
for model, language, scenario version, and scenario shift tier and is diagnostic,
not causal.

{markdown_table(adjusted_display)}

## Interpretation

{interpretation} The association remained negative in the adjusted diagnostic model.
However, **{actor_error_share:.3%}** of all errors were actor-identification errors,
**{higher_shift_error_share:.3%}** occurred in higher-shift scenarios, and only three
questions accounted for at least half of all errors. The error-containing group therefore
does not provide a clean or randomly assigned test of misunderstanding. Errors could
plausibly contribute to some rating shifts, but these data do not show that they explain
the broader shift pattern; even 4/4 cases had a mean absolute shift of
**{groups['4_of_4']['mean']:.6f}**. Observed associations can reflect item ambiguity,
scenario difficulty, model behavior, or other shared causes.

## Exact Subgroup Accuracy

{chr(10).join(subgroup_sections)}

## Limitations

The analysis contains only 20 scenario clusters, comprehension scores are highly
concentrated at 4/4, rating shifts are bounded and discrete, and the comparisons are
observational. Clustered standard errors and scenario-cluster bootstraps address dependence
within scenarios but cannot remove confounding or create independent scenario-level
replication. Externally approved items may still differ in difficulty, and no item was
removed or rescored after observing results.
"""
    (REPORTS / "comprehension_results_report.md").write_text(
        result_report, encoding="utf-8"
    )

    repeated = error_tables["repeated_questions"].copy()
    repeated_display = repeated[
        [
            "question_id",
            "scenario_id",
            "question_type",
            "incorrect_items",
            "attempts",
            "error_rate",
            "question_en",
            "correct_option",
            "ambiguity_flag",
        ]
    ].copy()
    repeated_display["error_rate"] = repeated_display["error_rate"].map(
        lambda value: f"{value:.3%}"
    )
    error_sections = []
    for key, title in (
        ("question_type", "Question Type"),
        ("model", "Model"),
        ("language", "Language"),
        ("scenario", "Scenario"),
        ("version", "Scenario Version"),
        ("shift_tier", "Scenario Shift Tier"),
    ):
        table = error_tables[key].copy()
        table["percentage_of_all_errors"] = table["percentage_of_all_errors"].map(
            lambda value: f"{value:.3%}"
        )
        error_sections.append(f"### {title}\n\n{markdown_table(table)}")
    error_report = f"""# Comprehension Error Audit

## Concentration

- Total incorrect items: **{error_summary['total_errors']}**
- Questions with at least one error: **{error_summary['questions_with_any_error']} / 80**
- Questions missed in at least 10% of evaluations: **{error_summary['questions_missed_at_least_10_percent']}**
- Questions accounting for at least half of all errors: **{error_summary['questions_accounting_for_at_least_half_of_errors']}**
- Largest single-question share of all errors: **{error_summary['top_question_error_share']:.3%}**

Actor-identification errors and GPT-4o's contribution are quantified below rather than
inferred from figure appearance.

{chr(10).join(error_sections)}

## Questions Missed in at Least 10% of Evaluations

Each source question was attempted 36 times: three models, six languages, and two scenario
versions. No item was removed or rescored.

{markdown_table(repeated_display)}

## Item-Design Inspection

All listed items retained their externally approved wording and answer keys. The strongest
design concern is the phrase "performed the central action." For S28_Q1, 27/36 responses
selected the cashier, who performed the act of giving extra change, while the key identifies
the customer, whose act of keeping it is the intended moral target. For S20_Q1, 21/36 selected
the junior panellist, who made the biased comments, while the key identifies Chioma, whose
omission is the blameworthiness target. S18_Q1 similarly presents two substantive co-authors
and produced 11/36 errors. These are plausible competing-actor interpretations, not evidence
that response order or parsing failed.

S26_Q1 and S26_Q2 show paired actor/action mistakes, including choices contradicted by the
scenario, so genuine factual-comprehension errors also occurred. The English-source
`ambiguity_flag` field still contains the historical value `Pending human review` for the
listed questions, even though the multilingual rows were subsequently externally approved.
Thus external approval should not be treated as a psychometric guarantee that every
"central action" stem is unambiguous.

The full wording, options, keys, original flags, and model selections remain in
`question_error_rates.csv` and `missed_items.csv`. No item was removed, re-keyed, or rescored.
"""
    (REPORTS / "comprehension_error_audit.md").write_text(
        error_report, encoding="utf-8"
    )

    rating_paths = [
        REPO / "results" / "processed" / "full_1782215308316_vrq93w.ratings.csv",
        REPO / "results" / "processed" / "extension_full_1782729062659_xqetbf.ratings.csv",
    ]
    reproducibility = f"""# Comprehension Analysis Reproducibility Report

## Sources and Integrity

- Active comprehension database SHA-256: `{sha256(DB)}`
- Work-unit results SHA-256: `{sha256(PROCESSED / 'work_unit_results.csv')}`
- Item-level results SHA-256: `{sha256(PROCESSED / 'item_level_results.csv')}`
- Original rating source 1 SHA-256: `{sha256(rating_paths[0])}`
- Original rating source 2 SHA-256: `{sha256(rating_paths[1])}`
- One-to-one merged rows: **720**
- Item rows: **2,880**
- Scenario clusters: **20**

## Shift Construction

For each exact scenario-model-language-version work unit, the script subtracts the same
model's English `en_en` rating from the non-English input/English response rating and takes
the absolute value. Literal rows use `{{language}}_translation_reason_en`; adapted rows use
`{{language}}_adapted_reason_en`. The merge is required to validate one-to-one. Only
`openai/gpt-4o-2024-11-20`, `anthropic/claude-sonnet-4.6`, and
`google/gemini-3.5-flash` are accepted.

## Statistical Procedures

Spearman confidence intervals and mean-difference confidence intervals use
{BOOTSTRAP_REPS:,} percentile bootstrap resamples of the 20 scenarios with replacement,
seed {BOOTSTRAP_SEED}. OLS standard errors are clustered by scenario with the finite-sample
covariance correction and t-based inference. Mann-Whitney U is two-sided and asymptotic
because the data contain ties.

## Normalization Audit

The 150 normalized responses are reproduced from their raw outputs using only the exact
locale separators and localized A-D aliases encoded in the parser. The audit rejects any
row with other free text, a token count other than four, or a changed response order.

## Reproduction

```powershell
$env:PYTHONPATH = "$PWD\\src"
py -3 scripts\\complete_association_analysis.py
py -3 scripts\\validate_project.py
py -3 -m pytest
py -3 run_experiment.py --dry-run
```

These analysis commands make no API requests.
"""
    canonical = REPORTS / "comprehension_reproducibility_report.md"
    canonical.write_text(reproducibility, encoding="utf-8")
    (REPORTS / "reproducibility_report.md").write_text(
        "Canonical final reproducibility documentation: "
        "`reports/comprehension_reproducibility_report.md`.\n",
        encoding="utf-8",
    )


def main() -> None:
    for directory in (PROCESSED, PLOTTING, FIGURES, REPORTS):
        directory.mkdir(parents=True, exist_ok=True)
    work, item, audit = audit_inputs()
    merged = build_rating_merge(work)
    analyses, regressions = association_analyses(merged)
    subgroups = subgroup_tables(work, item)
    error_tables, error_summary = error_audit(work, item)
    create_figures(merged, subgroups)
    write_reports(
        audit, analyses, regressions, subgroups, error_tables, error_summary
    )
    output = {
        "status": "PASS",
        "audit": audit,
        "rating_shift_merge": {
            "rows": len(merged),
            "unique_work_units": int(merged["work_unit_id"].nunique()),
            "missing_shifts": int(merged["absolute_rating_shift"].isna().sum()),
            "exactly_one_match_per_work_unit": True,
        },
        "analyses": analyses,
        "error_concentration": error_summary,
        "bootstrap": {
            "repetitions": BOOTSTRAP_REPS,
            "seed": BOOTSTRAP_SEED,
            "cluster": "scenario_id",
        },
        "no_api_requests_made": True,
    }
    (PROCESSED / "comprehension_shift_analysis.json").write_text(
        json.dumps(output, indent=2), encoding="utf-8"
    )
    final_audit_path = PROCESSED / "final_live_audit.json"
    final_audit = json.loads(final_audit_path.read_text(encoding="utf-8"))
    final_audit["association_analysis"] = {
        "status": "PASS",
        "one_to_one_rating_shift_matches": 720,
        "scenario_clusters": 20,
        "normalized_output_integrity_rows": 150,
        "no_additional_api_requests": True,
    }
    final_audit["figures"] = sorted(path.name for path in FIGURES.glob("*.png"))
    final_audit["plotting_data"] = sorted(path.name for path in PLOTTING.glob("*.csv"))
    final_audit_path.write_text(
        json.dumps(final_audit, indent=2), encoding="utf-8"
    )
    metadata_path = PROJECT / "run_metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    metadata["association_analysis"] = {
        "status": "complete",
        "work_unit_shift_matches": 720,
        "statistical_results_file": "results/processed/comprehension_shift_analysis.json",
        "merged_file": "results/processed/work_unit_results_with_rating_shift.csv",
        "bootstrap_repetitions": BOOTSTRAP_REPS,
        "bootstrap_seed": BOOTSTRAP_SEED,
        "no_additional_api_requests": True,
    }
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
