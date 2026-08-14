"""Generate publication-ready Figures 1-5 from finalized Draft 4 data.

Run from the repository root:
    py -3 scripts/figures/publication_v2/generate_publication_figures.py
"""

from __future__ import annotations

import math
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.colors import TwoSlopeNorm
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[3]
FIGURE_DATA = ROOT / "results" / "figures" / "data"
ANALYSIS_DATA = ROOT / "results" / "processed" / "analysis"
OUTPUT = ROOT / "results" / "figures" / "publication_v2"

LANGUAGES = ["hi", "bn", "ta", "es", "ja", "ar"]
LANGUAGE_LABELS = {
    "hi": "Hindi",
    "bn": "Bengali",
    "ta": "Tamil",
    "es": "Spanish",
    "ja": "Japanese",
    "ar": "Arabic",
}
EVALUATED_MODELS = ["chatgpt", "claude", "gemini_flash"]
ALL_MODELS = [*EVALUATED_MODELS, "gemini_pro"]
MODEL_LABELS = {
    "chatgpt": "GPT-4o",
    "claude": "Claude Sonnet 4.6",
    "gemini_flash": "Gemini 3.5 Flash",
    "gemini_pro": "Gemini 3.1 Pro",
}
MODEL_COLORS = {
    "chatgpt": "#0072B2",
    "claude": "#D55E00",
    "gemini_flash": "#009E73",
    "gemini_pro": "#7A5195",
}
FOUNDATIONS = [
    "Care/Harm",
    "Fairness/Cheating",
    "Loyalty/Betrayal",
    "Authority/Subversion",
    "Sanctity/Degradation",
]
FOUNDATION_TICKS = [
    "Care/\nHarm",
    "Fairness/\nCheating",
    "Loyalty/\nBetrayal",
    "Authority/\nSubversion",
    "Sanctity/\nDegradation",
]
FOUNDATION_COLUMN_TICKS = ["Care", "Fairness", "Loyalty", "Authority", "Sanctity"]
CONDITIONS = [
    "en_en",
    "translation_reason_en",
    "translation_reason_l2",
    "adapted_reason_en",
    "adapted_reason_l2",
]
CONDITION_LABELS = {
    "en_en": "English\nbaseline",
    "translation_reason_en": "Literal,\nEnglish response",
    "translation_reason_l2": "Literal, same-\nlanguage response",
    "adapted_reason_en": "Adapted,\nEnglish response",
    "adapted_reason_l2": "Adapted, same-\nlanguage response",
}

CAPTIONS = """# Figure Captions V2

**Figure 1. Input-language effects by evaluated model.** Mean blameworthiness shifts for non-English literal translations relative to the English baseline, separated by evaluated model. Positive values indicate higher blameworthiness ratings than the English baseline, while negative values indicate lower ratings. Error bars show 95% confidence intervals.

**Figure 2. Cultural-framing effects by language and moral foundation.** Heatmap showing mean rating differences between culturally adapted scenarios and literal translations. Negative values indicate that cultural adaptation lowered blameworthiness ratings relative to literal translation. Effects are shown by language and Moral Foundations Theory category.

**Figure 3. Response-language effects by evaluated model.** Mean rating shifts when models were instructed to respond in the input language rather than English while holding scenario text constant. Positive values indicate higher blameworthiness ratings under same-language response, while negative values indicate lower ratings.

**Figure 4. Mean absolute divergence from Gemini 3.1 Pro.** Mean absolute rating difference between each evaluated model and Gemini 3.1 Pro under identical scenario-condition pairs. Gemini 3.1 Pro is used as a high-capability reference comparator, not as objective moral ground truth.

**Figure 5. Intended-to-invoked moral foundation transitions.** Heatmaps show the human-coded foundations invoked in model explanations relative to each scenario's original intended foundation. Because scenario validation showed that some intended labels were not consistently recognised by human coders, these transitions should be interpreted alongside the human-majority sensitivity analysis.
"""


