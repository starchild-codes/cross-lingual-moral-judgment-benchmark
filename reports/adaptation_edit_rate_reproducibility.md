# Adaptation Edit-Rate Reproducibility

- Status: **PASS**
- Scenario-language pairs: **300**
- Model-level merged rows: **900**
- Duplicate merged keys: **0**
- Missing effects: **0**
- Bootstrap repetitions: **10,000**
- Random seed: **20260727**
- Cluster: `scenario_id`
- API calls: **none**

## Command

```powershell
py -3 scripts\adaptation_edit_audit.py
Set-Location neutral-control-experiment
py -3 -m pytest
Set-Location ..\comprehension-check-experiment
py -3 -m pytest
```

Exact source hashes, output hashes, package versions, row counts, and merge diagnostics are
stored in `data/processed/adaptation_edit_reproducibility.json`.
