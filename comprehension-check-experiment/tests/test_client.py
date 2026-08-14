from comprehension_check.client import build_payload, extract_raw_response


def base_row():
    return {
        "model_id": "openai/gpt-4o-2024-11-20",
        "temperature": "0",
        "max_tokens": "24",
        "reasoning_effort": "",
        "full_prompt": "Prompt",
    }


def test_payload_uses_exact_model_and_parameters():
    payload = build_payload(base_row())
    assert payload["model"] == "openai/gpt-4o-2024-11-20"
    assert payload["temperature"] == 0
    assert payload["max_tokens"] == 24
    assert "reasoning" not in payload


def test_gemini_payload_uses_minimal_reasoning():
    row = base_row()
    row["model_id"] = "google/gemini-3.5-flash"
    row["reasoning_effort"] = "minimal"
    assert build_payload(row)["reasoning"] == {"effort": "minimal"}


def test_extract_raw_response():
    payload = {"choices": [{"message": {"content": " A,B,C,D "}}]}
    assert extract_raw_response(payload) == "A,B,C,D"
