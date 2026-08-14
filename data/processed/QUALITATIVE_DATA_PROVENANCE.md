# Qualitative Data Provenance

## Canonical File

`qualitative_human_adjudicated_final.csv` is the public canonical extract of the 1,000 qualitative explanation rows. It is derived from `results/processed/full_merged_with_human_mft_codes.csv` by selecting `taskType = qualitative` and retains the original response-level fields. The added `human_adjudicated_mft_label` column is a direct duplicate of the historical final-label field for clear public use.

## Human Coding Process

Two independent human coders coded the 1,000 explanations: the first author and a computer-science graduate. Both were blind to model, input language, condition, and intended foundation. Their raw agreement was 96.2%, with Cohen's kappa = 0.948. Disagreements were resolved through human adjudication; the final labels are therefore human-adjudicated labels.

## Historical Filenames and Fields

The files and fields `full_merged_with_ai_mft_codes.csv`, `ai_mft_*`, `llama`, and `deepseek` are historical names. They do not accurately describe the final coding process and must not be cited as evidence that the final labels were AI-assisted or LLM-generated. The original historical files remain unchanged for traceability.

The canonical extract contains 1,000 rows. Its SHA-256 hash is `cb239a9804ef81a5da72868304f4fe9d42552c70a0f3df9fac07e6029d4c4dc2`.
