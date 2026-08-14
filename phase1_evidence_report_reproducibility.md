# Phase 1 Final Evidence Report: Locked

Generated locally from finalized files without API or model calls. This report supersedes earlier Phase 1 reports for interpretation.

## Executive Summary

The intended-label qualitative counts reproduce exactly, and the corrected quantitative pipeline passes all statistical gates. The 1,000 qualitative explanations were coded independently by two human coders and resolved through human adjudication. The separate 50-scenario validation was completed by three blinded human coders.

## Exact Source Files

- `results/processed/full_merged.csv`: 5,000 ratings plus the uncoded explanation rows in the merged dataset.
- `results/processed/full_merged_with_human_mft_codes.csv`: human-adjudicated response-code merge.
- Historical files and fields containing `ai_mft`, `llama`, or `deepseek` in their names are retained for traceability; those names do not accurately describe the final human coding process.
- `results/processed/scenario_validation_trial2/scenario_validation_merged_3coders.csv`: three-human, 50-scenario validation.

Hashes, row counts, and inclusion decisions are in `FINAL_EVIDENCE_INPUT_INVENTORY.md`.

## Qualitative Coding Provenance

The 1,000 explanations were coded independently by two human coders. Disagreements and invalid or uncertain cases were resolved through human adjudication. The final labels are human-adjudicated labels. The historical filename `full_merged_with_ai_mft_codes.csv` and similarly named fields are legacy artifacts and do not accurately describe the final coding process.

## Human-Coder Reliability

Human inter-rater reliability for the qualitative explanations was 96.2% raw agreement, with Cohen's kappa = 0.948. These values describe agreement between the two independent human coders before human adjudication.

## Existing-Result Reproduction

The adjudicated response codes reproduce 728/1000 (72.80%) intended-label agreement: Care/Harm 200/200, Loyalty/Betrayal 200/200, Fairness/Cheating 199/200, Sanctity/Degradation 116/200, and Authority/Subversion 13/200 (6.50%). These are descriptive results based on the human-adjudicated explanation labels.

## Three-Coder Scenario Validation

Across 50 English scenarios, pairwise raw agreement was A-B 74.00%, A-C 68.00%, B-C 70.00%; pairwise Cohen's kappa was A-B 0.67155129, A-C 0.59758551, B-C 0.62537463. Mean pairwise kappa was 0.63150381 and Fleiss' kappa was 0.62929679. Majority labels matched intended labels for 39/50; Authority matched for 5/10. S03, S09, S13, and S35 remained unresolved.

## Intended Versus Human-Majority Qualitative Analysis

Intended-reference match was 728/1000; resolved human-scenario-majority-reference match was 716/1000. Authority/Subversion was 13/200 under intended labels and 0/100 under human scenario-majority labels. The comparison changes the scenario reference label only; explanation labels remain human-adjudicated.

## S11 Findings

S11 intended Authority/Subversion but human majority Care/Harm. Its 100 explanation codes were Care/Harm 1/100, Loyalty/Betrayal 86/100, Authority/Subversion 13/100. Thus S11 is not a clean human-validated Authority test.

## S30 Findings

S30 retained a human-majority Authority/Subversion label, while its 100 explanation codes were Care/Harm 100/100. This uniform coding occurs across four source models, seven input languages, and all represented conditions. It supports benchmark-specific model reframing after scenario validation, with the limitation that S30 is one scenario and response codes are not human labels.

## Corrected Wilcoxon Implementation

The legacy tied-rank variance implementation was defective and could return p=1 for nonzero one-direction tied differences. It has been replaced with an exact two-sided random-sign permutation distribution over average ranks, computed by dynamic programming for every observed sample. Zeros are excluded, ties are preserved, all-zero vectors return p=1 explicitly, and no literal p=0 is emitted.

## Statistical Unit Tests

All 10 adversarial signed-rank tests passed, including six equal positive differences (p=.03125), six equal negative differences (p=.03125), ties, zeros, sign inversion, scale invariance, and a larger exact-DP vector.

## Foundation-Label Sensitivity Analysis

The analysis uses 50 intended-label scenarios, a 39-scenario validated subset, and 46 resolved human-majority scenarios. Pooled effects include ChatGPT, Claude, and Gemini Flash only. Paired-t intervals use Student-t critical values. Primary BH correction covers 105 tests per version; supplementary correction covers 35 tests per version/effect.

## Scenario-Clustered Bootstrap

Each of the 315 pooled foundation tests has a 10,000-iteration, fixed-seed scenario bootstrap. Scenarios are resampled as clusters and all associated primary-model paired differences are retained. Exact intervals and cluster counts are in `foundation_scenario_cluster_bootstrap_final.csv`.

## Headline-Finding Classifications

