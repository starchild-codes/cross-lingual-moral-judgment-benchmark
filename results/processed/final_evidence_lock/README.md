# Final Evidence Lock

Run from the repository root:

```powershell
corepack pnpm exec tsx scripts/final_evidence_lock/run_final_evidence_lock.ts
```

The command runs Wilcoxon tests, validates provenance and row counts, regenerates all lock outputs, performs 10,000-replicate scenario-cluster bootstraps, and writes the canonical report. It makes no API/model calls and does not modify legacy inputs.

Status: quantitative/statistical lock regenerated successfully; qualitative two-human provenance gate failed. See `FINAL_EVIDENCE_LOCK_BLOCKERS.md`.
