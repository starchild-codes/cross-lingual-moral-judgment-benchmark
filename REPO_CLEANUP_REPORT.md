# Repository Cleanup Report

## Scope

The public-release cleanup canonicalized paths and documentation without rerunning experiments, making API calls, changing scenario text, altering model outputs, qualitative labels, or numerical results. A pre-cleanup Git branch remains available as `backup/pre-public-release-cleanup-20260814`.

## Canonicalization Completed

- Created `data/scenarios_final_50.csv`, containing exactly `S01`-`S50`.
- Created `data/processed/qualitative_human_adjudicated_final.csv`, containing exactly 1,000 qualitative rows and an explicit human-adjudicated label column.
- Added scenario and qualitative provenance notes plus `paper_materials/FINAL_STUDY_SPECIFICATION.md`.
- Archived the obsolete 25-scenario `PROJECT_SPEC.md` at `archive/legacy_initial_project_spec.md` with an archival warning.
- Added `reports/statistical_policy_reconciliation.md` and separated historical exact-Wilcoxon materials from manuscript-primary documentation.

## Historical Evidence Preserved

No historical data or reports were deleted. Historical `ai_mft`, `llama`, and `deepseek` paths remain for traceability but do not describe the final human coding process.

## Source Reconciliation

`data/scenarios.csv` uses legacy numeric IDs for the first 25 scenarios and includes one non-scenario workbook-metadata row. The canonical file maps numeric IDs to `S01`-`S25` and excludes only that metadata row. `data/scenarios_extension.csv` provides `S26`-`S50`.

## Historical Evidence-Lock Boundary

The historical `results/processed/final_evidence_lock/` package uses the exact-Wilcoxon policy as its internal primary convention. It remains preserved as a robustness/sensitivity analysis and is not the manuscript-primary inference track. The final manuscript declares the paired-t framework as primary; see `reports/statistical_policy_reconciliation.md`.

## Security

Previously exposed scenario-validation credentials were removed from the current tracked tree. Any credential that was ever committed must be rotated/revoked by the repository owner. No current active-looking credential, private coder link, or active result store was detected in the tracked tree.

## Verification

- Canonical scenario dataset: 50 ordered IDs (`S01`-`S50`), with nonempty English scenario text.
- Canonical qualitative dataset: 1,000 qualitative rows; every explicit human-adjudicated label matches the preserved final-label value.
- Historical `full_merged_with_ai_mft_codes.csv` and clearly named `full_merged_with_human_mft_codes.csv` are byte-identical, confirming a provenance naming correction rather than a data revision.

## Final Publication-Readiness Pass

- Primary statistical policy declared: the manuscript-era paired-t framework is the final manuscript's primary inferential framework.
- Robustness track preserved: exact-Wilcoxon, `q_w_primary_105`, `q_w_effect_35`, and scenario-cluster bootstrap outputs remain available as robustness/sensitivity analyses.
- TypeScript errors fixed with type-only narrowing; `corepack pnpm exec tsc --noEmit` passes.
- Root tests pass: Vitest 15/15.
- Neutral-control tests pass: pytest 38/38.
- Comprehension-check tests pass: pytest 31/31.
- Current-tree security scan: PASS; no active-looking tracked secrets were detected.
- Credential rotation remains an owner action for any credential previously committed in repository history.
- No scientific result, scenario text, qualitative label, model response, or statistical value was changed. No paid/API call was made.

Publication-readiness status: PASS.
