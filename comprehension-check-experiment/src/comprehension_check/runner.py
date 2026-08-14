from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .client import build_payload, extract_raw_response, send_request, verify_model_ids
from .parsing import parse_answers, score_answers
from .storage import ResultStore


PROJECT = Path(__file__).resolve().parents[2]
MANIFEST = PROJECT / "data" / "processed" / "run_manifest_720.csv"
ITEMS = PROJECT / "data" / "processed" / "multilingual_comprehension_questions.csv"
ACTIVE_DB = PROJECT / "results" / "active" / "comprehension_results.sqlite"


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def review_gate(items: list[dict[str, str]]) -> tuple[bool, list[str]]:
    unresolved: list[str] = []
    for row in items:
        if row.get("native_review_status") != "Approved":
            unresolved.append(f"{row['question_id']}:{row['language_code']}:{row['scenario_version']}")
            continue
        if not row.get("semantic_fidelity_1_5") or not row.get("naturalness_1_5"):
            unresolved.append(f"{row['question_id']}:{row['language_code']}:{row['scenario_version']}")
            continue
        if row.get("single_correct_answer") != "Yes":
            unresolved.append(f"{row['question_id']}:{row['language_code']}:{row['scenario_version']}")
    return not unresolved, unresolved


def archive_active_store(path: Path) -> Path | None:
    active_dir = path.parent
    artifacts = [
        artifact
        for artifact in active_dir.iterdir()
        if artifact.is_file() and artifact.name != ".gitkeep"
    ]
    if not artifacts:
        return None
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive_dir = PROJECT / "results" / "archive" / f"run_{timestamp}"
    archive_dir.mkdir(parents=True, exist_ok=False)
    for artifact in artifacts:
        shutil.move(str(artifact), archive_dir / artifact.name)
    return archive_dir


def select_smoke_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    first_scenario = min(row["scenario_id"] for row in rows)
    candidates = [
        row
        for row in rows
        if row["scenario_id"] == first_scenario
        and row["input_language"] == "hi"
        and row["scenario_version"] == "literal"
    ]
    candidates.sort(key=lambda row: row["model_key"])
    if len(candidates) != 3:
        raise RuntimeError("Smoke-test selection must contain exactly three model work units")
    return candidates


def validate_parameter_consistency(rows: list[dict[str, str]]) -> None:
    by_model: dict[str, set[tuple[str, str, str, str]]] = {}
    for row in rows:
        signature = (
            row["model_id"],
            row["temperature"],
            row["max_tokens"],
            row.get("reasoning_effort", ""),
        )
        by_model.setdefault(row["model_key"], set()).add(signature)
    inconsistent = {model: values for model, values in by_model.items() if len(values) != 1}
    if inconsistent:
        raise RuntimeError(f"Inconsistent request parameters within model: {inconsistent}")


def execute_rows(
    rows: list[dict[str, str]],
    api_key: str,
    store: ResultStore,
    request_fn: Callable[[str, dict[str, Any]], dict[str, Any]] = send_request,
    retry_limit: int = 3,
) -> None:
    completed = store.completed_ids()
    for row in rows:
        if row["work_unit_id"] in completed:
            continue
        last_error = ""
        for attempt in range(1, retry_limit + 1):
            payload = build_payload(row)
            response: dict[str, Any] | None = None
            raw = ""
            try:
                response = request_fn(api_key, payload)
                raw = extract_raw_response(response)
                parsed = parse_answers(raw)
                scores = score_answers(parsed, row["answer_key"])
                usage = response.get("usage") or {}
                store.record_attempt(
                    row["work_unit_id"], attempt, payload, "succeeded", response, raw
                )
                store.record_result(
                    row["work_unit_id"],
                    row["model_id"],
                    raw,
                    parsed,
                    scores,
                    usage,
                )
                break
            except Exception as exc:
                last_error = str(exc)
                store.record_attempt(
                    row["work_unit_id"],
                    attempt,
                    payload,
                    "failed",
                    response_payload=response,
                    raw_response=raw,
                    error_note=last_error,
                )
        else:
            raise RuntimeError(
                f"{row['work_unit_id']} failed after {retry_limit} attempts: {last_error}"
            )