def configure_style() -> None:
    mpl.rcParams.update(
        {
            "font.family": "DejaVu Sans",
            "font.size": 10,
            "axes.titlesize": 13,
            "axes.titleweight": "semibold",
            "axes.labelsize": 11,
            "axes.edgecolor": "#333333",
            "axes.linewidth": 0.8,
            "xtick.labelsize": 9.5,
            "ytick.labelsize": 9.5,
            "legend.fontsize": 9.5,
            "figure.facecolor": "white",
            "axes.facecolor": "white",
            "savefig.facecolor": "white",
            "savefig.transparent": False,
            "pdf.fonttype": 42,
            "ps.fonttype": 42,
            "svg.fonttype": "none",
            "axes.unicode_minus": True,
        }
    )


def read(name: str, directory: Path = FIGURE_DATA) -> pd.DataFrame:
    return pd.read_csv(directory / name)


def assert_same_rows(label: str, plotted: pd.DataFrame, canonical: pd.DataFrame) -> None:
    common = list(plotted.columns)
    missing = [column for column in common if column not in canonical.columns]
    if missing:
        raise RuntimeError(f"{label}: canonical table is missing columns {missing}")
    left = plotted[common].sort_values(common, kind="stable").reset_index(drop=True)
    right = canonical[common].sort_values(common, kind="stable").reset_index(drop=True)
    try:
        pd.testing.assert_frame_equal(left, right, check_exact=True, check_dtype=False)
    except AssertionError as error:
        raise RuntimeError(f"{label}: figure data do not match canonical processed data") from error


def validate_sources() -> dict[str, pd.DataFrame]:
    data = {
        "figure1": read("figure1_language_effect_by_model.csv"),
        "figure2": read("figure2_framing_heatmap.csv"),
        "figure3": read("figure3_reasoning_effect_by_model.csv"),
        "figure4": read("figure4_reference_divergence.csv"),
        "figure5": read("figure5_foundation_transitions.csv"),
    }

    model_comparison = read("model_comparison.csv", ANALYSIS_DATA)
    foundation_breakdown = read("foundation_breakdown.csv", ANALYSIS_DATA)
    reference = read("reference_divergence.csv", ANALYSIS_DATA)
    transitions = read("foundation_transitions.csv", ANALYSIS_DATA)

    assert_same_rows(
        "Figure 1",
        data["figure1"],
        model_comparison.query("effect_type == 'language' and language != 'all' and mft_foundation == 'all'"),
    )
    assert_same_rows(
        "Figure 2",
        data["figure2"],
        foundation_breakdown.query("effect_type == 'framing' and language != 'all'"),
    )
    assert_same_rows(
        "Figure 3",
        data["figure3"],
        model_comparison.query("effect_type == 'reasoning' and language != 'all' and mft_foundation == 'all'"),
    )
    assert_same_rows(
        "Figure 4",
        data["figure4"],
        reference.query("group_by == 'model_key+condition_type'"),
    )
    assert_same_rows(
        "Figure 5",
        data["figure5"],
        transitions.query("model_key != 'all'"),
    )

    if set(data["figure1"].model_key) != set(EVALUATED_MODELS):
        raise RuntimeError("Figure 1 evaluated-model set changed")
    if set(data["figure3"].model_key) != set(EVALUATED_MODELS):
        raise RuntimeError("Figure 3 evaluated-model set changed")
    if set(data["figure4"].model_key) != set(EVALUATED_MODELS):
        raise RuntimeError("Figure 4 evaluated-model set changed")
    if set(data["figure5"].model_key) != set(ALL_MODELS):
        raise RuntimeError("Figure 5 source-model set changed")
    return data


def export_figure(fig: plt.Figure, basename: str) -> None:
    for extension in ("png", "pdf", "svg"):
        options = {"bbox_inches": "tight", "pad_inches": 0.16, "facecolor": "white"}
        if extension == "png":
            options["dpi"] = 300
        fig.savefig(OUTPUT / f"{basename}.{extension}", **options)
    plt.close(fig)


