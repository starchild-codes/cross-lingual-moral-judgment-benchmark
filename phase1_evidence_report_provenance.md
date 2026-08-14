# Phase 1 Final Evidence Report

Generated locally from finalized project data. No model/API calls were made.

## Exact Files Used

- `results/processed/full_merged_with_human_mft_codes.csv`: final 1,000 qualitative explanations and human-adjudicated MFT labels.
- `results/processed/full_merged.csv`: finalized rating data.
- `results/processed/scenario_validation_trial2/scenario_validation_merged_3coders.csv`: final blinded three-human-coder scenario validation.
- `results/processed/analysis/foundation_match.csv` and `foundation_transitions.csv`: finalized existing qualitative outputs used for reproduction checks.

## Qualitative Coding Provenance

The 1,000 qualitative explanations were coded independently by **two human coders**. Their raw inter-rater agreement was **96.2%**, with **Cohen's kappa = 0.948**. Disagreements and invalid or uncertain cases were resolved through human adjudication; the final foundation labels used throughout this report are therefore **human-adjudicated labels**, not LLM-generated or AI-assisted labels.

**Historical filename note:** the source was previously stored as `full_merged_with_ai_mft_codes.csv`, and some legacy column names retain an `ai_mft_` prefix. Those names are historical and do not accurately describe the final coding process. The original file remains unchanged for traceability, while this analysis now reads the byte-identical copy `full_merged_with_human_mft_codes.csv`.

## Reproduction Gate

The existing qualitative findings reproduced exactly from the row-level coded data: **728/1000 = 72.8%** overall. Foundation-specific matches were Care/Harm **200/200 = 100%**, Loyalty/Betrayal **200/200 = 100%**, Fairness/Cheating **199/200 = 99.5%**, Sanctity/Degradation **116/200 = 58%**, and Authority/Subversion **13/200 = 6.5%**. The full model-specific foundation-transition matrix also reproduced cell-for-cell against the finalized existing transition table.

## Three-Coder Scenario Validation

Three blinded human coders labelled all 50 English scenarios. Pairwise raw agreement ranged from **68% to 74%**, pairwise Cohen's kappa from **0.597586 to 0.671551**, mean pairwise kappa was **0.631504**, and Fleiss' kappa was **0.629297**. Majority labels matched intended labels for **39/50 = 78%**. Authority/Subversion majority agreement was **5/10 = 50%**. Four complete three-way disagreements remained unresolved: S03, S09, S13, S35.

| version | scenarios |
| --- | --- |
| Version 1: original intended labels | 50 |
| Version 2: validated subset | 39 |
| Version 3: human-majority labels | 46 |

## S11 And S30

### S11

S11 had **100** qualitative responses. Original intended label: **Authority/Subversion**; human-majority label: **Care/Harm**. Distribution: Loyalty/Betrayal 86/100 (86.0%), Authority/Subversion 13/100 (13.0%), Care/Harm 1/100 (1.0%). Match with the original intended label was **13/100 = 13.0%**; match with the human-majority label was **1/100 = 1.0%**. Authority/Subversion counts by model were chatgpt 3/25, claude 4/25, gemini_flash 2/25, gemini_pro 4/25; languages with at least one Authority/Subversion code were ar 4/16, bn 1/16, es 1/16, hi 1/16, ja 3/16, ta 3/16. Full model, language, condition-type, and instructed reasoning/response-language breakdowns are in `s11_s30_breakdowns.csv`.

### S30

S30 had **100** qualitative responses. Original intended label: **Authority/Subversion**; human-majority label: **Authority/Subversion**. Distribution: Care/Harm 100/100 (100.0%). Match with the original intended label was **0/100 = 0.0%**; match with the human-majority label was **0/100 = 0.0%**. Authority/Subversion counts by model were chatgpt 0/25, claude 0/25, gemini_flash 0/25, gemini_pro 0/25; languages with at least one Authority/Subversion code were none. Full model, language, condition-type, and instructed reasoning/response-language breakdowns are in `s11_s30_breakdowns.csv`.

