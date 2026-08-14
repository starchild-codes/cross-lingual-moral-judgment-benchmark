# Translation and Adaptation Edit-Rate Audit

## Validation and Sources

- Scenario files: `data/scenarios.csv`, `data/scenarios_extension.csv`
- Rating files: `results/processed/full_1782215308316_vrq93w.ratings.csv`,
  `results/processed/extension_full_1782729062659_xqetbf.ratings.csv`
- Valid scenarios: **50**
- Scenario-language pairs: **300**
- Model-level edit/effect rows: **900**
- Duplicate pair keys: **0**
- Missing pair keys: **0**
- Duplicate merged keys: **0**
- Missing adaptation effects: **0**

The terminal `scenarios.xlsx` source-footer marker in `data/scenarios.csv` was ignored; no
text-bearing row was dropped. Gemini 3.1 Pro was excluded.

## Normalization and Tokenization

Raw text is preserved exactly for character-level raw distance and hashing. Analysis text
uses only Unicode NFKC, repeated-whitespace collapse, and outer trimming. No words,
punctuation, names, accents, or language-specific content are removed.

The deterministic Unicode tokenizer groups contiguous letters, combining marks, and numbers,
emits punctuation as separate tokens, and emits Japanese Han, Hiragana, and Katakana
characters individually because whitespace does not define Japanese words. Token measures
are secondary, particularly for Japanese, and are not directly equivalent across languages.

## Descriptive Edit Statistics

| scope   | pairs | mean     | median   | standard_deviation | interquartile_range | minimum  | maximum  | scenario_cluster_bootstrap_mean_ci_lower_95 | scenario_cluster_bootstrap_mean_ci_upper_95 |
| ------- | ----- | -------- | -------- | ------------------ | ------------------- | -------- | -------- | ------------------------------------------- | ------------------------------------------- |
| Overall | 300   | 0.514544 | 0.537329 | 0.162686           | 0.204645            | 0.012658 | 0.880000 | 0.496236                                    | 0.532790                                    |

### By Language

| language | pairs | mean     | median   | standard_deviation | interquartile_range | minimum  | maximum  | scenario_cluster_bootstrap_mean_ci_lower_95 | scenario_cluster_bootstrap_mean_ci_upper_95 |
| -------- | ----- | -------- | -------- | ------------------ | ------------------- | -------- | -------- | ------------------------------------------- | ------------------------------------------- |
| Arabic   | 50    | 0.613607 | 0.625984 | 0.148013           | 0.223566            | 0.268293 | 0.808451 | 0.573265                                    | 0.652497                                    |
| Bengali  | 50    | 0.549268 | 0.537886 | 0.095819           | 0.125175            | 0.317647 | 0.763889 | 0.522454                                    | 0.576112                                    |
| Hindi    | 50    | 0.460098 | 0.454275 | 0.122627           | 0.194585            | 0.264438 | 0.736264 | 0.427588                                    | 0.492696                                    |
| Japanese | 50    | 0.585172 | 0.579601 | 0.111959           | 0.130770            | 0.310345 | 0.880000 | 0.554140                                    | 0.615315                                    |
| Spanish  | 50    | 0.507026 | 0.547110 | 0.164526           | 0.203005            | 0.012658 | 0.757143 | 0.459996                                    | 0.550293                                    |
| Tamil    | 50    | 0.372096 | 0.387438 | 0.188806           | 0.295263            | 0.076741 | 0.710145 | 0.321029                                    | 0.423536                                    |

### By Foundation

| foundation           | pairs | mean     | median   | standard_deviation | interquartile_range | minimum  | maximum  | scenario_cluster_bootstrap_mean_ci_lower_95 | scenario_cluster_bootstrap_mean_ci_upper_95 |
| -------------------- | ----- | -------- | -------- | ------------------ | ------------------- | -------- | -------- | ------------------------------------------- | ------------------------------------------- |
| Authority/Subversion | 60    | 0.519684 | 0.529276 | 0.149996           | 0.184269            | 0.118377 | 0.800738 | 0.500426                                    | 0.544207                                    |
| Care/Harm            | 66    | 0.488016 | 0.515075 | 0.146440           | 0.178299            | 0.012658 | 0.763889 | 0.434436                                    | 0.539500                                    |
| Fairness/Cheating    | 60    | 0.519572 | 0.533882 | 0.170536           | 0.176801            | 0.076741 | 0.880000 | 0.487906                                    | 0.552928                                    |
| Loyalty/Betrayal     | 60    | 0.517883 | 0.541857 | 0.160302           | 0.255487            | 0.161836 | 0.767442 | 0.474259                                    | 0.567351                                    |
| Sanctity/Degradation | 54    | 0.531963 | 0.564671 | 0.189021           | 0.222063            | 0.089197 | 0.808451 | 0.499414                                    | 0.566573                                    |

