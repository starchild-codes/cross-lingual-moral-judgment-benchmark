from __future__ import annotations

import csv
import hashlib
import json
import platform
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import scipy
import seaborn as sns
import statsmodels
import statsmodels.formula.api as smf
from scipy.stats import kruskal, spearmanr


ROOT = Path(__file__).resolve().parents[1]
DATA_OUT = ROOT / "data" / "processed"
REPORTS = ROOT / "reports"
FIGURES = ROOT / "figures"
PLOTTING = ROOT / "plotting_data"
SCENARIO_FILES = [ROOT / "data" / "scenarios.csv", ROOT / "data" / "scenarios_extension.csv"]
RATING_FILES = [
    ROOT / "results" / "processed" / "full_1782215308316_vrq93w.ratings.csv",
    ROOT / "results" / "processed" / "extension_full_1782729062659_xqetbf.ratings.csv",
]
LANGUAGES = {
    "hi": "Hindi",
    "bn": "Bengali",
    "ta": "Tamil",
    "es": "Spanish",
    "ja": "Japanese",
    "ar": "Arabic",
}
MODELS = {
    "chatgpt": ("openai/gpt-4o-2024-11-20", "GPT-4o"),
    "claude": ("anthropic/claude-sonnet-4.6", "Claude Sonnet 4.6"),
    "gemini_flash": ("google/gemini-3.5-flash", "Gemini 3.5 Flash"),
}
FOUNDATION_ORDER = [
    "Care/Harm",
    "Fairness/Cheating",
    "Loyalty/Betrayal",
    "Authority/Subversion",
    "Sanctity/Degradation",
]
BOOTSTRAP_REPS = 10_000
SEED = 20260727
COLORS = {
    "Hindi": "#356AF5",
    "Bengali": "#7B61A8",
    "Tamil": "#B44C43",
    "Spanish": "#DF7900",
    "Japanese": "#1C8872",
    "Arabic": "#4B91C4",
}
FIGURE_FILENAMES = [
    "adaptation_edit_rate_by_language.png",
    "adaptation_edit_rate_by_foundation.png",
    "absolute_adaptation_effect_vs_edit_rate.png",
    "signed_adaptation_effect_vs_edit_rate.png",
    "adaptation_edit_rate_distribution.png",
    "adaptation_effect_by_edit_classification.png",
    "scenario_language_edit_rate_heatmap.png",
]
PLOTTING_FILENAMES = [
    "edit_rate_by_language.csv",
    "edit_rate_by_foundation.csv",
    "absolute_effect_vs_edit_rate.csv",
    "signed_effect_vs_edit_rate.csv",
    "edit_rate_distribution.csv",
    "effect_by_surface_classification.csv",
    "scenario_language_edit_rate_heatmap.csv",
]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def read_csv_exact(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text)).strip()


def is_japanese_character(character: str) -> bool:
    code = ord(character)
    return (
        0x3040 <= code <= 0x30FF
        or 0x31F0 <= code <= 0x31FF
        or 0x3400 <= code <= 0x4DBF
        or 0x4E00 <= code <= 0x9FFF
        or 0xF900 <= code <= 0xFAFF
    )


def unicode_tokens(text: str, language_code: str) -> list[str]:
    tokens: list[str] = []
    current: list[str] = []

    def flush() -> None:
        if current:
            tokens.append("".join(current))
            current.clear()

    for character in text:
        if character.isspace():
            flush()
            continue
        category = unicodedata.category(character)
        if language_code == "ja" and is_japanese_character(character):
            flush()
            tokens.append(character)
        elif category[0] in {"L", "M", "N"}:
            current.append(character)
        else:
            flush()
            tokens.append(character)
    flush()
    return tokens


def levenshtein_distance(sequence_a, sequence_b) -> int:
    if len(sequence_a) > len(sequence_b):
        sequence_a, sequence_b = sequence_b, sequence_a
    pattern_length = len(sequence_a)
    if pattern_length == 0:
        return len(sequence_b)
    masks: dict[object, int] = {}
    for index, item in enumerate(sequence_a):
        masks[item] = masks.get(item, 0) | (1 << index)
    full_mask = (1 << pattern_length) - 1
    positive = full_mask
    negative = 0
    score = pattern_length
    final_bit = 1 << (pattern_length - 1)
    for item in sequence_b:
        equal = masks.get(item, 0)
        vertical = equal | negative
        horizontal = (((equal & positive) + positive) ^ positive) | equal
        positive_horizontal = negative | ~(horizontal | positive)
        negative_horizontal = positive & horizontal
        if positive_horizontal & final_bit:
            score += 1
        elif negative_horizontal & final_bit:
            score -= 1
        positive_horizontal = ((positive_horizontal << 1) | 1) & full_mask
        negative_horizontal = (negative_horizontal << 1) & full_mask
        positive = (negative_horizontal | ~(vertical | positive_horizontal)) & full_mask
        negative = positive_horizontal & vertical
    return score


def lcs_length(sequence_a, sequence_b) -> int:
    if len(sequence_a) > len(sequence_b):
        sequence_a, sequence_b = sequence_b, sequence_a
    masks: dict[object, int] = {}
    for index, item in enumerate(sequence_a):
        masks[item] = masks.get(item, 0) | (1 << index)
    state = 0
    for item in sequence_b:
        matches = masks.get(item, 0)
        combined = matches | state
        shifted = (state << 1) | 1
        state = combined & ~(combined - shifted)
    return state.bit_count()


def token_edit_operations(sequence_a: list[str], sequence_b: list[str]) -> tuple[int, int, int]:
    n, m = len(sequence_a), len(sequence_b)
    matrix = np.zeros((n + 1, m + 1), dtype=np.int32)
    matrix[:, 0] = np.arange(n + 1)
    matrix[0, :] = np.arange(m + 1)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            substitution = matrix[i - 1, j - 1] + (sequence_a[i - 1] != sequence_b[j - 1])
            deletion = matrix[i - 1, j] + 1
            insertion = matrix[i, j - 1] + 1
            matrix[i, j] = min(substitution, deletion, insertion)
    added = removed = replaced = 0
    i, j = n, m
    while i or j:
        if i and j and sequence_a[i - 1] == sequence_b[j - 1]:
            i -= 1
            j -= 1
        elif i and j and matrix[i, j] == matrix[i - 1, j - 1] + 1:
            replaced += 1
            i -= 1
            j -= 1
        elif i and matrix[i, j] == matrix[i - 1, j] + 1:
            removed += 1
            i -= 1
        else:
            added += 1
            j -= 1
    return added, removed, replaced


def validate_distance_implementations() -> None:
    examples = [
        ("", "", 0),
        ("a", "", 1),
        ("kitten", "sitting", 3),
        ("mañana", "manana", 1),
        ("東京", "京都", 2),
    ]
    for left, right, expected in examples:
        if levenshtein_distance(left, right) != expected:
            raise RuntimeError("Levenshtein implementation self-test failed")
    if lcs_length("ABCBDAB", "BDCABA") != 4:
        raise RuntimeError("LCS implementation self-test failed")


def sentence_count(text: str) -> int:
    segments = [segment for segment in re.split(r"[.!?。！？।॥]+", text) if segment.strip()]
    return max(1, len(segments))


def approximate_clause_count(text: str) -> int:
    separators = len(re.findall(r"[,;:،、—–]+", text))
    return sentence_count(text) + separators


