import argparse
import csv
from pathlib import Path


def read_by_response_id(path):
    with open(path, newline="", encoding="utf-8") as handle:
        return {row["response_id"]: row for row in csv.DictReader(handle)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--codes", required=True)
    parser.add_argument("--merged", default="results/processed/full_merged.csv")
    parser.add_argument("--out", default="results/processed/full_merged_with_codes.csv")
    args = parser.parse_args()

    codes = read_by_response_id(args.codes)
    with open(args.merged, newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
        fieldnames = list(rows[0].keys()) if rows else []

    extra = ["human_coded_foundation", "is_flagged", "foundation_match"]
    for column in extra:
        if column not in fieldnames:
            fieldnames.append(column)

    for row in rows:
        code = codes.get(row.get("response_id", ""))
        human = code.get("human_coded_foundation", "") if code else ""
        flagged = code.get("is_flagged", "") if code else ""
        designed = row.get("mft_foundation", "")
        row["human_coded_foundation"] = human
        row["is_flagged"] = flagged
        row["foundation_match"] = str(human == designed) if human else ""

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {out}")


if __name__ == "__main__":
    main()
