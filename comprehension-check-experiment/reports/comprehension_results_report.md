# Multilingual Comprehension-Check Results

## Dataset Audit

- Unique work units: **720**
- Item-level responses: **2,880**
- Incorrect items: **105**
- Overall accuracy: **96.3541667%**
- Work-unit 4/4 rate: **86.1111111%**
- Normalized outputs: **150**

All 150 normalized outputs were scored only after exact separator or localized option-label
normalization. Response order was preserved; no answer content was inferred; no ambiguous
free text was converted; and every normalized row remains linked to its raw output in
`normalization_integrity_audit.csv`.

## Rating-Shift Merge

All 720 comprehension work units received exactly one absolute moral-rating shift from the
same model and scenario. Literal rows use `*_translation_reason_en - en_en`; adapted rows
use `*_adapted_reason_en - en_en`, in absolute value. Only the three evaluated models were
included; Gemini 3.1 Pro was excluded.

## Primary Association

Spearman's rho between the 0-4 comprehension score and absolute rating shift was
**-0.237918** (two-sided p = **1.00647e-10**,
n = **720**, 95% scenario-cluster bootstrap CI
**[-0.401269,
0.013410]**, 10,000 resamples).
Using item accuracy on the 0-1 scale gave rho = **-0.237918**
and p = **1.00647e-10**. This is mathematically
equivalent because it is a positive linear rescaling of the 0-4 score.

## Fully Comprehended Versus Error-Containing Cases

| Group | n | Mean shift | Median shift | SD | IQR |
|---|---:|---:|---:|---:|---:|
| 4/4 | 620 | 0.603226 | 0.000000 | 0.949784 | 1.000000 |
| <4/4 | 100 | 1.350000 | 1.000000 | 1.313296 | 2.000000 |

Mann-Whitney U = **20112.500**, two-sided
p = **3.04116e-10**. The mean difference
(`<4/4 minus 4/4`) was **0.746774**,
with a 95% scenario-cluster bootstrap CI of
**[0.000787,
1.365320]**.
These groups were observed, not randomly assigned.

## Clustered Regression

For `absolute_rating_shift ~ comprehension_score`, the score coefficient was
**-0.760084** (scenario-clustered SE
**0.271307**, 95% CI
**[-1.327936, -0.192231]**,
p = **0.0113849**). The intercept was
**3.636433**, n = **720**,
20 scenario clusters, R-squared = **0.074105**.

The sensitivity model using `any_comprehension_error` produced a coefficient of
**0.746774** (clustered SE
**0.309816**, 95% CI
**[0.098321, 1.395228]**,
p = **0.0262324**), intercept
**0.603226**, R-squared
**0.061791**.

## Adjusted Diagnostic Model

The adjusted score coefficient was **-0.502618**
(scenario-clustered SE **0.220175**, 95% CI
**[-0.963450, -0.041787]**,
p = **0.0341322**), n = **720**,
20 clusters, R-squared = **0.261027**. This model adjusts
for model, language, scenario version, and scenario shift tier and is diagnostic,
not causal.

| term                                    | coefficient | clustered_se | ci_lower_95 | ci_upper_95 | p_value  |
| --------------------------------------- | ----------- | ------------ | ----------- | ----------- | -------- |
| Intercept                               | 3.273554    | 0.938135     | 1.310015    | 5.237094    | 0.002454 |
| C(model_key)[T.claude]                  | -0.060057   | 0.158019     | -0.390795   | 0.270681    | 0.708117 |
| C(model_key)[T.gemini_flash]            | 0.056675    | 0.188259     | -0.337355   | 0.450706    | 0.766646 |
| C(input_language)[T.bn]                 | -0.183464   | 0.087165     | -0.365903   | -0.001026   | 0.048848 |
| C(input_language)[T.es]                 | -0.116667   | 0.104870     | -0.336163   | 0.102829    | 0.279808 |
| C(input_language)[T.hi]                 | -0.208202   | 0.171374     | -0.566893   | 0.150488    | 0.239288 |
| C(input_language)[T.ja]                 | -0.116623   | 0.095226     | -0.315933   | 0.082687    | 0.235657 |
| C(input_language)[T.ta]                 | -0.145942   | 0.093355     | -0.341337   | 0.049453    | 0.134485 |
| C(scenario_version)[T.literal]          | -0.101469   | 0.049158     | -0.204359   | 0.001421    | 0.052934 |
| C(shift_tier_manuscript)[T.Lower-shift] | -0.898182   | 0.225506     | -1.370172   | -0.426192   | 0.000797 |
| correct_count_0_4                       | -0.502618   | 0.220175     | -0.963450   | -0.041787   | 0.034132 |

