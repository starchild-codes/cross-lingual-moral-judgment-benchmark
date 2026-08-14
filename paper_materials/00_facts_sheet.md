# Project Facts Sheet

Generated from on-disk data files on 2026-06-30T05:29:08.259Z.

## Design Counts

- Final scenario count: 50
- Languages in final data: en (English), hi (Hindi), bn (Bengali), ta (Tamil), es (Spanish), ja (Japanese), ar (Arabic)
- Condition count: 25
- Final merged dataset rows: 6000
- Rating rows: 5000
- Qualitative rows: 1000

## Models

| model_key |openrouter_model_string |
| --- | --- |
| chatgpt | openai/gpt-4o-2024-11-20 |
| claude | anthropic/claude-sonnet-4.6 |
| gemini_flash | google/gemini-3.5-flash |
| gemini_pro | google/gemini-3.1-pro-preview |

## API Calls And Cost

The table reports both row counts and summed `attemptCount`, because retries make attempted API calls differ from completed work-unit rows.

| model_key |task_type |rows |summed_attempt_count_api_calls |
| --- | --- | --- | --- |
| chatgpt | qualitative | 250 | 250 |
| chatgpt | rating | 1250 | 1250 |
| claude | qualitative | 250 | 250 |
| claude | rating | 1250 | 1251 |
| gemini_flash | qualitative | 250 | 255 |
| gemini_flash | rating | 1250 | 1275 |
| gemini_pro | qualitative | 250 | 250 |
| gemini_pro | rating | 1250 | 1252 |

- Total completed work-unit rows: 6000
- Total summed attemptCount API calls: 6033
- Total actual API cost from `cost` column: 10.792262000000033

## Data Collection Date Range

- Earliest `createdAt`: 2026-06-23T11:48:28.316Z
- Latest `updatedAt`: 2026-06-29T11:02:00.692Z

## Final Dataset Breakdown

### Rows By Model

| model_key |rows |
| --- | --- |
| chatgpt | 1500 |
| claude | 1500 |
| gemini_flash | 1500 |
| gemini_pro | 1500 |

### Rows By Scenario

| scenario_id |rows |
| --- | --- |
| S01 | 200 |
| S02 | 100 |
| S03 | 100 |
| S04 | 100 |
| S05 | 100 |
| S06 | 200 |
| S07 | 100 |
| S08 | 100 |
| S09 | 100 |
| S10 | 100 |
| S11 | 200 |
| S12 | 100 |
| S13 | 100 |
| S14 | 100 |
| S15 | 100 |
| S16 | 200 |
| S17 | 100 |
| S18 | 100 |
| S19 | 100 |
| S20 | 100 |
| S21 | 200 |
| S22 | 100 |
| S23 | 100 |
| S24 | 100 |
| S25 | 100 |
| S26 | 200 |
| S27 | 100 |
| S28 | 200 |
| S29 | 200 |
| S30 | 200 |
| S31 | 100 |
| S32 | 100 |
| S33 | 100 |
| S34 | 200 |
| S35 | 100 |
| S36 | 100 |
| S37 | 100 |
| S38 | 100 |
| S39 | 100 |
| S40 | 100 |
| S41 | 100 |
| S42 | 100 |
| S43 | 100 |
| S44 | 100 |
| S45 | 100 |
| S46 | 100 |
| S47 | 100 |
| S48 | 100 |
| S49 | 100 |
| S50 | 100 |

### Rows By Model And Scenario

