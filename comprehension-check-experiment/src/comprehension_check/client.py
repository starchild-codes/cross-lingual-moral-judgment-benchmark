from __future__ import annotations

from typing import Any

import requests


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"


def build_payload(row: dict[str, str]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": row["model_id"],
        "temperature": float(row["temperature"]),
        "max_tokens": int(row["max_tokens"]),
        "messages": [{"role": "user", "content": row["full_prompt"]}],
    }
    if row.get("reasoning_effort"):
        payload["reasoning"] = {"effort": row["reasoning_effort"]}
    return payload


def send_request(api_key: str, payload: dict[str, Any], timeout: int = 120) -> dict[str, Any]:
    response = requests.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()


def extract_raw_response(payload: dict[str, Any]) -> str:
    return str(payload["choices"][0]["message"]["content"]).strip()


def verify_model_ids(api_key: str, required_ids: set[str], timeout: int = 60) -> dict[str, Any]:
    response = requests.get(
        OPENROUTER_MODELS_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()
    available = {item["id"] for item in payload.get("data", [])}
    missing = required_ids - available
    if missing:
        raise RuntimeError(f"Exact model IDs did not resolve: {sorted(missing)}")
    return {
        "verified": True,
        "exact_model_ids": sorted(required_ids),
        "verified_at_source": OPENROUTER_MODELS_URL,
    }