def effect_plot(data: pd.DataFrame, title: str, ylabel: str, basename: str) -> None:
    fig, ax = plt.subplots(figsize=(7.2, 4.8), constrained_layout=True)
    x = np.arange(len(LANGUAGES))
    offsets = [-0.22, 0.0, 0.22]
    width = 0.18

    for offset, model in zip(offsets, EVALUATED_MODELS):
        subset = data.set_index(["language", "model_key"]).loc[[(language, model) for language in LANGUAGES]]
        values = subset.mean_diff.to_numpy()
        lower = values - subset.ci_lower.to_numpy()
        upper = subset.ci_upper.to_numpy() - values
        ax.bar(
            x + offset,
            values,
            width=width,
            color=MODEL_COLORS[model],
            label=MODEL_LABELS[model],
            zorder=3,
        )
        ax.errorbar(
            x + offset,
            values,
            yerr=np.vstack([lower, upper]),
            fmt="none",
            ecolor="#333333",
            elinewidth=1.0,
            capsize=2.5,
            capthick=1.0,
            zorder=4,
        )

    ax.axhline(0, color="#555555", linewidth=1.0, linestyle=(0, (3, 2)), zorder=2)
    ax.set_xticks(x, [LANGUAGE_LABELS[language] for language in LANGUAGES])
    ax.set_ylabel(ylabel)
    ax.set_xlabel("Input language")
    ax.set_title(title, pad=12)
    ax.grid(axis="y", color="#D9D9D9", linewidth=0.65, zorder=1)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(
        loc="upper center",
        bbox_to_anchor=(0.5, -0.17),
        ncol=3,
        frameon=False,
        handlelength=1.4,
        columnspacing=1.4,
    )
    export_figure(fig, basename)


def framing_heatmap(data: pd.DataFrame) -> None:
    matrix = (
        data.pivot(index="language", columns="mft_foundation", values="mean_diff")
        .reindex(index=LANGUAGES, columns=FOUNDATIONS)
        .to_numpy()
    )
    limit = math.ceil(float(np.nanmax(np.abs(matrix))) * 10) / 10
    norm = TwoSlopeNorm(vmin=-limit, vcenter=0, vmax=limit)
    fig, ax = plt.subplots(figsize=(7.2, 5.25), constrained_layout=True)
    image = ax.imshow(matrix, cmap="RdBu_r", norm=norm, aspect="auto")

    ax.set_xticks(np.arange(len(FOUNDATIONS)), FOUNDATION_TICKS)
    ax.set_yticks(np.arange(len(LANGUAGES)), [LANGUAGE_LABELS[x] for x in LANGUAGES])
    ax.set_xlabel("Moral foundation")
    ax.set_ylabel("Input language")
    ax.set_title("Cultural-framing effects by language and moral foundation", pad=12)
    ax.set_xticks(np.arange(-0.5, len(FOUNDATIONS), 1), minor=True)
    ax.set_yticks(np.arange(-0.5, len(LANGUAGES), 1), minor=True)
    ax.grid(which="minor", color="white", linewidth=1.6)
    ax.tick_params(which="minor", bottom=False, left=False)
    ax.tick_params(axis="x", pad=7)

    for row in range(matrix.shape[0]):
        for column in range(matrix.shape[1]):
            value = matrix[row, column]
            rgba = image.cmap(image.norm(value))
            luminance = 0.2126 * rgba[0] + 0.7152 * rgba[1] + 0.0722 * rgba[2]
            ax.text(
                column,
                row,
                f"{value:.2f}",
                ha="center",
                va="center",
                color="white" if luminance < 0.48 else "#222222",
                fontsize=9.5,
                fontweight="semibold",
            )

    colorbar = fig.colorbar(image, ax=ax, shrink=0.86, pad=0.03)
    colorbar.set_label("Adapted minus literal mean rating", rotation=90, labelpad=10)
    colorbar.outline.set_linewidth(0.7)
    fig.text(
        0.5,
        -0.015,
        "Negative values indicate lower blameworthiness under cultural adaptation.",
        ha="center",
        va="top",
        fontsize=9.5,
        color="#444444",
    )
    export_figure(fig, "figure2_cultural_framing_heatmap_v2")