### Surface/Structural Classification

| edit_classification | model_rows | scenario_language_pairs | mean_absolute_effect | median_absolute_effect | standard_deviation | interquartile_range |
| ------------------- | ---------- | ----------------------- | -------------------- | ---------------------- | ------------------ | ------------------- |
| mixed               | 96         | 32                      | 0.302083             | 0                      | 0.545214           | 1                   |
| structural          | 792        | 264                     | 0.526515             | 0                      | 0.753788           | 1                   |
| surface-dominant    | 3          | 1                       | 0                    | 0                      | 0                  | 0                   |
| uncertain           | 9          | 3                       | 0.333333             | 0                      | 0.500000           | 1                   |

The classification is conservative and heuristic. Surface flags rely on transparent,
limited multilingual lexicons and capitalization where available; `uncertain` is retained
when evidence is inadequate.

## Edit Magnitude and Absolute Adaptation Effects

| analysis      | group                | edit_metric                    | n   | scenario_clusters | spearman_rho | two_sided_p_value | scenario_cluster_bootstrap_ci_lower_95 | scenario_cluster_bootstrap_ci_upper_95 | bootstrap_repetitions |
| ------------- | -------------------- | ------------------------------ | --- | ----------------- | ------------ | ----------------- | -------------------------------------- | -------------------------------------- | --------------------- |
| pooled        | Overall              | normalized_character_edit_rate | 900 | 50                | 0.201885     | 0.000000          | 0.124930                               | 0.272966                               | 10000                 |
| by_model      | Claude Sonnet 4.6    | normalized_character_edit_rate | 300 | 50                | 0.240947     | 0.000025          | 0.140454                               | 0.344396                               | 10000                 |
| by_model      | GPT-4o               | normalized_character_edit_rate | 300 | 50                | 0.146250     | 0.011206          | 0.034655                               | 0.256323                               | 10000                 |
| by_model      | Gemini 3.5 Flash     | normalized_character_edit_rate | 300 | 50                | 0.223306     | 0.000096          | 0.123416                               | 0.322928                               | 10000                 |
| by_language   | Arabic               | normalized_character_edit_rate | 150 | 50                | 0.319761     | 0.000066          | 0.152695                               | 0.474215                               | 10000                 |
| by_language   | Bengali              | normalized_character_edit_rate | 150 | 50                | 0.086476     | 0.292699          | -0.087596                              | 0.252591                               | 10000                 |
| by_language   | Hindi                | normalized_character_edit_rate | 150 | 50                | 0.255191     | 0.001624          | 0.100416                               | 0.400750                               | 10000                 |
| by_language   | Japanese             | normalized_character_edit_rate | 150 | 50                | 0.027761     | 0.735949          | -0.157559                              | 0.207960                               | 10000                 |
| by_language   | Spanish              | normalized_character_edit_rate | 150 | 50                | 0.148506     | 0.069728          | -0.049671                              | 0.325024                               | 10000                 |
| by_language   | Tamil                | normalized_character_edit_rate | 150 | 50                | 0.340919     | 0.000020          | 0.162852                               | 0.491049                               | 10000                 |
| by_foundation | Authority/Subversion | normalized_character_edit_rate | 180 | 10                | 0.207686     | 0.005149          | 0.059223                               | 0.342239                               | 10000                 |
| by_foundation | Care/Harm            | normalized_character_edit_rate | 198 | 11                | 0.154125     | 0.030161          | -0.035462                              | 0.322258                               | 10000                 |
| by_foundation | Fairness/Cheating    | normalized_character_edit_rate | 180 | 10                | 0.328280     | 0.000007          | 0.267666                               | 0.399982                               | 10000                 |
| by_foundation | Loyalty/Betrayal     | normalized_character_edit_rate | 180 | 10                | 0.131898     | 0.077565          | -0.052513                              | 0.287883                               | 10000                 |
| by_foundation | Sanctity/Degradation | normalized_character_edit_rate | 162 | 9                 | 0.231446     | 0.003043          | 0.069662                               | 0.386492                               | 10000                 |

