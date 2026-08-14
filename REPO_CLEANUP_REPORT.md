# Repository Cleanup Report

## Scope

This cleanup canonicalized public-release paths and documentation without rerunning experiments, making API calls, changing scenario text, altering model outputs, or changing numerical results. A pre-cleanup Git branch was retained as `backup/pre-public-release-cleanup-20260814`.

## Canonicalization Completed

- Created `data/scenarios_final_50.csv`, containing exactly `S01`-`S50`.
- Created `data/processed/qualitative_human_adjudicated_final.csv`, containing exactly 1,000 qualitative rows and an explicit human-adjudicated label column.
- Added scenario and qualitative provenance notes.
- Added `paper_materials/FINAL_STUDY_SPECIFICATION.md` as the authoritative 50-scenario study definition.
- Moved the obsolete 25-scenario `PROJECT_SPEC.md` to `archive/legacy_initial_project_spec.md` and added an archival warning.
- Added `archive/README.md` and rewrote the root README around canonical inputs, outputs, and terminology.
- Added `reports/statistical_policy_reconciliation.md` to distinguish the manuscript-era paired-t track from the later exact-Wilcoxon robustness lock.

## Historical Evidence Preserved

No historical data or reports were deleted. Historical `ai_mft`, `llama`, and `deepseek` paths are retained for traceability but are explicitly noncanonical; their names do not describe the final human coding process.

## Reconciled Source Anomaly

`data/scenarios.csv` uses legacy numeric IDs for the first 25 scenarios and includes one non-scenario workbook-metadata row. The canonical file maps numeric IDs to `S01`-`S25` and excludes only that metadata row. `data/scenarios_extension.csv` provides `S26`-`S50`.

## Manual Review Required

The historical `results/processed/final_evidence_lock/` package contains generated prose that contradicts the final human-coding provenance and calls its exact-Wilcoxon approach “primary.” It remains preserved as historical evidence and is not a canonical source for qualitative provenance or declared manuscript inference. Authors must choose the manuscript's declared primary inferential policy before external submission; see `reports/statistical_policy_reconciliation.md`.

## Security

The tracked-tree security scan found scenario-validation access tokens embedded in the historical scenario-validation README. They were replaced with placeholders, including tokenized example URLs. Those credentials should be rotated before public release because they were previously present in tracked history. No credentials, private coder links, or active result stores are intentionally included in the canonical public-release documentation.

## Verification

- Canonical scenario dataset: 50 ordered IDs (`S01`-`S50`), with nonempty English scenario text.
- Canonical qualitative dataset: 1,000 qualitative rows; every explicit human-adjudicated label matches the preserved final-label value.
- Historical `full_merged_with_ai_mft_codes.csv` and clearly named `full_merged_with_human_mft_codes.csv` are byte-identical, confirming that the change is provenance naming rather than a data revision.
- Test suites passed: root Vitest 15/15; neutral-control Python tests 38/38; comprehension-check Python tests 31/31.
- `git diff --check` passed.

`corepack pnpm exec tsc --noEmit` still reports three pre-existing type errors in `scripts/final_evidence_lock/run_final_evidence_lock.ts` (lines 283, 339, and 368). That archival script was not rerun or behaviorally changed during cleanup; the errors should be resolved in a dedicated maintenance change before treating a full TypeScript compilation as a release gate.