| finding | classification |
| --- | --- |
| Arabic Authority/Subversion input-language effect | lost after validation |
| Arabic Fairness/Cheating reasoning effect | weakened to suggestive |
| Arabic Sanctity/Degradation framing effect | weakened to suggestive |
| Bengali Authority/Subversion input-language effect | directionally stable but not statistically robust |
| Japanese Fairness/Cheating reasoning effect | weakened to suggestive |
| Pooled Authority/Subversion input-language effect | stable |
| Pooled Authority/Subversion reasoning effect | weakened to suggestive |
| Spanish Authority/Subversion framing effect | directionally stable but not statistically robust |
| Spanish Sanctity/Degradation framing effect | directionally stable but not statistically robust |
| Tamil Loyalty/Betrayal input-language effect | directionally stable but not statistically robust |

Exact estimates, p-values, q-values, n, nonzero n, and bootstrap intervals are in `headline_finding_sensitivity_final.csv`.

## Effect-Type Consistency

| analysis_version | effect_type | tests | t_q_primary_lt_05 | t_q_primary_lt_10 | wilcoxon_q_primary_lt_05 | wilcoxon_q_primary_lt_10 | wilcoxon_q_effect_lt_05 | wilcoxon_q_effect_lt_10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| v1_original_intended | language | 35 | 5 | 10 | 4 | 8 | 8 | 9 |
| v1_original_intended | framing | 35 | 5 | 7 | 3 | 5 | 3 | 5 |
| v1_original_intended | reasoning | 35 | 4 | 8 | 3 | 5 | 3 | 4 |
| v2_validated_subset | language | 35 | 2 | 3 | 1 | 3 | 1 | 3 |
| v2_validated_subset | framing | 35 | 4 | 5 | 3 | 5 | 4 | 6 |
| v2_validated_subset | reasoning | 35 | 1 | 5 | 0 | 4 | 0 | 6 |
| v3_human_scenario_majority | language | 35 | 1 | 1 | 1 | 1 | 1 | 1 |
| v3_human_scenario_majority | framing | 35 | 6 | 7 | 5 | 7 | 7 | 8 |
| v3_human_scenario_majority | reasoning | 35 | 3 | 3 | 3 | 4 | 3 | 4 |
| all_three_versions | language | 35 |  |  |  |  |  |  |
| all_three_versions | framing | 35 |  |  |  |  |  |  |
| all_three_versions | reasoning | 35 |  |  |  |  |  |  |

Framing leads corrected significance counts and cross-version q<.05 survival, while reasoning leads stable-direction and scenario-bootstrap support. No manipulation is unequivocally most consistent across all prespecified criteria.

## Claim-Evidence Matrix