The pooled analysis and subgroup analyses use scenario-cluster bootstrap confidence
intervals with 10,000 resamples. Rows are not treated as 900 independent observations.

## Clustered Regressions

| regression               | term                                  | coefficient | clustered_se | ci_lower_95 | ci_upper_95 | p_value  | n   | scenario_clusters | r_squared |
| ------------------------ | ------------------------------------- | ----------- | ------------ | ----------- | ----------- | -------- | --- | ----------------- | --------- |
| signed_effect            | Intercept                             | 0.028403    | 0.105104     | -0.182813   | 0.239618    | 0.788117 | 900 | 50                | 0.003830  |
| signed_effect            | normalized_character_edit_rate        | -0.333763   | 0.225565     | -0.787053   | 0.119526    | 0.145361 | 900 | 50                | 0.003830  |
| absolute_effect          | Intercept                             | 0.012302    | 0.073635     | -0.135674   | 0.160278    | 0.868008 | 900 | 50                | 0.043775  |
| absolute_effect          | normalized_character_edit_rate        | 0.945666    | 0.154656     | 0.634872    | 1.256460    | 0.000000 | 900 | 50                | 0.043775  |
| adjusted_absolute_effect | Intercept                             | 0.023120    | 0.181878     | -0.342378   | 0.388618    | 0.899369 | 900 | 50                | 0.086715  |
| adjusted_absolute_effect | C(model)[T.GPT-4o]                    | 0.146667    | 0.064965     | 0.016114    | 0.277220    | 0.028460 | 900 | 50                | 0.086715  |
| adjusted_absolute_effect | C(model)[T.Gemini 3.5 Flash]          | 0.020000    | 0.051105     | -0.082700   | 0.122700    | 0.697235 | 900 | 50                | 0.086715  |
| adjusted_absolute_effect | C(language)[T.Bengali]                | -0.125804   | 0.086001     | -0.298629   | 0.047022    | 0.149903 | 900 | 50                | 0.086715  |
| adjusted_absolute_effect | C(language)[T.Hindi]                  | -0.029638   | 0.078176     | -0.186739   | 0.127463    | 0.706239 | 900 | 50                | 0.086715  |
| adjusted_absolute_effect | C(language)[T.Japanese]               | -0.180541   | 0.090338     | -0.362083   | 0.001000    | 0.051227 | 900 | 50                | 0.086715  |
| adjusted_absolute_effect | C(language)[T.Spanish]                | 0.009578    | 0.082010     | -0.155227   | 0.174383    | 0.907504 | 900 | 50                | 0.086715  |
| adjusted_absolute_effect | C(language)[T.Tamil]                  | 0.125181    | 0.117767     | -0.111481   | 0.361843    | 0.293014 | 900 | 50                | 0.086715  |
| adjusted_absolute_effect | C(foundation)[T.Care/Harm]            | -0.163480   | 0.140223     | -0.445269   | 0.118309    | 0.249316 | 900 | 50                | 0.086715  |
| adjusted_absolute_effect | C(foundation)[T.Fairness/Cheating]    | -0.055426   | 0.142487     | -0.341766   | 0.230913    | 0.698968 | 900 | 50                | 0.086715  |
| adjusted_absolute_effect | C(foundation)[T.Loyalty/Betrayal]     | -0.286812   | 0.168428     | -0.625280   | 0.051656    | 0.094927 | 900 | 50                | 0.086715  |
| adjusted_absolute_effect | C(foundation)[T.Sanctity/Degradation] | -0.195642   | 0.135636     | -0.468211   | 0.076928    | 0.155550 | 900 | 50                | 0.086715  |
| adjusted_absolute_effect | normalized_character_edit_rate        | 1.153214    | 0.190845     | 0.769697    | 1.536731    | 0.000000 | 900 | 50                | 0.086715  |

The signed-effect, absolute-effect, and adjusted absolute-effect regressions use standard
errors clustered by scenario. They are diagnostic, not causal.

