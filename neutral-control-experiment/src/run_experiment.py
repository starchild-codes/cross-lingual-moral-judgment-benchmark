from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from .build_conditions import build_conditions
from .common import (
    CONDITIONS_CSV,
    DATABASE_PATH,
    MODEL_KEYS,
    RESULTS_DIR,
    ROOT,
    configure_utf8_console,
    ensure_directories,
    load_models_config,
)
from .openrouter_client import OpenRouterClient
from .parse_rating import parse_rating
from .prompts import load_prompts, user_message
from .storage import ResultStore, response_id, unique_key, utc_now
from .validate_input import InputValidationError


RAW_CSV = RESULTS_DIR / "neutral_control_ratings_raw.csv"
MODEL_VERIFICATION = RESULTS_DIR / "model_verification.json"


def work_units(conditions, model_keys: list[str]) -> list[tuple[dict[str, Any], str]]:
    return [
        (condition, model_key)
        for condition in conditions.to_dict("records")
        for model_key in model_keys
    ]


def make_client(request_config: dict[str, Any]) -> OpenRouterClient:
    load_dotenv(ROOT / ".env")
    return OpenRouterClient(
        api_key=os.getenv("OPENROUTER_API_KEY", ""),
        timeout_seconds=float(request_config["timeout_seconds"]),
        site_url=os.getenv("OPENROUTER_SITE_URL") or None,
        app_name=os.getenv("OPENROUTER_APP_NAME") or None,
    )


