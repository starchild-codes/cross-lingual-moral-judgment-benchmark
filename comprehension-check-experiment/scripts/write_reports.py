from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter
from pathlib import Path
from statistics import mean


PROJECT = Path(__file__).resolve().parents[1]
PROCESSED = PROJECT / "data" / "processed"
REPORTS = PROJECT / "reports"


def read_csv(name: str) -> list[dict[str, str]]:
    with (PROCESSED / name).open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def fmt(value: str) -> str:
    return f"{float(value):.3f}"


def cost_estimate(manifest: list[dict[str, str]]) -> dict[str, float]:
    prices = {
        "chatgpt": (2.50, 10.00),
        "claude": (3.00, 15.00),
        "gemini_flash": (1.50, 9.00),
    }
    totals: dict[str, float] = {}
    for model, (input_price, output_price) in prices.items():
        rows = [row for row in manifest if row["model_key"] == model]
        # Conservative preflight estimate for multilingual text: two Unicode
        # characters per input token and eight billed output tokens per call.
        estimated_input_tokens = sum(len(row["full_prompt"]) / 2 for row in rows)
        estimated_output_tokens = 8 * len(rows)
        totals[model] = (
            estimated_input_tokens * input_price / 1_000_000
            + estimated_output_tokens * output_price / 1_000_000
        )
    totals["total"] = sum(totals.values())
    return totals