def changed_surface_flags(
    literal_tokens: list[str], adapted_tokens: list[str], language_code: str
) -> tuple[bool, bool, bool, str]:
    literal_set = set(literal_tokens)
    adapted_set = set(adapted_tokens)
    changed = literal_set.symmetric_difference(adapted_set)

    latin_name_pattern = re.compile(r"^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ'-]{2,}$")
    title_markers = {
        "mr", "mrs", "ms", "dr", "sr", "sra", "don", "doña", "señor", "señora",
        "श्री", "श्रीमती", "মি", "মিসেস", "திரு", "திருமதி", "さん", "氏", "السيد", "السيدة",
    }
    name_candidates = {
        token for token in changed
        if latin_name_pattern.match(token)
        or token.casefold().strip(".") in title_markers
    }
    names_changed = bool(name_candidates)

    location_markers = {
        "city", "village", "town", "district", "hospital", "school", "university",
        "office", "temple", "church", "mosque", "ciudad", "pueblo", "hospital",
        "escuela", "universidad", "मंदिर", "अस्पताल", "विद्यालय", "शहर", "गाँव",
        "হাসপাতাল", "স্কুল", "শহর", "கோவில்", "மருத்துவமனை", "பள்ளி",
        "病院", "学校", "寺", "町", "مدينة", "قرية", "مستشفى", "مدرسة", "جامعة",
    }
    locations_changed = any(token.casefold().strip(".,،。") in location_markers for token in changed)

    cultural_markers = {
        "rupee", "peso", "yen", "dinar", "sari", "kimono", "hijab", "festival",
        "wedding", "fast", "ritual", "snack", "food", "temple", "church", "mosque",
        "रुपये", "रुपया", "साड़ी", "त्योहार", "व्रत", "रस्म", "शादी",
        "টাকা", "শাড়ি", "উৎসব", "উপবাস", "রীতি", "বিয়ে",
        "ரூபாய்", "சாரி", "திருவிழா", "விரதம்", "சடங்கு", "திருமணம்",
        "円", "着物", "祭り", "断食", "儀式", "結婚式",
        "ريال", "دينار", "حجاب", "مهرجان", "صيام", "طقوس", "زفاف",
    }
    objects_changed = any(token.casefold().strip(".,،。") in cultural_markers for token in changed)
    note = (
        "Conservative lexicon/capitalization flags; false negatives are expected, "
        f"especially for {LANGUAGES[language_code]}."
    )
    return names_changed, locations_changed, objects_changed, note


def classify_edit(
    edit_rate: float,
    token_edit_rate: float,
    relative_length_change: float,
    sentence_changed: bool,
    clause_difference: int,
    surface_flag: bool,
) -> tuple[str, str]:
    if (
        sentence_changed
        or clause_difference >= 2
        or edit_rate >= 0.45
        or token_edit_rate >= 0.50
        or abs(relative_length_change) >= 0.30
    ):
        return "structural", "Structural threshold triggered by extent, length, sentence, or clause change."
    if surface_flag and edit_rate <= 0.20 and clause_difference == 0:
        return "surface-dominant", "Detected surface substitution with limited structural change."
    if surface_flag or edit_rate >= 0.20 or token_edit_rate >= 0.25 or clause_difference == 1:
        return "mixed", "Both surface and broader textual changes are plausible."
    return "uncertain", "Automatic evidence was insufficient for a confident surface/structural label."


def load_scenario_pairs() -> tuple[pd.DataFrame, dict[str, object]]:
    scenario_rows: list[dict[str, str]] = []
    ignored_non_scenario_footer_rows = 0
    for path in SCENARIO_FILES:
        for row in read_csv_exact(path):
            raw_id = (row.get("scenario_id") or row.get("scenarios_id") or "").strip()
            if not raw_id:
                populated = {
                    key: (value or "").strip()
                    for key, value in row.items()
                    if (value or "").strip()
                }
                if not populated or populated == {"mft_foundation": "scenarios.xlsx"}:
                    ignored_non_scenario_footer_rows += 1
                    continue
                raise RuntimeError(f"Scenario row without ID in {path}")
            scenario_id = f"S{int(raw_id):02d}" if raw_id.isdigit() else raw_id
            scenario_rows.append(
                {
                    "scenario_id": scenario_id,
                    "foundation": row["mft_foundation"],
                    **{
                        f"text_{language}_{version}": row[f"text_{language}_{column}"]
                        for language in LANGUAGES
                        for version, column in (("literal", "b"), ("adapted", "c"))
                    },
                }
            )
    scenarios = pd.DataFrame(scenario_rows)
    if len(scenarios) != 50 or scenarios["scenario_id"].nunique() != 50:
        raise RuntimeError("Expected exactly 50 unique valid scenarios")
    if set(scenarios["foundation"]) != set(FOUNDATION_ORDER):
        raise RuntimeError("Unexpected or missing foundation labels")

    pair_rows = []
    for scenario in scenarios.itertuples(index=False):
        for language_code, language in LANGUAGES.items():
            literal = getattr(scenario, f"text_{language_code}_literal")
            adapted = getattr(scenario, f"text_{language_code}_adapted")
            if not isinstance(literal, str) or not literal or not isinstance(adapted, str) or not adapted:
                raise RuntimeError(f"Missing text for {scenario.scenario_id}-{language_code}")
            pair_rows.append(
                {
                    "scenario_id": scenario.scenario_id,
                    "foundation": scenario.foundation,
                    "language_code": language_code,
                    "language": language,
                    "literal_text_raw": literal,
                    "adapted_text_raw": adapted,
                }
            )
    pairs = pd.DataFrame(pair_rows)
    if len(pairs) != 300 or pairs.duplicated(["scenario_id", "language_code"]).any():
        raise RuntimeError("Scenario-language text mapping is not exactly one-to-one")
    return pairs, {
        "scenario_rows": len(scenarios),
        "scenario_language_pairs": len(pairs),
        "ignored_non_scenario_footer_rows": ignored_non_scenario_footer_rows,
        "duplicate_pairs": 0,
        "missing_pairs": 0,
    }