def verify_models(
    client: OpenRouterClient,
    model_config: dict[str, Any],
    model_keys: list[str],
    request_config: dict[str, Any],
) -> None:
    results = []
    if MODEL_VERIFICATION.exists():
        try:
            existing = json.loads(MODEL_VERIFICATION.read_text(encoding="utf-8"))
            if isinstance(existing, list):
                results.extend(existing)
        except (json.JSONDecodeError, OSError):
            pass
    verification_run = utc_now()
    maximum_attempts = int(request_config["maximum_attempts"])
    for model_key in model_keys:
        model_id = model_config[model_key]["model"]
        verified = False
        for attempt_number in range(1, maximum_attempts + 1):
            result = client.request(
                model=model_id,
                system_prompt="This is a model-availability test. Follow the output format exactly.",
                user_message="Return only the digit 1.",
                temperature=float(request_config["temperature"]),
                max_tokens=int(request_config["max_tokens"]),
                reasoning_effort=model_config[model_key].get("reasoning_effort"),
            )
            results.append(
                {
                    "verification_run": verification_run,
                    "attempt_number": attempt_number,
                    "model_key": model_key,
                    "model": model_id,
                    "request_temperature": float(request_config["temperature"]),
                    "request_max_tokens": int(request_config["max_tokens"]),
                    "reasoning_effort": model_config[model_key].get(
                        "reasoning_effort"
                    ),
                    "http_status": result.http_status,
                    "raw_output": result.raw_output,
                    "error_note": result.error_note,
                    "response_json": json.loads(result.response_json),
                    "tested_at": utc_now(),
                }
            )
            MODEL_VERIFICATION.write_text(
                json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            if result.http_status == 200 and parse_rating(result.raw_output) == 1:
                verified = True
                break
            if attempt_number < maximum_attempts:
                delay = float(request_config["backoff_seconds"]) * 2 ** (
                    attempt_number - 1
                )
                time.sleep(delay)
        if not verified:
            raise RuntimeError(
                f"Model verification failed after {maximum_attempts} attempts for "
                f"{model_key} ({model_id}). "
                f"Saved the API response to {MODEL_VERIFICATION}; full run stopped."
            )
        time.sleep(float(request_config["delay_seconds"]))


def collect(
    conditions,
    model_keys: list[str],
    client: OpenRouterClient,
    config: dict[str, Any],
    smoke_test: bool = False,
) -> dict[str, int]:
    request_config = config["request"]
    models = config["models"]
    prompts = load_prompts()
    store = ResultStore(DATABASE_PATH)
    units = work_units(conditions, model_keys)
    if smoke_test:
        first = conditions.iloc[[0]]
        units = work_units(first, MODEL_KEYS)

    summary = {"selected": len(units), "skipped_valid": 0, "completed_valid": 0, "failed": 0}
    for position, (condition, model_key) in enumerate(units, start=1):
        key = unique_key(condition["control_id"], model_key, condition["condition_id"])
        if store.has_valid(key):
            summary["skipped_valid"] += 1
            continue
        starting_attempts = store.attempt_count(key)
        maximum_attempts = int(request_config["maximum_attempts"])
        if starting_attempts >= maximum_attempts:
            summary["failed"] += 1
            continue

        model_id = models[model_key]["model"]
        reminder = prompts[condition["response_language"]]["retry_reminder"]
        final_valid = False
        for attempt_number in range(starting_attempts + 1, maximum_attempts + 1):
            retry_differed = attempt_number > 1
            message = user_message(
                condition["scenario_text"],
                condition["question_text"],
                condition["rating_instruction"],
                reminder if retry_differed else None,
            )
            result = client.request(
                model=model_id,
                system_prompt=condition["system_prompt"],
                user_message=message,
                temperature=float(request_config["temperature"]),
                max_tokens=int(request_config["max_tokens"]),
                reasoning_effort=models[model_key].get("reasoning_effort"),
            )
            parsed = parse_rating(result.raw_output)
            valid = parsed is not None
            error_note = result.error_note
            if result.raw_output is not None and not valid:
                error_note = "Invalid rating output; expected one unambiguous integer from 1 to 7"
            attempt = {
                "unique_key": key,
                "attempt_number": attempt_number,
                "raw_output": result.raw_output,
                "parsed_rating": parsed,
                "is_valid": valid,
                "http_status": result.http_status,
                "error_note": error_note,
                "openrouter_model_string": model_id,
                "request_temperature": float(request_config["temperature"]),
                "request_max_tokens": int(request_config["max_tokens"]),
                "reasoning_effort": models[model_key].get("reasoning_effort"),
                "retry_prompt_differed": retry_differed,
                "response_json": result.response_json,
                "created_at": utc_now(),
            }
            store.record_attempt(attempt)
            record = {
                "response_id": response_id(key),
                "unique_key": key,
                **condition,
                "model_key": model_key,
                "openrouter_model_string": model_id,
                "request_temperature": float(request_config["temperature"]),
                "request_max_tokens": int(request_config["max_tokens"]),
                "reasoning_effort": models[model_key].get("reasoning_effort"),
                "raw_output": result.raw_output,
                "parsed_rating": parsed,
                "is_valid": int(valid),
                "attempt_count": attempt_number,
                "http_status": result.http_status,
                "error_note": error_note,
                "prompt_tokens": result.prompt_tokens,
                "completion_tokens": result.completion_tokens,
                "total_tokens": result.total_tokens,
                "reported_cost": result.reported_cost,
                "retry_prompt_differed": int(retry_differed),
            }
            store.save_response(record)
            if valid:
                final_valid = True
                summary["completed_valid"] += 1
                break
            if not result.temporary_error and result.http_status not in (None, 200):
                break
            if attempt_number < maximum_attempts:
                delay = float(request_config["backoff_seconds"]) * 2 ** (attempt_number - 1)
                time.sleep(delay)
        if not final_valid:
            summary["failed"] += 1
        if position % 10 == 0:
            store.export_csv(RAW_CSV)
        print(f"[{position}/{len(units)}] {key}: {'valid' if final_valid else 'unresolved'}")
        time.sleep(float(request_config["delay_seconds"]))
    store.export_csv(RAW_CSV)
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the neutral-control experiment.")
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--dry-run", action="store_true", help="Validate and count calls only.")
    modes.add_argument("--smoke-test", action="store_true", help="Run 1 condition across 3 models.")
    modes.add_argument("--full", action="store_true", help="Run all selected work units.")
    modes.add_argument("--resume", action="store_true", help="Resume the full run safely.")
    parser.add_argument("--model", choices=MODEL_KEYS, help="Restrict full/resume to one model.")
    return parser.parse_args()


def main() -> int:
    configure_utf8_console()
    args = parse_args()
    ensure_directories()
    config = load_models_config()
    model_keys = [args.model] if args.model else MODEL_KEYS
    try:
        conditions = build_conditions(output=CONDITIONS_CSV)
    except (InputValidationError, RuntimeError) as error:
        print(error, file=sys.stderr)
        return 1

    expected = len(conditions) * len(model_keys)
    if args.dry_run:
        print(f"Workbook valid. Conditions: {len(conditions)}.")
        print(f"Selected models: {', '.join(model_keys)}.")
        print(f"Expected API calls: {expected}. No API requests were made.")
        return 0

    if args.smoke_test and args.model:
        print("--model cannot be combined with --smoke-test; smoke test always checks all 3 models.", file=sys.stderr)
        return 2

    try:
        client = make_client(config["request"])
        if args.full or args.resume:
            verify_models(client, config["models"], model_keys, config["request"])
        summary = collect(
            conditions,
            model_keys,
            client,
            config,
            smoke_test=args.smoke_test,
        )
    except (ValueError, RuntimeError) as error:
        print(error, file=sys.stderr)
        return 1
    print(json.dumps(summary, indent=2))
    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