**Is the original 6.5% Authority/Subversion result mainly driven by S11? No.** All 13 Authority/Subversion codes came from S11, so S11 raises rather than depresses the combined match rate. S11 contributes 87/187 non-Authority codes, whereas S30 contributes 100/187 and received no Authority/Subversion codes at all. S30 is therefore the stronger driver of the low combined rate and the cleaner test because humans retained Authority/Subversion as its majority label.

**Does S30 still get reframed by models? Yes.** All 100 S30 explanations were coded Care/Harm, including all 25 responses from each of the four evaluated source models. The pattern appears in every input language represented (English, Hindi, Bengali, Tamil, Spanish, Japanese, and Arabic), every condition type, and every instructed reasoning/response language represented. This is strong descriptive evidence for S30, while still being one scenario rather than a general population estimate.

The most frequent replacements across the original 200 Authority-designed responses were Care/Harm 101/200 (50.5%), Loyalty/Betrayal 86/200 (43.0%), Fairness/Cheating 0/200 (0.0%), Sanctity/Degradation 0/200 (0.0%).

## Intended Labels Versus Human-Majority Labels

- Original intended-label analysis: **728/1000 = 72.8%** overall; Authority/Subversion **13/200 = 6.5%**.
- Human-majority-label analysis: **716/1000 = 71.6%** overall; Authority/Subversion **0/100 = 0.0%**.
- Human-majority analysis excluded 0 qualitative rows from 0 unresolved qualitative target scenarios. Scenario-level validation excluded all four unresolved scenarios from Version 3 quantitative grouping.

Authority/Subversion remains the lowest qualitative match foundation under the human-majority reference (0/100, 0.0%). Models therefore still underinvoke Authority/Subversion relative to human-majority labels, although the original 6.5% estimate overstates the problem because S11 was not human-validated as Authority/Subversion.

## Foundation-Level Quantitative Sensitivity

All quantitative sensitivity estimates pool only ChatGPT, Claude, and Gemini Flash. Gemini Pro is excluded. Effects retain the original paired definitions. Confidence intervals use the Student t critical value over paired model-scenario differences. Wilcoxon tests are two-sided; Benjamini-Hochberg correction is applied separately across the 105 foundation-level tests within each analysis version.

### Effect-Type Consistency Across All Foundation-Level Tests

| analysis_version | effect_type | tests | surviving_q_lt_05 | surviving_q_lt_10 |
| --- | --- | --- | --- | --- |
| v1_original_intended | language | 35 | 11 | 11 |
| v1_original_intended | framing | 35 | 14 | 16 |
| v1_original_intended | reasoning | 35 | 12 | 12 |
| v2_validated_subset | language | 35 | 7 | 8 |
| v2_validated_subset | framing | 35 | 9 | 13 |
| v2_validated_subset | reasoning | 35 | 7 | 10 |
| v3_human_majority | language | 35 | 5 | 8 |
| v3_human_majority | framing | 35 | 10 | 15 |
| v3_human_majority | reasoning | 35 | 8 | 10 |
| all_three_versions | language | 35 | 5 |  |
| all_three_versions | framing | 35 | 9 |  |
| all_three_versions | reasoning | 35 | 7 |  |

