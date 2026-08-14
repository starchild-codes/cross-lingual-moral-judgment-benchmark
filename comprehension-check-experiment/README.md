# Multilingual Comprehension Check

This self-contained project implements and analyzes a 720-work-unit factual comprehension
check for the 20-scenario high/low shift panel. The live evaluation and final analysis are complete.

## Current status

- 20 selected scenarios, balanced across five foundations and high/low shift tiers
- 80 English factual MCQs
- 960 multilingual literal/adapted MCQ rows
- 720/720 unique model work units completed, 240 per model
- 2,880 factual answers scored
- 96.354% overall item accuracy
- 86.111% scenario-level 4/4 accuracy
- Native-speaker review complete: 960/960 rows approved

All 960 multilingual MCQ rows have completed external review and are approved for the configured live evaluation.

## Key files

- `multilingual_comprehension_check_approved.xlsx`
- `multilingual_comprehension_check_completed.xlsx` (preserved pre-approval workbook)
- `data/input/multilingual_comprehension_check.xlsx` (untouched original)
- `data/processed/selected_scenarios.csv`
- `data/processed/english_comprehension_questions.csv`
- `data/processed/multilingual_comprehension_questions.csv`
- `data/processed/run_manifest_720.csv`
- `data/processed/comprehension_item_validation.csv`
- `results/processed/item_level_results.csv`
- `results/processed/work_unit_results_with_rating_shift.csv`
- `results/processed/comprehension_shift_analysis.json`
- `results/processed/final_live_audit.json`
- `results/figures/`
- `results/plotting_data/`
- `reports/comprehension_results_report.md`
- `reports/comprehension_error_audit.md`
- `reports/comprehension_reproducibility_report.md`

## Integrity

- Original SHA-256: `d1462380a5d335663a83ca62e69af98eec937cedf3c2079a93f257e65a5c8dbb`
- Completed SHA-256: `c2a15e62821459c2d41d699fde686fda272268bdc064608785fbc98a395c298e`
- Approved SHA-256: `a45e60df32e3773dea3951e555eceeb721d7f8210ab905cadc5b026d10344285`

## Setup

```powershell
py -3 -m pip install -r requirements.txt
$env:PYTHONPATH = "$PWD\src"
```

## Validation

```powershell
py -3 scripts\validate_project.py
py -3 -m pytest
py -3 run_experiment.py --dry-run
```

The dry run performs no network requests and reports 720 work units plus the state of the
human-review gate.

## Native-speaker review

All 960 multilingual MCQ rows were externally reviewed by speakers competent in the
respective languages. Reviewers approved every row without revisions. Because approval
was categorical, semantic fidelity and naturalness were conservatively encoded as 4/5;
no reviewer identities were invented.

## Reproduction commands

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
It verifies all three exact IDs against OpenRouter's model registry before any paid request.

```powershell
py -3 -m comprehension_check.analysis
py -3 scripts\finalize_live_results.py
py -3 scripts\complete_association_analysis.py
```

The active SQLite store contains all 720 final observations and 743 preserved attempt rows.
Earlier stopped-run and smoke evidence remains under `results/archive/` and is excluded from
the final dataset.

The completed association analysis attaches exactly one original moral-rating shift to every
comprehension work unit, runs scenario-clustered inference and diagnostic regressions, and
exports exact subgroup and error-concentration tables. These analysis commands use existing
local results and make no API requests.