## Surface-Versus-Structural Comparison

| edit_classification | model_rows | scenario_language_pairs | mean_absolute_effect | median_absolute_effect | standard_deviation | interquartile_range |
| ------------------- | ---------- | ----------------------- | -------------------- | ---------------------- | ------------------ | ------------------- |
| mixed               | 96         | 32                      | 0.302083             | 0                      | 0.545214           | 1                   |
| structural          | 792        | 264                     | 0.526515             | 0                      | 0.753788           | 1                   |
| surface-dominant    | 3          | 1                       | 0                    | 0                      | 0                  | 0                   |
| uncertain           | 9          | 3                       | 0.333333             | 0                      | 0.500000           | 1                   |

Omnibus result: `{"test": "Kruskal-Wallis", "statistic": 8.282656218628942, "p_value": 0.015901718253855487, "groups_tested": 3}`.
Small classification cells should not be overinterpreted.

## Robustness

### Alternative Edit Metrics

| analysis           | excluded_group | edit_metric                               | n   | scenario_clusters | spearman_rho | two_sided_p_value |
| ------------------ | -------------- | ----------------------------------------- | --- | ----------------- | ------------ | ----------------- |
| metric_sensitivity |                | normalized_character_edit_rate            | 900 | 50                | 0.201885     | 0.000000          |
| metric_sensitivity |                | token_edit_rate                           | 900 | 50                | 0.200195     | 0.000000          |
| metric_sensitivity |                | token_jaccard_dissimilarity               | 900 | 50                | 0.238511     | 0.000000          |
| metric_sensitivity |                | absolute_relative_character_length_change | 900 | 50                | 0.075267     | 0.023941          |
| metric_sensitivity |                | longest_common_subsequence_dissimilarity  | 900 | 50                | 0.191850     | 0.000000          |

### Leave-One-Language-Out

| analysis               | excluded_group | edit_metric                    | n   | scenario_clusters | spearman_rho | two_sided_p_value |
| ---------------------- | -------------- | ------------------------------ | --- | ----------------- | ------------ | ----------------- |
| leave_one_language_out | Hindi          | normalized_character_edit_rate | 750 | 50                | 0.190535     | 0.000000          |
| leave_one_language_out | Bengali        | normalized_character_edit_rate | 750 | 50                | 0.221559     | 0.000000          |
| leave_one_language_out | Tamil          | normalized_character_edit_rate | 750 | 50                | 0.176772     | 0.000001          |
| leave_one_language_out | Spanish        | normalized_character_edit_rate | 750 | 50                | 0.214297     | 0.000000          |
| leave_one_language_out | Japanese       | normalized_character_edit_rate | 750 | 50                | 0.245949     | 0.000000          |
| leave_one_language_out | Arabic         | normalized_character_edit_rate | 750 | 50                | 0.160848     | 0.000010          |

### Leave-One-Foundation-Out

| analysis                 | excluded_group       | edit_metric                    | n   | scenario_clusters | spearman_rho | two_sided_p_value |
| ------------------------ | -------------------- | ------------------------------ | --- | ----------------- | ------------ | ----------------- |
| leave_one_foundation_out | Care/Harm            | normalized_character_edit_rate | 702 | 39                | 0.212032     | 0.000000          |
| leave_one_foundation_out | Fairness/Cheating    | normalized_character_edit_rate | 720 | 40                | 0.170236     | 0.000004          |
| leave_one_foundation_out | Loyalty/Betrayal     | normalized_character_edit_rate | 720 | 40                | 0.228260     | 0.000000          |
| leave_one_foundation_out | Authority/Subversion | normalized_character_edit_rate | 720 | 40                | 0.203736     | 0.000000          |
| leave_one_foundation_out | Sanctity/Degradation | normalized_character_edit_rate | 738 | 41                | 0.197657     | 0.000000          |

The leave-one-scenario-out rho range was
**[0.190635, 0.219657]**.
Alternative metric signs were consistent
with the primary association. Complete scenario, model, extreme-edit exclusion, and
scenario-language mean results are in `adaptation_edit_robustness_results.csv`.

## Extreme-Pair Inspection

### Ten Most Heavily Edited Pairs

