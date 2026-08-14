# Historical Final Evidence Lock Reproducibility

> **ARCHIVAL ROBUSTNESS PACKAGE - NOT THE CANONICAL QUALITATIVE PROVENANCE.**
>
> This package preserves a later exact-Wilcoxon robustness analysis. Its historical source-path and generated-prose claims about qualitative coding are superseded by `data/processed/QUALITATIVE_DATA_PROVENANCE.md`. Its statistical policy is reconciled, without changing results, in `reports/statistical_policy_reconciliation.md`.

## Software

- Runtime: Node.js v24.17.0
- Package manager: pnpm via Corepack
- TypeScript runner: tsx (version pinned in the project lockfile)
- CSV parser: csv-parse (version pinned in the project lockfile)

## One Command

```powershell
corepack pnpm exec tsx scripts/final_evidence_lock/run_final_evidence_lock.ts
```

## Inputs And Mappings

Ratings come from `results/processed/full_merged.csv`. The final qualitative coding source is `data/processed/qualitative_human_adjudicated_final.csv`; see its provenance note for the two independent human coders and human adjudication. Historical field names in older input artifacts are retained only for traceability. Human scenario-majority labels come from `scenario_validation_merged_3coders.csv`.

## Fixed Analysis Settings

- Pooled primary models: chatgpt, claude, gemini_flash; gemini_pro excluded.
- Exact Wilcoxon: two-sided sign permutation over average ranks; zeros excluded; all observed samples solved exactly by dynamic programming.
- Bootstrap: 10000 scenario-cluster resamples; base seed 20260716; row seed is base seed plus deterministic row index.
- FDR: primary 105-test BH family within each label version; supplementary 35-test family within version and effect type.
- Label versions: 50 intended scenarios; 39 validated-subset scenarios; 46 resolved human-majority scenarios.
- Unresolved scenarios: S03, S09, S13, S35.

## Expected Gates

5,000 ratings; 1,000 explanations; 100 explanations per qualitative target; 50 scenario-validation rows; 728/1,000 intended match; foundation matches 200, 200, 13, 199, and 116 in the documented order; S11 distribution 86 Loyalty, 13 Authority, 1 Care; S30 100 Care; no literal p=0; all Wilcoxon unit tests pass.

## Outputs

All generated tables and documentation are written beneath `results/processed/final_evidence_lock/`; the canonical report is `phase1_evidence_report_reproducibility.md`.

## Resolved Declared Package Versions

- tsx: ^4.16.2
- csv-parse: ^5.5.6
