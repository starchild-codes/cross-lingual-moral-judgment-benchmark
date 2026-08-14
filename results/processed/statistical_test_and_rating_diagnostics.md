# Statistical Test And Rating Output Diagnostics

## Existing Statistical Tests In Finalized Result Tables

The p-values currently present in `results/processed/analysis/language_effects.csv`, `framing_effects.csv`, `reasoning_effects.csv`, and `foundation_breakdown.csv` were produced by a two-sided paired t-test on paired rating differences.

- `language_effect`: paired t-test comparing L-translation-reason-EN against the same model/scenario English baseline.
- `framing_effect`: paired t-test comparing L-adapted-reason-EN against L-translation-reason-EN for the same model/scenario.
- `reasoning_effect`: paired t-test comparing L-translation-reason-L2 against L-translation-reason-EN for the same model/scenario.
- `foundation_breakdown`: the same paired t-test logic as above, after subsetting rows by designed MFT foundation.

The implementation computes paired differences first, then uses t = mean(diff) / SE(diff) and a Student t distribution with n - 1 degrees of freedom. The relevant code path is `scripts/post-expansion-analysis.ts -> summarizeEffect() -> pairedSummary()`.

## Confidence Intervals And Unit Of Variance

The 95% confidence intervals in the finalized tables were computed as mean paired difference +/- 1.96 x standard error of paired differences. The standard error is SD(diff) / sqrt(n), where diff is the within-pair rating difference.

Yes: uncertainty is estimated over paired scenario-level differences, with the model included in the pairing key for model-specific and pooled effects. For pooled effects, the variance unit is the paired model-scenario difference. For foundation breakdowns, the same paired-difference unit is used after filtering to that foundation.

## Rating Diagnostics

- Total rating work units: 5000
- Rating rows with `attemptCount > 1` requiring a work-unit retry: 28
- Malformed outputs after retries, defined as non-null `errorNote` or final `parsedRating` not in 1-7: 0
- Missing/null ratings in final analysis: 0

Important caveat: internal retry attempts inside `runRatingTask()` are not separately persisted in the final CSV. Therefore, `attemptCount > 1` captures work-unit-level retries visible in saved data, not every internal malformed-output retry that may have happened before a successful final parse.

### Breakdown By Model

| group_type | group_value | total_rating_work_units | outputs_requiring_workunit_retry_attemptCount_gt_1 | malformed_after_retries_or_error | missing_null_ratings_final |
| --- | --- | --- | --- | --- | --- |
| model | chatgpt | 1250 | 0 | 0 | 0 |
| model | claude | 1250 | 1 | 0 | 0 |
| model | gemini_flash | 1250 | 25 | 0 | 0 |
| model | gemini_pro | 1250 | 2 | 0 | 0 |

### Breakdown By Language

| group_type | group_value | total_rating_work_units | outputs_requiring_workunit_retry_attemptCount_gt_1 | malformed_after_retries_or_error | missing_null_ratings_final |
| --- | --- | --- | --- | --- | --- |
| language | ar | 800 | 1 | 0 | 0 |
| language | bn | 800 | 0 | 0 | 0 |
| language | en | 200 | 25 | 0 | 0 |
| language | es | 800 | 0 | 0 | 0 |
| language | hi | 800 | 0 | 0 | 0 |
| language | ja | 800 | 0 | 0 | 0 |
| language | ta | 800 | 2 | 0 | 0 |

### Breakdown By Condition Type

| group_type | group_value | total_rating_work_units | outputs_requiring_workunit_retry_attemptCount_gt_1 | malformed_after_retries_or_error | missing_null_ratings_final |
| --- | --- | --- | --- | --- | --- |
| condition_type | adapted_reason_en | 1200 | 0 | 0 | 0 |
| condition_type | adapted_reason_l2 | 1200 | 1 | 0 | 0 |
| condition_type | en_en | 200 | 25 | 0 | 0 |
| condition_type | translation_reason_en | 1200 | 1 | 0 | 0 |
| condition_type | translation_reason_l2 | 1200 | 1 | 0 | 0 |