## Interpretation

Comprehension score was associated with rating shift, so factual errors may contribute to some shifts; the observational design does not establish causation. The association remained negative in the adjusted diagnostic model.
However, **86.667%** of all errors were actor-identification errors,
**78.095%** occurred in higher-shift scenarios, and only three
questions accounted for at least half of all errors. The error-containing group therefore
does not provide a clean or randomly assigned test of misunderstanding. Errors could
plausibly contribute to some rating shifts, but these data do not show that they explain
the broader shift pattern; even 4/4 cases had a mean absolute shift of
**0.603226**. Observed associations can reflect item ambiguity,
scenario difficulty, model behavior, or other shared causes.

## Exact Subgroup Accuracy

### Language and Model

| input_language | model_key    | correct_items | total_items | work_units_4_of_4 | total_work_units | accuracy | 4_of_4_proportion |
| -------------- | ------------ | ------------- | ----------- | ----------------- | ---------------- | -------- | ----------------- |
| ar             | chatgpt      | 152           | 160         | 32                | 40               | 95.000%  | 80.000%           |
| ar             | claude       | 155           | 160         | 35                | 40               | 96.875%  | 87.500%           |
| ar             | gemini_flash | 156           | 160         | 36                | 40               | 97.500%  | 90.000%           |
| bn             | chatgpt      | 147           | 160         | 28                | 40               | 91.875%  | 70.000%           |
| bn             | claude       | 154           | 160         | 34                | 40               | 96.250%  | 85.000%           |
| bn             | gemini_flash | 156           | 160         | 36                | 40               | 97.500%  | 90.000%           |
| es             | chatgpt      | 153           | 160         | 33                | 40               | 95.625%  | 82.500%           |
| es             | claude       | 155           | 160         | 35                | 40               | 96.875%  | 87.500%           |
| es             | gemini_flash | 155           | 160         | 35                | 40               | 96.875%  | 87.500%           |
| hi             | chatgpt      | 153           | 160         | 33                | 40               | 95.625%  | 82.500%           |
| hi             | claude       | 159           | 160         | 39                | 40               | 99.375%  | 97.500%           |
| hi             | gemini_flash | 157           | 160         | 37                | 40               | 98.125%  | 92.500%           |
| ja             | chatgpt      | 151           | 160         | 33                | 40               | 94.375%  | 82.500%           |
| ja             | claude       | 156           | 160         | 36                | 40               | 97.500%  | 90.000%           |
| ja             | gemini_flash | 158           | 160         | 38                | 40               | 98.750%  | 95.000%           |
| ta             | chatgpt      | 145           | 160         | 27                | 40               | 90.625%  | 67.500%           |
| ta             | claude       | 155           | 160         | 35                | 40               | 96.875%  | 87.500%           |
| ta             | gemini_flash | 158           | 160         | 38                | 40               | 98.750%  | 95.000%           |
### Scenario Version and Model