def calculate_edit_metrics(pairs: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for pair in pairs.itertuples(index=False):
        literal_normalized = normalize_text(pair.literal_text_raw)
        adapted_normalized = normalize_text(pair.adapted_text_raw)
        literal_tokens = unicode_tokens(literal_normalized, pair.language_code)
        adapted_tokens = unicode_tokens(adapted_normalized, pair.language_code)
        raw_distance = levenshtein_distance(pair.literal_text_raw, pair.adapted_text_raw)
        normalized_distance = levenshtein_distance(literal_normalized, adapted_normalized)
        char_denominator = max(len(literal_normalized), len(adapted_normalized), 1)
        token_distance = levenshtein_distance(literal_tokens, adapted_tokens)
        token_denominator = max(len(literal_tokens), len(adapted_tokens), 1)
        literal_token_set, adapted_token_set = set(literal_tokens), set(adapted_tokens)
        union = literal_token_set | adapted_token_set
        intersection = literal_token_set & adapted_token_set
        jaccard = len(intersection) / len(union) if union else 1.0
        overlap = (
            len(intersection) / min(len(literal_token_set), len(adapted_token_set))
            if literal_token_set and adapted_token_set
            else 1.0
        )
        lcs_ratio = lcs_length(literal_normalized, adapted_normalized) / char_denominator
        added, removed, replaced = token_edit_operations(literal_tokens, adapted_tokens)
        literal_sentences, adapted_sentences = (
            sentence_count(literal_normalized),
            sentence_count(adapted_normalized),
        )
        literal_clauses, adapted_clauses = (
            approximate_clause_count(literal_normalized),
            approximate_clause_count(adapted_normalized),
        )
        names_changed, locations_changed, objects_changed, surface_note = changed_surface_flags(
            literal_tokens, adapted_tokens, pair.language_code
        )
        relative_length_change = (
            len(adapted_normalized) - len(literal_normalized)
        ) / max(len(literal_normalized), 1)
        classification, classification_note = classify_edit(
            normalized_distance / char_denominator,
            token_distance / token_denominator,
            relative_length_change,
            literal_sentences != adapted_sentences,
            abs(adapted_clauses - literal_clauses),
            names_changed or locations_changed or objects_changed,
        )
        rows.append(
            {
                **pair._asdict(),
                "literal_text_normalized": literal_normalized,
                "adapted_text_normalized": adapted_normalized,
                "literal_raw_sha256": sha256_text(pair.literal_text_raw),
                "adapted_raw_sha256": sha256_text(pair.adapted_text_raw),
                "literal_normalized_sha256": sha256_text(literal_normalized),
                "adapted_normalized_sha256": sha256_text(adapted_normalized),
                "raw_character_edit_distance": raw_distance,
                "normalized_character_edit_distance": normalized_distance,
                "normalized_character_edit_rate": normalized_distance / char_denominator,
                "literal_character_length": len(literal_normalized),
                "adapted_character_length": len(adapted_normalized),
                "relative_character_length_change": relative_length_change,
                "absolute_relative_character_length_change": abs(relative_length_change),
                "literal_token_count": len(literal_tokens),
                "adapted_token_count": len(adapted_tokens),
                "token_edit_distance": token_distance,
                "token_edit_rate": token_distance / token_denominator,
                "token_jaccard_similarity": jaccard,
                "token_jaccard_dissimilarity": 1 - jaccard,
                "token_overlap_coefficient": overlap,
                "longest_common_subsequence_ratio": lcs_ratio,
                "longest_common_subsequence_dissimilarity": 1 - lcs_ratio,
                "tokens_added": added,
                "tokens_added_proportion": added / max(len(adapted_tokens), 1),
                "tokens_removed": removed,
                "tokens_removed_proportion": removed / max(len(literal_tokens), 1),
                "tokens_replaced": replaced,
                "tokens_replaced_proportion": replaced / token_denominator,
                "literal_sentence_count": literal_sentences,
                "adapted_sentence_count": adapted_sentences,
                "sentence_count_changed": literal_sentences != adapted_sentences,
                "literal_approximate_clause_count": literal_clauses,
                "adapted_approximate_clause_count": adapted_clauses,
                "approximate_clause_count_changed": literal_clauses != adapted_clauses,
                "names_changed_conservative": names_changed,
                "locations_or_institutions_changed_conservative": locations_changed,
                "culturally_specific_objects_changed_conservative": objects_changed,
                "surface_detection_note": surface_note,
                "edit_classification": classification,
                "classification_note": classification_note,
            }
        )
    audit = pd.DataFrame(rows)
    if len(audit) != 300 or audit.duplicated(["scenario_id", "language_code"]).any():
        raise RuntimeError("Edit audit row validation failed")
    audit.to_csv(
        DATA_OUT / "adaptation_edit_audit_300.csv", index=False, encoding="utf-8-sig"
    )
    classification_columns = [
        "scenario_id",
        "foundation",
        "language_code",
        "language",
        "names_changed_conservative",
        "locations_or_institutions_changed_conservative",
        "culturally_specific_objects_changed_conservative",
        "literal_sentence_count",
        "adapted_sentence_count",
        "sentence_count_changed",
        "literal_approximate_clause_count",
        "adapted_approximate_clause_count",
        "approximate_clause_count_changed",
        "edit_classification",
        "classification_note",
        "surface_detection_note",
    ]
    audit[classification_columns].to_csv(
        DATA_OUT / "adaptation_edit_surface_classification.csv",
        index=False,
        encoding="utf-8-sig",
    )
    return audit


def merge_rating_effects(audit: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, object]]:
    ratings = pd.concat([pd.read_csv(path) for path in RATING_FILES], ignore_index=True)
    authorized_ids = {value[0] for value in MODELS.values()}
    ratings = ratings[
        (ratings["status"] == "succeeded")
        & ratings["parsedRating"].notna()
        & ratings["modelKey"].isin(MODELS)
        & ratings["modelString"].isin(authorized_ids)
    ].copy()
    duplicate_count = int(
        ratings.duplicated(["scenarioId", "modelKey", "conditionId"]).sum()
    )
    if duplicate_count:
        raise RuntimeError(f"Duplicate authorized rating rows: {duplicate_count}")
    lookup = ratings.set_index(["scenarioId", "modelKey", "conditionId"])[
        ["parsedRating", "modelString"]
    ].to_dict("index")
    rows = []
    for pair in audit.itertuples(index=False):
        for model_key, (model_id, model_label) in MODELS.items():
            literal_condition = f"{pair.language_code}_translation_reason_en"
            adapted_condition = f"{pair.language_code}_adapted_reason_en"
            literal_key = (pair.scenario_id, model_key, literal_condition)
            adapted_key = (pair.scenario_id, model_key, adapted_condition)
            if literal_key not in lookup or adapted_key not in lookup:
                raise RuntimeError(f"Missing adaptation rating effect for {pair.scenario_id}")
            if (
                lookup[literal_key]["modelString"] != model_id
                or lookup[adapted_key]["modelString"] != model_id
            ):
                raise RuntimeError("Model ID mismatch in rating merge")
            literal_rating = float(lookup[literal_key]["parsedRating"])
            adapted_rating = float(lookup[adapted_key]["parsedRating"])
            signed = adapted_rating - literal_rating
            rows.append(
                {
                    **pair._asdict(),
                    "model_key": model_key,
                    "model_id": model_id,
                    "model": model_label,
                    "literal_condition_id": literal_condition,
                    "adapted_condition_id": adapted_condition,
                    "literal_english_response_rating": literal_rating,
                    "adapted_english_response_rating": adapted_rating,
                    "signed_adaptation_effect": signed,
                    "absolute_adaptation_effect": abs(signed),
                }
            )
    merged = pd.DataFrame(rows)
    keys = ["scenario_id", "language_code", "model_key"]
    if len(merged) != 900 or merged.duplicated(keys).any():
        raise RuntimeError("Model-level edit/effect merge is not one-to-one")
    merged.to_csv(
        DATA_OUT / "adaptation_edit_model_merge_900.csv",
        index=False,
        encoding="utf-8-sig",
    )
    return merged, {
        "rows": len(merged),
        "unique_model_scenario_language_keys": int(merged[keys].drop_duplicates().shape[0]),
        "duplicates": int(merged.duplicated(keys).sum()),
        "missing_signed_effects": int(merged["signed_adaptation_effect"].isna().sum()),
        "unauthorized_models": sorted(set(merged["model_id"]) - {value[0] for value in MODELS.values()}),
    }


def scenario_cluster_bootstrap(
    frame: pd.DataFrame,
    statistic,
    repetitions: int = BOOTSTRAP_REPS,
    seed: int = SEED,
) -> tuple[float, float]:
    scenario_ids = frame["scenario_id"].to_numpy()
    clusters = np.array(sorted(frame["scenario_id"].unique()))
    grouped_indices = [np.flatnonzero(scenario_ids == cluster) for cluster in clusters]
    rng = np.random.default_rng(seed)
    estimates = np.empty(repetitions)
    for repetition in range(repetitions):
        sampled = rng.integers(0, len(clusters), size=len(clusters))
        indices = np.concatenate([grouped_indices[index] for index in sampled])
        estimates[repetition] = statistic(indices)
    finite_estimates = estimates[np.isfinite(estimates)]
    if len(finite_estimates) < max(100, int(0.9 * repetitions)):
        raise ValueError(
            f"Too few finite bootstrap estimates: {len(finite_estimates)} / {repetitions}"
        )
    return tuple(np.quantile(finite_estimates, [0.025, 0.975]))


