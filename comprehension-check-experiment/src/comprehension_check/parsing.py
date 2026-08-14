from __future__ import annotations

import re


ANSWER_PATTERN = re.compile(r"^\s*([A-D])\s*,\s*([A-D])\s*,\s*([A-D])\s*,\s*([A-D])\s*$", re.I)
LOCALIZED_OPTION_ALIASES = {
    "ए": "A",
    "बी": "B",
    "सी": "C",
    "डी": "D",
    "এ": "A",
    "বি": "B",
    "সি": "C",
    "ডি": "D",
    "ஏ": "A",
    "பி": "B",
    "சி": "C",
    "டி": "D",
    "エー": "A",
    "ビー": "B",
    "シー": "C",
    "ディー": "D",
}


def parse_answers(raw: str) -> list[str]:
    normalized = (
        (raw or "")
        .replace("、", ",")
        .replace("，", ",")
        .replace("،", ",")
    )
    parts = [part.strip() for part in normalized.split(",")]
    if len(parts) == 4:
        normalized = ",".join(
            LOCALIZED_OPTION_ALIASES.get(part, part) for part in parts
        )
    match = ANSWER_PATTERN.fullmatch(normalized)
    if not match:
        raise ValueError("Response must contain exactly four comma-separated letters A-D")
    return [part.upper() for part in match.groups()]


def score_answers(parsed: list[str], answer_key: str) -> dict[str, int]:
    expected = [part.strip() for part in answer_key.split(",")]
    if len(parsed) != 4 or len(expected) != 4:
        raise ValueError("Exactly four parsed and expected answers are required")
    correct = [int(actual == target) for actual, target in zip(parsed, expected)]
    return {
        "correct_count_0_4": sum(correct),
        "actor_correct": correct[0],
        "action_correct": correct[1],
        "affected_correct": correct[2],
        "consequence_correct": correct[3],
    }
