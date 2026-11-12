# Qualitative Human Coding: Public-Evidence Audit

## Status: study-team account documented; independent source verification incomplete

The study team reports that two humans independently coded 1,000 model explanations, with 96.2% raw agreement and Cohen's kappa = 0.948. This audit does **not** dispute that the independent human work took place. It assesses what the public archive independently demonstrates.

- The released 1,000-row qualitative label column is an exact copy of the historical `ai_mft_final_label` field.
- The `full_merged_with_human_mft_codes.csv` and `full_merged_with_ai_mft_codes.csv` archives are byte-identical.
- The historical `scripts/ai-mft-coding.ts` and `results/processed/ai_mft_coding/` preserve a real automated Llama/DeepSeek workflow.
- `qualitative_ai_coder_agreement.csv` reports 959/996 agreement, kappa 0.94815, explicitly **LLM-to-LLM**, not human-to-human.
- Three separate human scenario validators assessed the original 50 scenario texts; their per-coder records are present and are not the 1,000-explanation coding exports.

The two original independent response-level human coding files and the human adjudication log are not deposited. To independently verify the human statistics and provenance of the final labels, retrieve those files, compute agreement directly from their paired rows, and match their final adjudications by `response_id` to the released extract. Any actual differences require a documented analysis reconciliation.

**Absence of the files from this repository is not evidence that the study-team-reported human coding never occurred.** Until they are provided, public reproduction of descriptive counts is conditional on the released label field, rather than independent confirmation of its human origin.