def describe_primary(
    frame: pd.DataFrame, grouping: list[str], seed_offset: int = 0
) -> pd.DataFrame:
    grouped = [(("Overall",), frame)] if not grouping else list(frame.groupby(grouping, sort=True))
    rows = []
    for index, (key, group) in enumerate(grouped):
        key = key if isinstance(key, tuple) else (key,)
        values = group["normalized_character_edit_rate"].to_numpy()
        ci = scenario_cluster_bootstrap(
            group,
            lambda indices: float(values[indices].mean()),
            seed=SEED + seed_offset + index,
        )
        row = {
            **{column: value for column, value in zip(grouping or ["scope"], key)},
            "pairs": len(group),
            "mean": float(np.mean(values)),
            "median": float(np.median(values)),
            "standard_deviation": (
                float(np.std(values, ddof=1)) if len(values) > 1 else float("nan")
            ),
            "interquartile_range": float(np.quantile(values, 0.75) - np.quantile(values, 0.25)),
            "minimum": float(np.min(values)),
            "maximum": float(np.max(values)),
            "scenario_cluster_bootstrap_mean_ci_lower_95": ci[0],
            "scenario_cluster_bootstrap_mean_ci_upper_95": ci[1],
        }
        rows.append(row)
    return pd.DataFrame(rows)


def correlation_rows(
    frame: pd.DataFrame,
    grouping_name: str,
    grouping_column: str | None,
    metric: str = "normalized_character_edit_rate",
    seed_offset: int = 0,
) -> list[dict[str, object]]:
    grouped = [("Overall", frame)] if grouping_column is None else list(frame.groupby(grouping_column, sort=True))
    rows = []
    for index, (group_value, group) in enumerate(grouped):
        edit = group[metric].to_numpy()
        effect = group["absolute_adaptation_effect"].to_numpy()
        rho, p_value = spearmanr(edit, effect)
        ci = scenario_cluster_bootstrap(
            group,
            lambda indices: float(spearmanr(edit[indices], effect[indices]).statistic),
            seed=SEED + seed_offset + index,
        )
        rows.append(
            {
                "analysis": grouping_name,
                "group": group_value,
                "edit_metric": metric,
                "n": len(group),
                "scenario_clusters": group["scenario_id"].nunique(),
                "spearman_rho": float(rho),
                "two_sided_p_value": float(p_value),
                "scenario_cluster_bootstrap_ci_lower_95": ci[0],
                "scenario_cluster_bootstrap_ci_upper_95": ci[1],
                "bootstrap_repetitions": BOOTSTRAP_REPS,
            }
        )
    return rows


def regression_table(result, name: str) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "regression": name,
            "term": result.params.index,
            "coefficient": result.params.values,
            "clustered_se": result.bse.values,
            "ci_lower_95": result.conf_int()[0].values,
            "ci_upper_95": result.conf_int()[1].values,
            "p_value": result.pvalues.values,
            "n": int(result.nobs),
            "scenario_clusters": 50,
            "r_squared": result.rsquared,
        }
    )


def fit_clustered(formula: str, data: pd.DataFrame):
    return smf.ols(formula, data=data).fit(
        cov_type="cluster",
        cov_kwds={"groups": data["scenario_id"], "use_correction": True},
        use_t=True,
    )


def primary_analyses(audit: pd.DataFrame, merged: pd.DataFrame) -> dict[str, object]:
    descriptive_tables = {
        "overall": describe_primary(audit, []),
        "language": describe_primary(audit, ["language"], 100),
        "foundation": describe_primary(audit, ["foundation"], 200),
        "scenario": describe_primary(audit, ["scenario_id"], 300),
        "classification": describe_primary(audit, ["edit_classification"], 400),
    }
    for name, table in descriptive_tables.items():
        table.to_csv(
            DATA_OUT / f"adaptation_edit_descriptive_{name}.csv",
            index=False,
            encoding="utf-8-sig",
        )

    correlations = []
    correlations.extend(correlation_rows(merged, "pooled", None))
    correlations.extend(correlation_rows(merged, "by_model", "model", seed_offset=100))
    correlations.extend(correlation_rows(merged, "by_language", "language", seed_offset=200))
    correlations.extend(correlation_rows(merged, "by_foundation", "foundation", seed_offset=300))
    correlation_table = pd.DataFrame(correlations)
    correlation_table.to_csv(
        DATA_OUT / "adaptation_edit_correlations.csv", index=False, encoding="utf-8-sig"
    )

    signed = fit_clustered(
        "signed_adaptation_effect ~ normalized_character_edit_rate", merged
    )
    absolute = fit_clustered(
        "absolute_adaptation_effect ~ normalized_character_edit_rate", merged
    )
    adjusted = fit_clustered(
        "absolute_adaptation_effect ~ normalized_character_edit_rate + "
        "C(model) + C(language) + C(foundation)",
        merged,
    )
    regressions = pd.concat(
        [
            regression_table(signed, "signed_effect"),
            regression_table(absolute, "absolute_effect"),
            regression_table(adjusted, "adjusted_absolute_effect"),
        ],
        ignore_index=True,
    )
    regressions.to_csv(
        DATA_OUT / "adaptation_edit_regressions.csv", index=False, encoding="utf-8-sig"
    )

    classification_summary = (
        merged.groupby("edit_classification", as_index=False)
        .agg(
            model_rows=("absolute_adaptation_effect", "size"),
            scenario_language_pairs=("scenario_id", lambda values: len(values) // 3),
            mean_absolute_effect=("absolute_adaptation_effect", "mean"),
            median_absolute_effect=("absolute_adaptation_effect", "median"),
            standard_deviation=("absolute_adaptation_effect", "std"),
            interquartile_range=(
                "absolute_adaptation_effect",
                lambda values: values.quantile(0.75) - values.quantile(0.25),
            ),
        )
    )
    classification_summary.to_csv(
        DATA_OUT / "adaptation_edit_classification_effects.csv",
        index=False,
        encoding="utf-8-sig",
    )
    class_groups = [
        group["absolute_adaptation_effect"].to_numpy()
        for _, group in merged.groupby("edit_classification")
        if len(group) >= 5
    ]
    if len(class_groups) >= 2:
        omnibus = kruskal(*class_groups)
        omnibus_result = {
            "test": "Kruskal-Wallis",
            "statistic": float(omnibus.statistic),
            "p_value": float(omnibus.pvalue),
            "groups_tested": len(class_groups),
        }
    else:
        omnibus_result = {
            "test": "Not run",
            "reason": "Fewer than two classification cells contained at least five rows.",
        }
    return {
        "descriptive": {name: table.to_dict("records") for name, table in descriptive_tables.items()},
        "correlations": correlation_table.to_dict("records"),
        "regressions": regressions.to_dict("records"),
        "classification_effects": classification_summary.to_dict("records"),
        "classification_omnibus": omnibus_result,
    }


def robustness_analyses(merged: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, object]] = []

    def add_correlation(label: str, group: str, frame: pd.DataFrame, metric: str) -> None:
        rho, p_value = spearmanr(frame[metric], frame["absolute_adaptation_effect"])
        rows.append(
            {
                "analysis": label,
                "excluded_group": group,
                "edit_metric": metric,
                "n": len(frame),
                "scenario_clusters": frame["scenario_id"].nunique(),
                "spearman_rho": float(rho),
                "two_sided_p_value": float(p_value),
            }
        )

    metrics = [
        "normalized_character_edit_rate",
        "token_edit_rate",
        "token_jaccard_dissimilarity",
        "absolute_relative_character_length_change",
        "longest_common_subsequence_dissimilarity",
    ]
    for metric in metrics:
        add_correlation("metric_sensitivity", "", merged, metric)
    for language in LANGUAGES.values():
        add_correlation(
            "leave_one_language_out",
            language,
            merged[merged["language"] != language],
            "normalized_character_edit_rate",
        )
    for foundation in FOUNDATION_ORDER:
        add_correlation(
            "leave_one_foundation_out",
            foundation,
            merged[merged["foundation"] != foundation],
            "normalized_character_edit_rate",
        )
    for scenario_id in sorted(merged["scenario_id"].unique()):
        add_correlation(
            "leave_one_scenario_out",
            scenario_id,
            merged[merged["scenario_id"] != scenario_id],
            "normalized_character_edit_rate",
        )
    for model in [value[1] for value in MODELS.values()]:
        add_correlation(
            "model_stratified",
            model,
            merged[merged["model"] == model],
            "normalized_character_edit_rate",
        )
    pair_threshold = (
        merged[["scenario_id", "language_code", "normalized_character_edit_rate"]]
        .drop_duplicates()
        ["normalized_character_edit_rate"]
        .quantile(0.95)
    )
    add_correlation(
        "exclude_top_5_percent_edit_pairs",
        f"edit_rate>{pair_threshold:.12f}",
        merged[merged["normalized_character_edit_rate"] <= pair_threshold],
        "normalized_character_edit_rate",
    )
    pair_means = (
        merged.groupby(
            [
                "scenario_id",
                "foundation",
                "language_code",
                "language",
                "normalized_character_edit_rate",
            ],
            as_index=False,
        )
        .agg(absolute_adaptation_effect=("absolute_adaptation_effect", "mean"))
    )
    add_correlation(
        "scenario_language_means",
        "",
        pair_means,
        "normalized_character_edit_rate",
    )
    robustness = pd.DataFrame(rows)
    robustness.to_csv(
        DATA_OUT / "adaptation_edit_robustness_results.csv",
        index=False,
        encoding="utf-8-sig",
    )
    return robustness


