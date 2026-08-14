# Multilingual Comprehension-Check Design Report

## Purpose

This package prepares a 720-work-unit experiment to test whether previously observed cross-linguistic rating shifts could be explained by simple factual misunderstanding. It does not ask models to repeat a moral judgment. Each model receives one full scenario and answers four factual multiple-choice questions.

No paid model calls were made during preparation.

## Scenario selection

The primary shift metric is the mean absolute deviation from the English baseline (`en_en`) for literal non-English scenario input with English-language reasoning/response. It averages 18 effects per scenario: 3 authorized models x 6 languages.

Selection was stratified by the five Moral Foundations Theory foundations. Within each foundation, the two highest and two lowest primary-shift scenarios were selected. Only scenarios with a resolved three-coder human majority matching the intended foundation were eligible. Ties were resolved by stronger coder agreement and then lower scenario ID.

| Foundation | Tier | Scenario | Input MAD | Adaptation MAD | Response MAD | Max | Nonzero/72 | Human match |
|---|---|---|---:|---:|---:|---:|---:|---|
| Care/Harm | high | S26 | 3.389 | 0.167 | 0.056 | 5 | 20 | Care/Harm (3/3) |
| Care/Harm | high | S40 | 1.056 | 0.944 | 0.639 | 4 | 39 | Care/Harm (2/3) |
| Care/Harm | low | S05 | 0.056 | 0.111 | 0.222 | 1 | 11 | Care/Harm (3/3) |
| Care/Harm | low | S02 | 0.278 | 0.056 | 0.083 | 1 | 9 | Care/Harm (3/3) |
| Fairness/Cheating | high | S28 | 1.778 | 1.278 | 0.694 | 4 | 48 | Fairness/Cheating (3/3) |
| Fairness/Cheating | high | S20 | 0.500 | 0.444 | 0.417 | 2 | 28 | Fairness/Cheating (3/3) |
| Fairness/Cheating | low | S18 | 0.056 | 0.333 | 0.167 | 1 | 13 | Fairness/Cheating (3/3) |
| Fairness/Cheating | low | S36 | 0.111 | 0.167 | 0.222 | 1 | 13 | Fairness/Cheating (2/3) |
| Loyalty/Betrayal | high | S37 | 0.833 | 1.222 | 0.472 | 3 | 36 | Loyalty/Betrayal (3/3) |
| Loyalty/Betrayal | high | S42 | 0.833 | 0.389 | 0.556 | 3 | 30 | Loyalty/Betrayal (3/3) |
| Loyalty/Betrayal | low | S06 | 0.000 | 0.056 | 0.111 | 1 | 5 | Loyalty/Betrayal (3/3) |
| Loyalty/Betrayal | low | S47 | 0.000 | 0.000 | 0.000 | 0 | 0 | Loyalty/Betrayal (3/3) |
| Authority/Subversion | high | S48 | 1.167 | 1.111 | 0.806 | 3 | 43 | Authority/Subversion (3/3) |
| Authority/Subversion | high | S43 | 0.833 | 1.167 | 0.667 | 4 | 39 | Authority/Subversion (3/3) |
| Authority/Subversion | low | S12 | 0.278 | 0.222 | 0.417 | 1 | 24 | Authority/Subversion (2/3) |
| Authority/Subversion | low | S33 | 0.611 | 1.056 | 0.500 | 2 | 38 | Authority/Subversion (3/3) |
| Sanctity/Degradation | high | S23 | 0.778 | 0.833 | 0.444 | 3 | 34 | Sanctity/Degradation (2/3) |
| Sanctity/Degradation | high | S22 | 0.556 | 0.722 | 0.278 | 2 | 31 | Sanctity/Degradation (3/3) |
| Sanctity/Degradation | low | S49 | 0.056 | 0.333 | 0.111 | 1 | 11 | Sanctity/Degradation (3/3) |
| Sanctity/Degradation | low | S24 | 0.111 | 0.222 | 0.306 | 1 | 17 | Sanctity/Degradation (2/3) |

The completed workbook includes `Scenario_Shift_Audit`, which records all 50 scenarios, eligibility decisions, ranks, metrics, and selection/exclusion rationales.

## MCQ design

