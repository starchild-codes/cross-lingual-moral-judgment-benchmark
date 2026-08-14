from comprehension_check.storage import ResultStore


def test_result_store_is_resumable(tmp_path):
    store = ResultStore(tmp_path / "results.sqlite")
    store.record_attempt("unit", 1, {"model": "x"}, "succeeded", {}, "A,B,C,D")
    store.record_result(
        "unit",
        "model",
        "A,B,C,D",
        ["A", "B", "C", "D"],
        {"correct_count_0_4": 4},
        {"prompt_tokens": 10, "completion_tokens": 4, "total_tokens": 14, "cost": 0.1},
    )
    assert store.completed_ids() == {"unit"}
    store.close()
