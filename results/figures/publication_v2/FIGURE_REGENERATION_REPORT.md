# Figure Regeneration Report

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
| Figure 1 | `results/figures/data/figure1_language_effect_by_model.csv` | `results/processed/analysis/model_comparison.csv` | Exact | 2230 x 1512 px | 300 |
| Figure 2 | `results/figures/data/figure2_framing_heatmap.csv` | `results/processed/analysis/foundation_breakdown.csv` | Exact | 2229 x 1722 px | 300 |
| Figure 3 | `results/figures/data/figure3_reasoning_effect_by_model.csv` | `results/processed/analysis/model_comparison.csv` | Exact | 2230 x 1512 px | 300 |
| Figure 4 | `results/figures/data/figure4_reference_divergence.csv` | `results/processed/analysis/reference_divergence.csv` | Exact | 2230 x 1653 px | 300 |
| Figure 5 | `results/figures/data/figure5_foundation_transitions.csv` | `results/processed/analysis/foundation_transitions.csv` | Exact | 2192 x 2374 px | 300 |

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
