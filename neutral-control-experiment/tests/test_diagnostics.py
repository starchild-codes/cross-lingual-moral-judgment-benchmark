from __future__ import annotations

import pandas as pd

from src.build_conditions import generate_conditions
from src.common import MODEL_KEYS
from src.diagnostics import diagnostic_rows
from src.storage import unique_key


def test_complete_diagnostics(approved_frame):
    conditions = generate_conditions(approved_frame)
    rows = []
    attempts = []
    for condition in conditions.to_dict("records"):
        for model_key in MODEL_KEYS:
            key = unique_key(condition["control_id"], model_key, condition["condition_id"])
            rows.append(
                {
                    **condition,
                    "unique_key": key,
                    "model_key": model_key,
                    "parsed_rating": 1.0,
                    "is_valid": 1,
                    "attempt_count": 1,
                    "total_tokens": None,
                    "reported_cost": None,
                }
            )
            attempts.append({"http_status": 200, "is_valid": 1})
    metrics, complete = diagnostic_rows(pd.DataFrame(rows), pd.DataFrame(attempts))
    assert complete is True
    metric_map = {row["metric"]: row["value"] for row in metrics if row["dimension"] == "overall"}
    assert metric_map["valid_final_rows"] == 375
    assert metric_map["duplicate_unique_keys"] == 0