def execute_rows_parallel(
    rows: list[dict[str, str]],
    api_key: str,
    store: ResultStore,
    request_fn: Callable[[str, dict[str, Any]], dict[str, Any]] = send_request,
    retry_limit: int = 3,
    max_workers: int = 12,
) -> None:
    pending = [row for row in rows if row["work_unit_id"] not in store.completed_ids()]
    next_attempt = {
        row["work_unit_id"]: store.connection.execute(
            "SELECT COALESCE(MAX(attempt_number), 0) + 1 FROM attempts WHERE work_unit_id = ?",
            (row["work_unit_id"],),
        ).fetchone()[0]
        for row in pending
    }

    def collect(row: dict[str, str]) -> dict[str, Any]:
        attempts: list[dict[str, Any]] = []
        last_error = ""
        first_attempt = next_attempt[row["work_unit_id"]]
        for attempt in range(first_attempt, first_attempt + retry_limit):
            payload = build_payload(row)
            response: dict[str, Any] | None = None
            raw = ""
            try:
                response = request_fn(api_key, payload)
                raw = extract_raw_response(response)
                parsed = parse_answers(raw)
                scores = score_answers(parsed, row["answer_key"])
                attempts.append(
                    {
                        "attempt": attempt,
                        "payload": payload,
                        "status": "succeeded",
                        "response": response,
                        "raw": raw,
                        "error": "",
                    }
                )
                return {
                    "ok": True,
                    "row": row,
                    "attempts": attempts,
                    "response": response,
                    "raw": raw,
                    "parsed": parsed,
                    "scores": scores,
                }
            except Exception as exc:
                last_error = str(exc)
                attempts.append(
                    {
                        "attempt": attempt,
                        "payload": payload,
                        "status": "failed",
                        "response": response,
                        "raw": raw,
                        "error": last_error,
                    }
                )
        return {
            "ok": False,
            "row": row,
            "attempts": attempts,
            "error": last_error,
        }

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(collect, row) for row in pending]
        for future in as_completed(futures):
            result = future.result()
            row = result["row"]
            for attempt in result["attempts"]:
                store.record_attempt(
                    row["work_unit_id"],
                    attempt["attempt"],
                    attempt["payload"],
                    attempt["status"],
                    attempt["response"],
                    attempt["raw"],
                    attempt["error"],
                )
            if not result["ok"]:
                for outstanding in futures:
                    outstanding.cancel()
                raise RuntimeError(
                    f"{row['work_unit_id']} failed after {retry_limit} attempts: "
                    f"{result['error']}"
                )
            response = result["response"]
            store.record_result(
                row["work_unit_id"],
                row["model_id"],
                result["raw"],
                result["parsed"],
                result["scores"],
                response.get("usage") or {},
            )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--full", action="store_true")
    parser.add_argument("--replace-active", action="store_true")
    args = parser.parse_args(argv)
    if sum([args.dry_run, args.smoke, args.full]) != 1:
        parser.error("Choose exactly one of --dry-run, --smoke, or --full")

    rows = load_csv(MANIFEST)
    if len(rows) != 720 or len({row["work_unit_id"] for row in rows}) != 720:
        raise RuntimeError("Manifest must contain exactly 720 unique work units")
    validate_parameter_consistency(rows)
    items = load_csv(ITEMS)
    gate_passed, unresolved = review_gate(items)
    summary = {
        "manifest_rows": len(rows),
        "unique_work_units": len({row["work_unit_id"] for row in rows}),
        "review_gate_passed": gate_passed,
        "unresolved_review_rows": len(unresolved),
        "network_requests_made": 0,
    }
    if args.dry_run:
        print(json.dumps(summary, indent=2))
        return 0
    if not gate_passed:
        raise RuntimeError(
            f"Human-review gate is closed: {len(unresolved)} multilingual rows remain unresolved"
        )
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is required for live execution")
    if args.replace_active:
        archive_active_store(ACTIVE_DB)
    verification = verify_model_ids(api_key, {row["model_id"] for row in rows})
    verification_path = PROJECT / "results" / "active" / "model_verification.json"
    verification_path.parent.mkdir(parents=True, exist_ok=True)
    verification_path.write_text(json.dumps(verification, indent=2), encoding="utf-8")
    chosen = select_smoke_rows(rows) if args.smoke else rows
    store = ResultStore(ACTIVE_DB)
    try:
        if args.full:
            execute_rows_parallel(chosen, api_key, store)
        else:
            execute_rows(chosen, api_key, store)
    finally:
        store.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