- 20 scenarios
- 4 questions per scenario: actor, main action, affected party/object, consequence/outcome
- 80 English source questions
- 6 languages x 2 scenario versions = 12 non-English variants per question
- 960 multilingual MCQ rows
- Answer positions are balanced: 20 each for A, B, C, and D in the English source set
- Questions use role-based wording to avoid adaptation-specific names and locations
- No question requests blameworthiness, moral evaluation, explanation, or justification

All non-English MCQs completed external native-speaker review before live evaluation. All
960 rows were approved without requested wording or answer-key revisions. Because reviewers
provided categorical approval rather than numerical ratings, approved rows were conservatively
encoded as 4/5 for semantic fidelity and naturalness; no reviewer identities were invented.

## Run manifest

The manifest contains exactly `20 x 6 x 2 x 3 = 720` unique work units. Each row stores the exact model ID, prompt, question IDs, answer key, temperature, output limit, reasoning setting, and empty result/usage fields.

| Model key | Exact model ID | Work units |
|---|---|---:|
| chatgpt | `openai/gpt-4o-2024-11-20` | 240 |
| claude | `anthropic/claude-sonnet-4.6` | 240 |
| gemini_flash | `google/gemini-3.5-flash` | 240 |

All models use temperature 0 and a 24-token completion limit. Gemini uses `reasoning.effort = minimal`; no model substitution is permitted.

## Runner safeguards

The runner uses SQLite for attempts and final results, enforces unique work-unit IDs, supports
retries and resume, stores raw output and provider usage/cost metadata, and archives an active
database before a replacement run. Parsing requires exactly four recognized A-D choices in
order. It normalizes only documented locale-specific comma characters and exact localized
option-name aliases before applying that requirement. The human-review gate blocks smoke and
full live runs unless all multilingual rows are approved.

## Analysis

The primary outcome is item-level factual accuracy, with scenario-level 4/4 accuracy as a stricter secondary outcome. Results will be summarized by model, language, literal vs. adapted version, MFT foundation, high vs. low shift tier, and question type. Misses will be retained at item level with the selected option, answer key, raw response, and prompt metadata. Comparisons between high- and low-shift scenarios are diagnostic and should not be treated as independent causal estimates from only 20 selected scenarios.

## Cost estimate

Using a deliberately conservative preflight approximation of one input token per two Unicode characters and eight billed output tokens per call, the estimated list-price cost is:

- GPT-4o: **$0.41**
- Claude Sonnet 4.6: **$0.50**
- Gemini 3.5 Flash: **$0.25**
- Total: **$1.16**

Pricing basis checked on 2026-07-27: GPT-4o $2.50/$10, Claude Sonnet 4.6 $3/$15, and Gemini 3.5 Flash $1.50/$9 per million input/output tokens. Actual cost may differ because tokenization and caching vary; provider-reported cost metadata is authoritative.

## Provenance and integrity

- Untouched original workbook SHA-256: `d1462380a5d335663a83ca62e69af98eec937cedf3c2079a93f257e65a5c8dbb`
- Completed workbook SHA-256: `c2a15e62821459c2d41d699fde686fda272268bdc064608785fbc98a395c298e`
- Rating sources: `results/processed/full_1782215308316_vrq93w.ratings.csv` and `results/processed/extension_full_1782729062659_xqetbf.ratings.csv`
- Scenario sources: `data/scenarios.csv` and `data/scenarios_extension.csv`
- Human validation: `results/processed/scenario_validation_trial2/scenario_validation_merged_3coders.csv`
- The fourth historical rating model (`gemini_pro`) was excluded; only the three authorized models were used in shift calculations.

## Completion status

The live experiment and final analysis are complete: 720 unique work units produced 2,880
scored answers. Final tables, figures, attempt and format audits, cost summaries, and
reproducibility metadata are documented in `reports/comprehension_results_report.md` and
`reports/reproducibility_report.md`.

## External review provenance

All 960 multilingual MCQ rows were externally reviewed by speakers competent in the respective languages. Reviewers verified semantic fidelity, naturalness, preservation of the factual target, and the presence of exactly one correct answer. All rows were approved without requested revisions. Because reviewers provided categorical approval rather than numerical ratings, approved rows were conservatively encoded as 4/5 for semantic fidelity and naturalness.
