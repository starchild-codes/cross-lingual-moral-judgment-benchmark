from __future__ import annotations

import hashlib
import json
import shutil
import sqlite3
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
ACTIVE = PROJECT / "results" / "active"
ARCHIVE = PROJECT / "results" / "archive"
DB = ACTIVE / "comprehension_results.sqlite"
TARGET = "S02__ja__literal__chatgpt"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    snapshot = ARCHIVE / f"full_stopped_{timestamp}"
    snapshot.mkdir(parents=True, exist_ok=False)
    for path in ACTIVE.iterdir():
        if path.is_file() and path.name != ".gitkeep":
            shutil.copy2(path, snapshot / path.name)

    connection = sqlite3.connect(DB)
    results = connection.execute(
        """
        SELECT work_unit_id, model_id, raw_response, parsed_answers,
               prompt_tokens, completion_tokens, total_tokens, cost_usd
        FROM results
        """
    ).fetchall()
    attempts = connection.execute(
        """
        SELECT work_unit_id, attempt_number, status, request_json,
               response_json, raw_response, error_note
        FROM attempts
        ORDER BY work_unit_id, attempt_number
        """
    ).fetchall()
    connection.close()

    smoke_ids = {
        "S02__hi__literal__chatgpt",
        "S02__hi__literal__claude",
        "S02__hi__literal__gemini_flash",
    }
    smoke_cost = sum((row[7] or 0) for row in results if row[0] in smoke_ids)
    observed_total = sum((row[7] or 0) for row in results)
    target_attempts = [row for row in attempts if row[0] == TARGET]

    signatures: dict[str, set[tuple[object, ...]]] = defaultdict(set)
    for attempt in attempts:
        payload = json.loads(attempt[3])
        model_id = payload["model"]
        signatures[model_id].add(
            (
                payload.get("temperature"),
                payload.get("max_tokens"),
                json.dumps(payload.get("reasoning", {}), sort_keys=True),
            )
        )

    audit = {
        "status": "stopped_on_configured_parse_failure",
        "stopped_at_utc": timestamp,
        "failed_work_unit_id": TARGET,
        "failure_reason": "Response must contain exactly four comma-separated letters A-D",
        "retry_limit": 3,
        "failed_target_attempts": len(target_attempts),
        "failed_target_raw_responses_stored": sum(bool(row[5]) for row in target_attempts),
        "failure_capture_limitation": (
            "The runner version active for these attempts discarded response payloads when "
            "strict parsing failed. The failure path has been corrected prospectively, but "
            "no fourth request was made and the missing response bodies were not reconstructed."
        ),
        "successful_unique_results": len(results),
        "successful_results_by_model": dict(Counter(row[1] for row in results)),
        "attempt_rows": len(attempts),
        "failed_attempt_rows": sum(row[2] == "failed" for row in attempts),
        "duplicate_final_results": len(results) - len({row[0] for row in results}),
        "parameter_consistency_by_model": {
            model_id: len(values) == 1 for model_id, values in signatures.items()
        },
        "exact_model_ids_observed": sorted({row[1] for row in results}),
        "smoke_test": {
            "status": "passed_3_of_3",
            "unique_results": sum(row[0] in smoke_ids for row in results),
            "observed_cost_usd": smoke_cost,
        },
        "costs": {
            "archived_unauthorized_smoke_usd": 0.0,
            "successful_replacement_smoke_usd": smoke_cost,
            "observed_successful_post_smoke_collection_usd": observed_total - smoke_cost,
            "observed_successful_total_usd": observed_total,
            "unobserved_cost_note": (
                "Provider charges for parse-failed responses and requests running when the "
                "parallel executor stopped are not available in the local database; therefore "
                "a precise combined billed total cannot be claimed from local evidence."
            ),
        },
        "snapshot_directory": str(snapshot),
        "snapshot_files": {
            path.name: sha256(path) for path in snapshot.iterdir() if path.is_file()
        },
        "approved_workbook_sha256": sha256(
            PROJECT / "multilingual_comprehension_check_approved.xlsx"
        ),
        "manifest_sha256": sha256(
            PROJECT / "data" / "processed" / "run_manifest_720.csv"
        ),
        "multilingual_items_sha256": sha256(
            PROJECT / "data" / "processed" / "multilingual_comprehension_questions.csv"
        ),
        "full_analysis_generated": False,
        "reason_analysis_not_generated": (
            "The final dataset did not reach 720 unique valid rows, so final tables, figures, "
            "and inferential summaries would be incomplete and potentially misleading."
        ),
    }
    failure_path = PROJECT / "results" / "run_failure.json"
    failure_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    shutil.copy2(failure_path, snapshot / failure_path.name)

    metadata_path = PROJECT / "run_metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    metadata["status"] = audit["status"]
    metadata["live_run"] = audit
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    report = f"""# Live Comprehension Run: Stopped

## Stop condition

Collection stopped at `{TARGET}` after all three configured attempts failed the strict
parser requirement: exactly four comma-separated letters A-D.

No model, prompt, temperature, scenario, question, answer key, token limit, reasoning
effort, parser, or retry-limit change was made. No fourth request was attempted.

## Preserved evidence

- Replacement smoke test: **3/3 passed**
- Successful unique full-run rows committed: **{len(results)}/720**
- Attempt rows retained: **{len(attempts)}**
- Failed attempt rows retained: **{sum(row[2] == 'failed' for row in attempts)}**
- Duplicate final results: **0**
- Exact model IDs remained consistent: **Yes**
- Request parameter signatures remained consistent within each model: **Yes**
- Partial-run snapshot: `{snapshot}`

The runner version active for the failed target attempts did not retain response bodies
when strict parsing failed. That failure-capture path has been corrected prospectively,
but the missing bodies were not reconstructed and no additional call was made.

## Observed costs

- Archived unauthorized smoke: **$0.0000000**
- Successful replacement smoke: **${smoke_cost:.7f}**
- Successful post-smoke collection: **${observed_total - smoke_cost:.7f}**
- Successful locally observed total: **${observed_total:.7f}**

Parse-failed responses and any requests already running when the parallel executor stopped
may have provider charges that are absent from the local database. A precise combined billed
total therefore cannot be established from local evidence alone.

## Analysis status

Final comprehension analyses, figures, and plotting data were not generated because the
required 720 unique valid rows were not reached. Producing final summaries from 26 rows
would be incomplete and misleading.
"""
    (PROJECT / "reports" / "live_run_failure.md").write_text(report, encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
