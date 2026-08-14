"""
Post-human-coding analysis placeholder.

Run this only after human coding is complete and
results/processed/full_merged_with_codes.csv exists.
"""

import csv
from collections import Counter, defaultdict
from pathlib import Path

FOUNDATIONS = [
    "Care/Harm",
    "Loyalty/Betrayal",
    "Authority/Subversion",
    "Fairness/Cheating",
    "Sanctity/Degradation",
]


def run_coded_analysis(
    input_path="results/processed/full_merged_with_codes.csv",
    output_dir="results/processed/analysis",
):
    """
    Loads full_merged_with_codes.csv and computes:
    - foundation match rate by model, language, condition type, and designed foundation
    - designed -> invoked foundation transition matrix per model

    Also leaves the data needed for Figure 5: a 5x5 transition heatmap,
    one panel per model.
    """
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    with open(input_path, newline="", encoding="utf-8") as handle:
        rows = [row for row in csv.DictReader(handle) if row.get("taskType") == "qualitative"]

    grouped = defaultdict(lambda: [0, 0])
    transitions = defaultdict(Counter)
    for row in rows:
        designed = row.get("mft_foundation", "")
        invoked = row.get("human_coded_foundation", "")
        if designed not in FOUNDATIONS or invoked not in FOUNDATIONS:
            continue
        condition_type = _condition_type(row)
        for key in [
            ("model", row.get("modelKey", "")),
            ("language", row.get("inputLang", "")),
            ("condition_type", condition_type),
            ("mft_foundation", designed),
        ]:
            grouped[key][0] += int(designed == invoked)
            grouped[key][1] += 1
        transitions[row.get("modelKey", "")][(designed, invoked)] += 1

    with open(out / "foundation_match.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["group_type", "group_value", "matches", "total", "match_rate"])
        for (group_type, group_value), (matches, total) in sorted(grouped.items()):
            writer.writerow([group_type, group_value, matches, total, matches / total if total else ""])

    with open(out / "foundation_transitions.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["model_key", "designed_foundation", "human_coded_foundation", "count"])
        for model, counts in sorted(transitions.items()):
            for designed in FOUNDATIONS:
                for invoked in FOUNDATIONS:
                    writer.writerow([model, designed, invoked, counts[(designed, invoked)]])

    # Figure 5 generation should consume foundation_transitions.csv after coding is complete.


def _condition_type(row):
    if row.get("conditionId") == "en_en":
        return "en_en"
    reason = "reason_en" if row.get("reasoningLang") == "en" else "reason_l2"
    return f"{row.get('scenarioVersion')}_{reason}"


if __name__ == "__main__":
    run_coded_analysis()