| finding | classification | original_intended | validated_subset | human_majority |
| --- | --- | --- | --- | --- |
| Arabic Authority/Subversion input-language effect | lost significance | diff=0.43333333, d=0.55996755, W-p=0.0018735129, q=0.0089417659, n=30 | diff=0.46666667, d=0.50975336, W-p=0.043819656, q=0.12883269, n=15 | diff=0.46666667, d=0.50975336, W-p=0.043819656, q=0.12883269, n=15 |
| Arabic Fairness/Cheating reasoning effect | strengthened | diff=0.4, d=0.55250625, W-p=0.000039423308, q=0.00031841902, n=30 | diff=0.44444444, d=0.63675591, W-p=0.000042578776, q=0.00063868164, n=27 | diff=0.43333333, d=0.6382775, W-p=0.000008818775, q=0.00013228162, n=30 |
| Arabic Sanctity/Degradation framing effect | stable | diff=-0.59259259, d=-0.66706767, W-p=0.00045118276, q=0.0024933784, n=27 | diff=-0.59259259, d=-0.66706767, W-p=0.00045118276, q=0.0039478491, n=27 | diff=-0.59259259, d=-0.66706767, W-p=0.00045118276, q=0.0033838707, n=27 |
| Bengali Authority/Subversion input-language effect | strengthened | diff=0.4, d=0.55250625, W-p=0.000039423308, q=0.00031841902, n=30 | diff=0.53333333, d=0.6396346, W-p=0.0070537351, q=0.032201834, n=15 | diff=0.53333333, d=0.6396346, W-p=0.0070537351, q=0.032201834, n=15 |
| Japanese Fairness/Cheating reasoning effect | stable | diff=0.33333333, d=0.60974984, W-p=0.0000010155031, q=0.000021325566, n=30 | diff=0.33333333, d=0.60092521, W-p=0.000012152832, q=0.00021524983, n=27 | diff=0.33333333, d=0.60974984, W-p=0.0000010155031, q=0.000017771305, n=30 |
| Pooled Authority/Subversion input-language effect | stable | diff=0.37777778, d=0.45701449, W-p=0, q=0, n=180 | diff=0.41111111, d=0.40047787, W-p=9.7802886e-7, q=0.00003423101, n=90 | diff=0.41111111, d=0.40047787, W-p=9.7802886e-7, q=0.000017771305, n=90 |
| Pooled Authority/Subversion reasoning effect | strengthened | diff=-0.17222222, d=-0.23316044, W-p=0.0000012359969, q=0.000021629946, n=180 | diff=-0.24444444, d=-0.27060786, W-p=0.00096803396, q=0.0063527229, n=90 | diff=-0.24444444, d=-0.27060786, W-p=0.00096803396, q=0.0056468648, n=90 |
| Spanish Authority/Subversion framing effect | lost significance | diff=-0.46666667, d=-0.56958689, W-p=0.000099644052, q=0.00070520546, n=30 | diff=-0.6, d=-0.60875959, W-p=0.012411775, q=0.054301514, n=15 | diff=-0.6, d=-0.60875959, W-p=0.012411775, q=0.054301514, n=15 |
| Spanish Sanctity/Degradation framing effect | stable | diff=-0.48148148, d=-0.60003824, W-p=0.00032355481, q=0.001887403, n=27 | diff=-0.48148148, d=-0.60003824, W-p=0.00032355481, q=0.0030884777, n=27 | diff=-0.48148148, d=-0.60003824, W-p=0.00032355481, q=0.0026133273, n=27 |
| Tamil Loyalty/Betrayal input-language effect | lost significance | diff=-0.43333333, d=-0.69215687, W-p=0.0000097561344, q=0.0001053339, n=30 | diff=-0.41666667, d=-0.63723892, W-p=0.0007576027, q=0.0056820202, n=24 | diff=-0.21212121, d=-0.3046359, W-p=0.017244687, q=0.064667575, n=33 |

### Exact Headline Statistics

