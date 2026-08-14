# Neutral-Control Multilingual Experiment

Self-contained Python project for validating, running, diagnosing, and analysing the five
neutral controls for the multilingual moral-judgment study.

The experiment asks whether multilingual shifts in 1-7 blameworthiness ratings may partly reflect
general response-scale calibration rather than moral judgment specifically. It makes no paid API
calls unless a smoke test or full run is explicitly started.

## Current Run Status

The workbook has the expected five controls and 65 source rows. All 60 non-English literal
translations and cultural adaptations are marked `Approved` following native-speaker review.
Input validation and deterministic generation of all 125 conditions now pass. The original
preapproval workbook is retained at
`data/input/neutral_controls_multilingual_preapproval.xlsx` for traceability.

The project never modifies scenario or question wording.

The authorized live run is complete: 375 of 375 unique work units produced valid ratings, with 125
rows per model and 75 rows per control. Three malformed Gemini attempt outputs were retried
successfully; there are no unresolved failures or duplicate active work units. All 375 final
ratings were 1.

## Project Layout

```text
neutral-control-experiment/
|-- README.md
|-- requirements.txt
|-- .env.example
|-- config/
|   |-- models.yaml
|   `-- prompts.yaml
|-- data/
|   |-- input/neutral_controls_multilingual.xlsx
|   |-- processed/
|   `-- results/
|-- figures/
|-- reports/neutral_control_report.md
|-- src/
`-- tests/
```

## Setup

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it on Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Activate it on Windows Command Prompt:

```bat
.venv\Scripts\activate.bat
```

Activate it on macOS or Linux:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create the local environment file.

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Put the OpenRouter key in `.env`:

```dotenv
OPENROUTER_API_KEY=your_key_here
```

Optional request attribution:

```dotenv
OPENROUTER_SITE_URL=https://your-project.example
OPENROUTER_APP_NAME=Neutral Control Experiment
```

Secrets are not logged and `.env` is ignored by Git.

## Required Workflow

Run from this project folder.

1. Validate the frozen workbook:

```bash
python -m src.validate_input
```

2. Generate the 125 deterministic conditions:

```bash
python -m src.build_conditions
```

3. Run tests. Tests use fixtures and mocked HTTP responses and never make paid calls:

```bash
python -m pytest
```

4. Perform a no-cost dry run:

```bash
python -m src.run_experiment --dry-run
```

5. After workbook approval, API-key setup, and explicit authorization, run the three-call smoke
test:

```bash
python -m src.run_experiment --smoke-test
```

The smoke test uses one control-condition across GPT-4o, Claude Sonnet 4.6, and Gemini 3.5 Flash.
It does not start the full run. In this completed collection, the successful replacement smoke rows
were retained as the first three rows of the final 375-work-unit dataset.

6. Only after reviewing the smoke-test output, explicitly run the full experiment:

```bash
python -m src.run_experiment --full
```

The full experiment spends API credits. It performs a minimal availability request to each selected
model first and saves those API responses to `data/results/model_verification.json`. If a configured
model ID is unavailable, the run stops rather than substituting another model.

Run one model only:

```bash
python -m src.run_experiment --full --model chatgpt
```

Resume an interrupted full run safely:

```bash
python -m src.run_experiment --resume
```

SQLite storage uses the unique key `control_id::model_key::condition_id`. Each attempt is committed
immediately. Valid work units are skipped, failed attempts remain preserved, and invalid results
are retried only up to the configured maximum.

7. Validate completion and export the clean dataset:

```bash
python -m src.diagnostics
```

Diagnostics exits with a failure code unless all 375 unique valid responses are present.

8. Analyse the controls:

```bash
python -m src.analyze_controls
```

9. Create 300-dpi publication figures and plotting-data CSVs:

```bash
python -m src.make_figures
```

## Experimental Design

Each control has 25 conditions:

- `en_en`
- Six non-English languages, each with:
  - `{language}_literal_response_en`
  - `{language}_literal_response_{language}`
  - `{language}_adapted_response_en`
  - `{language}_adapted_response_{language}`

This produces 125 conditions and 375 work units across:

- `openai/gpt-4o-2024-11-20`
- `anthropic/claude-sonnet-4.6`
- `google/gemini-3.5-flash`

Model IDs and request settings are configurable in `config/models.yaml`. No Gemini 3.1 Pro,
explanation, English-adapted, English-literal, or English-input/non-English-response conditions are
created.

The completed run used temperature 0 and a uniform completion limit of 16 tokens. Gemini 3.5 Flash
alone used `reasoning.effort = minimal`; the other two models had no reasoning parameter.

### Authorized Protocol Deviation

Gemini 3.5 Flash was configured with minimal reasoning effort because its default reasoning process
exhausted the original five-token completion limit before returning a rating. The completion limit
was increased uniformly to 16 tokens across all evaluated models. No model, prompt, temperature,
scenario, question, or rating-scale changes were made.

The failed pre-correction smoke evidence remains in the timestamped
`data/results/archive/20260727T074504Z_precorrection_smoke` folder and is excluded from the active
375-row dataset.

## Cost Planning

OpenRouter's public model pages were checked on 2026-07-27. The listed per-million-token
input/output prices were:

- GPT-4o (2024-11-20): `$2.50 / $10.00`
- Claude Sonnet 4.6: `$3.00 / $15.00`
- Gemini 3.5 Flash: `$1.50 / $9.00`

For the 125 prompts per model, the current workbook and prompt templates contain approximately
89,096 input characters per model. Using a deliberately broad range of one token per four
characters through one token per character, plus the final configured maximum of 16 output tokens
per call, the planned 375-call run was approximately `$0.18-$0.65`, before retries and provider-side
changes. This is a planning estimate, not a billing guarantee. Confirm current pricing immediately
before a paid run:

- https://openrouter.ai/openai/gpt-4o-2024-11-20
- https://openrouter.ai/anthropic/claude-sonnet-4.6
- https://openrouter.ai/google/gemini-3.5-flash

## Outputs

After a completed run:

- `data/results/neutral_control_ratings_raw.csv`: one current final record per work unit.
- SQLite `attempts` table: every failed and successful attempt.
- `data/results/neutral_control_ratings_clean.csv`: 375 unique valid final ratings.
- `data/results/neutral_control_diagnostics.csv`: completion, retry, token, and cost checks.
- `data/results/neutral_control_summary.csv`: descriptive and floor-effect summaries.
- `data/results/neutral_control_contrasts.csv`: individual and aggregate paired contrasts.
- `data/results/run_metadata.json`: exact IDs, settings, hashes, commands, timestamps, and audit
  results.
- `data/results/cost_ledger.csv`: archived smoke, replacement smoke, full-run, and combined costs.
- `figures/neutral_control_rating_distribution.png`
- `figures/neutral_control_effects.png`
- plotting data CSVs for both figures.
- `reports/neutral_control_report.md`: generated manuscript-ready report.

Missing token or cost fields remain blank; they are never fabricated.

## Completed-Run Cost

Reported OpenRouter costs were `$0.002103000` for the archived first smoke attempt,
`$0.001401000` for the successful replacement smoke, and `$0.273344000` for the subsequent full
experiment including exact-ID verification. The combined total was `$0.276848000`. The final 375
response rows cost `$0.274110500`; this includes the successful replacement smoke, so it is not
added again in the combined total.

## Exploratory Contrasts

The analysis computes:

- Input language: literal English-response minus English baseline.
- Cultural adaptation, primary: adapted English-response minus literal English-response.
- Cultural adaptation, secondary: adapted same-language response minus literal same-language response.
- Response language, primary: literal same-language response minus literal English response.
- Response language, secondary: adapted same-language response minus adapted English response.

Fixed-seed bootstrap confidence intervals summarize the paired differences. With only five controls
per model-language cell, inferential interpretation is explicitly exploratory. Non-significance is
not treated as evidence of no effect.

## Later Moral-versus-Neutral Comparison

No original moral results are bundled, so no interaction is estimated. When a moral-results CSV is
available, it must contain:

```text
item_id
model_key
condition_id
input_language
scenario_version
response_language
rating
```

Run:

```bash
python -m src.compare_moral_and_neutral --moral-csv path/to/moral_results.csv
```

The script validates the schema and creates descriptive matched-condition summaries. It does not
fabricate missing moral results or automatically claim a moral-versus-neutral interaction.