| model_key |scenario_id |rows |
| --- | --- | --- |
| chatgpt | S01 | 50 |
| chatgpt | S02 | 25 |
| chatgpt | S03 | 25 |
| chatgpt | S04 | 25 |
| chatgpt | S05 | 25 |
| chatgpt | S06 | 50 |
| chatgpt | S07 | 25 |
| chatgpt | S08 | 25 |
| chatgpt | S09 | 25 |
| chatgpt | S10 | 25 |
| chatgpt | S11 | 50 |
| chatgpt | S12 | 25 |
| chatgpt | S13 | 25 |
| chatgpt | S14 | 25 |
| chatgpt | S15 | 25 |
| chatgpt | S16 | 50 |
| chatgpt | S17 | 25 |
| chatgpt | S18 | 25 |
| chatgpt | S19 | 25 |
| chatgpt | S20 | 25 |
| chatgpt | S21 | 50 |
| chatgpt | S22 | 25 |
| chatgpt | S23 | 25 |
| chatgpt | S24 | 25 |
| chatgpt | S25 | 25 |
| chatgpt | S26 | 50 |
| chatgpt | S27 | 25 |
| chatgpt | S28 | 50 |
| chatgpt | S29 | 50 |
| chatgpt | S30 | 50 |
| chatgpt | S31 | 25 |
| chatgpt | S32 | 25 |
| chatgpt | S33 | 25 |
| chatgpt | S34 | 50 |
| chatgpt | S35 | 25 |
| chatgpt | S36 | 25 |
| chatgpt | S37 | 25 |
| chatgpt | S38 | 25 |
| chatgpt | S39 | 25 |
| chatgpt | S40 | 25 |
| chatgpt | S41 | 25 |
| chatgpt | S42 | 25 |
| chatgpt | S43 | 25 |
| chatgpt | S44 | 25 |
| chatgpt | S45 | 25 |
| chatgpt | S46 | 25 |
| chatgpt | S47 | 25 |
| chatgpt | S48 | 25 |
| chatgpt | S49 | 25 |
| chatgpt | S50 | 25 |
| claude | S01 | 50 |
| claude | S02 | 25 |
| claude | S03 | 25 |
| claude | S04 | 25 |
| claude | S05 | 25 |
| claude | S06 | 50 |
| claude | S07 | 25 |
| claude | S08 | 25 |
| claude | S09 | 25 |
| claude | S10 | 25 |
| claude | S11 | 50 |
| claude | S12 | 25 |
| claude | S13 | 25 |
| claude | S14 | 25 |
| claude | S15 | 25 |
| claude | S16 | 50 |
| claude | S17 | 25 |
| claude | S18 | 25 |
| claude | S19 | 25 |
| claude | S20 | 25 |
| claude | S21 | 50 |
| claude | S22 | 25 |
| claude | S23 | 25 |
| claude | S24 | 25 |
| claude | S25 | 25 |
| claude | S26 | 50 |
| claude | S27 | 25 |
| claude | S28 | 50 |
| claude | S29 | 50 |
| claude | S30 | 50 |
| claude | S31 | 25 |
| claude | S32 | 25 |
| claude | S33 | 25 |
| claude | S34 | 50 |
| claude | S35 | 25 |
| claude | S36 | 25 |
| claude | S37 | 25 |
| claude | S38 | 25 |
| claude | S39 | 25 |
| claude | S40 | 25 |
| claude | S41 | 25 |
| claude | S42 | 25 |
| claude | S43 | 25 |
| claude | S44 | 25 |
| claude | S45 | 25 |
| claude | S46 | 25 |
| claude | S47 | 25 |
| claude | S48 | 25 |
| claude | S49 | 25 |
| claude | S50 | 25 |
| gemini_flash | S01 | 50 |
| gemini_flash | S02 | 25 |
| gemini_flash | S03 | 25 |
| gemini_flash | S04 | 25 |
| gemini_flash | S05 | 25 |
| gemini_flash | S06 | 50 |
| gemini_flash | S07 | 25 |
| gemini_flash | S08 | 25 |
| gemini_flash | S09 | 25 |
| gemini_flash | S10 | 25 |
| gemini_flash | S11 | 50 |
| gemini_flash | S12 | 25 |
| gemini_flash | S13 | 25 |
| gemini_flash | S14 | 25 |
| gemini_flash | S15 | 25 |
| gemini_flash | S16 | 50 |
| gemini_flash | S17 | 25 |
| gemini_flash | S18 | 25 |
| gemini_flash | S19 | 25 |
| gemini_flash | S20 | 25 |
| gemini_flash | S21 | 50 |
| gemini_flash | S22 | 25 |
| gemini_flash | S23 | 25 |
| gemini_flash | S24 | 25 |
| gemini_flash | S25 | 25 |
| gemini_flash | S26 | 50 |
| gemini_flash | S27 | 25 |
| gemini_flash | S28 | 50 |
| gemini_flash | S29 | 50 |
| gemini_flash | S30 | 50 |
| gemini_flash | S31 | 25 |
| gemini_flash | S32 | 25 |
| gemini_flash | S33 | 25 |
| gemini_flash | S34 | 50 |
| gemini_flash | S35 | 25 |
| gemini_flash | S36 | 25 |
| gemini_flash | S37 | 25 |
| gemini_flash | S38 | 25 |
| gemini_flash | S39 | 25 |
| gemini_flash | S40 | 25 |
| gemini_flash | S41 | 25 |
| gemini_flash | S42 | 25 |
| gemini_flash | S43 | 25 |
| gemini_flash | S44 | 25 |
| gemini_flash | S45 | 25 |
| gemini_flash | S46 | 25 |
| gemini_flash | S47 | 25 |
| gemini_flash | S48 | 25 |
| gemini_flash | S49 | 25 |
| gemini_flash | S50 | 25 |
| gemini_pro | S01 | 50 |
| gemini_pro | S02 | 25 |
| gemini_pro | S03 | 25 |
| gemini_pro | S04 | 25 |
| gemini_pro | S05 | 25 |
| gemini_pro | S06 | 50 |
| gemini_pro | S07 | 25 |
| gemini_pro | S08 | 25 |
| gemini_pro | S09 | 25 |
| gemini_pro | S10 | 25 |
| gemini_pro | S11 | 50 |
| gemini_pro | S12 | 25 |
| gemini_pro | S13 | 25 |
| gemini_pro | S14 | 25 |
| gemini_pro | S15 | 25 |
| gemini_pro | S16 | 50 |
| gemini_pro | S17 | 25 |
| gemini_pro | S18 | 25 |
| gemini_pro | S19 | 25 |
| gemini_pro | S20 | 25 |
| gemini_pro | S21 | 50 |
| gemini_pro | S22 | 25 |
| gemini_pro | S23 | 25 |
| gemini_pro | S24 | 25 |
| gemini_pro | S25 | 25 |
| gemini_pro | S26 | 50 |
| gemini_pro | S27 | 25 |
| gemini_pro | S28 | 50 |
| gemini_pro | S29 | 50 |
| gemini_pro | S30 | 50 |
| gemini_pro | S31 | 25 |
| gemini_pro | S32 | 25 |
| gemini_pro | S33 | 25 |
| gemini_pro | S34 | 50 |
| gemini_pro | S35 | 25 |
| gemini_pro | S36 | 25 |
| gemini_pro | S37 | 25 |
| gemini_pro | S38 | 25 |
| gemini_pro | S39 | 25 |
| gemini_pro | S40 | 25 |
| gemini_pro | S41 | 25 |
| gemini_pro | S42 | 25 |
| gemini_pro | S43 | 25 |
| gemini_pro | S44 | 25 |
| gemini_pro | S45 | 25 |
| gemini_pro | S46 | 25 |
| gemini_pro | S47 | 25 |
| gemini_pro | S48 | 25 |
| gemini_pro | S49 | 25 |
| gemini_pro | S50 | 25 |