def divergence_plot(data: pd.DataFrame) -> None:
    fig, ax = plt.subplots(figsize=(7.2, 5.25), constrained_layout=True)
    x = np.arange(len(CONDITIONS))
    offsets = [-0.22, 0.0, 0.22]
    width = 0.2
    indexed = data.set_index(["condition_type", "model_key"])

    for offset, model in zip(offsets, EVALUATED_MODELS):
        values = indexed.loc[[(condition, model) for condition in CONDITIONS]].mean_absolute_difference.to_numpy()
        ax.bar(
            x + offset,
            values,
            width=width,
            color=MODEL_COLORS[model],
            label=MODEL_LABELS[model],
            zorder=3,
        )

    ax.set_xticks(x, [CONDITION_LABELS[condition] for condition in CONDITIONS])
    ax.set_ylabel("Mean absolute rating difference")
    ax.set_xlabel("Scenario and instructed response condition")
    ax.set_title("Mean absolute divergence from Gemini 3.1 Pro", pad=12)
    ax.text(
        0.5,
        1.005,
        "Reference comparator, not objective moral ground truth",
        transform=ax.transAxes,
        ha="center",
        va="bottom",
        fontsize=9.5,
        color="#4A4A4A",
    )
    ax.set_ylim(bottom=0)
    ax.grid(axis="y", color="#D9D9D9", linewidth=0.65, zorder=1)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(
        loc="upper center",
        bbox_to_anchor=(0.5, -0.24),
        ncol=3,
        frameon=False,
        handlelength=1.4,
        columnspacing=1.4,
    )
    export_figure(fig, "figure4_reference_divergence_v2")


def transition_heatmaps(data: pd.DataFrame) -> None:
    fig, axes = plt.subplots(2, 2, figsize=(7.2, 7.65), constrained_layout=True)
    axes_flat = axes.ravel()
    images = []

    for ax, model in zip(axes_flat, ALL_MODELS):
        subset = data[data.model_key == model]
        counts = (
            subset.pivot(index="designed_foundation", columns="invoked_foundation", values="count")
            .reindex(index=FOUNDATIONS, columns=FOUNDATIONS)
            .fillna(0)
            .to_numpy(dtype=int)
        )
        percentages = (
            subset.pivot(index="designed_foundation", columns="invoked_foundation", values="row_percentage")
            .reindex(index=FOUNDATIONS, columns=FOUNDATIONS)
            .fillna(0)
            .to_numpy(dtype=float)
        )
        image = ax.imshow(percentages, cmap="Blues", vmin=0, vmax=1, aspect="equal")
        images.append(image)
        ax.set_title(MODEL_LABELS[model], fontsize=11.5, pad=7)
        ax.set_xticks(np.arange(5), FOUNDATION_COLUMN_TICKS, fontsize=9, rotation=24, ha="right", rotation_mode="anchor")
        ax.set_yticks(np.arange(5), FOUNDATION_TICKS, fontsize=9)
        ax.set_xticks(np.arange(-0.5, 5, 1), minor=True)
        ax.set_yticks(np.arange(-0.5, 5, 1), minor=True)
        ax.grid(which="minor", color="white", linewidth=1.2)
        ax.tick_params(which="minor", bottom=False, left=False)
        ax.tick_params(axis="x", pad=4)
        for row in range(5):
            for column in range(5):
                proportion = percentages[row, column]
                ax.text(
                    column,
                    row,
                    str(counts[row, column]),
                    ha="center",
                    va="center",
                    color="white" if proportion >= 0.55 else "#1F1F1F",
                    fontsize=9.3,
                    fontweight="semibold" if counts[row, column] else "normal",
                )

    for ax in axes[:, 0]:
        ax.set_ylabel("Original intended foundation", labelpad=8)
    for ax in axes[1, :]:
        ax.set_xlabel("Human-coded invoked foundation", labelpad=8)

    colorbar = fig.colorbar(images[0], ax=axes_flat.tolist(), location="bottom", shrink=0.62, pad=0.045, aspect=35)
    colorbar.set_label("Within-row proportion (shading); cell annotations are counts", labelpad=8)
    colorbar.set_ticks([0, 0.25, 0.5, 0.75, 1], labels=["0%", "25%", "50%", "75%", "100%"])
    colorbar.outline.set_linewidth(0.7)
    fig.suptitle("Intended-to-invoked moral foundation transitions", fontsize=13, fontweight="semibold")
    export_figure(fig, "figure5_foundation_transitions_v2")


