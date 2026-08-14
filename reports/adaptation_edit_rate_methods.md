# Adaptation Edit-Rate Methods

## Primary Metric

The primary metric is Levenshtein distance between NFKC/whitespace-normalized literal and
adapted strings divided by the longer normalized string length. It ranges from 0 to 1.
Distance is computed by an exact deterministic bit-parallel Levenshtein implementation,
validated against fixed unit examples.

## Secondary Metrics

Secondary metrics include raw and normalized character distances, relative character-length
change, exact token Levenshtein rate, token-set Jaccard similarity, token overlap,
bit-parallel character LCS ratio, and minimal token alignment counts for additions,
removals, and replacements. Added proportions use adapted token count; removed proportions
use literal token count; replacement proportions use the larger token count.

## Surface Audit

Sentence boundaries use `. ! ? 。 ！ ？ । ॥`. Approximate clauses equal sentence segments
plus comma/semicolon/colon/dash separators. Conservative multilingual marker lexicons flag
possible names, locations/institutions, and cultural objects. Classification thresholds are:
structural for sentence changes, clause difference >=2, character edit rate >=.45, token
edit rate >=.50, or absolute relative length change >=.30; surface-dominant for a detected
surface flag with edit rate <=.20 and unchanged clauses; mixed for intermediate evidence;
otherwise uncertain.

## Rating Effect

For each authorized model, scenario, and language:

`{language}_adapted_reason_en - {language}_translation_reason_en`

produces the signed cultural-adaptation effect; its absolute value is the absolute effect.

## Inference

Bootstrap repetitions: **10,000**. Seed: **20260727**. Cluster:
`scenario_id`. Spearman confidence intervals resample scenarios with replacement.
Regressions use finite-sample-corrected scenario-clustered covariance and t-based inference.
