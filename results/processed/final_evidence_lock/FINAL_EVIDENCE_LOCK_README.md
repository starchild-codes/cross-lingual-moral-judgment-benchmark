# Final Evidence Lock Reproducibility

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

Ratings come from `results/processed/full_merged.csv`. Response-level qualitative codes come from `full_merged_with_ai_mft_codes.csv` and map exactly to `ai_mft_codes_adjudicated.csv`: `llama_label -> ai_mft_llama_label`, `deepseek_label -> ai_mft_deepseek_label`, and `adjudicated_label -> ai_mft_final_label`. These are not human-coder mappings. Human scenario-majority labels come from `scenario_validation_merged_3coders.csv`.

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

All generated tables and documentation are written beneath `results/processed/final_evidence_lock/`; the canonical report is `PHASE1_FINAL_EVIDENCE_REPORT_LOCKED.md`. The qualitative human-provenance gate is expected to remain blocked unless genuine human coder exports are supplied.

## Resolved Declared Package Versions

- tsx: ^4.16.2
- csv-parse: ^5.5.6
