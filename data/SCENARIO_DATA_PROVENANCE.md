# Scenario Data Provenance

## Canonical File

`scenarios_final_50.csv` is the canonical 50-scenario input file for public-release documentation and future analysis. It contains `S01` through `S50`, with the original English text and all literal-translation and cultural-adaptation text fields retained.

## Source Reconciliation

The first 25 scenarios originate in `scenarios.csv`, whose historical identifier field is named `scenarios_id` and uses numeric values `1` through `25`. The canonical file maps these without changing text to `S01` through `S25`. `scenarios.csv` also contains one non-scenario metadata row referring to `scenarios.xlsx`; it is excluded from the canonical dataset.

Scenarios `S26` through `S50` originate in `scenarios_extension.csv`, which already uses `scenario_id`. The extension supplies `moral_structure_en`; the corresponding field is blank for `S01` through `S25` because it is not present in the source file. This is a metadata distinction, not a change to scenario wording.

## Integrity

The canonical file has exactly 50 unique scenario IDs in numeric order. Scenario and question text were copied from the source records without editorial revision. The SHA-256 hash of the current canonical file is `b0e799acad0fbda5aabe5ef50a0693114f80b2f71b05fddd550ccb3d8dc9ffb2`.
