# Authority/Subversion Reproducibility

- Status: **PASS**
- S11 explanation rows: **100**
- S30 explanation rows: **100**
- Unique explanation rows: **200**
- Authority/Subversion codes across S11/S30: **13/200**
- Condition identifiers per scenario: **25**
- API calls: **none**

## Exact Command

```powershell
py -3 scripts\authority_subversion_expansion.py
py -3 -m py_compile scripts\authority_subversion_expansion.py
```

Source hashes, output hashes, package versions, subgroup denominators, translation
dependence, and manual thematic decisions are recorded in
`results/processed/authority_subversion_reproducibility.json`.
