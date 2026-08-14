# Neutral-Control Experiment Report

## Methods

Five neutral-control scenarios, validated as neutral by three independent external coders in
English, were evaluated after native-speaker review and approval across seven languages. Each
control used an English baseline plus literal and culturally adapted non-English versions, yielding
25 conditions per control. The exact evaluated models were
`openai/gpt-4o-2024-11-20`, `anthropic/claude-sonnet-4.6`, and
`google/gemini-3.5-flash`. They completed the same 1-7 blameworthiness-rating task across 375
expected responses at temperature 0 and a uniform 16-token completion limit. The controls diagnose
model use of the response scale; they do not establish a human baseline.

### Protocol Deviation

Gemini 3.5 Flash was configured with minimal reasoning effort because its default reasoning process
exhausted the original five-token completion limit before returning a rating. The completion limit
was increased uniformly to 16 tokens across all evaluated models. No model, prompt, temperature,
scenario, question, or rating-scale changes were made.

The pre-correction smoke database, CSV, model-verification evidence, and manifest are retained in
the timestamped `data/results/archive` folder. Those observations were removed from the active
store and are not part of the final dataset.

## Results

Completion was 375 of 375 responses (100.0%), with 375 unique work units and
no duplicates. The collection contained 3 retry attempts, all of which resolved, and
0 invalid final responses. Raw outputs and token and cost metadata were retained for every
final row. No active output ended with `MAX_TOKENS`.

### Cost Accounting

- Archived first smoke attempt: $0.002103000.
- Successful replacement smoke test: $0.001401000.
- Full experiment after the smoke, including verification: $0.273344000.
- Combined total for all paid requests: $0.276848000.

The successful three-row replacement smoke is retained within the final 375-row dataset. It is
therefore separated from the remaining 372 responses in the cost ledger and is not counted twice
in the combined total. The 375 final response rows themselves cost $0.274110500.

The overall mean rating was 1.000 (median 1.000). Ratings were
concentrated as follows: 375 responses at 1
(100.0%), 0 at 2
(0.0%), and 0 above 2
(0.0%).

### Model-Level Ratings

- chatgpt: M = 1.000, median = 1.000, n = 125.
- claude: M = 1.000, median = 1.000, n = 125.
- gemini_flash: M = 1.000, median = 1.000, n = 125.

### Exploratory Calibration Contrasts

Because the contrasts contain only five controls per model-language cell, their confidence
intervals and any inferential interpretation are exploratory. Non-significance must not be read as
evidence of no effect.

- cultural_adaptation_primary: mean paired difference 0.000, 95% bootstrap CI [0.000, 0.000], n = 90.
- input_language: mean paired difference 0.000, 95% bootstrap CI [0.000, 0.000], n = 90.
- response_language_primary: mean paired difference 0.000, 95% bootstrap CI [0.000, 0.000], n = 90.

## Interpretation

All neutral-control ratings were at the floor value of 1, so every observed mean calibration
contrast was zero. The results provide no evidence of upward calibration shifts in these controls,
but complete floor compression limits sensitivity to downward shifts and does not rule out general
calibration effects on non-neutral items.

The original moral-rating dataset was not used here. No moral-versus-neutral interaction was
estimated. `src.compare_moral_and_neutral` is provided for that later analysis.

## Reproducibility

The run was resumed after an interrupted export and completed through the unique work-unit store.
Machine-readable request settings, model IDs, timestamps, workbook hashes, archive provenance,
cost components, commands, and output paths are recorded in
`data/results/run_metadata.json`; cost components are also available in
`data/results/cost_ledger.csv`.