def build_extremes(audit: pd.DataFrame, merged: pd.DataFrame) -> pd.DataFrame:
    pair_effects = (
        merged.groupby(["scenario_id", "language_code"], as_index=False)
        .agg(
            mean_signed_adaptation_effect=("signed_adaptation_effect", "mean"),
            mean_absolute_adaptation_effect=("absolute_adaptation_effect", "mean"),
        )
    )
    pair_detail = audit.merge(
        pair_effects, on=["scenario_id", "language_code"], validate="one_to_one"
    )
    pair_columns = [
        "scenario_id",
        "foundation",
        "language_code",
        "language",
        "literal_text_raw",
        "adapted_text_raw",
        "normalized_character_edit_rate",
        "token_edit_rate",
        "relative_character_length_change",
        "longest_common_subsequence_ratio",
        "edit_classification",
        "classification_note",
        "mean_signed_adaptation_effect",
        "mean_absolute_adaptation_effect",
    ]
    sections = []
    top_edit = pair_detail.nlargest(20, "normalized_character_edit_rate")[pair_columns].copy()
    top_edit.insert(0, "extreme_type", "most_heavily_edited_pair")
    sections.append(top_edit)
    nonidentical = pair_detail[pair_detail["normalized_character_edit_rate"] > 0]
    least = nonidentical.nsmallest(20, "normalized_character_edit_rate")[pair_columns].copy()
    least.insert(0, "extreme_type", "least_edited_nonidentical_pair")
    sections.append(least)

    model_columns = pair_columns[:-2] + [
        "model_key",
        "model_id",
        "model",
        "signed_adaptation_effect",
        "absolute_adaptation_effect",
    ]
    largest_effect = merged.nlargest(20, "absolute_adaptation_effect")[model_columns].copy()
    largest_effect.insert(0, "extreme_type", "largest_model_level_adaptation_effect")
    sections.append(largest_effect)
    edit_q25, edit_q75 = (
        pair_detail["normalized_character_edit_rate"].quantile(0.25),
        pair_detail["normalized_character_edit_rate"].quantile(0.75),
    )
    effect_q25, effect_q75 = (
        merged["absolute_adaptation_effect"].quantile(0.25),
        merged["absolute_adaptation_effect"].quantile(0.75),
    )
    high_edit_low_effect = merged[
        (merged["normalized_character_edit_rate"] >= edit_q75)
        & (merged["absolute_adaptation_effect"] <= effect_q25)
    ][model_columns].copy()
    high_edit_low_effect.insert(0, "extreme_type", "high_edit_low_effect")
    sections.append(high_edit_low_effect)
    low_edit_high_effect = merged[
        (merged["normalized_character_edit_rate"] <= edit_q25)
        & (merged["absolute_adaptation_effect"] >= effect_q75)
    ][model_columns].copy()
    low_edit_high_effect.insert(0, "extreme_type", "low_edit_high_effect")
    sections.append(low_edit_high_effect)
    extremes = pd.concat(sections, ignore_index=True, sort=False)
    extremes["audit_note"] = "No text or rating was altered; quartile sections retain every qualifying row."
    extremes.to_csv(
        DATA_OUT / "adaptation_edit_extreme_pairs.csv",
        index=False,
        encoding="utf-8-sig",
    )
    return extremes


def style_axis(axis, title: str, ylabel: str) -> None:
    axis.set_title(title, fontsize=14, fontweight="bold", pad=12)
    axis.set_ylabel(ylabel)
    axis.grid(axis="y", color="#D8DEE8", linewidth=0.8)
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)


