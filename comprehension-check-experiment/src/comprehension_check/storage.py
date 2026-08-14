from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any


SCHEMA = """
CREATE TABLE IF NOT EXISTS attempts (
    attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_unit_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    request_json TEXT NOT NULL,
    response_json TEXT,
    raw_response TEXT,
    status TEXT NOT NULL,
    error_note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(work_unit_id, attempt_number)
);
CREATE TABLE IF NOT EXISTS results (
    work_unit_id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    raw_response TEXT NOT NULL,
    parsed_answers TEXT NOT NULL,
    scores_json TEXT NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    cost_usd REAL,
    completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


class ResultStore:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(path)
        self.connection.executescript(SCHEMA)

    def completed_ids(self) -> set[str]:
        rows = self.connection.execute("SELECT work_unit_id FROM results").fetchall()
        return {row[0] for row in rows}

    def record_attempt(
        self,
        work_unit_id: str,
        attempt_number: int,
        request_payload: dict[str, Any],
        status: str,
        response_payload: dict[str, Any] | None = None,
        raw_response: str = "",
        error_note: str = "",
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO attempts
            (work_unit_id, attempt_number, request_json, response_json, raw_response, status, error_note)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                work_unit_id,
                attempt_number,
                json.dumps(request_payload, ensure_ascii=False, sort_keys=True),
                json.dumps(response_payload, ensure_ascii=False, sort_keys=True)
                if response_payload is not None
                else None,
                raw_response,
                status,
                error_note,
            ),
        )
        self.connection.commit()

    def record_result(
        self,
        work_unit_id: str,
        model_id: str,
        raw_response: str,
        parsed_answers: list[str],
        scores: dict[str, int],
        usage: dict[str, Any],
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO results
            (work_unit_id, model_id, raw_response, parsed_answers, scores_json,
             prompt_tokens, completion_tokens, total_tokens, cost_usd)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                work_unit_id,
                model_id,
                raw_response,
                ",".join(parsed_answers),
                json.dumps(scores, sort_keys=True),
                usage.get("prompt_tokens"),
                usage.get("completion_tokens"),
                usage.get("total_tokens"),
                usage.get("cost"),
            ),
        )
        self.connection.commit()

    def close(self) -> None:
        self.connection.close()
