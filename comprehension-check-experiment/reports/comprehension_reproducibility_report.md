# Comprehension Analysis Reproducibility Report

## Sources and Integrity

- Active comprehension database SHA-256: `d56b470a2f292e5fe99abb6cbf46129b1780b6fa4107c5de5db89fa598fe6b9f`
- Work-unit results SHA-256: `516ea4a858dc47da6c2177a5a931f40ece9cd7e1bb9bbbed36d1a897f4e2d1a2`
- Item-level results SHA-256: `b913e017193f30234b0c96965ac808a66ca0f97660e9915dd5db1757f44d57b1`
- Original rating source 1 SHA-256: `971ea311e52ecd6bd79c8cfb177fd38d9b3330defe3ebaf1d662f66ae72166af`
- Original rating source 2 SHA-256: `4fd4f75ef784da7828f40f562d445e5933260d7d658983dfa8cb59154b967b8b`
- One-to-one merged rows: **720**
- Item rows: **2,880**
- Scenario clusters: **20**

## Shift Construction

For each exact scenario-model-language-version work unit, the script subtracts the same
model's English `en_en` rating from the non-English input/English response rating and takes
the absolute value. Literal rows use `{language}_translation_reason_en`; adapted rows use
`{language}_adapted_reason_en`. The merge is required to validate one-to-one. Only
`openai/gpt-4o-2024-11-20`, `anthropic/claude-sonnet-4.6`, and
`google/gemini-3.5-flash` are accepted.

## Statistical Procedures

Spearman confidence intervals and mean-difference confidence intervals use
10,000 percentile bootstrap resamples of the 20 scenarios with replacement,
seed 20260727. OLS standard errors are clustered by scenario with the finite-sample
covariance correction and t-based inference. Mann-Whitney U is two-sided and asymptotic
because the data contain ties.

## Normalization Audit

The 150 normalized responses are reproduced from their raw outputs using only the exact
locale separators and localized A-D aliases encoded in the parser. The audit rejects any
row with other free text, a token count other than four, or a changed response order.

## Reproduction

```powershell
$env:PYTHONPATH = "$PWD\src"
py -3 scripts\complete_association_analysis.py
py -3 scripts\validate_project.py
py -3 -m pytest
py -3 run_experiment.py --dry-run
```

These analysis commands make no API requests.
