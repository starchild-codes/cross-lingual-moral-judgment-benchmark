from __future__ import annotations

import re
import unicodedata


LABEL_PATTERN = re.compile(
    r"(?i)^(?:rating|score|answer)\s*[:=\-]?\s*([1-7])\.?$"
)


def normalize_numerals(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    output: list[str] = []
    for character in normalized:
        if character.isnumeric():
            try:
                number = unicodedata.numeric(character)
            except (TypeError, ValueError):
                output.append(character)
                continue
            if number.is_integer() and 0 <= number <= 9:
                output.append(str(int(number)))
                continue
        output.append(character)
    return "".join(output)


def parse_rating(raw_output: str | None) -> int | None:
    if raw_output is None:
        return None
    text = normalize_numerals(str(raw_output)).strip()
    if not text:
        return None
    if re.search(r"\d\s*(?:[.\u066b]\s*\d|[-–—]\s*\d|\bto\b\s*\d)", text, re.I):
        return None
    if re.fullmatch(r"[1-7]\.?", text):
        return int(text[0])
    match = LABEL_PATTERN.fullmatch(text)
    if match:
        return int(match.group(1))
    return None