def write_validation_report(validation: list[dict[str, str]]) -> None:
    critical = sum(int(row["critical_flag_count"]) for row in validation)
    structurally_valid = sum(row["structural_validation"] == "PASS" for row in validation)
    review_required = sum(row["human_review_required"] == "Yes" for row in validation)
    by_language = Counter(row["language_code"] for row in validation)
    by_version = Counter(row["scenario_version"] for row in validation)
    lines = [
        "# Comprehension Item Validation",
        "",
        "## Status",
        "",
        f"- Multilingual rows checked: **{len(validation)}**",
        f"- Structurally valid rows: **{structurally_valid}/{len(validation)}**",
        f"- Critical automated flags: **{critical}**",
        f"- Rows awaiting human review: **{review_required}**",
        "",
        "The automated validator found no missing identifiers, answer choices, answer keys, "
        "duplicate options, malformed replacement characters, moral-judgment wording, or "
        "requests for explanations. Human review is still mandatory because semantic fidelity, "
        "naturalness, and single-correct-answer judgments cannot be established by structural checks.",
        "",
        "## Coverage",
        "",
        "| Language | Rows |",
        "|---|---:|",
    ]
    for language in ("hi", "bn", "ta", "es", "ja", "ar"):
        lines.append(f"| {language} | {by_language[language]} |")
    lines.extend(
        [
            "",
            "| Scenario version | Rows |",
            "|---|---:|",
            f"| Literal | {by_version['literal']} |",
            f"| Adapted | {by_version['adapted']} |",
            "",
            "## Human-review checkpoint",
            "",
            "For every row in `MCQ_Translations`, a native speaker must:",
            "",
            "1. verify the scenario text and MCQ wording preserve the intended factual target;",
            "2. rate semantic fidelity from 1 to 5;",
            "3. rate naturalness from 1 to 5;",
            "4. confirm that exactly one answer is correct;",
            "5. change `native_review_status` to `Approved` only after completing those checks.",
            "",
            "The live runner refuses smoke or full execution until all 960 rows pass this gate.",
        ]
    )
    (REPORTS / "comprehension_item_validation.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )


def write_design_report(
    selected: list[dict[str, str]],
    manifest: list[dict[str, str]],
    verification: dict[str, object],
) -> None:
    costs = cost_estimate(manifest)
    table = [
        "| Foundation | Tier | Scenario | Input MAD | Adaptation MAD | Response MAD | Max | Nonzero/72 | Human match |",
        "|---|---|---|---:|---:|---:|---:|---:|---|",
    ]
    for row in selected:
        table.append(
            f"| {row['foundation']} | {row['selection_tier']} | {row['scenario_id']} | "
            f"{fmt(row['input_language_mad'])} | {fmt(row['adaptation_mad'])} | "
            f"{fmt(row['response_language_mad'])} | {float(row['maximum_observed_shift']):.0f} | "
            f"{row['nonzero_total_effect_count']} | {row['human_majority_foundation']} "
            f"({row['num_coders_matching_intended']}/3) |"
        )
    lines = [
        "# Multilingual Comprehension-Check Design Report",
        "",
        "## Purpose",
        "",
        "This package prepares a 720-work-unit experiment to test whether previously observed "
        "cross-linguistic rating shifts could be explained by simple factual misunderstanding. "
        "It does not ask models to repeat a moral judgment. Each model receives one full scenario "
        "and answers four factual multiple-choice questions.",
        "",
        "No paid model calls were made during preparation.",
        "",
        "## Scenario selection",
        "",
        "The primary shift metric is the mean absolute deviation from the English baseline "
        "(`en_en`) for literal non-English scenario input with English-language reasoning/response. "
        "It averages 18 effects per scenario: 3 authorized models x 6 languages.",
        "",
        "Selection was stratified by the five Moral Foundations Theory foundations. Within each "
        "foundation, the two highest and two lowest primary-shift scenarios were selected. Only "
        "scenarios with a resolved three-coder human majority matching the intended foundation "
        "were eligible. Ties were resolved by stronger coder agreement and then lower scenario ID.",
        "",
        *table,
        "",
        "The completed workbook includes `Scenario_Shift_Audit`, which records all 50 scenarios, "
        "eligibility decisions, ranks, metrics, and selection/exclusion rationales.",
        "",
        "## MCQ design",
        "",
        "- 20 scenarios",
        "- 4 questions per scenario: actor, main action, affected party/object, consequence/outcome",
        "- 80 English source questions",
        "- 6 languages x 2 scenario versions = 12 non-English variants per question",
        "- 960 multilingual MCQ rows",
        "- Answer positions are balanced: 20 each for A, B, C, and D in the English source set",
        "- Questions use role-based wording to avoid adaptation-specific names and locations",
        "- No question requests blameworthiness, moral evaluation, explanation, or justification",
        "",
        "The non-English MCQs are automated machine-translation drafts. They are intentionally "
        "marked `Pending native-speaker review`; no reviewer identity, score, approval, or note "
        "has been invented.",
        "",
        "## Run manifest",
        "",
        "The manifest contains exactly `20 x 6 x 2 x 3 = 720` unique work units. Each row stores "
        "the exact model ID, prompt, question IDs, answer key, temperature, output limit, reasoning "
        "setting, and empty result/usage fields.",
        "",
        "| Model key | Exact model ID | Work units |",
        "|---|---|---:|",
        "| chatgpt | `openai/gpt-4o-2024-11-20` | 240 |",
        "| claude | `anthropic/claude-sonnet-4.6` | 240 |",
        "| gemini_flash | `google/gemini-3.5-flash` | 240 |",
        "",
        "All models use temperature 0 and a 24-token completion limit. Gemini uses "
        "`reasoning.effort = minimal`; no model substitution is permitted.",
        "",
        "## Runner safeguards",
        "",
        "The runner uses SQLite for attempts and final results, enforces unique work-unit IDs, "
        "supports retries and resume, stores raw output and provider usage/cost metadata, and "
        "archives an active database before a replacement run. Parsing accepts only exactly four "
        "comma-separated letters A-D. The human-review gate blocks both smoke and full live runs.",
        "",
        "## Planned analysis",
        "",
        "The primary outcome is item-level factual accuracy, with scenario-level 4/4 accuracy as "
        "a stricter secondary outcome. Results will be summarized by model, language, literal vs. "
        "adapted version, MFT foundation, high vs. low shift tier, and question type. Misses will "
        "be retained at item level with the selected option, answer key, raw response, and prompt "
        "metadata. Comparisons between high- and low-shift scenarios are diagnostic and should not "
        "be treated as independent causal estimates from only 20 selected scenarios.",
        "",
        "## Cost estimate",
        "",
        "Using a deliberately conservative preflight approximation of one input token per two "
        "Unicode characters and eight billed output tokens per call, the estimated list-price cost is:",
        "",
        f"- GPT-4o: **${costs['chatgpt']:.2f}**",
        f"- Claude Sonnet 4.6: **${costs['claude']:.2f}**",
        f"- Gemini 3.5 Flash: **${costs['gemini_flash']:.2f}**",
        f"- Total: **${costs['total']:.2f}**",
        "",
        "Pricing basis checked on 2026-07-27: GPT-4o $2.50/$10, Claude Sonnet 4.6 $3/$15, "
        "and Gemini 3.5 Flash $1.50/$9 per million input/output tokens. Actual cost may differ "
        "because tokenization and caching vary; provider-reported cost metadata is authoritative.",
        "",
        "## Provenance and integrity",
        "",
        f"- Untouched original workbook SHA-256: `{verification['original_workbook_sha256']}`",
        f"- Completed workbook SHA-256: `{verification['completed_workbook_sha256']}`",
        "- Rating sources: `results/processed/full_1782215308316_vrq93w.ratings.csv` and "
        "`results/processed/extension_full_1782729062659_xqetbf.ratings.csv`",
        "- Scenario sources: `data/scenarios.csv` and `data/scenarios_extension.csv`",
        "- Human validation: `results/processed/scenario_validation_trial2/"
        "scenario_validation_merged_3coders.csv`",
        "- The fourth historical rating model (`gemini_pro`) was excluded; only the three "
        "authorized models were used in shift calculations.",
        "",
        "## Current stopping point",
        "",
        "Preparation is complete. The project is intentionally stopped at native-speaker review. "
        "Do not run the smoke test until every multilingual row is approved and fully rated.",
    ]
    (REPORTS / "comprehension_design_report.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )


def write_readme(verification: dict[str, object]) -> None:
    text = f"""# Multilingual Comprehension Check

This self-contained project prepares a 720-work-unit factual comprehension check for the
20-scenario high/low shift panel. Preparation is complete; paid model evaluation has not begun.

## Current status

- 20 selected scenarios, balanced across five foundations and high/low shift tiers
- 80 English factual MCQs
- 960 multilingual literal/adapted MCQ rows
- 720 unique model work units
- 0 paid API requests
- **Stopped at the required native-speaker review checkpoint**

The translated MCQs are automated drafts. Every row in
`data/processed/multilingual_comprehension_questions.csv` and the workbook
`MCQ_Translations` sheet must be reviewed before live execution.

## Key files

- `multilingual_comprehension_check_completed.xlsx`
- `data/input/multilingual_comprehension_check.xlsx` (untouched original)
- `data/processed/selected_scenarios.csv`
- `data/processed/english_comprehension_questions.csv`
- `data/processed/multilingual_comprehension_questions.csv`
- `data/processed/run_manifest_720.csv`
- `data/processed/comprehension_item_validation.csv`
- `reports/comprehension_item_validation.md`
- `reports/comprehension_design_report.md`

## Integrity

- Original SHA-256: `{verification['original_workbook_sha256']}`
- Completed SHA-256: `{verification['completed_workbook_sha256']}`

## Setup

```powershell
py -3 -m pip install -r requirements.txt
$env:PYTHONPATH = "$PWD\\src"
```

## Validation

```powershell
py -3 scripts\\validate_project.py
py -3 -m pytest
py -3 run_experiment.py --dry-run
```

The dry run performs no network requests and reports 720 work units plus the state of the
human-review gate.

## Native-speaker review

For each of the 960 multilingual rows, reviewers must complete:

1. `semantic_fidelity_1_5`
2. `naturalness_1_5`
3. `single_correct_answer` (`Yes` only when exactly one answer is supported)
4. `native_review_status` (`Approved` only after all checks pass)
5. optional notes for any correction or uncertainty

Do not invent reviewer identities or approvals. Re-run validation after importing reviewed rows.

## Live commands after approval

Three-call smoke test:

```powershell
py -3 run_experiment.py --smoke --replace-active
```

Full resumable experiment:

```powershell
py -3 run_experiment.py --full
```

Both commands require `OPENROUTER_API_KEY`. Exact model IDs and request parameters are stored
in every manifest row. The runner will refuse live execution while review fields remain pending.
"""
    (PROJECT / "README.md").write_text(text, encoding="utf-8")


def main() -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    selected = read_csv("selected_scenarios.csv")
    manifest = read_csv("run_manifest_720.csv")
    validation = read_csv("comprehension_item_validation.csv")
    verification = json.loads((PROCESSED / "build_verification.json").read_text(encoding="utf-8"))
    write_validation_report(validation)
    write_design_report(selected, manifest, verification)
    write_readme(verification)
    print("Reports and README written.")


if __name__ == "__main__":
    main()
