# Historical Final Evidence Lock

> **ARCHIVAL ROBUSTNESS PACKAGE.** This directory preserves a later exact-Wilcoxon analysis. It is not the canonical source for qualitative provenance or the declared manuscript statistical policy. See `data/processed/QUALITATIVE_DATA_PROVENANCE.md` and `reports/statistical_policy_reconciliation.md`.

Run from the repository root:

```powershell
corepack pnpm exec tsx scripts/final_evidence_lock/run_final_evidence_lock.ts
```

The command runs Wilcoxon tests, validates provenance and row counts, regenerates all lock outputs, performs 10,000-replicate scenario-cluster bootstraps, and writes the canonical report. It makes no API/model calls and does not modify legacy inputs.

Status: historical quantitative/statistical lock preserved. The final qualitative coding provenance is human-coded and human-adjudicated; see `data/processed/QUALITATIVE_DATA_PROVENANCE.md`.
