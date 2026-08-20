# Data and code availability

This repository contains the code and released derived materials needed to
inspect and reproduce the reported analyses for *Beyond English-Centric
Alignment: Multilingual and Cultural Variation in LLM Moral Judgment*.

## Publicly released materials

The repository includes:

- the canonical 50-scenario benchmark and its provenance documentation;
- the human-adjudicated qualitative coding extract;
- processed rating tables, validation tables, plotting data, and figures;
- analysis, validation, and figure-generation scripts;
- statistical reports, integrity hashes, and reproducibility metadata; and
- tests for the JavaScript/TypeScript analysis code and the standalone Python
  experiment packages.

The code is released under the MIT License. The repository's data files are
research materials assembled from model outputs, human coding, translations,
and study instruments; reuse of those data remains subject to the permissions,
privacy expectations, and third-party terms applicable to their source
materials. The authors should be contacted before redistributing data outside
this repository.

## Reproduction boundary

The released processed files support reproduction of the reported descriptive
and statistical analyses without API credentials. A clean checkout can install
the JavaScript dependencies with pnpm and run the documented tests. The
standalone Python packages have separate requirements files and validation
instructions in their local READMEs and reports.

Re-running the original model-collection stage is a separate operation. It
requires the relevant provider accounts, API credentials, model availability,
and an approved runtime configuration. Model providers may change model
versions, system behavior, pricing, or availability, so a new collection run
is not expected to reproduce the released responses byte-for-byte.

Credentials, service-role keys, coder tokens, private administration links,
raw active databases, and browser backups are intentionally excluded. Example
environment files contain placeholders only.

## Versioning

For a publication, cite the immutable Git commit or archived release associated
with the manuscript rather than the moving `main` branch. If the repository is
archived through a DOI service, that DOI should be added to `CITATION.cff` and
to the manuscript's data and code availability statement.
