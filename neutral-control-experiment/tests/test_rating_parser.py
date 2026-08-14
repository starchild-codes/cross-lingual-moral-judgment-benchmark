from __future__ import annotations

import pytest

from src.parse_rating import parse_rating


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("1", 1),
        ("7", 7),
        ("1.", 1),
        ("Rating: 3", 3),
        ("  4  ", 4),
        ("３", 3),
        ("٣", 3),
        ("۳", 3),
        ("३", 3),
        ("৩", 3),
        ("௩", 3),
    ],
)
def test_valid_multilingual_ratings(raw, expected):
    assert parse_rating(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [None, "", "0", "8", "3.5", "2-3", "2–3", "2 to 3", "1 or 2", "I think 3", "Rating: 9"],
)
def test_invalid_ratings(raw):
    assert parse_rating(raw) is None

