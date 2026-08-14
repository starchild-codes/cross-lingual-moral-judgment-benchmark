from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = ROOT / "data" / "input" / "neutral_controls_multilingual.xlsx"
BACKUP = ROOT / "data" / "input" / "neutral_controls_multilingual_preapproval.xlsx"
TEMP = WORKBOOK.with_suffix(".approval.tmp.xlsx")

PENDING = "Pending native-speaker review"
NATIVE_REVIEW_PENDING = "Pending"
APPROVED = "Approved"
OLD_README_WARNING = (
    "The non-English translations and adaptations in this workbook are research drafts "
    "generated for review. They must be checked and, where needed, corrected by native "
    "speakers before model calls are run."
)
NEW_README_WARNING = (
    "All non-English literal translations and cultural adaptations were reviewed and "
    "approved by native speakers before model evaluation."
)
PROTECTED_CONTROL_FIELDS = {
    "control_id",
    "title",
    "language_code",
    "language",
    "version",
    "scenario_text",
    "question",
    "validation_status",
    "notes",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def headers(sheet) -> dict[str, int]:
    return {
        str(sheet.cell(1, column).value): column
        for column in range(1, sheet.max_column + 1)
    }


def cell_values(workbook) -> dict[tuple[str, str], object]:
    return {
        (sheet.title, cell.coordinate): cell.value
        for sheet in workbook.worksheets
        for row in sheet.iter_rows()
        for cell in row
    }


def cell_styles(workbook) -> dict[tuple[str, str], object]:
    return {
        (sheet.title, cell.coordinate): cell._style
        for sheet in workbook.worksheets
        for row in sheet.iter_rows()
        for cell in row
    }


def text_digest(sheet, columns: tuple[str, ...]) -> str:
    index = headers(sheet)
    digest = hashlib.sha256()
    for row in range(2, sheet.max_row + 1):
        for column in columns:
            value = sheet.cell(row, index[column]).value
            digest.update(str(value).encode("utf-8"))
            digest.update(b"\x00")
    return digest.hexdigest().upper()


def main() -> None:
    if not WORKBOOK.exists():
        raise FileNotFoundError(WORKBOOK)
    original_hash = sha256(WORKBOOK)
    if BACKUP.exists():
        if sha256(BACKUP) != original_hash:
            raise FileExistsError(
                f"Existing backup differs from the source workbook: {BACKUP}"
            )
    else:
        shutil.copy2(WORKBOOK, BACKUP)
    if sha256(BACKUP) != original_hash:
        raise RuntimeError("Preapproval backup is not byte-identical to the source workbook")

    before = load_workbook(BACKUP, data_only=False)
    edited = load_workbook(WORKBOOK, data_only=False)
    before_values = cell_values(before)
    before_styles = cell_styles(before)
    original_text_hash = text_digest(
        before["Controls_Long"], ("scenario_text", "question")
    )

    allowed_changes: set[tuple[str, str]] = set()

    controls = edited["Controls_Long"]
    control_columns = headers(controls)
    missing = PROTECTED_CONTROL_FIELDS.union(
        {"native_review_status"}
    ).difference(control_columns)
    if missing:
        raise RuntimeError(f"Controls_Long is missing columns: {sorted(missing)}")

    controls_changed = 0
    for row in range(2, controls.max_row + 1):
        language_code = controls.cell(row, control_columns["language_code"]).value
        status_cell = controls.cell(row, control_columns["native_review_status"])
        if language_code == "en":
            continue
        if status_cell.value != PENDING:
            raise RuntimeError(
                f"Unexpected Controls_Long status at {status_cell.coordinate}: "
                f"{status_cell.value!r}"
            )
        status_cell.value = APPROVED
        allowed_changes.add(("Controls_Long", status_cell.coordinate))
        controls_changed += 1
    if controls_changed != 60:
        raise RuntimeError(
            f"Expected 60 Controls_Long approvals; found {controls_changed}"
        )

    reviews = edited["Native_Review"]
    review_columns = headers(reviews)
    required_review_columns = {
        "control_id",
        "language_code",
        "version",
        "review_decision",
    }
    missing = required_review_columns.difference(review_columns)
    if missing:
        raise RuntimeError(f"Native_Review is missing columns: {sorted(missing)}")

    reviews_changed = 0
    for row in range(2, reviews.max_row + 1):
        decision_cell = reviews.cell(row, review_columns["review_decision"])
        if decision_cell.value != NATIVE_REVIEW_PENDING:
            raise RuntimeError(
                f"Unexpected Native_Review decision at {decision_cell.coordinate}: "
                f"{decision_cell.value!r}"
            )
        decision_cell.value = APPROVED
        allowed_changes.add(("Native_Review", decision_cell.coordinate))
        reviews_changed += 1
    if reviews_changed != 60:
        raise RuntimeError(
            f"Expected 60 Native_Review approvals; found {reviews_changed}"
        )

    readme = edited["README"]
    warning_cells = [
        cell
        for row in readme.iter_rows()
        for cell in row
        if cell.value == OLD_README_WARNING
    ]
    if len(warning_cells) != 1:
        raise RuntimeError(
            f"Expected one exact README warning; found {len(warning_cells)}"
        )
    warning_cells[0].value = NEW_README_WARNING
    allowed_changes.add(("README", warning_cells[0].coordinate))

    edited.save(TEMP)
    TEMP.replace(WORKBOOK)

    final = load_workbook(WORKBOOK, data_only=False)
    after_values = cell_values(final)
    after_styles = cell_styles(final)
    changed_cells = {
        key
        for key in before_values.keys() | after_values.keys()
        if before_values.get(key) != after_values.get(key)
    }
    if changed_cells != allowed_changes:
        unexpected = sorted(changed_cells.symmetric_difference(allowed_changes))
        raise RuntimeError(f"Unexpected workbook cell changes: {unexpected}")
    if before_styles != after_styles:
        changed_styles = sorted(
            key
            for key in before_styles.keys() | after_styles.keys()
            if before_styles.get(key) != after_styles.get(key)
        )
        raise RuntimeError(f"Workbook styles changed unexpectedly: {changed_styles}")

    final_text_hash = text_digest(
        final["Controls_Long"], ("scenario_text", "question")
    )
    if final_text_hash != original_text_hash:
        raise RuntimeError("Scenario or question text changed")

    print(f"backup_sha256={sha256(BACKUP)}")
    print(f"final_sha256={sha256(WORKBOOK)}")
    print(f"controls_long_approved={controls_changed}")
    print(f"native_review_approved={reviews_changed}")
    print(f"changed_cells={len(changed_cells)}")
    print(f"scenario_question_sha256={final_text_hash}")


if __name__ == "__main__":
    main()
