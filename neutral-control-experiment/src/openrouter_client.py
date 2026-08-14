from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import requests


OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"


@dataclass
class OpenRouterResult:
    raw_output: str | None
    http_status: int | None
    error_note: str | None
    prompt_tokens: int | None
    completion_tokens: int | None
    total_tokens: int | None
    reported_cost: float | None
    response_json: str
    temporary_error: bool


class OpenRouterClient:
    def __init__(
        self,
        api_key: str,
        timeout_seconds: float,
        site_url: str | None = None,
        app_name: str | None = None,
        session: requests.Session | None = None,
    ):
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY is required for API calls")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.site_url = site_url
        self.app_name = app_name
        self.session = session or requests.Session()

    def _headers(self) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.site_url:
            headers["HTTP-Referer"] = self.site_url
        if self.app_name:
            headers["X-Title"] = self.app_name
        return headers

    def request(
        self,
        model: str,
        system_prompt: str,
        user_message: str,
        temperature: float,
        max_tokens: int,
        reasoning_effort: str | None = None,
    ) -> OpenRouterResult:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if reasoning_effort is not None:
            payload["reasoning"] = {"effort": reasoning_effort}
        try:
            response = self.session.post(
                OPENROUTER_ENDPOINT,
                headers=self._headers(),
                json=payload,
                timeout=self.timeout_seconds,
            )
        except requests.RequestException as error:
            return OpenRouterResult(
                raw_output=None,
                http_status=None,
                error_note=f"{type(error).__name__}: {error}",
                prompt_tokens=None,
                completion_tokens=None,
                total_tokens=None,
                reported_cost=None,
                response_json=json.dumps({"request_error": str(error)}, ensure_ascii=False),
                temporary_error=True,
            )

        try:
            body: dict[str, Any] = response.json()
        except ValueError:
            body = {"raw_response_text": response.text}
        serialized = json.dumps(body, ensure_ascii=False)
        if not response.ok:
            detail = body.get("error", body)
            return OpenRouterResult(
                raw_output=None,
                http_status=response.status_code,
                error_note=f"OpenRouter HTTP {response.status_code}: {detail}",
                prompt_tokens=None,
                completion_tokens=None,
                total_tokens=None,
                reported_cost=None,
                response_json=serialized,
                temporary_error=response.status_code in {408, 409, 425, 429}
                or response.status_code >= 500,
            )

        choices = body.get("choices") or []
        raw_output = None
        if choices:
            raw_output = choices[0].get("message", {}).get("content")
        usage = body.get("usage") or {}
        cost = usage.get("cost")
        if cost is None:
            cost = body.get("cost")
        return OpenRouterResult(
            raw_output=raw_output,
            http_status=response.status_code,
            error_note=None if raw_output is not None else "API response contained no output text",
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
            total_tokens=usage.get("total_tokens"),
            reported_cost=cost,
            response_json=serialized,
            temporary_error=False,
        )