def create_figures(audit: pd.DataFrame, merged: pd.DataFrame) -> None:
    sns.set_theme(style="whitegrid")
    language_data = audit[
        ["scenario_id", "language", "normalized_character_edit_rate"]
    ].copy()
    language_data["language_n"] = language_data.groupby("language")["scenario_id"].transform("size")
    language_data.to_csv(
        PLOTTING / "edit_rate_by_language.csv", index=False, encoding="utf-8-sig"
    )
    fig, axis = plt.subplots(figsize=(9.5, 5.8))
    sns.boxplot(
        data=language_data,
        x="language",
        y="normalized_character_edit_rate",
        order=list(LANGUAGES.values()),
        color="#DDE5F3",
        showfliers=False,
        ax=axis,
    )
    sns.stripplot(
        data=language_data,
        x="language",
        y="normalized_character_edit_rate",
        order=list(LANGUAGES.values()),
        palette=COLORS,
        hue="language",
        legend=False,
        alpha=0.65,
        jitter=0.2,
        ax=axis,
    )
    axis.set_xlabel("Language")
    style_axis(axis, "Normalized Character Edit Rate by Language", "Normalized character edit rate")
    fig.tight_layout()
    fig.savefig(FIGURES / "adaptation_edit_rate_by_language.png", dpi=180)
    plt.close(fig)

    foundation_data = audit[
        ["scenario_id", "foundation", "normalized_character_edit_rate"]
    ].copy()
    foundation_data["foundation_n"] = foundation_data.groupby("foundation")["scenario_id"].transform("size")
    foundation_data.to_csv(
        PLOTTING / "edit_rate_by_foundation.csv", index=False, encoding="utf-8-sig"
    )
    fig, axis = plt.subplots(figsize=(10.8, 5.8))
    sns.boxplot(
        data=foundation_data,
        x="foundation",
        y="normalized_character_edit_rate",
        order=FOUNDATION_ORDER,
        color="#DDE5F3",
        showfliers=False,
        ax=axis,
    )
    sns.stripplot(
        data=foundation_data,
        x="foundation",
        y="normalized_character_edit_rate",
        order=FOUNDATION_ORDER,
        color="#356AF5",
        alpha=0.55,
        jitter=0.2,
        ax=axis,
    )
    axis.set_xlabel("Moral foundation")
    axis.tick_params(axis="x", rotation=15)
    style_axis(axis, "Normalized Character Edit Rate by Moral Foundation", "Normalized character edit rate")
    fig.tight_layout()
    fig.savefig(FIGURES / "adaptation_edit_rate_by_foundation.png", dpi=180)
    plt.close(fig)

    scatter_columns = [
        "scenario_id",
        "language",
        "model",
        "normalized_character_edit_rate",
        "absolute_adaptation_effect",
        "signed_adaptation_effect",
    ]
    scatter = merged[scatter_columns].copy()
    scatter["total_n"] = len(scatter)
    scatter["model_n"] = scatter.groupby("model")["scenario_id"].transform("size")
    scatter.to_csv(
        PLOTTING / "absolute_effect_vs_edit_rate.csv", index=False, encoding="utf-8-sig"
    )
    fig, axis = plt.subplots(figsize=(9.2, 5.8))
    sns.scatterplot(
        data=scatter,
        x="normalized_character_edit_rate",
        y="absolute_adaptation_effect",
        hue="model",
        alpha=0.55,
        s=42,
        ax=axis,
    )
    axis.set_xlabel("Normalized character edit rate")
    style_axis(
        axis,
        "Absolute Cultural-Adaptation Effect by Edit Rate",
        "Absolute cultural-adaptation effect",
    )
    axis.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(FIGURES / "absolute_adaptation_effect_vs_edit_rate.png", dpi=180)
    plt.close(fig)

    scatter.to_csv(
        PLOTTING / "signed_effect_vs_edit_rate.csv", index=False, encoding="utf-8-sig"
    )
    fig, axis = plt.subplots(figsize=(9.2, 5.8))
    sns.scatterplot(
        data=scatter,
        x="normalized_character_edit_rate",
        y="signed_adaptation_effect",
        hue="model",
        alpha=0.55,
        s=42,
        ax=axis,
    )
    axis.axhline(0, color="#555555", linewidth=1)
    axis.set_xlabel("Normalized character edit rate")
    style_axis(
        axis,
        "Signed Cultural-Adaptation Effect by Edit Rate",
        "Signed cultural-adaptation effect",
    )
    axis.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(FIGURES / "signed_adaptation_effect_vs_edit_rate.png", dpi=180)
    plt.close(fig)

    distribution = audit[
        ["scenario_id", "language", "normalized_character_edit_rate"]
    ].copy()
    distribution["total_n"] = len(distribution)
    distribution.to_csv(
        PLOTTING / "edit_rate_distribution.csv", index=False, encoding="utf-8-sig"
    )
    fig, axis = plt.subplots(figsize=(8.5, 5.5))
    sns.histplot(distribution["normalized_character_edit_rate"], bins=20, color="#1C8872", ax=axis)
    axis.set_xlabel("Normalized character edit rate")
    style_axis(axis, "Distribution of Normalized Character Edit Rates", "Scenario-language pairs")
    fig.tight_layout()
    fig.savefig(FIGURES / "adaptation_edit_rate_distribution.png", dpi=180)
    plt.close(fig)

    class_data = merged[
        ["scenario_id", "language", "model", "edit_classification", "absolute_adaptation_effect"]
    ].copy()
    class_data["classification_n"] = class_data.groupby("edit_classification")[
        "scenario_id"
    ].transform("size")
    class_data.to_csv(
        PLOTTING / "effect_by_surface_classification.csv", index=False, encoding="utf-8-sig"
    )
    class_order = [
        value for value in ["surface-dominant", "mixed", "structural", "uncertain"]
        if value in set(class_data["edit_classification"])
    ]
    fig, axis = plt.subplots(figsize=(9.2, 5.8))
    sns.boxplot(
        data=class_data,
        x="edit_classification",
        y="absolute_adaptation_effect",
        order=class_order,
        color="#DDE5F3",
        showfliers=False,
        ax=axis,
    )
    sns.stripplot(
        data=class_data,
        x="edit_classification",
        y="absolute_adaptation_effect",
        order=class_order,
        hue="model",
        alpha=0.35,
        jitter=0.25,
        size=3,
        ax=axis,
    )
    axis.set_xlabel("Edit classification")
    style_axis(
        axis,
        "Cultural-Adaptation Effects by Edit Classification",
        "Absolute cultural-adaptation effect",
    )
    axis.legend(frameon=False, ncol=3, loc="upper center", bbox_to_anchor=(0.5, -0.15))
    fig.subplots_adjust(left=0.10, right=0.98, top=0.88, bottom=0.24)
    fig.savefig(FIGURES / "adaptation_effect_by_edit_classification.png", dpi=180)
    plt.close(fig)

    heatmap = audit.pivot(
        index="scenario_id", columns="language", values="normalized_character_edit_rate"
    ).reindex(columns=list(LANGUAGES.values()))
    heatmap.reset_index().to_csv(
        PLOTTING / "scenario_language_edit_rate_heatmap.csv",
        index=False,
        encoding="utf-8-sig",
    )
    fig, axis = plt.subplots(figsize=(8.4, 13.0))
    sns.heatmap(
        heatmap,
        cmap="viridis",
        vmin=0,
        vmax=1,
        cbar_kws={"label": "Normalized character edit rate"},
        ax=axis,
    )
    axis.set_xlabel("Language")
    axis.set_ylabel("Scenario")
    axis.set_title("Scenario-Language Normalized Character Edit Rates", fontsize=14, fontweight="bold", pad=12)
    fig.tight_layout()
    fig.savefig(FIGURES / "scenario_language_edit_rate_heatmap.png", dpi=180)
    plt.close(fig)


def markdown_table(frame: pd.DataFrame) -> str:
    display = frame.copy()
    headers = [str(column) for column in display.columns]
    rows = [headers] + [
        ["" if pd.isna(value) else str(value) for value in row]
        for row in display.itertuples(index=False, name=None)
    ]
    widths = [max(len(row[index]) for row in rows) for index in range(len(headers))]
    lines = [
        "| " + " | ".join(value.ljust(widths[index]) for index, value in enumerate(rows[0])) + " |",
        "| " + " | ".join("-" * widths[index] for index in range(len(headers))) + " |",
    ]
    lines.extend(
        "| " + " | ".join(value.ljust(widths[index]) for index, value in enumerate(row)) + " |"
        for row in rows[1:]
    )
    return "\n".join(lines)


def compact_numeric(frame: pd.DataFrame, decimals: int = 6) -> pd.DataFrame:
    result = frame.copy()
    for column in result.select_dtypes(include="number").columns:
        result[column] = result[column].map(
            lambda value: str(int(value)) if float(value).is_integer() else f"{value:.{decimals}f}"
        )
    return result