| scenario_version | model_key    | correct_items | total_items | work_units_4_of_4 | total_work_units | accuracy | 4_of_4_proportion |
| ---------------- | ------------ | ------------- | ----------- | ----------------- | ---------------- | -------- | ----------------- |
| adapted          | chatgpt      | 452           | 480         | 94                | 120              | 94.167%  | 78.333%           |
| adapted          | claude       | 470           | 480         | 110               | 120              | 97.917%  | 91.667%           |
| adapted          | gemini_flash | 471           | 480         | 111               | 120              | 98.125%  | 92.500%           |
| literal          | chatgpt      | 449           | 480         | 92                | 120              | 93.542%  | 76.667%           |
| literal          | claude       | 464           | 480         | 104               | 120              | 96.667%  | 86.667%           |
| literal          | gemini_flash | 469           | 480         | 109               | 120              | 97.708%  | 90.833%           |
### Question Type and Model

| question_type         | model_key    | correct_items | total_items | work_units_4_of_4 | total_work_units | accuracy | 4_of_4_proportion |
| --------------------- | ------------ | ------------- | ----------- | ----------------- | ---------------- | -------- | ----------------- |
| Actor                 | chatgpt      | 189           | 240         | 186               | 240              | 78.750%  | 77.500%           |
| Actor                 | claude       | 219           | 240         | 214               | 240              | 91.250%  | 89.167%           |
| Actor                 | gemini_flash | 221           | 240         | 220               | 240              | 92.083%  | 91.667%           |
| Affected party/object | chatgpt      | 240           | 240         | 186               | 240              | 100.000% | 77.500%           |
| Affected party/object | claude       | 240           | 240         | 214               | 240              | 100.000% | 89.167%           |
| Affected party/object | gemini_flash | 240           | 240         | 220               | 240              | 100.000% | 91.667%           |
| Consequence/outcome   | chatgpt      | 240           | 240         | 186               | 240              | 100.000% | 77.500%           |
| Consequence/outcome   | claude       | 237           | 240         | 214               | 240              | 98.750%  | 89.167%           |
| Consequence/outcome   | gemini_flash | 240           | 240         | 220               | 240              | 100.000% | 91.667%           |
| Main action           | chatgpt      | 232           | 240         | 186               | 240              | 96.667%  | 77.500%           |
| Main action           | claude       | 238           | 240         | 214               | 240              | 99.167%  | 89.167%           |
| Main action           | gemini_flash | 239           | 240         | 220               | 240              | 99.583%  | 91.667%           |
### Foundation and Model

| foundation           | model_key    | correct_items | total_items | work_units_4_of_4 | total_work_units | accuracy | 4_of_4_proportion |
| -------------------- | ------------ | ------------- | ----------- | ----------------- | ---------------- | -------- | ----------------- |
| Authority/Subversion | chatgpt      | 182           | 192         | 38                | 48               | 94.792%  | 79.167%           |
| Authority/Subversion | claude       | 190           | 192         | 46                | 48               | 98.958%  | 95.833%           |
| Authority/Subversion | gemini_flash | 190           | 192         | 46                | 48               | 98.958%  | 95.833%           |
| Care/Harm            | chatgpt      | 175           | 192         | 36                | 48               | 91.146%  | 75.000%           |
| Care/Harm            | claude       | 189           | 192         | 45                | 48               | 98.438%  | 93.750%           |
| Care/Harm            | gemini_flash | 188           | 192         | 44                | 48               | 97.917%  | 91.667%           |
| Fairness/Cheating    | chatgpt      | 166           | 192         | 22                | 48               | 86.458%  | 45.833%           |
| Fairness/Cheating    | claude       | 173           | 192         | 29                | 48               | 90.104%  | 60.417%           |
| Fairness/Cheating    | gemini_flash | 178           | 192         | 34                | 48               | 92.708%  | 70.833%           |
| Loyalty/Betrayal     | chatgpt      | 192           | 192         | 48                | 48               | 100.000% | 100.000%          |
| Loyalty/Betrayal     | claude       | 191           | 192         | 47                | 48               | 99.479%  | 97.917%           |
| Loyalty/Betrayal     | gemini_flash | 192           | 192         | 48                | 48               | 100.000% | 100.000%          |
| Sanctity/Degradation | chatgpt      | 186           | 192         | 42                | 48               | 96.875%  | 87.500%           |
| Sanctity/Degradation | claude       | 191           | 192         | 47                | 48               | 99.479%  | 97.917%           |
| Sanctity/Degradation | gemini_flash | 192           | 192         | 48                | 48               | 100.000% | 100.000%          |
### Scenario Shift Tier and Model

