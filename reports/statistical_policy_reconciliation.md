# Statistical Policy Reconciliation

## Purpose

This note distinguishes the repository's manuscript-era paired-test outputs from the later exact-Wilcoxon robustness lock. It does not change any estimates, p-values, correction families, figures, or conclusions.

## Declared Manuscript Policy

The final manuscript declares the manuscript-era paired-t framework, including its reported confidence intervals and manuscript-family Benjamini-Hochberg correction, as the **primary inferential framework**. Exact-Wilcoxon results with `q_w_primary_105`, `q_w_effect_35`, and scenario-cluster bootstrap intervals are retained as a later robustness/sensitivity analysis.

Both tracks use the same observations but apply different inferential and correction conventions. The robustness track must not be mistaken for the manuscript-primary track. This declaration changes no numerical result.

## Two Preserved Inference Tracks

| Track | Location | Statistical framing | Status |
| --- | --- | --- | --- |
| Manuscript-era analysis | `phase1_evidence_report*.md` and original processed outputs | Paired t tests with reported confidence intervals and manuscript-family multiple-testing correction | Declared manuscript-primary framework |
| Later robustness lock | `results/processed/final_evidence_lock/` | Exact two-sided Wilcoxon signed-rank/sign-permutation inference, 105-test BH family, 35-test supplementary effect-family BH correction, and scenario-cluster bootstrap intervals | Retained robustness/sensitivity framework |

The lock's `PAPER_READY_STATISTICAL_RESULTS.md` calls the exact-Wilcoxon family “primary,” whereas earlier manuscript-era materials use paired t tests. These are distinct analysis policies, not interchangeable labels.

## Public-Release Rule

Public documentation must identify which track supports each statement. Do not silently replace manuscript paired-t results with exact-Wilcoxon results, or vice versa. The two tracks share the same underlying observations but differ in inferential method and correction family.

The qualified cross-track wording for cultural adaptation is: **Cultural adaptation produced the most consistent significance-based corrected pattern, whereas other consistency criteria showed a more mixed picture.**

## Remaining Scope

This document resolves only the declaration of the primary manuscript framework. It preserves any numerical differences between the two inference tracks without adjudicating them away or treating the robustness analysis as invalid.