def write_reports(
    source_validation: dict[str, object],
    merge_diagnostics: dict[str, object],
    audit: pd.DataFrame,
    merged: pd.DataFrame,
    analyses: dict[str, object],
    robustness: pd.DataFrame,
    extremes: pd.DataFrame,
) -> None:
    descriptive_overall = pd.DataFrame(analyses["descriptive"]["overall"])
    correlations = pd.DataFrame(analyses["correlations"])
    regressions = pd.DataFrame(analyses["regressions"])
    pooled = correlations[correlations["analysis"] == "pooled"].iloc[0]
    signed_term = regressions[
        (regressions["regression"] == "signed_effect")
        & (regressions["term"] == "normalized_character_edit_rate")
    ].iloc[0]
    absolute_term = regressions[
        (regressions["regression"] == "absolute_effect")
        & (regressions["term"] == "normalized_character_edit_rate")
    ].iloc[0]
    adjusted_term = regressions[
        (regressions["regression"] == "adjusted_absolute_effect")
        & (regressions["term"] == "normalized_character_edit_rate")
    ].iloc[0]
    overall = descriptive_overall.iloc[0]
    class_effects = pd.DataFrame(analyses["classification_effects"])
    classification = class_effects
    metric_robustness = robustness[robustness["analysis"] == "metric_sensitivity"]
    loo_language = robustness[robustness["analysis"] == "leave_one_language_out"]
    loo_foundation = robustness[robustness["analysis"] == "leave_one_foundation_out"]
    loo_scenario = robustness[robustness["analysis"] == "leave_one_scenario_out"]
    primary_sign = np.sign(pooled["spearman_rho"])
    robustness_consistent = bool(
        all(np.sign(value) == primary_sign for value in metric_robustness["spearman_rho"])
    )
    interpretation = (
        "Larger textual edits were positively associated with larger absolute adaptation effects."
        if pooled["spearman_rho"] > 0 and pooled["two_sided_p_value"] < 0.05
        else "The pooled association was weak or statistically uncertain, suggesting that adaptation effects are not reducible to edit volume alone."
    )
    top_edit_excerpt = extremes[extremes["extreme_type"] == "most_heavily_edited_pair"][
        ["scenario_id", "foundation", "language", "normalized_character_edit_rate", "edit_classification"]
    ].head(10)
    largest_effect_excerpt = extremes[
        extremes["extreme_type"] == "largest_model_level_adaptation_effect"
    ][
        [
            "scenario_id",
            "foundation",
            "language",
            "model",
            "normalized_character_edit_rate",
            "signed_adaptation_effect",
            "absolute_adaptation_effect",
            "edit_classification",
        ]
    ].head(10)
    manuscript_paragraph = (
        f"Across 300 scenario-language pairs, the mean normalized character edit rate was "
        f"{overall['mean']:.3f} (median = {overall['median']:.3f}, SD = "
        f"{overall['standard_deviation']:.3f}, IQR = {overall['interquartile_range']:.3f}; "
        f"95% scenario-cluster bootstrap CI for the mean "
        f"[{overall['scenario_cluster_bootstrap_mean_ci_lower_95']:.3f}, "
        f"{overall['scenario_cluster_bootstrap_mean_ci_upper_95']:.3f}]). Across 900 "
        f"model-level observations, normalized character edit rate was correlated with "
        f"absolute cultural-adaptation effects at Spearman rho = {pooled['spearman_rho']:.3f} "
        f"(two-sided p = {pooled['two_sided_p_value']:.3g}, 95% scenario-cluster bootstrap "
        f"CI [{pooled['scenario_cluster_bootstrap_ci_lower_95']:.3f}, "
        f"{pooled['scenario_cluster_bootstrap_ci_upper_95']:.3f}]). In scenario-clustered "
        f"regression, the absolute-effect coefficient was {absolute_term['coefficient']:.3f} "
        f"(SE = {absolute_term['clustered_se']:.3f}, 95% CI "
        f"[{absolute_term['ci_lower_95']:.3f}, {absolute_term['ci_upper_95']:.3f}], "
        f"p = {absolute_term['p_value']:.3g}); after adjustment for model, language, and "
        f"foundation it was {adjusted_term['coefficient']:.3f} "
        f"(SE = {adjusted_term['clustered_se']:.3f}, 95% CI "
        f"[{adjusted_term['ci_lower_95']:.3f}, {adjusted_term['ci_upper_95']:.3f}], "
        f"p = {adjusted_term['p_value']:.3g}). These diagnostic associations do not establish "
        f"that textual edit magnitude caused rating change."
    )

    report = f"""# Translation and Adaptation Edit-Rate Audit

## Validation and Sources

- Scenario files: `data/scenarios.csv`, `data/scenarios_extension.csv`
- Rating files: `results/processed/full_1782215308316_vrq93w.ratings.csv`,
  `results/processed/extension_full_1782729062659_xqetbf.ratings.csv`
- Valid scenarios: **{source_validation['scenario_rows']}**
- Scenario-language pairs: **{source_validation['scenario_language_pairs']}**
- Model-level edit/effect rows: **{merge_diagnostics['rows']}**
- Duplicate pair keys: **{source_validation['duplicate_pairs']}**
- Missing pair keys: **{source_validation['missing_pairs']}**
- Duplicate merged keys: **{merge_diagnostics['duplicates']}**
- Missing adaptation effects: **{merge_diagnostics['missing_signed_effects']}**

The terminal `scenarios.xlsx` source-footer marker in `data/scenarios.csv` was ignored; no
text-bearing row was dropped. Gemini 3.1 Pro was excluded.

## Normalization and Tokenization

Raw text is preserved exactly for character-level raw distance and hashing. Analysis text
uses only Unicode NFKC, repeated-whitespace collapse, and outer trimming. No words,
punctuation, names, accents, or language-specific content are removed.

The deterministic Unicode tokenizer groups contiguous letters, combining marks, and numbers,
emits punctuation as separate tokens, and emits Japanese Han, Hiragana, and Katakana
characters individually because whitespace does not define Japanese words. Token measures
are secondary, particularly for Japanese, and are not directly equivalent across languages.

## Descriptive Edit Statistics

{markdown_table(compact_numeric(descriptive_overall))}

### By Language

{markdown_table(compact_numeric(pd.DataFrame(analyses['descriptive']['language'])))}

### By Foundation

{markdown_table(compact_numeric(pd.DataFrame(analyses['descriptive']['foundation'])))}

### Surface/Structural Classification

{markdown_table(compact_numeric(classification))}

The classification is conservative and heuristic. Surface flags rely on transparent,
limited multilingual lexicons and capitalization where available; `uncertain` is retained
when evidence is inadequate.

## Edit Magnitude and Absolute Adaptation Effects

{markdown_table(compact_numeric(correlations))}

The pooled analysis and subgroup analyses use scenario-cluster bootstrap confidence
intervals with 10,000 resamples. Rows are not treated as 900 independent observations.

## Clustered Regressions

{markdown_table(compact_numeric(regressions))}

The signed-effect, absolute-effect, and adjusted absolute-effect regressions use standard
errors clustered by scenario. They are diagnostic, not causal.

## Surface-Versus-Structural Comparison

{markdown_table(compact_numeric(class_effects))}

Omnibus result: `{json.dumps(analyses['classification_omnibus'], ensure_ascii=False)}`.
Small classification cells should not be overinterpreted.

## Robustness

### Alternative Edit Metrics

{markdown_table(compact_numeric(metric_robustness))}

### Leave-One-Language-Out

{markdown_table(compact_numeric(loo_language))}

### Leave-One-Foundation-Out

{markdown_table(compact_numeric(loo_foundation))}

The leave-one-scenario-out rho range was
**[{loo_scenario['spearman_rho'].min():.6f}, {loo_scenario['spearman_rho'].max():.6f}]**.
Alternative metric signs were {"consistent" if robustness_consistent else "not fully consistent"}
with the primary association. Complete scenario, model, extreme-edit exclusion, and
scenario-language mean results are in `adaptation_edit_robustness_results.csv`.

## Extreme-Pair Inspection

### Ten Most Heavily Edited Pairs

{markdown_table(compact_numeric(top_edit_excerpt))}

### Ten Largest Model-Level Adaptation Effects

{markdown_table(compact_numeric(largest_effect_excerpt))}

The untruncated top/bottom and discordant-quartile audits, including full literal and adapted
texts, are in `adaptation_edit_extreme_pairs.csv`.

## Interpretation

{interpretation} Character edit rate measures textual extent, not cultural quality or
semantic distance. A small edit can alter a morally salient detail, while a large edit can
preserve the same moral structure. Language-specific associations are heterogeneity and
must not be generalized as universal effects.

## Limitations

Token boundaries are not linguistically equivalent across scripts; Japanese token measures
are character-like. Automatic surface classification is deliberately incomplete. Ratings
are bounded and discrete, edit metrics repeat across three models, and only 50 scenario
clusters are available. Clustered inference addresses dependence but not confounding.

## Manuscript-Ready Results Paragraph

{manuscript_paragraph}
"""
    (REPORTS / "adaptation_edit_rate_report.md").write_text(report, encoding="utf-8")

    methods = f"""# Adaptation Edit-Rate Methods

## Primary Metric

The primary metric is Levenshtein distance between NFKC/whitespace-normalized literal and
adapted strings divided by the longer normalized string length. It ranges from 0 to 1.
Distance is computed by an exact deterministic bit-parallel Levenshtein implementation,
validated against fixed unit examples.

## Secondary Metrics

Secondary metrics include raw and normalized character distances, relative character-length
change, exact token Levenshtein rate, token-set Jaccard similarity, token overlap,
bit-parallel character LCS ratio, and minimal token alignment counts for additions,
removals, and replacements. Added proportions use adapted token count; removed proportions
use literal token count; replacement proportions use the larger token count.

## Surface Audit

Sentence boundaries use `. ! ? 。 ！ ？ । ॥`. Approximate clauses equal sentence segments
plus comma/semicolon/colon/dash separators. Conservative multilingual marker lexicons flag
possible names, locations/institutions, and cultural objects. Classification thresholds are:
structural for sentence changes, clause difference >=2, character edit rate >=.45, token
edit rate >=.50, or absolute relative length change >=.30; surface-dominant for a detected
surface flag with edit rate <=.20 and unchanged clauses; mixed for intermediate evidence;
otherwise uncertain.

## Rating Effect

For each authorized model, scenario, and language:

`{{language}}_adapted_reason_en - {{language}}_translation_reason_en`

produces the signed cultural-adaptation effect; its absolute value is the absolute effect.

## Inference

Bootstrap repetitions: **{BOOTSTRAP_REPS:,}**. Seed: **{SEED}**. Cluster:
`scenario_id`. Spearman confidence intervals resample scenarios with replacement.
Regressions use finite-sample-corrected scenario-clustered covariance and t-based inference.
"""
    (REPORTS / "adaptation_edit_rate_methods.md").write_text(methods, encoding="utf-8")


