from __future__ import annotations

import pandas as pd
import pytest

from src.common import INPUT_WORKBOOK
from src.validate_input import read_controls, validate_frame


@pytest.fixture(scope="session")
def structural_frame() -> pd.DataFrame:
    return validate_frame(read_controls(INPUT_WORKBOOK), require_native_approval=False)


@pytest.fixture
def approved_frame(structural_frame: pd.DataFrame) -> pd.DataFrame:
    frame = structural_frame.copy()
    non_english = frame["language_code"] != "en"
    frame.loc[non_english, "native_review_status"] = "Approved after native-speaker review"
    return validate_frame(frame, require_native_approval=True)

