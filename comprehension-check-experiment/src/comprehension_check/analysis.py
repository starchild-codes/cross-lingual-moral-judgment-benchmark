from __future__ import annotations

import csv
import json
import sqlite3
from collections import defaultdict
from pathlib import Path
from statistics import mean


PROJECT = Path(__file__).resolve().parents[2]
MANIFEST = PROJECT / "data" / "processed" / "run_manifest_720.csv"
DATABASE = PROJECT / "results" / "active" / "comprehension_results.sqlite"
OUTPUT = PROJECT / "results" / "processed"


def read_manifest() -> list[dict[str, str]]:
    with MANIFEST.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        return
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def build_outputs() -> dict[str, int]:
    if not DATABASE.exists():
        raise FileNotFoundError("No active result database exists")
    manifest = {row["work_unit_id"]: row for row in read_manifest()}
    connection = sqlite3.connect(DATABASE)
    rows = connection.execute(
        """
        SELECT work_unit_id, model_id, raw_response, parsed_answers, scores_json,
               prompt_tokens, completion_tokens, total_tokens, cost_usd
        FROM results
        """
    ).fetchall()
    connection.close()
    if len(rows) != 720:
        raise RuntimeError(f"Analysis requires 720 completed results, found {len(rows)}")

    work_units: list[dict[str, object]] = []
    item_rows: list[dict[str, object]] = []
    question_types = ["Actor", "Main action", "Affected party/object", "Consequence/outcome"]
    for stored in rows:
        work_unit_id = stored[0]
        source = manifest[work_unit_id]
        parsed = stored[3].split(",")
        answer_key = source["answer_key"].split(",")
        question_ids = source["question_ids"].split(",")
        scores = json.loads(stored[4])
        base = {
            "work_unit_id": work_unit_id,
            "scenario_id": source["scenario_id"],
            "foundation": source["foundation"],
            "shift_tier": source["shift_tier"],
            "model_key": source["model_key"],
            "model_id": source["model_id"],
            "input_language": source["input_language"],
            "scenario_version": source["scenario_version"],
        }
        work_units.append(
            {
                **base,
                **scores,
                "scenario_all_4_correct": int(scores["correct_count_0_4"] == 4),
                "raw_response": stored[2],
                "prompt_tokens": stored[5],
                "completion_tokens": stored[6],
                "total_tokens": stored[7],
                "cost_usd": stored[8],
            }
        )
        for index in range(4):
            item_rows.append(
                {
                    **base,
                    "question_id": question_ids[index],
                    "question_type": question_types[index],
                    "selected_option": parsed[index],
                    "correct_option": answer_key[index],
                    "item_correct": int(parsed[index] == answer_key[index]),
                    "raw_response": stored[2],
                }
            )

    summary_rows: list[dict[str, object]] = []
    grouping_sets = [
        ["model_key"],
        ["input_language"],
        ["scenario_version"],
        ["foundation"],
        ["shift_tier"],
        ["model_key", "input_language"],
        ["model_key", "scenario_version"],
        ["model_key", "shift_tier"],
    ]
    for grouping in grouping_sets:
        buckets: dict[tuple[str, ...], list[dict[str, object]]] = defaultdict(list)
        for row in work_units:
            buckets[tuple(str(row[column]) for column in grouping)].append(row)
        for key, bucket in sorted(buckets.items()):
            summary_rows.append(
                {
                    "grouping": "+".join(grouping),
                    "group_value": "|".join(key),
                    "work_units": len(bucket),
                    "item_accuracy": mean(
                        float(row["correct_count_0_4"]) / 4 for row in bucket
                    ),
                    "scenario_4_of_4_accuracy": mean(
                        float(row["scenario_all_4_correct"]) for row in bucket
                    ),
                }
            )

    OUTPUT.mkdir(parents=True, exist_ok=True)
    write_csv(OUTPUT / "work_unit_results.csv", work_units)
    write_csv(OUTPUT / "item_level_results.csv", item_rows)
    write_csv(
        OUTPUT / "missed_items.csv",
        [row for row in item_rows if row["item_correct"] == 0],
    )
    write_csv(OUTPUT / "accuracy_summaries.csv", summary_rows)
    return {
        "work_units": len(work_units),
        "item_rows": len(item_rows),
        "missed_items": sum(row["item_correct"] == 0 for row in item_rows),
        "summary_rows": len(summary_rows),
    }


if __name__ == "__main__":
    print(json.dumps(build_outputs(), indent=2))