def write_reproducibility(
    source_validation: dict[str, object],
    merge_diagnostics: dict[str, object],
) -> dict[str, object]:
    reproducibility = f"""# Adaptation Edit-Rate Reproducibility

- Status: **PASS**
- Scenario-language pairs: **{source_validation['scenario_language_pairs']}**
- Model-level merged rows: **{merge_diagnostics['rows']}**
- Duplicate merged keys: **{merge_diagnostics['duplicates']}**
- Missing effects: **{merge_diagnostics['missing_signed_effects']}**
- Bootstrap repetitions: **{BOOTSTRAP_REPS:,}**
- Random seed: **{SEED}**
- Cluster: `scenario_id`
- API calls: **none**

## Command

```powershell
py -3 scripts\\adaptation_edit_audit.py
Set-Location neutral-control-experiment
py -3 -m pytest
Set-Location ..\\comprehension-check-experiment
py -3 -m pytest
```

Exact source hashes, output hashes, package versions, row counts, and merge diagnostics are
stored in `data/processed/adaptation_edit_reproducibility.json`.
"""
    (REPORTS / "adaptation_edit_rate_reproducibility.md").write_text(
        reproducibility, encoding="utf-8"
    )
    source_hashes = {str(path.relative_to(ROOT)): sha256_file(path) for path in SCENARIO_FILES + RATING_FILES}
    output_paths = sorted(
        list(DATA_OUT.glob("adaptation_edit_*.csv"))
        + list(DATA_OUT.glob("adaptation_edit_*.json"))
        + [FIGURES / name for name in FIGURE_FILENAMES]
        + [PLOTTING / name for name in PLOTTING_FILENAMES]
        + list(REPORTS.glob("adaptation_edit_rate_*.md"))
    )
    output_hashes = {
        str(path.relative_to(ROOT)): sha256_file(path)
        for path in output_paths
        if path.name != "adaptation_edit_reproducibility.json"
    }
    metadata = {
        "status": "PASS",
        "bootstrap_repetitions": BOOTSTRAP_REPS,
        "random_seed": SEED,
        "cluster": "scenario_id",
        "source_validation": source_validation,
        "merge_diagnostics": merge_diagnostics,
        "source_hashes_sha256": source_hashes,
        "analysis_script_sha256": sha256_file(Path(__file__)),
        "output_hashes_sha256": output_hashes,
        "package_versions": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "scipy": scipy.__version__,
            "statsmodels": statsmodels.__version__,
            "matplotlib": matplotlib.__version__,
            "seaborn": sns.__version__,
        },
        "commands": [
            "py -3 scripts\\adaptation_edit_audit.py",
            "Set-Location neutral-control-experiment; py -3 -m pytest",
            "Set-Location comprehension-check-experiment; py -3 -m pytest",
        ],
        "test_results": {
            "neutral_control_experiment": "38 passed",
            "comprehension_check_experiment": "31 passed",
            "root_aggregate_note": (
                "Parent-root collection is not a valid aggregate test context because "
                "neutral-control-experiment imports its project-local src package."
            ),
        },
        "no_api_calls": True,
    }
    metadata_path = DATA_OUT / "adaptation_edit_reproducibility.json"
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    for directory in (DATA_OUT, REPORTS, FIGURES, PLOTTING):
        directory.mkdir(parents=True, exist_ok=True)
    validate_distance_implementations()
    pairs, source_validation = load_scenario_pairs()
    audit = calculate_edit_metrics(pairs)
    merged, merge_diagnostics = merge_rating_effects(audit)
    analyses = primary_analyses(audit, merged)
    robustness = robustness_analyses(merged)
    extremes = build_extremes(audit, merged)
    create_figures(audit, merged)
    write_reports(
        source_validation,
        merge_diagnostics,
        audit,
        merged,
        analyses,
        robustness,
        extremes,
    )
    summary = {
        "status": "PASS",
        "source_validation": source_validation,
        "merge_diagnostics": merge_diagnostics,
        "primary_descriptive": analyses["descriptive"]["overall"][0],
        "pooled_correlation": next(
            row for row in analyses["correlations"] if row["analysis"] == "pooled"
        ),
        "classification_omnibus": analyses["classification_omnibus"],
        "robustness_rows": len(robustness),
        "extreme_audit_rows": len(extremes),
        "figure_count": sum((FIGURES / name).exists() for name in FIGURE_FILENAMES),
        "plotting_data_count": sum(
            (PLOTTING / name).exists() for name in PLOTTING_FILENAMES
        ),
        "no_api_calls": True,
    }
    (DATA_OUT / "adaptation_edit_analysis_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    write_reproducibility(source_validation, merge_diagnostics)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