def make_contact_sheet() -> None:
    files = [
        ("Figure 1", "figure1_input_language_effects_v2.png"),
        ("Figure 2", "figure2_cultural_framing_heatmap_v2.png"),
        ("Figure 3", "figure3_response_language_effects_v2.png"),
        ("Figure 4", "figure4_reference_divergence_v2.png"),
        ("Figure 5", "figure5_foundation_transitions_v2.png"),
    ]
    width = 2400
    margin = 90
    gap = 70
    cell_width = (width - 2 * margin - gap) // 2
    label_height = 48
    thumbnails: list[tuple[str, Image.Image]] = []
    for label, filename in files:
        image = Image.open(OUTPUT / filename).convert("RGB")
        image.thumbnail((cell_width, 900), Image.Resampling.LANCZOS)
        thumbnails.append((label, image.copy()))

    row_heights = []
    for start in (0, 2):
        row_heights.append(max(thumbnails[index][1].height for index in range(start, start + 2)) + label_height)
    final_height = thumbnails[4][1].height + label_height
    height = margin * 2 + sum(row_heights) + final_height + gap * 2
    sheet = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("arial.ttf", 34) if Path("C:/Windows/Fonts/arial.ttf").exists() else ImageFont.load_default()

    y = margin
    for row, start in enumerate((0, 2)):
        for column in range(2):
            label, image = thumbnails[start + column]
            x = margin + column * (cell_width + gap) + (cell_width - image.width) // 2
            draw.text((x, y), label, fill="#222222", font=font)
            sheet.paste(image, (x, y + label_height))
        y += row_heights[row] + gap
    label, image = thumbnails[4]
    x = (width - image.width) // 2
    draw.text((x, y), label, fill="#222222", font=font)
    sheet.paste(image, (x, y + label_height))
    sheet.save(OUTPUT / "all_figures_contact_sheet_v2.png", dpi=(300, 300))


def verify_outputs() -> dict[str, tuple[int, int]]:
    basenames = [
        "figure1_input_language_effects_v2",
        "figure2_cultural_framing_heatmap_v2",
        "figure3_response_language_effects_v2",
        "figure4_reference_divergence_v2",
        "figure5_foundation_transitions_v2",
    ]
    forbidden = [
        "chatgpt",
        "gemini_flash",
        "gemini_pro",
        "en_en",
        "translation_reason",
        "adapted_reason",
        "reasoning-language",
        "Designed-to-invoked",
    ]
    dimensions = {}
    for basename in basenames:
        png = OUTPUT / f"{basename}.png"
        pdf = OUTPUT / f"{basename}.pdf"
        svg = OUTPUT / f"{basename}.svg"
        with Image.open(png) as image:
            dpi = image.info.get("dpi", (0, 0))
            if min(dpi) < 299:
                raise RuntimeError(f"{png.name}: expected 300 dpi, found {dpi}")
            dimensions[basename] = image.size
        svg_text = svg.read_text(encoding="utf-8")
        if "<text" not in svg_text:
            raise RuntimeError(f"{svg.name}: text was not preserved as vector text")
        if pdf.stat().st_size < 2_000 or svg.stat().st_size < 2_000:
            raise RuntimeError(f"{basename}: suspiciously small vector export")
        lowered = svg_text.lower()
        leaked = [term for term in forbidden if term.lower() in lowered]
        if leaked:
            raise RuntimeError(f"{svg.name}: forbidden labels found: {leaked}")
    return dimensions


