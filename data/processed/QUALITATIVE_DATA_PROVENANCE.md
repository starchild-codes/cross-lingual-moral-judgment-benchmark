# Qualitative Data Provenance

## Released extract and source lineage

`qualitative_human_adjudicated_final.csv` contains 1,000 model-explanation rows extracted from `results/processed/full_merged_with_human_mft_codes.csv`. Its `human_adjudicated_mft_label` field duplicates the existing `ai_mft_final_label` field. The field name alone does not establish human annotation provenance.

`results/processed/full_merged_with_human_mft_codes.csv` and `results/processed/full_merged_with_ai_mft_codes.csv` are byte-identical (SHA-256 `404b9cf67fa86cdf846db4ae53e26d38bbc844370c025ed81c4360794e195284`). `scripts/ai-mft-coding.ts` and `results/processed/ai_mft_coding/` document an earlier automated Llama/DeepSeek coding and adjudication pipeline. Those are real archived records of an automated workflow, not arbitrary legacy names.

## Independent human coding reported by the study team

The study team reports that two independent humans coded the 1,000 explanations (the first author and a computer-science graduate), with reported raw agreement of 96.2% and Cohen's kappa = 0.948, followed by human adjudication. Model, language, and condition metadata were withheld from the coder-facing materials. The first author had designed the scenarios and could recognize their intended foundations. English and Hindi explanations were read directly; the other languages were machine-translated into English for coding according to the study's method account.

**Evidence boundary:** The original independent human response-level label files, human adjudication log, and independent calculation of human agreement have not been deposited in this public snapshot. Accordingly, this released extract alone cannot show whether its labels are identical to the separately reported human decisions. This limitation **does not imply that the independent human coding did not occur**.

`results/processed/final_evidence_lock/qualitative_ai_coder_agreement.csv` records 959 exact agreements among 996 valid **LLM-to-LLM** coding pairs (96.285%; kappa approximately 0.94815). Those numbers must not be cited as independently verified human inter-rater reliability merely because they resemble the author-reported human statistics.

## Closing the public verification gap

Preserve or deposit independent, de-identified Coder A and Coder B files keyed by `response_id`, plus their actual human-adjudicated final labels. `mft_coding/kappa_calculator.py` already calculates raw agreement and Cohen's kappa from two such files. Verify that the adjudicated human labels match the published extract by `response_id`; if any differ, reconcile the affected qualitative statistics and figures rather than silently renaming the older records.

The three-human validation dataset in `results/processed/scenario_validation_trial2/` concerns **50 scenario texts** and is not a substitute for the two-person coding of 1,000 model explanations.

The 1,000-row extract has SHA-256 `cb239a9804ef81a5da72868304f4fe9d42552c70a0f3df9fac07e6029d4c4dc2`. It allows reproduction of descriptive results **conditional on the archived response labels**, subject to the source-attribution limitation above.