| scenario_id | foundation           | language | normalized_character_edit_rate | edit_classification |
| ----------- | -------------------- | -------- | ------------------------------ | ------------------- |
| S28         | Fairness/Cheating    | Japanese | 0.880000                       | structural          |
| S25         | Sanctity/Degradation | Arabic   | 0.808451                       | structural          |
| S22         | Sanctity/Degradation | Arabic   | 0.801187                       | structural          |
| S13         | Authority/Subversion | Arabic   | 0.800738                       | structural          |
| S21         | Sanctity/Degradation | Arabic   | 0.798742                       | structural          |
| S15         | Authority/Subversion | Arabic   | 0.778068                       | structural          |
| S24         | Sanctity/Degradation | Arabic   | 0.773885                       | structural          |
| S16         | Fairness/Cheating    | Arabic   | 0.773585                       | structural          |
| S32         | Loyalty/Betrayal     | Arabic   | 0.767442                       | structural          |
| S20         | Fairness/Cheating    | Arabic   | 0.766234                       | structural          |

### Ten Largest Model-Level Adaptation Effects

| scenario_id | foundation           | language | model             | normalized_character_edit_rate | signed_adaptation_effect | absolute_adaptation_effect | edit_classification |
| ----------- | -------------------- | -------- | ----------------- | ------------------------------ | ------------------------ | -------------------------- | ------------------- |
| S28         | Fairness/Cheating    | Tamil    | GPT-4o            | 0.488372                       | -4                       | 4                          | structural          |
| S28         | Fairness/Cheating    | Arabic   | Claude Sonnet 4.6 | 0.706897                       | 4                        | 4                          | structural          |
| S40         | Care/Harm            | Tamil    | GPT-4o            | 0.453333                       | -4                       | 4                          | structural          |
| S43         | Authority/Subversion | Arabic   | GPT-4o            | 0.612245                       | 4                        | 4                          | structural          |
| S45         | Care/Harm            | Bengali  | GPT-4o            | 0.763889                       | -4                       | 4                          | structural          |
| S10         | Loyalty/Betrayal     | Spanish  | GPT-4o            | 0.417504                       | -3                       | 3                          | structural          |
| S23         | Sanctity/Degradation | Arabic   | Gemini 3.5 Flash  | 0.763636                       | -3                       | 3                          | structural          |
| S27         | Care/Harm            | Spanish  | GPT-4o            | 0.580247                       | -3                       | 3                          | structural          |
| S28         | Fairness/Cheating    | Spanish  | GPT-4o            | 0.483871                       | -3                       | 3                          | structural          |
| S30         | Authority/Subversion | Arabic   | GPT-4o            | 0.535714                       | -3                       | 3                          | structural          |

The untruncated top/bottom and discordant-quartile audits, including full literal and adapted
texts, are in `adaptation_edit_extreme_pairs.csv`.

## Interpretation

Larger textual edits were positively associated with larger absolute adaptation effects. Character edit rate measures textual extent, not cultural quality or
semantic distance. A small edit can alter a morally salient detail, while a large edit can
preserve the same moral structure. Language-specific associations are heterogeneity and
must not be generalized as universal effects.

## Limitations

Token boundaries are not linguistically equivalent across scripts; Japanese token measures
are character-like. Automatic surface classification is deliberately incomplete. Ratings
are bounded and discrete, edit metrics repeat across three models, and only 50 scenario
clusters are available. Clustered inference addresses dependence but not confounding.

## Manuscript-Ready Results Paragraph

Across 300 scenario-language pairs, the mean normalized character edit rate was 0.515 (median = 0.537, SD = 0.163, IQR = 0.205; 95% scenario-cluster bootstrap CI for the mean [0.496, 0.533]). Across 900 model-level observations, normalized character edit rate was correlated with absolute cultural-adaptation effects at Spearman rho = 0.202 (two-sided p = 9.89e-10, 95% scenario-cluster bootstrap CI [0.125, 0.273]). In scenario-clustered regression, the absolute-effect coefficient was 0.946 (SE = 0.155, 95% CI [0.635, 1.256], p = 1.56e-07); after adjustment for model, language, and foundation it was 1.153 (SE = 0.191, 95% CI [0.770, 1.537], p = 2.01e-07). These diagnostic associations do not establish that textual edit magnitude caused rating change.
