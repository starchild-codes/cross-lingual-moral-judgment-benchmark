from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from .analyze_controls import CONTRASTS_CSV
from .common import MODEL_KEYS, ROOT, configure_utf8_console, load_models_config
from .diagnostics import CLEAN_CSV


FIGURES = ROOT / "figures"
MODEL_COLORS = {
    "chatgpt": "#0072B2",
    "claude": "#D55E00",
    "gemini_flash": "#009E73",
}


def configure() -> None:
    mpl.rcParams.update(
        {
            "font.family": "DejaVu Sans",
            "font.size": 10,
            "axes.titlesize": 13,
            "axes.labelsize": 11,
            "legend.fontsize": 9.5,
            "figure.facecolor": "white",
            "axes.facecolor": "white",
            "savefig.facecolor": "white",
        }
    )


def export(fig: plt.Figure, name: str) -> None:
    fig.savefig(FIGURES / name, dpi=300, bbox_inches="tight", pad_inches=0.15, facecolor="white")
    plt.close(fig)


def rating_distribution(data: pd.DataFrame, labels: dict[str, str]) -> None:
    plot_rows = []
    for (model, control), subset in data.groupby(["model_key", "control_id"]):
        counts = subset["parsed_rating"].value_counts()
        for rating in range(1, 8):
            plot_rows.append(
                {
                    "model_key": model,
                    "control_id": control,
                    "rating": rating,
                    "count": int(counts.get(rating, 0)),
                    "proportion": float(counts.get(rating, 0) / len(subset)),
                }
            )
    plotting = pd.DataFrame(plot_rows)
    plotting.to_csv(FIGURES / "neutral_control_rating_distribution_plot_data.csv", index=False)

    fig, axes = plt.subplots(1, 3, figsize=(7.2, 4.2), sharey=True)
    controls = sorted(data["control_id"].unique())
    for ax, model in zip(axes, MODEL_KEYS):
        subset = plotting[plotting["model_key"] == model]
        bottom = np.zeros(len(controls))
        for rating in range(1, 8):
            values = (
                subset[subset["rating"] == rating]
                .set_index("control_id")
                .reindex(controls)["proportion"]
                .to_numpy()
            )
            ax.bar(
                controls,
                values,
                bottom=bottom,
                label=str(rating),
                color=plt.cm.viridis((rating - 1) / 6),
                width=0.72,
            )
            bottom += values
        ax.set_title(labels[model], fontsize=11)
        ax.set_ylim(0, 1)
        ax.spines[["top", "right"]].set_visible(False)
    axes[0].set_ylabel("Proportion of ratings")
    fig.supxlabel("Control", y=0.18)
    handles, legend_labels = axes[-1].get_legend_handles_labels()
    fig.legend(
        handles,
        legend_labels,
        title="Rating",
        ncol=7,
        loc="lower center",
        bbox_to_anchor=(0.5, 0.01),
        frameon=False,
    )
    fig.suptitle("Neutral-control rating distributions by model", y=0.96)
    fig.subplots_adjust(left=0.09, right=0.99, top=0.83, bottom=0.29, wspace=0.12)
    export(fig, "neutral_control_rating_distribution.png")


def effects_figure(contrasts: pd.DataFrame, labels: dict[str, str]) -> None:
    names = ["input_language", "cultural_adaptation_primary", "response_language_primary"]
    display = {
        "input_language": "Input language",
        "cultural_adaptation_primary": "Cultural adaptation",
        "response_language_primary": "Response language",
    }
    plotting = contrasts[
        (contrasts["row_type"] == "aggregate")
        & (contrasts["aggregation_level"] == "model")
        & contrasts["contrast"].isin(names)
    ].copy()
    plotting["contrast_label"] = plotting["contrast"].map(display)
    plotting["model_label"] = plotting["model_key"].map(labels)
    plotting.to_csv(FIGURES / "neutral_control_effects_plot_data.csv", index=False)

    fig, ax = plt.subplots(figsize=(7.2, 4.5), constrained_layout=True)
    x = np.arange(len(names))
    offsets = [-0.2, 0, 0.2]
    for offset, model in zip(offsets, MODEL_KEYS):
        subset = plotting[plotting["model_key"] == model].set_index("contrast").reindex(names)
        mean = subset["mean_paired_difference"].to_numpy()
        lower = mean - subset["ci_lower"].to_numpy()
        upper = subset["ci_upper"].to_numpy() - mean
        ax.errorbar(
            x + offset,
            mean,
            yerr=np.vstack([lower, upper]),
            fmt="o",
            markersize=6,
            capsize=3,
            linewidth=1.2,
            color=MODEL_COLORS[model],
            label=labels[model],
        )
    ax.axhline(0, color="#555555", linestyle=(0, (3, 2)), linewidth=1)
    ax.set_xticks(x, [display[name] for name in names])
    ax.set_ylabel("Mean paired rating difference")
    ax.set_ylim(-6, 6)
    ax.set_yticks([-6, -3, 0, 3, 6])
    ax.set_title("Neutral-control calibration contrasts")
    ax.grid(axis="y", color="#DDDDDD", linewidth=0.7)
    ax.spines[["top", "right"]].set_visible(False)
    if (
        plotting["mean_paired_difference"].eq(0).all()
        and plotting["ci_lower"].eq(0).all()
        and plotting["ci_upper"].eq(0).all()
    ):
        ax.text(
            0.5,
            0.96,
            "All estimates and 95% CIs = 0.00",
            transform=ax.transAxes,
            ha="center",
            va="top",
            fontsize=9,
            color="#444444",
        )
    ax.legend(frameon=False, ncol=3, loc="upper center", bbox_to_anchor=(0.5, -0.15))
    export(fig, "neutral_control_effects.png")


def make_figures(clean_csv: Path = CLEAN_CSV, contrasts_csv: Path = CONTRASTS_CSV) -> None:
    if not clean_csv.exists() or not contrasts_csv.exists():
        raise FileNotFoundError("Completed clean data and contrast results are required")
    data = pd.read_csv(clean_csv)
    contrasts = pd.read_csv(contrasts_csv)
    if len(data) != 375:
        raise RuntimeError("Figures require the complete 375-response dataset")
    config = load_models_config()
    labels = {key: value["display_name"] for key, value in config["models"].items()}
    FIGURES.mkdir(parents=True, exist_ok=True)
    configure()
    rating_distribution(data, labels)
    effects_figure(contrasts, labels)


def main() -> int:
    configure_utf8_console()
    parser = argparse.ArgumentParser(description="Create publication-ready neutral-control figures.")
    parser.add_argument("--clean-csv", type=Path, default=CLEAN_CSV)
    parser.add_argument("--contrasts-csv", type=Path, default=CONTRASTS_CSV)
    args = parser.parse_args()
    try:
        make_figures(args.clean_csv, args.contrasts_csv)
    except (FileNotFoundError, RuntimeError) as error:
        print(error, file=sys.stderr)
        return 1
    print(f"Wrote figures and plotting data to {FIGURES}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