| finding | classification | analysis_version | mean_diff | ci_lower | ci_upper | p_value_ttest | cohens_d | n | p_value_wilcoxon | q_value_bh_wilcoxon | fdr_q_lt_05 | fdr_q_lt_10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tamil Loyalty/Betrayal input-language effect | lost significance | v1_original_intended | -0.43333333333333335 | -0.6671088439635788 | -0.19955782270308792 | 0.0007032822635442137 | -0.6921568708897166 | 30 | 0.000009756134429217411 | 0.00010533390164402245 | true | true |
| Tamil Loyalty/Betrayal input-language effect | lost significance | v2_validated_subset | -0.4166666666666667 | -0.6927686059380227 | -0.14056472739531073 | 0.00479300296329388 | -0.6372389240525752 | 24 | 0.0007576026973277195 | 0.005682020229957896 | true | true |
| Tamil Loyalty/Betrayal input-language effect | lost significance | v3_human_majority | -0.21212121212121213 | -0.45902222344968396 | 0.03477979920725971 | 0.08970311513619444 | -0.30463589792247125 | 33 | 0.017244686723997926 | 0.06466757521499222 | false | true |
| Arabic Sanctity/Degradation framing effect | stable | v1_original_intended | -0.5925925925925926 | -0.9440139445617493 | -0.24117124062343587 | 0.0018481730441861632 | -0.6670676692091927 | 27 | 0.00045118275754951753 | 0.0024933783969841757 | true | true |
| Arabic Sanctity/Degradation framing effect | stable | v2_validated_subset | -0.5925925925925926 | -0.9440139445617493 | -0.24117124062343587 | 0.0018481730441861632 | -0.6670676692091927 | 27 | 0.00045118275754951753 | 0.003947849128558278 | true | true |
| Arabic Sanctity/Degradation framing effect | stable | v3_human_majority | -0.5925925925925926 | -0.9440139445617493 | -0.24117124062343587 | 0.0018481730441861632 | -0.6670676692091927 | 27 | 0.00045118275754951753 | 0.0033838706816213815 | true | true |
| Spanish Sanctity/Degradation framing effect | stable | v1_original_intended | -0.48148148148148145 | -0.7989074696491067 | -0.16405549331385622 | 0.004412390207288341 | -0.6000382376103702 | 27 | 0.0003235548059832283 | 0.0018874030349021649 | true | true |
| Spanish Sanctity/Degradation framing effect | stable | v2_validated_subset | -0.48148148148148145 | -0.7989074696491067 | -0.16405549331385622 | 0.004412390207288341 | -0.6000382376103702 | 27 | 0.0003235548059832283 | 0.00308847769347627 | true | true |
| Spanish Sanctity/Degradation framing effect | stable | v3_human_majority | -0.48148148148148145 | -0.7989074696491067 | -0.16405549331385622 | 0.004412390207288341 | -0.6000382376103702 | 27 | 0.0003235548059832283 | 0.0026133272790953054 | true | true |
| Japanese Fairness/Cheating reasoning effect | stable | v1_original_intended | 0.3333333333333333 | 0.1292025515791674 | 0.5374641150874993 | 0.002316228855839375 | 0.6097498436202111 | 30 | 0.0000010155031442415918 | 0.00002132556602907343 | true | true |
| Japanese Fairness/Cheating reasoning effect | stable | v2_validated_subset | 0.3333333333333333 | 0.11390124393209045 | 0.5527654227345762 | 0.004362658456633861 | 0.6009252125773316 | 27 | 0.000012152832377321232 | 0.00021524983276899334 | true | true |
| Japanese Fairness/Cheating reasoning effect | stable | v3_human_majority | 0.3333333333333333 | 0.1292025515791674 | 0.5374641150874993 | 0.002316228855839375 | 0.6097498436202111 | 30 | 0.0000010155031442415918 | 0.000017771305024227857 | true | true |
| Arabic Fairness/Cheating reasoning effect | strengthened | v1_original_intended | 0.4 | 0.12966377428239395 | 0.6703362257176061 | 0.005150605210149317 | 0.5525062514530825 | 30 | 0.00003942330779072023 | 0.0003184190244635096 | true | true |
| Arabic Fairness/Cheating reasoning effect | strengthened | v2_validated_subset | 0.4444444444444444 | 0.16833178698362555 | 0.7205571019052632 | 0.002748244817944334 | 0.6367559105878924 | 27 | 0.000042578775873103325 | 0.0006386816380965499 | true | true |
| Arabic Fairness/Cheating reasoning effect | strengthened | v3_human_majority | 0.43333333333333335 | 0.17982396618818813 | 0.6868427004784785 | 0.0015405967648947083 | 0.6382775033154234 | 30 | 0.000008818774981156352 | 0.00013228162471734528 | true | true |
| Pooled Authority/Subversion input-language effect | stable | v1_original_intended | 0.37777777777777777 | 0.2561971169778612 | 0.49935843857769435 | 5.422230664464678e-9 | 0.4570144872999839 | 180 | 0 | 0 | true | true |
| Pooled Authority/Subversion input-language effect | stable | v2_validated_subset | 0.4111111111111111 | 0.19610408668071078 | 0.6261181355415114 | 0.0002650051189472258 | 0.4004778701136469 | 90 | 9.780288565686135e-7 | 0.00003423100997990147 | true | true |
| Pooled Authority/Subversion input-language effect | stable | v3_human_majority | 0.4111111111111111 | 0.19610408668071078 | 0.6261181355415114 | 0.0002650051189472258 | 0.4004778701136469 | 90 | 9.780288565686135e-7 | 0.000017771305024227857 | true | true |
| Bengali Authority/Subversion input-language effect | strengthened | v1_original_intended | 0.4 | 0.12966377428239395 | 0.6703362257176061 | 0.005150605210149317 | 0.5525062514530825 | 30 | 0.00003942330779072023 | 0.0003184190244635096 | true | true |
| Bengali Authority/Subversion input-language effect | strengthened | v2_validated_subset | 0.5333333333333333 | 0.07158508516804996 | 0.9950815814986167 | 0.026607580197571368 | 0.6396345988854294 | 15 | 0.007053735147504181 | 0.032201834369040824 | true | true |
| Bengali Authority/Subversion input-language effect | strengthened | v3_human_majority | 0.5333333333333333 | 0.07158508516804996 | 0.9950815814986167 | 0.026607580197571368 | 0.6396345988854294 | 15 | 0.007053735147504181 | 0.032201834369040824 | true | true |
| Arabic Authority/Subversion input-language effect | lost significance | v1_original_intended | 0.43333333333333335 | 0.14437136533385397 | 0.7222953013328127 | 0.004648510782116144 | 0.5599675523000586 | 30 | 0.0018735128572680004 | 0.008941765909688183 | true | true |
| Arabic Authority/Subversion input-language effect | lost significance | v2_validated_subset | 0.4666666666666667 | -0.040306720710942656 | 0.973640054044276 | 0.06841716354055727 | 0.5097533568780933 | 15 | 0.04381965554407863 | 0.1288326883269735 | false | false |
| Arabic Authority/Subversion input-language effect | lost significance | v3_human_majority | 0.4666666666666667 | -0.040306720710942656 | 0.973640054044276 | 0.06841716354055727 | 0.5097533568780933 | 15 | 0.04381965554407863 | 0.1288326883269735 | false | false |
| Spanish Authority/Subversion framing effect | lost significance | v1_original_intended | -0.4666666666666667 | -0.7726010212315426 | -0.16073231210179068 | 0.004069703036843952 | -0.5695868886695797 | 30 | 0.00009964405201312587 | 0.0007052054560139354 | true | true |
| Spanish Authority/Subversion framing effect | lost significance | v2_validated_subset | -0.6 | -1.1458130463930414 | -0.05418695360695858 | 0.03346742202751396 | -0.6087595874350707 | 15 | 0.012411774684279564 | 0.05430151424372309 | false | true |
| Spanish Authority/Subversion framing effect | lost significance | v3_human_majority | -0.6 | -1.1458130463930414 | -0.05418695360695858 | 0.03346742202751396 | -0.6087595874350707 | 15 | 0.012411774684279564 | 0.05430151424372309 | false | true |
| Pooled Authority/Subversion reasoning effect | strengthened | v1_original_intended | -0.17222222222222222 | -0.2808628769575611 | -0.0635815674868833 | 0.0020536930357830663 | -0.23316044402222688 | 180 | 0.0000012359968968311819 | 0.000021629945694545682 | true | true |
| Pooled Authority/Subversion reasoning effect | strengthened | v2_validated_subset | -0.24444444444444444 | -0.43364034434012455 | -0.055248544548764295 | 0.011921112348940222 | -0.27060786051237806 | 90 | 0.0009680339648368008 | 0.006352722894241505 | true | true |
| Pooled Authority/Subversion reasoning effect | strengthened | v3_human_majority | -0.24444444444444444 | -0.43364034434012455 | -0.055248544548764295 | 0.011921112348940222 | -0.27060786051237806 | 90 | 0.0009680339648368008 | 0.005646864794881338 | true | true |