## Error Notes

- Non-null `errorNote` values: 0

No non-null error notes were found in the final merged dataset.

## MFT Coding Methodology

Qualitative responses were coded with two independent OpenRouter-hosted LLM coders that were not among the evaluated GPT-4o, Claude Sonnet, Gemini Flash, or Gemini Pro model families. This was done to reduce model-contamination risk between evaluated models and coding models. The primary coder was `meta-llama/llama-3.3-70b-instruct`; the second coder for reliability was `deepseek/deepseek-chat`. Both received the same structured Moral Foundations Theory coding prompt and were required to output exactly one of the five allowed labels.

Rows with exact model agreement were accepted directly. Invalid outputs and disagreements were manually adjudicated using the documented adjudication file and cluster rules, then merged into `full_merged_with_ai_mft_codes.csv`.

### Coding Reliability Before Adjudication

- Total paired responses coded: 1000
- Invalid paired rows excluded from kappa: 4
- Valid paired rows: 996
- Exact agreement percentage: 96.29%
- Cohen's kappa: 0.9482
- Cohen's kappa 95% bootstrap CI: [0.9319, 0.9635]

### Final Coding Sources After Adjudication

| ai_mft_code_source |rows |
| --- | --- |
| ai_agreement | 959 |
| manual_disagreement_review | 37 |
| manual_invalid_review | 4 |
