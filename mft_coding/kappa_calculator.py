import argparse
import csv
import math
import random
from pathlib import Path

FOUNDATIONS = [
    "Care/Harm",
    "Loyalty/Betrayal",
    "Authority/Subversion",
    "Fairness/Cheating",
    "Sanctity/Degradation",
]


def read_codes(path):
    with open(path, newline="", encoding="utf-8") as handle:
        return {row["response_id"]: row for row in csv.DictReader(handle)}


def cohen_kappa(pairs):
    if not pairs:
        return float("nan"), 0.0, [[0 for _ in FOUNDATIONS] for _ in FOUNDATIONS]
    index = {label: i for i, label in enumerate(FOUNDATIONS)}
    matrix = [[0 for _ in FOUNDATIONS] for _ in FOUNDATIONS]
    agree = 0
    for a, b in pairs:
        matrix[index[a]][index[b]] += 1
        agree += int(a == b)
    n = len(pairs)
    po = agree / n
    row_totals = [sum(row) for row in matrix]
    col_totals = [sum(matrix[r][c] for r in range(len(FOUNDATIONS))) for c in range(len(FOUNDATIONS))]
    pe = sum((row_totals[i] / n) * (col_totals[i] / n) for i in range(len(FOUNDATIONS)))
    kappa = float("nan") if math.isclose(1.0, pe) else (po - pe) / (1 - pe)
    return kappa, po, matrix


def bootstrap_ci(pairs, iterations=1000, seed=20260629):
    if not pairs:
        return float("nan"), float("nan")
    rng = random.Random(seed)
    values = []
    for _ in range(iterations):
        sample = [pairs[rng.randrange(len(pairs))] for _ in pairs]
        kappa, _, _ = cohen_kappa(sample)
        if not math.isnan(kappa):
            values.append(kappa)
    if not values:
        return float("nan"), float("nan")
    values.sort()
    return values[int(0.025 * (len(values) - 1))], values[int(0.975 * (len(values) - 1))]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--coder1", required=True)
    parser.add_argument("--coder2", required=True)
    args = parser.parse_args()

    coder1 = read_codes(args.coder1)
    coder2 = read_codes(args.coder2)
    missing_from_2 = sorted(set(coder1) - set(coder2))
    missing_from_1 = sorted(set(coder2) - set(coder1))
    shared = sorted(set(coder1) & set(coder2))
    pairs = []
    for response_id in shared:
        a = coder1[response_id].get("human_coded_foundation", "")
        b = coder2[response_id].get("human_coded_foundation", "")
        if a in FOUNDATIONS and b in FOUNDATIONS:
            pairs.append((a, b))

    kappa, agreement, matrix = cohen_kappa(pairs)
    ci_low, ci_high = bootstrap_ci(pairs)

    out_dir = Path("results/processed/interrater")
    out_dir.mkdir(parents=True, exist_ok=True)
    report = [
        "Cohen's kappa report",
        f"Matched coded responses: {len(pairs)}",
        f"Raw percentage agreement: {agreement * 100:.2f}%",
        f"Cohen's kappa: {kappa:.4f}" if not math.isnan(kappa) else "Cohen's kappa: undefined",
        f"95% bootstrap CI: [{ci_low:.4f}, {ci_high:.4f}]" if not math.isnan(ci_low) else "95% bootstrap CI: undefined",
        f"Warning: response_ids in coder1 but not coder2: {len(missing_from_2)}",
        f"Warning: response_ids in coder2 but not coder1: {len(missing_from_1)}",
    ]
    text = "\n".join(report) + "\n"
    print(text)
    (out_dir / "kappa_report.txt").write_text(text, encoding="utf-8")

    with open(out_dir / "confusion_matrix.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["coder1\\coder2", *FOUNDATIONS])
        for label, row in zip(FOUNDATIONS, matrix):
            writer.writerow([label, *row])


if __name__ == "__main__":
    main()