## Claim Evaluation

| claim | verdict | evidence |
| --- | --- | --- |
| Models systematically fail to recognise Authority/Subversion. | Not supported | Only two qualitative scenarios were originally Authority-designed; one (S11) was human-majority Care/Harm. Human coders retained Authority for 5/10 intended Authority scenarios. Human-majority qualitative Authority match was 0/100 (0.0%), insufficient for a general systematic claim. |
| Models rarely invoke Authority/Subversion for authority-designed scenarios. | Supported with qualification | Against original labels, Authority matched 13/200 (6.5%). Against human-majority labels it matched 0/100 (0.0%); the original estimate is strongly affected by S11's relabeling. |
| Authority/Subversion was the least stable foundation in this benchmark. | Supported with qualification | Scenario validation retained Authority for 5/10 (50%), the lowest majority-intended rate; qualitative human-majority Authority match was 0/100 (0.0%). Stability refers to this benchmark's items and coding scheme. |
| Human coders and models often interpreted authority-related scenarios through other moral foundations. | Supported | Humans reassigned 5/10 intended Authority scenarios and left additional Authority items unresolved where applicable; models matched original Authority in only 13/200, with replacements led by Care/Harm (101), Loyalty/Betrayal (86), Fairness/Cheating (0). |
| Models reframed even human-validated Authority/Subversion scenarios. | Supported | For human-validated S30, models invoked Authority/Subversion in 0/100 (0.0%); the remainder used other foundations. Scope is one qualitative scenario. |
| Cultural adaptation produced the most consistent quantitative effect. | Supported with qualification | Framing had the most q<.05 findings in each version (v1_original_intended: 14/35, v2_validated_subset: 9/35, v3_human_majority: 10/35) and the most findings surviving q<.05 in all three versions (9/35), versus reasoning 7/35 and language 5/35. Consistency remains foundation- and language-specific. |
| Input-language and instructed instructed-response-language effects were selective rather than universal. | Supported | Named effects show mixed stability classifications across languages and foundations (Arabic Authority/Subversion input-language effect: lost significance; Arabic Fairness/Cheating reasoning effect: strengthened; Arabic Sanctity/Degradation framing effect: stable; Bengali Authority/Subversion input-language effect: strengthened; Japanese Fairness/Cheating reasoning effect: stable; Pooled Authority/Subversion input-language effect: stable; Pooled Authority/Subversion reasoning effect: strengthened; Spanish Authority/Subversion framing effect: lost significance; Spanish Sanctity/Degradation framing effect: stable; Tamil Loyalty/Betrayal input-language effect: lost significance). |

