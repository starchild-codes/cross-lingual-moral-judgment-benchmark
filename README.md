# Beyond English-Centric Alignment

Reproducibility repository for **Beyond English-Centric Alignment: Multilingual and Cultural Variation in LLM Moral Judgment**.

This repository studies moral-judgment outputs across input language, cultural framing, and instructed response language. It preserves the benchmark, collection and analysis code, processed outputs, validation materials, figures, and audit documentation used in the final study.

## Study Overview

- 50 English moral scenarios across Care/Harm, Loyalty/Betrayal, Authority/Subversion, Fairness/Cheating, and Sanctity/Degradation.
- Seven input languages: English, Hindi, Bengali, Tamil, Spanish, Japanese, and Arabic.
- Literal translations and cultural adaptations for the six non-English languages.
- 25 conditions per scenario: English baseline plus literal/adapted versions crossed with English/same-language instructed response language.
- 5,000 model ratings and 1,000 qualitative explanations.
- Primary evaluated models: GPT-4o, Claude Sonnet 4.6, and Gemini 3.5 Flash. Gemini 3.1 Pro Preview is a fixed high-capability reference comparator, not moral ground truth.

The authoritative design is [FINAL_STUDY_SPECIFICATION.md](paper_materials/FINAL_STUDY_SPECIFICATION.md).

## Canonical Inputs and Outputs

| Resource | Canonical path | Notes |
| --- | --- | --- |
| Final scenario dataset | `data/scenarios_final_50.csv` | Exactly 50 scenarios, `S01`-`S50`; see `data/SCENARIO_DATA_PROVENANCE.md`. |
| Human-adjudicated qualitative labels | `data/processed/qualitative_human_adjudicated_final.csv` | Exactly 1,000 explanations; see `data/processed/QUALITATIVE_DATA_PROVENANCE.md`. |
| Rating results | `results/processed/full_merged.csv` | 5,000 rating observations. |
| Scenario validation | `results/processed/scenario_validation_trial2/` | Three blinded external human coders assessed the 50 English scenarios. |
| Statistical policy | `reports/statistical_policy_reconciliation.md` | The manuscript reports paired-t inference as the primary analysis, with exact-Wilcoxon and cluster-bootstrap analyses retained as robustness checks. |

The 1,000 explanations were coded independently by two human coders, with 96.2% raw agreement and Cohen's kappa = 0.948, then human-adjudicated. Historical filenames and fields containing `ai_mft`, `llama`, or `deepseek` do not describe the final coding process. They are retained only for traceability.

## Repository Layout

| Path | Contents |
| --- | --- |
| `data/` | Canonical scenario inputs and provenance documentation |
| `data/processed/` | Canonical human-adjudicated qualitative extract and provenance |
| `scripts/` | Collection, analysis, validation, and figure-generation code |
| `results/processed/` | Processed tables and reproducibility metadata |
| `results/figures/` | Generated figures and plotting data |
| `reports/` | Focused statistical, qualitative, and reconciliation reports |
| `paper_materials/` | Final study specification and manuscript-supporting materials |
| `neutral-control-experiment/` | Neutral-control package |
| `comprehension-check-experiment/` | Multilingual comprehension-check package |
| `archive/` | Superseded specifications and historical material, not canonical evidence |

Raw active result stores, credentials, coder access tokens, private administration links, and browser backups are intentionally excluded.

## Reproduce

Requirements: Node.js 20+, pnpm 9.15.4, and Python 3. The static analyses can be run without API credentials; do not invoke collection commands without explicitly configuring an approved environment.

```bash
corepack prepare pnpm@9.15.4 --activate
corepack pnpm install
corepack pnpm test
```

Focused reproducibility commands are documented with their reports. Examples:

```bash
py -3 scripts/authority_subversion_expansion.py
py -3 scripts/adaptation_edit_audit.py
```

The standalone experiment packages contain their own validators, dry-run commands, and test suites.

## Validation and Interpretation

- All non-English scenario materials used in the evaluated datasets underwent native-speaker review.
- Scenario-foundation validation used three blinded human coders; Authority/Subversion retained 5 of 10 intended scenarios under the human-majority criterion.
- Qualitative foundation labels are human-adjudicated labels, not model-generated labels.
- Outputs should be described as invoking, emphasizing, framing, or being coded as a foundation. They do not identify hidden model cognition.
- Cultural adaptation produced the most consistent significance-based corrected pattern, whereas other consistency criteria showed a more mixed picture.

## Security and Data Policy

Never commit API keys, Supabase service-role keys, coder tokens, private administration URLs, raw active databases, or `.env.local`. Example environment files must contain placeholders only.

Previously exposed scenario-validation credentials were removed from the current tracked tree. Any credential that was ever committed must be rotated/revoked by the repository owner.

## Citation and License

Formal citation metadata and a software/data license will be added when the manuscript record is finalized. Until then, reuse requires permission from the study authors.
