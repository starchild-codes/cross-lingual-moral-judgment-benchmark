# Statistical Policy Reconciliation

## Purpose

This note distinguishes the repository's manuscript-era paired-test outputs from the later exact-Wilcoxon robustness lock. It does not change any estimates, p-values, correction families, figures, or conclusions.

## Two Preserved Inference Tracks

| Track | Location | Statistical framing | Status |
| --- | --- | --- | --- |
| Manuscript-era analysis | `phase1_evidence_report*.md` and original processed outputs | Paired t tests with reported confidence intervals and multiple-testing corrections | Preserved as the manuscript-era result path |
| Later robustness lock | `results/processed/final_evidence_lock/` | Exact two-sided Wilcoxon signed-rank/sign-permutation inference, 105-test primary BH family, 35-test supplementary effect-family BH correction, and scenario-cluster bootstrap intervals | Preserved as a later robustness analysis |

The lock's `PAPER_READY_STATISTICAL_RESULTS.md` calls the exact-Wilcoxon family “primary,” whereas earlier manuscript-era materials use paired t tests. These are distinct analysis policies, not interchangeable labels.

## Public-Release Rule

Public documentation must identify which track supports each statement. Do not silently replace manuscript paired-t results with exact-Wilcoxon results, or vice versa. The two tracks share the same underlying observations but differ in inferential method and correction family.

The qualified cross-track wording for cultural adaptation is: **Cultural adaptation produced the most consistent significance-based corrected pattern, whereas other consistency criteria showed a more mixed picture.**

## Manual Review Required

Before final manuscript submission, the authors must decide which inferential track is the declared primary analysis and revise the manuscript consistently. This is a scientific-reporting decision; repository cleanup cannot resolve it without changing the declared analysis policy. No numeric result was changed during this reconciliation.
