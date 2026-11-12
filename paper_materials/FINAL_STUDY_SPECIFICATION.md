# Final Study Specification

## Scope

The final benchmark contains 50 English moral scenarios spanning five Moral Foundations Theory categories: Care/Harm, Loyalty/Betrayal, Authority/Subversion, Fairness/Cheating, and Sanctity/Degradation. The canonical scenario dataset is `data/scenarios_final_50.csv`.

Each scenario is evaluated in seven input languages: English, Hindi, Bengali, Tamil, Spanish, Japanese, and Arabic. For each non-English language, the design includes literal translation and cultural adaptation versions, crossed with English and same-language instructed response language. This gives 25 conditions per scenario.

## Models and Observations

The three primary evaluated models are GPT-4o (`openai/gpt-4o-2024-11-20`), Claude Sonnet 4.6 (`anthropic/claude-sonnet-4.6`), and Gemini 3.5 Flash (`google/gemini-3.5-flash`). The primary rating dataset contains 5,000 ratings: 50 scenarios x 25 conditions x 4 model records, including the fixed high-capability comparator Gemini 3.1 Pro Preview (`google/gemini-3.1-pro-preview`).

Gemini 3.1 Pro Preview is a fixed high-capability reference comparator. It is not moral ground truth, an oracle, or a source of correct answers.

## Qualitative Explanations and Validation

The qualitative dataset contains 1,000 explanations from 10 scenarios x 25 conditions x 4 models. The study team reports that two independent humans coded the explanations without displayed model, language, or condition metadata (reported agreement 96.2%; Cohen's kappa = 0.948). The first author designed the scenarios and thus could not be fully blind to their intended foundations. The original independent human response-level label exports and adjudication log are absent from the public snapshot, so human agreement and the attribution of the currently archived final labels cannot be independently verified here. The released qualitative label field also has a separate historical automated-coding lineage; see `data/processed/QUALITATIVE_DATA_PROVENANCE.md`.

Scenario-foundation validation was separate: three external blinded human coders assessed all 50 English scenarios. This validation retained 5 of 10 intended Authority/Subversion scenarios under the human-majority criterion.

## Interpretive Boundaries

The study evaluates output patterns, not hidden model cognition. Describe explanation results as foundations that were invoked, emphasized, framed, or coded. In the S30 qualitative finding, Care/Harm was the dominant single-label framing in all 100 explanations, while authority-adjacent rule, duty, protocol, compliance, and responsibility language was also present.

Cultural adaptation produced the most consistent significance-based corrected pattern, whereas other consistency criteria showed a more mixed picture. The detailed statistical policy reconciliation is in `reports/statistical_policy_reconciliation.md`.
