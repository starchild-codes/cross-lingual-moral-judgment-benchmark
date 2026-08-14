# Beyond English-Centric Alignment

Reproducibility repository for **Beyond English-Centric Alignment: Multilingual and Cultural Variation in LLM Moral Judgement**.

This project studies how moral judgments vary across input language, cultural framing, and reasoning language. It contains the benchmark scenarios, experiment software, validation tools, analysis scripts, processed research outputs, figures, and methodological audits used in the study.

## Research Design

- Seven input languages: English, Hindi, Bengali, Tamil, Spanish, Japanese, and Arabic.
- Literal translations and culturally adapted scenario versions.
- English and same-language reasoning conditions.
- Multiple commercial language-model families.
- Moral Foundations Theory categories used for scenario construction and human coding.
- Independent human scenario validation and qualitative explanation coding.
- Separate neutral-control and multilingual comprehension-check experiments.

The final qualitative labels are **human-adjudicated labels**. The 1,000 qualitative explanations were coded independently by two human coders, with 96.2% raw agreement and Cohen's kappa = 0.948. Historical field names containing `ai_mft`, `llama`, or `deepseek` do not describe the final coding process.

## Repository Structure

| Path | Contents |
| --- | --- |
| `data/` | Scenario datasets and validated experimental inputs |
| `scripts/` | Collection, analysis, validation, and figure-generation scripts |
| `results/processed/` | Processed tables and reproducibility metadata |
| `results/figures/` | Generated publication figures |
| `reports/` | Focused statistical and qualitative audits |
| `paper_materials/` | Manuscript evidence summaries and methods material |
| `neutral-control-experiment/` | Neutral-control experiment and analysis package |
| `comprehension-check-experiment/` | Multilingual comprehension-check package |
| `app/`, `components/`, `lib/` | Research operations and blinded validation interface |

Raw API result stores, live credentials, deployment metadata, browser backups, and private administration keys are intentionally excluded.

## JavaScript Setup

Requirements: Node.js 20 or later and pnpm 9.15.4.

```bash
corepack prepare pnpm@9.15.4 --activate
corepack pnpm install
corepack pnpm test
```

To run the local research interface:

```bash
corepack pnpm dev
```

Copy `.env.local.example` to `.env.local` only when model or database access is required. Never commit `.env.local`.

## Analysis

The repository includes both TypeScript and Python analysis pipelines. Key paper-level evidence is summarized in:

- `PHASE1_FINAL_EVIDENCE_REPORT_CORRECTED.md`
- `paper_materials/01_all_results.md`
- `reports/authority_subversion_expansion_report.md`
- `reports/adaptation_edit_rate_report.md`

Focused reproducibility commands are documented in the corresponding report and metadata files. Examples include:

```bash
py -3 scripts/authority_subversion_expansion.py
py -3 scripts/adaptation_edit_audit.py
```

The two standalone experiment packages contain their own READMEs, validators, dry-run commands, and test suites.

## Validation Provenance

- All non-English scenario materials used in the evaluated datasets underwent native-speaker review.
- Scenario-foundation validation used three blinded human coders.
- Qualitative explanations used two independent human coders followed by human adjudication.
- Machine-generated model outputs are the objects of analysis, not the source of the final human foundation labels.

See the Markdown reports and JSON reproducibility records for source hashes, row counts, subgroup denominators, and audit decisions.

## Security and Data Policy

This repository must not contain API keys, Supabase service-role keys, coder access tokens, private administration links, or raw active result databases. Example environment files contain placeholders only.

## Citation and License

Formal citation metadata and a software/data license will be added when the manuscript record is finalized. Until then, reuse requires permission from the study authors.
