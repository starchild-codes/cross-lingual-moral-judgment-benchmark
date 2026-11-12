# Reviewer Reproducibility Guide

This is a file map and evidence-boundary note, not a change to the data or results.

## Experimental design and archived evidence

- [Final 50 moral scenarios](data/scenarios_final_50.csv) and [design](paper_materials/FINAL_STUDY_SPECIFICATION.md)
- [Processed model outputs](results/processed/full_merged.csv): 5,000 moral ratings and 1,000 explanation rows
- [Released explanation label extract](data/processed/qualitative_human_adjudicated_final.csv): 1,000 rows; check the [qualitative provenance note](data/processed/QUALITATIVE_DATA_PROVENANCE.md) before attributing original label sources
- [Independent three-human scenario-foundation validation](results/processed/scenario_validation_trial2/): original per-coder annotations for 50 scenario texts

## Reproduction

- [Statistical policy reconciliation](reports/statistical_policy_reconciliation.md) distinguishes manuscript-primary paired-t results and separate Wilcoxon/bootstrap robustness analyses.
- [Analysis scripts](scripts/), [processed statistical outputs](results/processed/), and the [pnpm dependency lockfile](pnpm-lock.yaml) are available. The root package manager is pnpm 9.15.4; `corepack pnpm install` and `corepack pnpm test` are documented commands.
- The neutral-control and comprehension-check packages have their own Python requirements and test procedures. Later report-recorded Python package versions should not be mistaken for exact software versions of the original model-collection run.
- Repeating API collection requires credentials and is not guaranteed to yield byte-identical model outputs.

## Human annotation tasks and public-evidence limits

Three independent humans validated **50 scenario texts**; those labels are in the repository. Separately, the study team reports two independent human coders for **1,000 model explanations** with raw agreement 96.2% and Cohen's kappa = 0.948. The original independent two-human explanation-label sheets and adjudication log are not in this public snapshot, so human agreement and alignment of human final labels to the released output extract cannot be independently checked here. An earlier automated Llama/DeepSeek coding workflow is also archived. These separate data lineages must not be conflated; see the qualitative provenance note.

## Anonymous review

When creating an anonymous mirror, configure author-name, username, institution, email, and local-file-path redaction. Inspect the rendered README, citation metadata, and a sample of code and figures in a private browser. The mirror can redact text but not identifying information embedded in binary images or PDF documents. Share only the anonymous mirror link with reviewers.