def write_report(dimensions: dict[str, tuple[int, int]]) -> None:
    rows = []
    metadata = [
        ("Figure 1", "results/figures/data/figure1_language_effect_by_model.csv", "results/processed/analysis/model_comparison.csv", "figure1_input_language_effects_v2"),
        ("Figure 2", "results/figures/data/figure2_framing_heatmap.csv", "results/processed/analysis/foundation_breakdown.csv", "figure2_cultural_framing_heatmap_v2"),
        ("Figure 3", "results/figures/data/figure3_reasoning_effect_by_model.csv", "results/processed/analysis/model_comparison.csv", "figure3_response_language_effects_v2"),
        ("Figure 4", "results/figures/data/figure4_reference_divergence.csv", "results/processed/analysis/reference_divergence.csv", "figure4_reference_divergence_v2"),
        ("Figure 5", "results/figures/data/figure5_foundation_transitions.csv", "results/processed/analysis/foundation_transitions.csv", "figure5_foundation_transitions_v2"),
    ]
    for figure, plotted, canonical, basename in metadata:
        width, height = dimensions[basename]
        rows.append(f"| {figure} | `{plotted}` | `{canonical}` | Exact | {width} x {height} px | 300 |")

    report = f"""# Figure Regeneration Report

## Scope

Figures 1-5 were regenerated as a figure-only publication pass. No raw data, processed data, statistical definitions, inclusion rules, estimates, confidence intervals, p-values, q-values, effect sizes, or findings were changed. Existing figures and scripts were preserved.

Draft 4 (`C:/Users/anshi/Downloads/Draft 4.pdf`) and the original PNG/SVG/PDF figures were inspected before regeneration. The generator validates every plotting row against the canonical processed table and stops on any discrepancy.

## Reproducibility

- Script for all figures: `scripts/figures/publication_v2/generate_publication_figures.py`
- Command: `py -3 scripts/figures/publication_v2/generate_publication_figures.py`
- Output directory: `results/figures/publication_v2/`

## Data And Output Validation

| Figure | Plotting data | Canonical cross-check | Numerical match | PNG dimensions | DPI |
|---|---|---|---|---:|---:|
{chr(10).join(rows)}

All PNGs have a white background and 300 dpi metadata. PDF and SVG files were exported directly from Matplotlib with vector text and graphics; SVG text preservation was verified. The figures were also assembled into `all_figures_contact_sheet_v2.png` for visual inspection.

## Label Mappings

- Models: `chatgpt` -> GPT-4o; `claude` -> Claude Sonnet 4.6; `gemini_flash` -> Gemini 3.5 Flash; `gemini_pro` -> Gemini 3.1 Pro.
- Languages: `hi` -> Hindi; `bn` -> Bengali; `ta` -> Tamil; `es` -> Spanish; `ja` -> Japanese; `ar` -> Arabic.
- Conditions: `en_en` -> English baseline; `translation_reason_en` -> Literal, English response; `translation_reason_l2` -> Literal, same-language response; `adapted_reason_en` -> Adapted, English response; `adapted_reason_l2` -> Adapted, same-language response.
- Figure 3 terminology: reasoning-language wording was replaced with response-language wording; underlying values were not changed.
- Figure 5 terminology: `designed_foundation` is displayed as Original intended foundation; model explanation codes are displayed as Human-coded invoked foundation.
- Full Moral Foundations Theory labels are used throughout in the required order: Care/Harm, Fairness/Cheating, Loyalty/Betrayal, Authority/Subversion, Sanctity/Degradation.

## Figure-Specific Notes

- Figures 1 and 3 preserve the finalized means and 95% confidence intervals, include a zero reference line, and use the same model palette.
- Figure 2 includes all six non-English languages and all five foundations. Its diverging scale is centred at zero with symmetric limits, and annotations show two decimals.
- Figure 4 preserves all five finalized condition groups and explicitly identifies Gemini 3.1 Pro as a reference comparator rather than moral ground truth.
- Figure 5 preserves all 100 transition cells and every count. Cell shading uses the existing within-row proportion scale while annotations show counts.

## Remaining Limitation

Figure 5 necessarily contains dense 5 x 5 matrices in four panels. It has been enlarged and uses wrapped labels, but it should still be checked after final manuscript placement to ensure the publisher's downscaling does not reduce labels below the journal's preferred size. No data or plotting defect remains.
"""
    (OUTPUT / "FIGURE_REGENERATION_REPORT.md").write_text(report, encoding="utf-8")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    configure_style()
    data = validate_sources()
    effect_plot(
        data["figure1"],
        "Input-language effects by evaluated model",
        "Mean rating difference from English baseline",
        "figure1_input_language_effects_v2",
    )
    framing_heatmap(data["figure2"])
    effect_plot(
        data["figure3"],
        "Response-language effects by evaluated model",
        "Same-language minus English-response mean rating",
        "figure3_response_language_effects_v2",
    )
    divergence_plot(data["figure4"])
    transition_heatmaps(data["figure5"])
    (OUTPUT / "FIGURE_CAPTIONS_V2.md").write_text(CAPTIONS, encoding="utf-8")
    dimensions = verify_outputs()
    make_contact_sheet()
    write_report(dimensions)
    print("Generated and verified publication figures in results/figures/publication_v2")


if __name__ == "__main__":
    main()