## Paper Implications

- The claim that models rarely invoked Authority/Subversion for the two originally authority-designed qualitative targets remains descriptively true (**13/200**), but it must be qualified because S11's human-majority label was Care/Harm.
- The stronger claim that models generally or systematically fail to recognize Authority/Subversion is not supported by this benchmark design: human validation itself retained only 5/10 intended Authority scenarios, and the qualitative subset contains only two such scenarios.
- S30 independently tests a human-validated Authority/Subversion scenario. Its exact distribution and cross-model/language breakdown show whether reframing persists beyond S11; those results are reported above and in `s11_s30_breakdowns.csv`.
- Claims about the non-Authority and Authority quantitative findings should follow the stability classifications above rather than the original-label analysis alone.
- Cultural-framing, input-language, and instructed-response-language effects are heterogeneous across languages and foundations; universal wording is not warranted.

## Non-Negotiable Checks

- No new API calls were made: **confirmed**.
- No original data files were modified: **confirmed**.
- Existing outputs were not overwritten: **confirmed**; all verification CSVs are in `results/processed/phase1_final_evidence/`.
- Original 72.8% result reproduced: **confirmed (728/1000)**.
- Original Authority/Subversion result reproduced: **confirmed (13/200 = 6.5%)**.
- S11 human-majority label: **Care/Harm**.
- S30 human-majority label: **Authority/Subversion**.
- Complete three-way disagreements unresolved: **confirmed (4)**.
- Gemini Pro excluded from pooled main effects: **confirmed**.
