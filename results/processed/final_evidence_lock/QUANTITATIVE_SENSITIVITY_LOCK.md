# Quantitative Sensitivity Lock

The corrected analysis contains 315 foundation-level tests across three label versions. It pools ChatGPT, Claude, and Gemini Flash only, uses Student-t confidence intervals over paired model-scenario differences, exact tied Wilcoxon signed-rank tests, primary 105-test BH families, supplementary effect-specific 35-test BH families, and 10,000 scenario-cluster bootstrap replicates per row.

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

## Headline Classifications

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
