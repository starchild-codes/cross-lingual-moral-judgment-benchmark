from __future__ import annotations

from .common import ROOT, load_yaml


def load_prompts() -> dict[str, dict[str, str]]:
    return load_yaml(ROOT / "config" / "prompts.yaml")["languages"]


def prompts_for(response_language: str) -> tuple[str, str, str]:
    prompts = load_prompts()
    if response_language not in prompts:
        raise KeyError(f"No prompt configuration for response language {response_language}")
    configured = prompts[response_language]
    return (
        configured["system_prompt"],
        configured["rating_instruction"],
        configured["retry_reminder"],
    )


def user_message(
    scenario_text: str,
    question_text: str,
    rating_instruction: str,
    retry_reminder: str | None = None,
) -> str:
    parts = [scenario_text.strip(), question_text.strip(), rating_instruction.strip()]
    if retry_reminder:
        parts.append(retry_reminder.strip())
    return "\n\n".join(parts)

