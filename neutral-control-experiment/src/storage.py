from __future__ import annotations

import csv
import hashlib
import os
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


RAW_COLUMNS = [
    "response_id",
    "unique_key",
    "control_id",
    "control_title",
    "model_key",
    "openrouter_model_string",
    "request_temperature",
    "request_max_tokens",
    "reasoning_effort",
    "condition_id",
    "input_language",
    "scenario_version",
    "response_language",
    "scenario_text",
    "question_text",
    "system_prompt",
    "rating_instruction",
    "raw_output",
    "parsed_rating",
    "is_valid",
    "attempt_count",
    "http_status",
    "error_note",
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "reported_cost",
    "retry_prompt_differed",
    "created_at",
    "updated_at",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def unique_key(control_id: str, model_key: str, condition_id: str) -> str:
    return f"{control_id}::{model_key}::{condition_id}"


def response_id(key: str) -> str:
    return "neutral_" + hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]


class ResultStore:
    def __init__(self, database_path: Path):
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.database_path, timeout=30)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def _initialize(self) -> None:
        with self.connect() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS responses (
                    response_id TEXT PRIMARY KEY,
                    unique_key TEXT NOT NULL UNIQUE,
                    control_id TEXT NOT NULL,
                    control_title TEXT NOT NULL,
                    model_key TEXT NOT NULL,
                    openrouter_model_string TEXT NOT NULL,
                    request_temperature REAL NOT NULL,
                    request_max_tokens INTEGER NOT NULL,
                    reasoning_effort TEXT,
                    condition_id TEXT NOT NULL,
                    input_language TEXT NOT NULL,
                    scenario_version TEXT NOT NULL,
                    response_language TEXT NOT NULL,
                    scenario_text TEXT NOT NULL,
                    question_text TEXT NOT NULL,
                    system_prompt TEXT NOT NULL,
                    rating_instruction TEXT NOT NULL,
                    raw_output TEXT,
                    parsed_rating INTEGER,
                    is_valid INTEGER NOT NULL,
                    attempt_count INTEGER NOT NULL,
                    http_status INTEGER,
                    error_note TEXT,
                    prompt_tokens INTEGER,
                    completion_tokens INTEGER,
                    total_tokens INTEGER,
                    reported_cost REAL,
                    retry_prompt_differed INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS attempts (
                    attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    unique_key TEXT NOT NULL,
                    attempt_number INTEGER NOT NULL,
                    raw_output TEXT,
                    parsed_rating INTEGER,
                    is_valid INTEGER NOT NULL,
                    http_status INTEGER,
                    error_note TEXT,
                    openrouter_model_string TEXT,
                    request_temperature REAL,
                    request_max_tokens INTEGER,
                    reasoning_effort TEXT,
                    retry_prompt_differed INTEGER NOT NULL,
                    response_json TEXT,
                    created_at TEXT NOT NULL,
                    UNIQUE(unique_key, attempt_number)
                )
                """
            )
            response_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(responses)").fetchall()
            }
            response_additions = {
                "request_temperature": "REAL",
                "request_max_tokens": "INTEGER",
                "reasoning_effort": "TEXT",
            }
            for column, sql_type in response_additions.items():
                if column not in response_columns:
                    connection.execute(
                        f"ALTER TABLE responses ADD COLUMN {column} {sql_type}"
                    )
            attempt_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(attempts)").fetchall()
            }
            attempt_additions = {
                "openrouter_model_string": "TEXT",
                "request_temperature": "REAL",
                "request_max_tokens": "INTEGER",
                "reasoning_effort": "TEXT",
            }
            for column, sql_type in attempt_additions.items():
                if column not in attempt_columns:
                    connection.execute(
                        f"ALTER TABLE attempts ADD COLUMN {column} {sql_type}"
                    )

    def get(self, key: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT * FROM responses WHERE unique_key = ?", (key,)
            ).fetchone()
        return dict(row) if row else None

    def has_valid(self, key: str) -> bool:
        row = self.get(key)
        return bool(row and row["is_valid"] == 1 and row["parsed_rating"] is not None)

    def attempt_count(self, key: str) -> int:
        row = self.get(key)
        return int(row["attempt_count"]) if row else 0

    def record_attempt(self, attempt: dict[str, Any]) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO attempts (
                    unique_key, attempt_number, raw_output, parsed_rating, is_valid,
                    http_status, error_note, openrouter_model_string,
                    request_temperature, request_max_tokens, reasoning_effort,
                    retry_prompt_differed, response_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    attempt["unique_key"],
                    attempt["attempt_number"],
                    attempt.get("raw_output"),
                    attempt.get("parsed_rating"),
                    int(bool(attempt.get("is_valid"))),
                    attempt.get("http_status"),
                    attempt.get("error_note"),
                    attempt.get("openrouter_model_string"),
                    attempt.get("request_temperature"),
                    attempt.get("request_max_tokens"),
                    attempt.get("reasoning_effort"),
                    int(bool(attempt.get("retry_prompt_differed"))),
                    attempt.get("response_json"),
                    attempt.get("created_at", utc_now()),
                ),
            )

    def save_response(self, result: dict[str, Any]) -> None:
        existing = self.get(result["unique_key"])
        if existing and existing["is_valid"] == 1 and not result.get("is_valid"):
            return
        now = utc_now()
        result = dict(result)
        result.setdefault("created_at", existing["created_at"] if existing else now)
        result["updated_at"] = now
        values = [result.get(column) for column in RAW_COLUMNS]
        placeholders = ", ".join("?" for _ in RAW_COLUMNS)
        updates = ", ".join(
            f"{column}=excluded.{column}"
            for column in RAW_COLUMNS
            if column not in ("response_id", "unique_key", "created_at")
        )
        with self.connect() as connection:
            connection.execute(
                f"""
                INSERT INTO responses ({", ".join(RAW_COLUMNS)})
                VALUES ({placeholders})
                ON CONFLICT(unique_key) DO UPDATE SET {updates}
                """,
                values,
            )

    def rows(self) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM responses ORDER BY control_id, model_key, condition_id"
            ).fetchall()
        return [dict(row) for row in rows]

    def attempts(self) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM attempts ORDER BY unique_key, attempt_number"
            ).fetchall()
        return [dict(row) for row in rows]

    def export_csv(self, output: Path) -> None:
        rows = self.rows()
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = output.with_suffix(output.suffix + ".tmp")
        with temporary.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=RAW_COLUMNS, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
            handle.flush()
            os.fsync(handle.fileno())
        for attempt in range(1, 21):
            try:
                temporary.replace(output)
                break
            except PermissionError:
                if attempt == 20:
                    raise
                time.sleep(0.25)
