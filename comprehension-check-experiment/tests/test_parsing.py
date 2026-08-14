import pytest

from comprehension_check.parsing import parse_answers, score_answers


def test_parse_exact_answers():
    assert parse_answers("A,B,C,D") == ["A", "B", "C", "D"]


def test_parse_allows_whitespace_and_case():
    assert parse_answers(" a, b, c, d ") == ["A", "B", "C", "D"]


@pytest.mark.parametrize("raw", ["A、B、C、D", "A，B，C，D", "A،B،C،D"])
def test_parse_normalizes_locale_specific_commas(raw):
    assert parse_answers(raw) == ["A", "B", "C", "D"]


@pytest.mark.parametrize(
    "raw",
    [
        "ए, बी, सी, डी",
        "এ, বি, সি, ডি",
        "ஏ, பி, சி, டி",
        "エー, ビー, シー, ディー",
    ],
)
def test_parse_normalizes_exact_localized_option_names(raw):
    assert parse_answers(raw) == ["A", "B", "C", "D"]


@pytest.mark.parametrize(
    "raw",
    ["A,B,C", "A,B,C,D,A", "A B C D", "The answers are A,B,C,D", "A,B,C,E", ""],
)
def test_parse_rejects_invalid_output(raw):
    with pytest.raises(ValueError):
        parse_answers(raw)


def test_score_answers_by_question_type():
    result = score_answers(["A", "C", "B", "D"], "A,B,B,D")
    assert result == {
        "correct_count_0_4": 3,
        "actor_correct": 1,
        "action_correct": 0,
        "affected_correct": 1,
        "consequence_correct": 1,
    }