| claim | verdict | evidence | denominator | sensitivity_version | limitation | paper_safe_wording | wording_to_avoid |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Models systematically fail to recognise Authority/Subversion | Not supported | 13/200 response codes matched intended Authority, but scenario validation retained only 5/10 intended Authority labels. | 200 response explanations; 10 scenarios | intended and human-scenario-majority | Two Authority-designed qualitative targets; response codes are human-adjudicated. | Authority/Subversion was seldom invoked in the two Authority-designed qualitative targets. | Models systematically fail to recognise Authority/Subversion. |
| Models rarely invoke Authority/Subversion in explanations for authority-designed scenarios | Supported with qualification | 13/200 (6.50%). | 200 explanations from S11 and S30 | original intended | Only two scenarios. | Authority/Subversion was coded in 13 of 200 explanations for the two Authority-designed targets. | Models cannot recognise authority. |
| Authority/Subversion was the least stable intended foundation in this benchmark | Supported with qualification | Scenario-majority agreement was 5/10 for intended Authority scenarios; qualitative intended match was 13/200. | 10 intended Authority scenarios; 200 target explanations | scenario validation and intended qualitative | Benchmark-specific and English-original validation. | Authority/Subversion showed the weakest intended-label stability in this benchmark. | Authority is universally unstable. |
| Human coders frequently interpreted intended Authority/Subversion scenarios through other foundations | Supported with qualification | Only 5/10 intended Authority scenarios retained an Authority human-majority label. | 10 intended Authority scenarios | three-coder scenario validation | Three coders and English originals only. | Half of intended Authority scenarios received a different or unresolved human-majority interpretation. | Humans cannot recognise Authority. |
| Models frequently framed authority-designed scenarios through Care/Harm or Loyalty/Betrayal | Supported with qualification | See intended transition matrix; S11 was predominantly Loyalty/Betrayal and S30 entirely Care/Harm. | 200 explanations | original intended | Human-adjudicated response labels cover two scenarios. | Explanations for S11 and S30 were predominantly coded as Loyalty/Betrayal and Care/Harm, respectively. | All authority judgments become care or loyalty. |
| Models reframed even a human-validated Authority/Subversion scenario | Supported with qualification | S30 human majority was Authority/Subversion; 100/100 explanation labels were Care/Harm. | 100 S30 explanations | human-scenario-majority | One scenario. | For S30, which retained an Authority human-majority label, all 100 explanations were coded as Care/Harm. | Models always reframe validated Authority scenarios. |
| S30 showed consistent Care/Harm framing across models, languages, and experimental conditions | Supported with qualification | 100/100 S30 explanations were coded Care/Harm across four source models, seven input languages, and all represented conditions. | 100 S30 explanations | descriptive | One scenario and human-adjudicated response labels. | S30 showed uniform Care/Harm coding across the sampled models, languages, and conditions. | S30 proves a population-wide pattern. |
| Cultural adaptation produced the most consistent quantitative effects | Not supported | Framing leads corrected q<.05 counts and cross-version significance, while reasoning leads stable direction and scenario-bootstrap interval support. | 35 tests per effect and version | all three | No manipulation dominates every prespecified consistency criterion. | Framing led significance-based consistency, whereas reasoning led direction and bootstrap-based consistency. | Cultural framing was unequivocally the most consistent manipulation. |
| Input-language effects were selective rather than universal | Supported | Only a subset of 35 tests per version survived corrected q thresholds. | 35 tests per version | all three | Foundation-level pooled tests. | Input-language effects varied by language, foundation, and label definition. | Language always changes moral judgments. |
| Instructed reasoning/response-language effects were selective rather than universal | Supported | Only a subset of 35 tests per version survived corrected q thresholds. | 35 tests per version | all three | Instructed output language is not hidden internal reasoning. | Instructed reasoning/response-language effects were heterogeneous. | The analysis reveals internal reasoning. |
| Authority-related quantitative effects disappeared after human validation | Not supported | Pooled Authority input-language remained q<.05 in both validation versions, while Arabic input-language lost robustness and Spanish framing remained directional but q>=.10. | Authority foundation tests | v2 and v3 | Mixed finding-specific sensitivity. | Human validation weakened some Authority effects but did not eliminate all of them. | All Authority effects disappeared. |
| Foundation-label sensitivity materially changed some individual findings but preserved broader heterogeneity | Supported with qualification | Headline classifications include stable, weakened-to-suggestive, directionally stable/non-robust, and lost-after-validation results. | 10 headline findings; 315 total tests | all three | Heterogeneity is descriptive across a finite benchmark. | Label sensitivity changed several individual inferences while preserving heterogeneous effects across languages and foundations. | Sensitivity analysis proved universal robustness. |
| The 1,000 explanations were independently coded by two humans | Supported | Human inter-rater reliability was 96.2% raw agreement and Cohen's kappa = 0.948; final labels were resolved through human adjudication. | 1,000 explanations | provenance audit | Coder identities remain confidential. | Two independent human coders coded the explanations, with disagreements resolved through human adjudication. | Labels were LLM-generated or AI-assisted. |
| Original qualitative reproduction | Supported with qualification | 728/1000; human-majority-reference 716/1000, Authority 0/100. | 1,000 or resolved-majority subset | intended and majority | Response-label provenance qualification required. | The descriptive counts reproduce from the adjudicated response codes. | Human-coded reproduction. |

## Paper Implications

Use benchmark-specific language: explanations “invoked,” “emphasized,” “framed,” or “were coded as” a foundation. Do not claim direct recognition failure, ground truth, or hidden internal reasoning. Some Authority findings weaken after scenario validation, while pooled Authority input-language remains robust.

## Remaining Limitations

Only two intended Authority scenarios appear in the qualitative target set; only S30 retains a human-majority Authority label; scenario validation covers English originals; MFT categories can blend; explanation coding does not reveal internal cognition; and instructed response language does not expose hidden reasoning.

## Reproducibility Command

`corepack pnpm exec tsx scripts/final_evidence_lock/run_final_evidence_lock.ts`

## Final Validation Checklist

- Data gates: 5,000 ratings, 1,000 explanations, 100 rows per qualitative target, and 50 validation scenarios passed.
- Scenario gates: 39 validated, 46 resolved-majority, four unresolved, S11 Care majority, S30 Authority majority passed.
- Qualitative reproduction gates passed.
- Exact Wilcoxon tests and unit tests passed; no literal p=0.
- Gemini Pro excluded from pooled quantitative estimates.
- Earlier outputs preserved.
- Two-human qualitative provenance documented: 96.2% raw agreement, Cohen's kappa = 0.948, followed by human adjudication.

## Canonical Files

See `results/processed/final_evidence_lock/FINAL_OUTPUT_MANIFEST.csv`.