| shift_tier_manuscript | model_key    | correct_items | total_items | work_units_4_of_4 | total_work_units | accuracy | 4_of_4_proportion |
| --------------------- | ------------ | ------------- | ----------- | ----------------- | ---------------- | -------- | ----------------- |
| Higher-shift          | chatgpt      | 436           | 480         | 81                | 120              | 90.833%  | 67.500%           |
| Higher-shift          | claude       | 461           | 480         | 101               | 120              | 96.042%  | 84.167%           |
| Higher-shift          | gemini_flash | 461           | 480         | 101               | 120              | 96.042%  | 84.167%           |
| Lower-shift           | chatgpt      | 465           | 480         | 105               | 120              | 96.875%  | 87.500%           |
| Lower-shift           | claude       | 473           | 480         | 113               | 120              | 98.542%  | 94.167%           |
| Lower-shift           | gemini_flash | 479           | 480         | 119               | 120              | 99.792%  | 99.167%           |
### Scenario

| scenario_id | correct_items | total_items | work_units_4_of_4 | total_work_units | accuracy | 4_of_4_proportion |
| ----------- | ------------- | ----------- | ----------------- | ---------------- | -------- | ----------------- |
| S02         | 141           | 144         | 33                | 36               | 97.917%  | 91.667%           |
| S05         | 144           | 144         | 36                | 36               | 100.000% | 100.000%          |
| S06         | 144           | 144         | 36                | 36               | 100.000% | 100.000%          |
| S12         | 142           | 144         | 34                | 36               | 98.611%  | 94.444%           |
| S18         | 133           | 144         | 25                | 36               | 92.361%  | 69.444%           |
| S20         | 123           | 144         | 15                | 36               | 85.417%  | 41.667%           |
| S22         | 140           | 144         | 32                | 36               | 97.222%  | 88.889%           |
| S23         | 144           | 144         | 36                | 36               | 100.000% | 100.000%          |
| S24         | 144           | 144         | 36                | 36               | 100.000% | 100.000%          |
| S26         | 124           | 144         | 21                | 36               | 86.111%  | 58.333%           |
| S28         | 117           | 144         | 9                 | 36               | 81.250%  | 25.000%           |
| S33         | 141           | 144         | 33                | 36               | 97.917%  | 91.667%           |
| S36         | 144           | 144         | 36                | 36               | 100.000% | 100.000%          |
| S37         | 144           | 144         | 36                | 36               | 100.000% | 100.000%          |
| S40         | 143           | 144         | 35                | 36               | 99.306%  | 97.222%           |
| S42         | 144           | 144         | 36                | 36               | 100.000% | 100.000%          |
| S43         | 138           | 144         | 30                | 36               | 95.833%  | 83.333%           |
| S47         | 143           | 144         | 35                | 36               | 99.306%  | 97.222%           |
| S48         | 141           | 144         | 33                | 36               | 97.917%  | 91.667%           |
| S49         | 141           | 144         | 33                | 36               | 97.917%  | 91.667%           |

## Limitations

The analysis contains only 20 scenario clusters, comprehension scores are highly
concentrated at 4/4, rating shifts are bounded and discrete, and the comparisons are
observational. Clustered standard errors and scenario-cluster bootstraps address dependence
within scenarios but cannot remove confounding or create independent scenario-level
replication. Externally approved items may still differ in difficulty, and no item was
removed or rescored after observing results.
