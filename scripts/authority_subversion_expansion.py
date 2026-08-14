from __future__ import annotations

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
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"
PROCESSED = ROOT / "results" / "processed"
PLOTTING = ROOT / "results" / "plotting_data"
FIGURES = ROOT / "results" / "figures"

QUALITATIVE_SOURCE = PROCESSED / "full_merged_with_human_mft_codes.csv"
VALIDATION_SOURCE = (
    PROCESSED
    / "scenario_validation_trial2"
    / "scenario_validation_merged_3coders.csv"
)
MANUSCRIPT_REFERENCE = ROOT / "phase1_evidence_report_provenance.md"
LEGACY_BREAKDOWN = (
    PROCESSED / "phase1_final_evidence" / "s11_s30_breakdowns.csv"
)

SCENARIOS = ["S11", "S30"]
FOUNDATIONS = [
    "Care/Harm",
    "Loyalty/Betrayal",
    "Authority/Subversion",
    "Fairness/Cheating",
    "Sanctity/Degradation",
]
FOUNDATION_COLORS = {
    "Care/Harm": "#C8584A",
    "Loyalty/Betrayal": "#356A9A",
    "Authority/Subversion": "#6B5B95",
    "Fairness/Cheating": "#D68A2D",
    "Sanctity/Degradation": "#3F8F72",
}
MODEL_LABELS = {
    "chatgpt": "GPT-4o",
    "claude": "Claude Sonnet 4.6",
    "gemini_flash": "Gemini 3.5 Flash",
    "gemini_pro": "Gemini 3.1 Pro",
}
LANGUAGE_LABELS = {
    "en": "English",
    "hi": "Hindi",
    "bn": "Bengali",
    "ta": "Tamil",
    "es": "Spanish",
    "ja": "Japanese",
    "ar": "Arabic",
}

# Terms are matched in NFKC/case-folded raw explanations. Latin-script terms use
# token boundaries; terms in other scripts use literal substring matching.
# These dictionaries supplement, and never replace, the adjudicated human labels.
THEME_TERMS = {
    "authority_core": {
        "en": [
            "authority",
            "hierarchy",
            "hierarchical",
            "obedience",
            "obey",
            "disobey",
            "disobedience",
            "command",
            "chain of command",
            "rank",
            "supervisor",
            "leader",
            "institutional order",
            "legitimate command",
            "respect for his father",
            "respect for her father",
            "subversion",
        ],
        "hi": [
            "अधिकार",
            "प्राधिकरण",
            "पदानुक्रम",
            "आज्ञा",
            "आदेश",
            "अवज्ञा",
            "पर्यवेक्षक",
            "वरिष्ठ",
            "संस्थागत",
            "अनुशासन",
        ],
        "bn": [
            "কর্তৃপক্ষ",
            "পদানুক্রম",
            "আনুগত্য",
            "অবাধ্য",
            "আদেশ",
            "তত্ত্বাবধায়ক",
            "ঊর্ধ্বতন",
            "প্রাতিষ্ঠানিক",
            "শৃঙ্খলা",
        ],
        "ta": [
            "அதிகார",
            "படிநிலை",
            "கீழ்ப்படி",
            "கட்டளை",
            "மேற்பார்வையாளர்",
            "மேலதிகாரி",
            "நிறுவன",
            "ஒழுங்கு",
        ],
        "es": [
            "autoridad",
            "jerarquía",
            "obediencia",
            "obedecer",
            "desobedecer",
            "desobediencia",
            "mando",
            "cadena de mando",
            "rango",
            "supervisor",
            "superior",
            "orden institucional",
            "subversión",
        ],
        "ja": [
            "権威",
            "権限",
            "階層",
            "服従",
            "従う",
            "従わ",
            "命令",
            "上司",
            "監督者",
            "指揮",
            "組織秩序",
            "反抗",
        ],
        "ar": [
            "سلطة",
            "السلطة",
            "تسلسل هرمي",
            "طاعة",
            "عصيان",
            "أمر",
            "أوامر",
            "مشرف",
            "المشرف",
            "رئيس",
            "قيادة",
            "رتبة",
            "مؤسسي",
            "تمرد",
        ],
    },
    "authority_rule_obligation": {
        "en": [
            "duty",
            "obligation",
            "mandatory",
            "rule",
            "rules",
            "instruction",
            "instructions",
            "protocol",
            "protocols",
            "regulation",
            "regulations",
            "established procedure",
            "follow established",
            "role responsibility",
            "ethical responsibility",
            "ethical responsibilities",
            "workplace responsibility",
            "workplace responsibilities",
        ],
        "hi": [
            "कर्तव्य",
            "दायित्व",
            "अनिवार्य",
            "नियम",
            "मानक",
            "निर्देश",
            "प्रोटोकॉल",
            "विनियम",
            "पालन",
            "उल्लंघन",
        ],
        "bn": [
            "কর্তব্য",
            "দায়িত্ব",
            "বাধ্যবাধকতা",
            "বাধ্যতামূলক",
            "নিয়ম",
            "নির্দেশ",
            "প্রোটোকল",
            "বিধি",
            "মান্য",
            "লঙ্ঘন",
        ],
        "ta": [
            "கடமை",
            "பொறுப்பு",
            "கட்டாய",
            "விதி",
            "அறிவுறுத்தல்",
            "நெறிமுறை",
            "ஒழுங்குமுறை",
            "பின்பற்ற",
            "மீற",
        ],
        "es": [
            "deber",
            "obligación",
            "obligatorio",
            "obligatoria",
            "norma",
            "normas",
            "regla",
            "reglas",
            "reglamento",
            "reglamentos",
            "instrucción",
            "instrucciones",
            "protocolo",
            "regulación",
            "procedimiento establecido",
            "cumplir",
            "incumplir",
        ],
        "ja": [
            "義務",
            "責務",
            "必須",
            "規則",
            "ルール",
            "指示",
            "プロトコル",
            "規制",
            "手順",
            "従守",
            "遵守",
            "違反",
        ],
        "ar": [
            "واجب",
            "التزام",
            "إلزامي",
            "إلزامية",
            "قاعدة",
            "قواعد",
            "تعليمات",
            "بروتوكول",
            "لوائح",
            "إجراءات",
            "امتثال",
            "اتباع",
            "انتهاك",
        ],
    },
    "care_harm": {
        "en": [
            "harm",
            "hurt",
            "suffering",
            "danger",
            "dangerous",
            "safety",
            "unsafe",
            "injury",
            "injured",
            "well-being",
            "wellbeing",
            "neglect",
            "consequence",
            "consequences",
            "vulnerable",
            "protection",
            "protect",
            "risk",
            "at risk",
            "feelings",
            "emotional",
            "embarrass",
            "humiliat",
            "distress",
            "pain",
        ],
        "hi": [
            "हानि",
            "नुकसान",
            "चोट",
            "पीड़ा",
            "खतरा",
            "जोखिम",
            "सुरक्षा",
            "असुरक्षित",
            "कल्याण",
            "भलाई",
            "उपेक्षा",
            "परिणाम",
            "कमजोर",
            "संरक्षण",
            "भावना",
            "अपमान",
            "शर्मिंदा",
            "दर्द",
        ],
        "bn": [
            "ক্ষতি",
            "আঘাত",
            "কষ্ট",
            "বিপদ",
            "ঝুঁকি",
            "নিরাপত্তা",
            "অনিরাপদ",
            "কল্যাণ",
            "অবহেলা",
            "পরিণতি",
            "দুর্বল",
            "সুরক্ষা",
            "অনুভূতি",
            "অপমান",
            "লজ্জা",
            "ব্যথা",
        ],
        "ta": [
            "தீங்கு",
            "பாதிப்பு",
            "காயம்",
            "துன்பம்",
            "ஆபத்து",
            "அபாயம்",
            "பாதுகாப்பு",
            "நலன்",
            "புறக்கணிப்பு",
            "விளைவு",
            "பலவீன",
            "பாதுகாக்க",
            "உணர்வு",
            "அவமான",
            "வலி",
        ],
        "es": [
            "daño",
            "perjuicio",
            "herir",
            "sufrimiento",
            "peligro",
            "peligroso",
            "riesgo",
            "seguridad",
            "inseguro",
            "lesión",
            "bienestar",
            "negligencia",
            "consecuencia",
            "vulnerable",
            "protección",
            "proteger",
            "sentimientos",
            "emocional",
            "avergonz",
            "humill",
            "dolor",
        ],
        "ja": [
            "害",
            "傷",
            "苦痛",
            "苦し",
            "危険",
            "リスク",
            "安全",
            "負傷",
            "福祉",
            "幸福",
            "怠慢",
            "結果",
            "脆弱",
            "保護",
            "守る",
            "感情",
            "恥",
            "屈辱",
            "痛み",
        ],
        "ar": [
            "ضرر",
            "أذى",
            "إيذاء",
            "معاناة",
            "خطر",
            "مخاطر",
            "سلامة",
            "أمان",
            "إصابة",
            "رفاه",
            "إهمال",
            "عواقب",
            "ضعف",
            "حماية",
            "مشاعر",
            "عاطفي",
            "إحراج",
            "إهانة",
            "ألم",
        ],
    },
    "loyalty_betrayal": {
        "en": [
            "loyalty",
            "loyal",
            "betray",
            "betrayal",
            "trust",
            "deception",
            "deceive",
            "deceived",
            "dishonesty",
            "dishonest",
            "lie",
            "lied",
            "lying",
            "gratitude",
            "grateful",
            "allegiance",
            "abandon",
            "commitment",
            "relationship obligation",
            "family obligation",
            "familial obligation",
            "sacrifice",
            "sacrifices",
            "expectation",
            "expectations",
            "let his father down",
            "let her father down",
        ],
        "hi": [
            "निष्ठा",
            "वफादारी",
            "विश्वासघात",
            "भरोसा",
            "विश्वास",
            "झूठ",
            "धोखा",
            "कृतज्ञ",
            "आभार",
            "त्याग",
            "प्रतिबद्धता",
            "परिवारिक दायित्व",
            "पारिवारिक दायित्व",
            "बलिदान",
            "अपेक्षा",
            "उम्मीद",
        ],
        "bn": [
            "আনুগত্য",
            "বিশ্বস্ততা",
            "বিশ্বাসঘাতকতা",
            "বিশ্বাস",
            "মিথ্যা",
            "প্রতারণা",
            "কৃতজ্ঞ",
            "কৃতজ্ঞতা",
            "ত্যাগ",
            "অঙ্গীকার",
            "পারিবারিক দায়িত্ব",
            "বলিদান",
            "প্রত্যাশা",
            "আশা",
        ],
        "ta": [
            "விசுவாசம்",
            "துரோகம்",
            "நம்பிக்கை",
            "பொய்",
            "ஏமாற்ற",
            "நன்றியுணர்வு",
            "கைவிட",
            "உறுதிப்பாடு",
            "குடும்பக் கடமை",
            "தியாகம்",
            "எதிர்பார்ப்பு",
        ],
        "es": [
            "lealtad",
            "leal",
            "traición",
            "traicionar",
            "confianza",
            "engaño",
            "engañar",
            "mentira",
            "gratitud",
            "agradecimiento",
            "abandono",
            "abandonar",
            "compromiso",
            "obligación familiar",
            "sacrificio",
            "expectativa",
            "expectativas",
            "decepcionar a su padre",
        ],
        "ja": [
            "忠誠",
            "忠実",
            "裏切",
            "信頼",
            "嘘",
            "欺",
            "感謝",
            "恩",
            "放棄",
            "見捨て",
            "約束",
            "家族の義務",
            "犠牲",
            "期待",
        ],
        "ar": [
            "ولاء",
            "وفي",
            "خيانة",
            "ثقة",
            "كذب",
            "خداع",
            "امتنان",
            "عرفان",
            "تخلي",
            "هجر",
            "التزام عائلي",
            "تضحية",
            "تضحيات",
            "توقع",
            "توقعات",
        ],
    },
}

SCENARIO_NOTES = {
    "S11": (
        "A father-son hierarchy is present, but sacrifice, expectations, public embarrassment, "
        "and filial relationship obligations make Care/Harm and Loyalty/Betrayal highly plausible."
    ),
    "S12": (
        "The junior-supervisor hierarchy and bypassed private consultation are explicit, while "
        "evidence of patient delays supplies a competing Care/Harm justification."
    ),
    "S13": (
        "Refusal of an elder-led blessing blends hierarchy, family relationship, and sacred "
        "ritual cues; the three coders selected three different foundations."
    ),
    "S14": (
        "Parental consultation and filial duty are indirect authority cues, but dependency, "
        "illness, and foreseeable distress foreground Care/Harm."
    ),
    "S15": (
        "Mentorship and status create authority cues, but truthful testimony pits loyalty to a "
        "mentor against fairness and accountability."
    ),
    "S30": (
        "A mandatory institutional safety rule is the authority relationship; the same wording "
        "makes concrete danger and preventable harm immediately salient."
    ),
    "S33": (
        "A laboratory assistant explicitly ignores a supervisor's instructions, with no stated "
        "injury; this is a comparatively clean hierarchy and obedience item."
    ),
    "S38": (
        "Repeated rule-breaking indicates subversion, while laboratory safety makes potential "
        "harm a direct competing interpretation."
    ),
    "S43": (
        "An incident commander's evacuation order during an emergency supplies explicit rank, "
        "command legitimacy, and obedience cues."
    ),
    "S48": (
        "A lawful order from a senior police officer explicitly encodes rank, legitimacy, and "
        "obedience, making this a clean authority item."
    ),
}

SCENARIO_CUES = {
    "S11": {
        "moral_actors": "Arjun and his father",
        "authority_cues": (
            "Parent-child hierarchy, filial duty, deference to a father, and public disrespect "
            "during the father's retirement celebration."
        ),
        "care_harm_cues": (
            "Foreseeable emotional hurt, humiliation, distress, and the father's silent response."
        ),
        "loyalty_betrayal_cues": (
            "Three years of deception, the father's sacrifices, trust, gratitude, family "
            "expectations, and an implied relationship obligation."
        ),
        "fairness_cues": (
            "A possible reciprocity concern follows from accepting educational support while "
            "concealing plans, but distributive or procedural unfairness is not central."
        ),
        "sanctity_cues": (
            "The family celebration has symbolic importance, but no purity, sacredness, or "
            "degradation cue is explicit."
        ),
        "isolation_judgment": (
            "No. Authority is plausible, but betrayal, reciprocity, and emotional-harm cues are "
            "at least as salient; the three scenario coders did not converge on Authority."
        ),
    },
    "S30": {
        "moral_actors": "An employee, coworkers or others exposed to risk, and the institution represented by its mandatory rule",
        "authority_cues": (
            "A mandatory institutional rule creates an explicit compliance obligation; ignoring "
            "it is direct rule defiance."
        ),
        "care_harm_cues": (
            "The rule is explicitly about safety, making danger, injury, preventable harm, and "
            "protection immediately available rationales."
        ),
        "loyalty_betrayal_cues": (
            "Workplace trust or commitment can be inferred, but no personal group betrayal is "
            "stated."
        ),
        "fairness_cues": (
            "The employee may externalize risk or gain a speed advantage, but unequal allocation "
            "and cheating are not explicit."
        ),
        "sanctity_cues": "No purity, sacredness, or degradation cue is present.",
        "isolation_judgment": (
            "Comparatively clean, not pure. The authority relation is explicit and human-validated, "
            "but the word 'safety' simultaneously supplies a strong Care/Harm cue."
        ),
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def normalized_text(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value)).strip().casefold()


def term_matches(text: str, language: str, terms: list[str]) -> list[str]:
    found = []
    for term in terms:
        normalized_term = normalized_text(term)
        if language in {"en", "es"} and re.fullmatch(r"[\w -]+", normalized_term):
            pattern = rf"(?<!\w){re.escape(normalized_term)}"
            if normalized_term[-1].isalnum():
                pattern += r"(?!\w)"
            matched = re.search(pattern, text, flags=re.UNICODE) is not None
        else:
            matched = normalized_term in text
        if matched:
            found.append(term)
    return found


def condition_type(row: pd.Series) -> str:
    if row["conditionId"] == "en_en":
        return "English baseline"
    framing = "Literal" if row["scenarioVersion"] == "translation" else "Adapted"
    response = "English response" if row["reasoningLang"] == "en" else "Same-language response"
    return f"{framing}, {response}"


def response_instruction(row: pd.Series) -> str:
    if row["conditionId"] == "en_en":
        return "English baseline"
    return "English response" if row["reasoningLang"] == "en" else "Same-language response"


def framing(row: pd.Series) -> str:
    if row["conditionId"] == "en_en":
        return "English baseline"
    return "Literal" if row["scenarioVersion"] == "translation" else "Adapted"


def load_sources() -> tuple[pd.DataFrame, pd.DataFrame, dict[str, object]]:
    qualitative = pd.read_csv(QUALITATIVE_SOURCE, low_memory=False)
    qualitative = qualitative[
        qualitative["scenarioId"].isin(SCENARIOS)
        & qualitative["ai_mft_final_label"].notna()
        & qualitative["taskType"].eq("qualitative")
    ].copy()
    qualitative = qualitative.rename(
        columns={
            "scenarioId": "scenario_id",
            "ai_mft_final_label": "human_adjudicated_foundation",
            "rawOutput": "explanation_raw",
        }
    )
    qualitative["model"] = qualitative["modelKey"].map(MODEL_LABELS)
    qualitative["input_language"] = qualitative["inputLang"].map(LANGUAGE_LABELS)
    qualitative["reasoning_language"] = qualitative["reasoningLang"].map(LANGUAGE_LABELS)
    qualitative["condition_type"] = qualitative.apply(condition_type, axis=1)
    qualitative["response_instruction"] = qualitative.apply(response_instruction, axis=1)
    qualitative["framing"] = qualitative.apply(framing, axis=1)

    validation = pd.read_csv(VALIDATION_SOURCE)
    validation["all_three_disagree"] = (
        validation["all_three_disagree"].astype(str).str.casefold().eq("true")
    )

    diagnostics = {
        "qualitative_rows": len(qualitative),
        "scenario_counts": qualitative["scenario_id"].value_counts().sort_index().to_dict(),
        "unique_response_ids": qualitative["response_id"].nunique(),
        "models_per_scenario": {
            scenario: qualitative.loc[
                qualitative["scenario_id"].eq(scenario), "modelKey"
            ].value_counts().sort_index().to_dict()
            for scenario in SCENARIOS
        },
        "conditions_per_scenario": {
            scenario: qualitative.loc[
                qualitative["scenario_id"].eq(scenario), "conditionId"
            ].nunique()
            for scenario in SCENARIOS
        },
        "input_languages_per_scenario": {
            scenario: qualitative.loc[
                qualitative["scenario_id"].eq(scenario), "inputLang"
            ].value_counts().sort_index().to_dict()
            for scenario in SCENARIOS
        },
        "model_condition_cells_complete": {},
    }
    if len(qualitative) != 200 or qualitative["response_id"].nunique() != 200:
        raise RuntimeError("Expected exactly 200 unique S11/S30 explanations")
    if diagnostics["scenario_counts"] != {"S11": 100, "S30": 100}:
        raise RuntimeError("S11 and S30 must each contain exactly 100 explanations")
    for scenario in SCENARIOS:
        if diagnostics["models_per_scenario"][scenario] != {
            key: 25 for key in sorted(MODEL_LABELS)
        }:
            raise RuntimeError(f"Model cells are incomplete for {scenario}")
        if diagnostics["conditions_per_scenario"][scenario] != 25:
            raise RuntimeError(f"Condition cells are incomplete for {scenario}")
        scenario_rows = qualitative[qualitative["scenario_id"].eq(scenario)]
        model_condition = scenario_rows.groupby(["modelKey", "conditionId"]).size()
        diagnostics["model_condition_cells_complete"][scenario] = bool(
            len(model_condition) == 100 and model_condition.eq(1).all()
        )
        if not diagnostics["model_condition_cells_complete"][scenario]:
            raise RuntimeError(f"Model-by-condition cells are incomplete for {scenario}")
        expected_languages = {
            "ar": 16,
            "bn": 16,
            "en": 4,
            "es": 16,
            "hi": 16,
            "ja": 16,
            "ta": 16,
        }
        if diagnostics["input_languages_per_scenario"][scenario] != expected_languages:
            raise RuntimeError(f"Input-language cells are incomplete for {scenario}")
    distributions = {
        scenario: qualitative.loc[
            qualitative["scenario_id"].eq(scenario),
            "human_adjudicated_foundation",
        ].value_counts().to_dict()
        for scenario in SCENARIOS
    }
    if distributions["S11"] != {
        "Loyalty/Betrayal": 86,
        "Authority/Subversion": 13,
        "Care/Harm": 1,
    }:
        raise RuntimeError(f"S11 distribution failed to reproduce: {distributions['S11']}")
    if distributions["S30"] != {"Care/Harm": 100}:
        raise RuntimeError(f"S30 distribution failed to reproduce: {distributions['S30']}")
    diagnostics["label_distributions"] = distributions
    diagnostics["authority_invocations"] = int(
        qualitative["human_adjudicated_foundation"].eq("Authority/Subversion").sum()
    )
    if diagnostics["authority_invocations"] != 13:
        raise RuntimeError("Expected exactly 13 Authority/Subversion labels in 200 rows")
    return qualitative, validation, diagnostics


def build_explanation_breakdown(qualitative: pd.DataFrame) -> pd.DataFrame:
    columns = [
        "response_id",
        "scenario_id",
        "modelKey",
        "model",
        "inputLang",
        "input_language",
        "reasoningLang",
        "reasoning_language",
        "conditionId",
        "condition_type",
        "framing",
        "response_instruction",
        "scenarioVersion",
        "human_adjudicated_foundation",
        "explanation_raw",
    ]
    output = qualitative[columns].sort_values(["scenario_id", "response_id"]).copy()
    output.to_csv(
        PROCESSED / "authority_s11_s30_breakdown.csv",
        index=False,
        encoding="utf-8-sig",
    )
    return output


def aggregate_distribution(
    qualitative: pd.DataFrame, dimension: str, value_column: str
) -> list[dict[str, object]]:
    rows = []
    for scenario in SCENARIOS:
        scenario_frame = qualitative[qualitative["scenario_id"].eq(scenario)]
        for group_value, group in scenario_frame.groupby(value_column, dropna=False):
            counts = group["human_adjudicated_foundation"].value_counts()
            for foundation in FOUNDATIONS:
                count = int(counts.get(foundation, 0))
                rows.append(
                    {
                        "scenario_id": scenario,
                        "dimension": dimension,
                        "group_value": group_value,
                        "foundation": foundation,
                        "count": count,
                        "denominator": len(group),
                        "percentage": count / len(group) * 100,
                    }
                )
    return rows


def build_condition_breakdowns(qualitative: pd.DataFrame) -> pd.DataFrame:
    rows = []
    overall = qualitative.assign(overall="Overall")
    for dimension, column in [
        ("overall", "overall"),
        ("model", "model"),
        ("input_language", "input_language"),
        ("framing", "framing"),
        ("response_instruction", "response_instruction"),
        ("condition_type", "condition_type"),
        ("condition_id", "conditionId"),
    ]:
        rows.extend(aggregate_distribution(overall, dimension, column))
    output = pd.DataFrame(rows)
    output.to_csv(
        PROCESSED / "authority_condition_breakdowns.csv",
        index=False,
        encoding="utf-8-sig",
    )
    return output


def build_theme_audit(qualitative: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for item in qualitative.itertuples(index=False):
        text = normalized_text(item.explanation_raw)
        language = item.reasoningLang
        matches = {}
        for theme, language_terms in THEME_TERMS.items():
            matches[theme] = term_matches(text, language, language_terms[language])
        authority_any = bool(matches["authority_core"] or matches["authority_rule_obligation"])
        care = bool(matches["care_harm"])
        loyalty = bool(matches["loyalty_betrayal"])
        active = [
            name
            for name, value in [
                ("Authority/Subversion", authority_any),
                ("Care/Harm", care),
                ("Loyalty/Betrayal", loyalty),
            ]
            if value
        ]
        rows.append(
            {
                "response_id": item.response_id,
                "scenario_id": item.scenario_id,
                "model": item.model,
                "input_language": item.input_language,
                "reasoning_language": item.reasoning_language,
                "condition_id": item.conditionId,
                "condition_type": item.condition_type,
                "framing": item.framing,
                "response_instruction": item.response_instruction,
                "human_adjudicated_foundation": item.human_adjudicated_foundation,
                "explanation_raw": item.explanation_raw,
                "analysis_text_source": (
                    "raw English explanation"
                    if language == "en"
                    else f"raw {item.reasoning_language} explanation; multilingual dictionary"
                ),
                "authority_core_explicit": bool(matches["authority_core"]),
                "authority_core_terms": " | ".join(matches["authority_core"]),
                "authority_rule_or_obligation": bool(matches["authority_rule_obligation"]),
                "authority_rule_terms": " | ".join(matches["authority_rule_obligation"]),
                "authority_theme_any": authority_any,
                "care_harm_theme": care,
                "care_harm_terms": " | ".join(matches["care_harm"]),
                "loyalty_betrayal_theme": loyalty,
                "loyalty_betrayal_terms": " | ".join(matches["loyalty_betrayal"]),
                "theme_count": len(active),
                "theme_cooccurrence": " + ".join(active) if active else "No dictionary match",
                "manual_audit_status": "included in matched/unmatched review",
                "false_positive_caution": (
                    "Rule, duty, responsibility, safety, sacrifice, and expectation terms can "
                    "describe facts without endorsing the corresponding foundation."
                ),
            }
        )
    output = pd.DataFrame(rows).sort_values(["scenario_id", "response_id"])
    output.to_csv(
        PROCESSED / "authority_theme_audit.csv",
        index=False,
        encoding="utf-8-sig",
    )
    return output


def agreement_pattern(row: pd.Series) -> str:
    labels = [row["Coder_A_label"], row["Coder_B_label"], row["Coder_C_label"]]
    if row["all_three_disagree"]:
        return "All three disagree; unresolved"
    if len(set(labels)) == 1:
        return (
            "Unanimous intended"
            if labels[0] == row["intended_mft_foundation"]
            else "Unanimous competing"
        )
    return (
        "Majority intended"
        if row["majority_vote_label"] == row["intended_mft_foundation"]
        else "Majority competing"
    )


def build_validation_table(validation: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    authority = validation[
        validation["intended_mft_foundation"].eq("Authority/Subversion")
    ].copy()
    authority["majority_resolved"] = ~authority["all_three_disagree"]
    authority["agreement_pattern"] = authority.apply(agreement_pattern, axis=1)
    authority["competing_foundation"] = authority.apply(
        lambda row: (
            ""
            if row["majority_vote_label"] == row["intended_mft_foundation"]
            else (
                "Unresolved: "
                + " / ".join(
                    [
                        row["Coder_A_label"],
                        row["Coder_B_label"],
                        row["Coder_C_label"],
                    ]
                )
                if row["all_three_disagree"]
                else row["majority_vote_label"]
            )
        ),
        axis=1,
    )
    authority["interpretive_note"] = authority["scenario_id"].map(SCENARIO_NOTES)
    columns = [
        "scenario_id",
        "scenario_text_en",
        "intended_mft_foundation",
        "Coder_A_label",
        "Coder_B_label",
        "Coder_C_label",
        "majority_vote_label",
        "majority_resolved",
        "agreement_pattern",
        "majority_matches_intended",
        "competing_foundation",
        "interpretive_note",
    ]
    output = authority[columns].sort_values("scenario_id")
    output.to_csv(
        PROCESSED / "authority_all_scenarios_validation.csv",
        index=False,
        encoding="utf-8-sig",
    )

    context_rows = []
    for intended, group in validation.groupby("intended_mft_foundation"):
        retained = int(group["majority_vote_label"].eq(intended).sum())
        unresolved = int(group["all_three_disagree"].sum())
        resolved_shifts = group[
            ~group["all_three_disagree"] & group["majority_vote_label"].ne(intended)
        ]
        adjacent = resolved_shifts[
            resolved_shifts["majority_vote_label"].isin(
                ["Care/Harm", "Loyalty/Betrayal"]
            )
        ]
        context_rows.append(
            {
                "intended_foundation": intended,
                "n": len(group),
                "retained_intended": retained,
                "validation_rate": retained / len(group),
                "resolved_competing_majority": len(resolved_shifts),
                "unresolved": unresolved,
                "resolved_shift_to_care": int(
                    resolved_shifts["majority_vote_label"].eq("Care/Harm").sum()
                ),
                "resolved_shift_to_loyalty": int(
                    resolved_shifts["majority_vote_label"].eq("Loyalty/Betrayal").sum()
                ),
                "resolved_shift_to_adjacent_relational": len(adjacent),
            }
        )
    context = pd.DataFrame(context_rows).sort_values("validation_rate")
    context.to_csv(
        PROCESSED / "authority_foundation_validation_context.csv",
        index=False,
        encoding="utf-8-sig",
    )
    return output, context


def theme_counts(
    themes: pd.DataFrame, dimension: str, column: str
) -> pd.DataFrame:
    rows = []
    for scenario in SCENARIOS:
        subset = themes[themes["scenario_id"].eq(scenario)]
        for value, group in subset.groupby(column):
            for theme in [
                "authority_core_explicit",
                "authority_rule_or_obligation",
                "authority_theme_any",
                "care_harm_theme",
                "loyalty_betrayal_theme",
            ]:
                count = int(group[theme].sum())
                rows.append(
                    {
                        "scenario_id": scenario,
                        "dimension": dimension,
                        "group_value": value,
                        "theme": theme,
                        "count": count,
                        "denominator": len(group),
                        "percentage": count / len(group) * 100,
                    }
                )
    return pd.DataFrame(rows)


def build_theme_summaries(themes: pd.DataFrame) -> pd.DataFrame:
    work = themes.assign(overall="Overall")
    summaries = pd.concat(
        [
            theme_counts(work, "overall", "overall"),
            theme_counts(work, "model", "model"),
            theme_counts(work, "input_language", "input_language"),
            theme_counts(work, "condition_type", "condition_type"),
        ],
        ignore_index=True,
    )
    summaries.to_csv(
        PROCESSED / "authority_theme_counts.csv",
        index=False,
        encoding="utf-8-sig",
    )
    cooccurrence = (
        themes.groupby(["scenario_id", "theme_cooccurrence"], as_index=False)
        .size()
        .rename(columns={"size": "count"})
    )
    cooccurrence["denominator"] = cooccurrence["scenario_id"].map(
        themes["scenario_id"].value_counts()
    )
    cooccurrence["percentage"] = (
        cooccurrence["count"] / cooccurrence["denominator"] * 100
    )
    cooccurrence.to_csv(
        PROCESSED / "authority_theme_cooccurrence.csv",
        index=False,
        encoding="utf-8-sig",
    )
    return summaries


def make_figure(qualitative: pd.DataFrame) -> pd.DataFrame:
    counts = (
        qualitative.groupby(
            ["scenario_id", "human_adjudicated_foundation"], as_index=False
        )
        .size()
        .rename(
            columns={
                "human_adjudicated_foundation": "foundation",
                "size": "count",
            }
        )
    )
    complete = pd.MultiIndex.from_product(
        [SCENARIOS, FOUNDATIONS], names=["scenario_id", "foundation"]
    ).to_frame(index=False)
    plotting = complete.merge(
        counts, on=["scenario_id", "foundation"], how="left", validate="one_to_one"
    )
    plotting["count"] = plotting["count"].fillna(0).astype(int)
    plotting["denominator"] = 100
    plotting["percentage"] = plotting["count"]
    plotting.to_csv(
        PLOTTING / "authority_s11_s30_foundation_distribution.csv",
        index=False,
        encoding="utf-8-sig",
    )

    pivot = plotting.pivot(index="scenario_id", columns="foundation", values="percentage")
    pivot = pivot.reindex(index=SCENARIOS, columns=FOUNDATIONS)
    fig, axis = plt.subplots(figsize=(10.2, 5.8))
    bottom = pd.Series(0.0, index=pivot.index)
    for foundation in FOUNDATIONS:
        values = pivot[foundation]
        axis.bar(
            pivot.index,
            values,
            bottom=bottom,
            label=foundation,
            color=FOUNDATION_COLORS[foundation],
            width=0.58,
        )
        for index, value in enumerate(values):
            if value >= 8:
                axis.text(
                    index,
                    bottom.iloc[index] + value / 2,
                    f"{int(value)}%",
                    ha="center",
                    va="center",
                    color="white",
                    fontsize=11,
                    fontweight="bold",
                )
        bottom += values
    axis.set_ylim(0, 100)
    axis.set_ylabel("Human-coded explanations (%)")
    axis.set_xlabel("Qualitative scenario")
    axis.set_title(
        "Foundation Framing of the Two Authority/Subversion Qualitative Scenarios",
        fontsize=14,
        fontweight="bold",
        pad=12,
    )
    axis.grid(axis="y", color="#D9DEE7", linewidth=0.8)
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)
    axis.legend(
        title="Human-adjudicated foundation",
        frameon=False,
        bbox_to_anchor=(1.01, 1),
        loc="upper left",
    )
    fig.tight_layout()
    fig.savefig(
        FIGURES / "authority_s11_s30_foundation_distribution.png",
        dpi=180,
        bbox_inches="tight",
    )
    plt.close(fig)
    return plotting


def markdown_table(frame: pd.DataFrame) -> str:
    display = frame.copy().fillna("")
    headers = list(display.columns)
    rows = [headers] + [
        [str(value).replace("\n", " ") for value in row]
        for row in display.astype(str).values.tolist()
    ]
    widths = [max(len(row[index]) for row in rows) for index in range(len(headers))]
    output = [
        "| " + " | ".join(value.ljust(widths[index]) for index, value in enumerate(rows[0])) + " |",
        "| " + " | ".join("-" * widths[index] for index in range(len(headers))) + " |",
    ]
    output.extend(
        "| " + " | ".join(value.ljust(widths[index]) for index, value in enumerate(row)) + " |"
        for row in rows[1:]
    )
    return "\n".join(output)


def compact_theme_overall(themes: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for scenario in SCENARIOS:
        group = themes[themes["scenario_id"].eq(scenario)]
        for label, column in [
            ("Authority core language", "authority_core_explicit"),
            ("Rule/obligation authority language", "authority_rule_or_obligation"),
            ("Any authority language", "authority_theme_any"),
            ("Care/Harm language", "care_harm_theme"),
            ("Loyalty/Betrayal language", "loyalty_betrayal_theme"),
        ]:
            count = int(group[column].sum())
            rows.append(
                {
                    "scenario": scenario,
                    "theme": label,
                    "count": count,
                    "denominator": len(group),
                    "percentage": f"{count / len(group) * 100:.1f}%",
                }
            )
    return pd.DataFrame(rows)


def compact_theme_subgroups(themes: pd.DataFrame, dimension: str) -> pd.DataFrame:
    column = {
        "model": "model",
        "input_language": "input_language",
        "condition_type": "condition_type",
    }[dimension]
    rows = []
    for (scenario, group_value), group in themes.groupby(
        ["scenario_id", column], sort=True
    ):
        denominator = len(group)
        row = {
            "scenario": scenario,
            dimension: group_value,
            "n": denominator,
        }
        for label, theme_column in [
            ("authority_any", "authority_theme_any"),
            ("care_harm", "care_harm_theme"),
            ("loyalty_betrayal", "loyalty_betrayal_theme"),
        ]:
            count = int(group[theme_column].sum())
            row[label] = f"{count}/{denominator} ({count / denominator * 100:.1f}%)"
        rows.append(row)
    return pd.DataFrame(rows)


def rare_s11_authority_table(
    conditions: pd.DataFrame, dimension: str
) -> pd.DataFrame:
    return conditions[
        conditions["scenario_id"].eq("S11")
        & conditions["dimension"].eq(dimension)
        & conditions["foundation"].eq("Authority/Subversion")
    ][["group_value", "count", "denominator", "percentage"]].sort_values("group_value")


def write_reports(
    qualitative: pd.DataFrame,
    validation_table: pd.DataFrame,
    foundation_context: pd.DataFrame,
    conditions: pd.DataFrame,
    themes: pd.DataFrame,
    diagnostics: dict[str, object],
) -> None:
    s11 = validation_table[validation_table["scenario_id"].eq("S11")].iloc[0]
    s30 = validation_table[validation_table["scenario_id"].eq("S30")].iloc[0]
    theme_overall = compact_theme_overall(themes)
    cooccurrence = (
        themes.groupby(["scenario_id", "theme_cooccurrence"], as_index=False)
        .size()
        .rename(columns={"size": "count"})
    )
    s30_by_model = conditions[
        conditions["scenario_id"].eq("S30")
        & conditions["dimension"].eq("model")
        & conditions["foundation"].eq("Care/Harm")
    ][["group_value", "count", "denominator", "percentage"]]
    s30_by_language = conditions[
        conditions["scenario_id"].eq("S30")
        & conditions["dimension"].eq("input_language")
        & conditions["foundation"].eq("Care/Harm")
    ][["group_value", "count", "denominator", "percentage"]]
    cue_audit = pd.DataFrame(
        [
            {"scenario": scenario, **SCENARIO_CUES[scenario]}
            for scenario in SCENARIOS
        ]
    )
    theme_by_model = compact_theme_subgroups(themes, "model")
    theme_by_language = compact_theme_subgroups(themes, "input_language")
    theme_by_condition = compact_theme_subgroups(themes, "condition_type")
    s30_themes = themes[themes["scenario_id"].eq("S30")]
    s30_authority_any = int(s30_themes["authority_theme_any"].sum())
    s30_authority_core = int(s30_themes["authority_core_explicit"].sum())
    s30_authority_and_care = int(
        (s30_themes["authority_theme_any"] & s30_themes["care_harm_theme"]).sum()
    )

    scenario_audit = pd.DataFrame(
        [
            {
                "scenario": "S11",
                "intended": s11["intended_mft_foundation"],
                "coder_A": s11["Coder_A_label"],
                "coder_B": s11["Coder_B_label"],
                "coder_C": s11["Coder_C_label"],
                "majority": s11["majority_vote_label"],
                "resolved": s11["majority_resolved"],
                "clean_authority_test": "No",
                "interpretation": SCENARIO_NOTES["S11"],
            },
            {
                "scenario": "S30",
                "intended": s30["intended_mft_foundation"],
                "coder_A": s30["Coder_A_label"],
                "coder_B": s30["Coder_B_label"],
                "coder_C": s30["Coder_C_label"],
                "majority": s30["majority_vote_label"],
                "resolved": s30["majority_resolved"],
                "clean_authority_test": "Comparatively cleaner, but safety harm remains explicit",
                "interpretation": SCENARIO_NOTES["S30"],
            },
        ]
    )

    manuscript_results = (
        "Across the two scenarios originally designed as Authority/Subversion, the "
        "human-adjudicated explanation codes invoked Authority/Subversion in 13 of 200 "
        "explanations (6.5%). This pooled proportion requires scenario-level qualification. "
        "S11 did not retain its intended label during blinded three-coder scenario validation: "
        "its individual labels were Care/Harm, Loyalty/Betrayal, and Care/Harm, yielding a "
        "Care/Harm majority. Model explanations for S11 were coded predominantly as "
        "Loyalty/Betrayal (86/100), with 13/100 Authority/Subversion and 1/100 Care/Harm. "
        "S30, by contrast, retained Authority/Subversion by a two-coder majority and therefore "
        "provides the cleaner descriptive test. All 100 S30 explanations were coded Care/Harm. "
        "This 100% pattern held within each of the four model families (25/25 each), all seven "
        "input-language groups (4/4 for English and 16/16 for each non-English language), and "
        "every represented framing and response-language condition. Thus, S30 shows consistent "
        "Care/Harm reframing for one human-validated Authority/Subversion scenario; it does not "
        "establish a universal failure of authority reasoning."
    )
    manuscript_discussion = (
        "Authority/Subversion may be comparatively difficult to isolate because hierarchy and "
        "obedience conflicts often embed relational loyalty and concrete harm. S11 combines "
        "paternal expectations, sacrifice, public disclosure, and emotional injury, making its "
        "original authority label unstable even for human scenario coders. S30 more directly "
        "presents institutional rule compliance, yet the rule is explicitly a safety rule, so "
        "model explanations can foreground foreseeable danger and protection rather than the "
        "abstract legitimacy of mandatory rules. The unanimity of the S30 Care/Harm codes is "
        "therefore important descriptive evidence of consistent reframing across the sampled "
        "models and conditions, but the qualitative subset contains only one human-validated "
        "Authority/Subversion scenario. The result is hypothesis-generating, not proof of a "
        "general model-family deficiency."
    )
    manuscript_limitations = (
        "Only two qualitative scenarios were originally designed as Authority/Subversion, and "
        "one (S11) did not retain that label under human validation; consequently, only one "
        "human-validated Authority/Subversion scenario remained in the qualitative subset. "
        "Single-label explanation coding can obscure mixed-foundation reasoning, as indicated "
        "by the supplementary lexical co-occurrence audit. Five non-English reasoning languages "
        "depended on machine-translated coder-facing text during the original coding workflow, "
        "and subtle authority cues may not transfer perfectly. Coder A was the first author, "
        "which should be considered when evaluating interpretive independence, although Coder B "
        "coded independently and both coders were blind to model, language, condition, and "
        "intended foundation."
    )

    report = f"""# Authority/Subversion Qualitative Expansion

## Source Audit

- Qualitative source: `results/processed/full_merged_with_human_mft_codes.csv`
- Scenario-validation source: `results/processed/scenario_validation_trial2/scenario_validation_merged_3coders.csv`
- Manuscript reference inspected, not modified: `phase1_evidence_report_provenance.md`
- S11 explanations: **100**
- S30 explanations: **100**
- Unique explanation rows: **200**
- Models represented per scenario: **4**, with **25** rows each
- Input languages represented: **7**
- Condition identifiers represented per scenario: **25**
- Model-by-condition grid: **100/100 unique cells per scenario**, one row per cell
- Input-language denominators per scenario: **English 4; each of six non-English languages 16**
- Reproduced intended-label Authority/Subversion count: **13/200 (6.5%)**
- Reproduced S11 distribution: **86 Loyalty/Betrayal, 13 Authority/Subversion, 1 Care/Harm**
- Reproduced S30 distribution: **100 Care/Harm**
- Explanation coding: two independent human coders; raw agreement **96.2%**;
  Cohen's **κ = 0.948**; disagreements human-adjudicated
- Coder A: first author; Coder B: computer science graduate
- Blinding: model, language, condition, and intended foundation
- API calls: **none**

Historical `ai_mft_*`, `llama`, and `deepseek` column names are treated as stale field names,
not coder identities. The final explanation labels are human-adjudicated labels under the
study provenance supplied for this audit.

No separate coder-facing English-translation artifact was found in the repository. The
available 1,000-row coding snapshot reproduces the raw model explanations byte-for-byte.
Accordingly, the supplementary lexical audit uses raw English responses and explicit
multilingual dictionaries for same-language responses rather than applying English keywords
to non-English text. This does not alter the human codes.

## Scenario-Level Interpretive Audit

{markdown_table(scenario_audit)}

### Cue Audit

{markdown_table(cue_audit)}

### S11

**Exact scenario text**

> {s11['scenario_text_en'].replace(chr(10), ' ')}

The moral actors are Arjun and his father. Hierarchical and filial-duty cues are present:
the father financed Arjun's education, hoped he would join the family business, and was
publicly contradicted at his retirement celebration. Yet the wording more strongly
foregrounds personal trust and sacrifice, unmet expectations, public embarrassment, and
emotional hurt. Loyalty/Betrayal, Care/Harm, and Authority/Subversion are therefore all
plausible. The three human scenario labels and the Care/Harm majority show that S11 is not a
clean test of model failure to recognize Authority/Subversion.

### S30

**Exact scenario text**

> {s30['scenario_text_en'].replace(chr(10), ' ')}

The central authority relationship is between an employee and a mandatory institutional
safety rule. Unlike S11, the obligation is explicit rather than inferred from a family
relationship. However, “safety” supplies a direct Care/Harm cue: explanations repeatedly
emphasize danger, risk, injury, and protection. The lexical audit separately records core
hierarchy language and broader rule/obligation language, allowing Care/Harm framing to
coexist with references to rules, protocols, duties, or compliance rather than forcing a
single thematic interpretation.

## Human-Coded Foundation Distributions

S11: **86% Loyalty/Betrayal, 13% Authority/Subversion, 1% Care/Harm**.

S30: **100% Care/Harm**. The pattern is pooled and subgroup-complete:

### S30 by Model

{markdown_table(s30_by_model.round({'percentage': 1}))}

### S30 by Input Language

{markdown_table(s30_by_language.round({'percentage': 1}))}

Complete literal/adapted, response-language, condition-type, and 25-condition distributions
are in `results/processed/authority_condition_breakdowns.csv`.

### Concentration of S11's 13 Authority/Subversion Codes

By model:

{markdown_table(rare_s11_authority_table(conditions, 'model').round({'percentage': 1}))}

By input language:

{markdown_table(rare_s11_authority_table(conditions, 'input_language').round({'percentage': 1}))}

By framing:

{markdown_table(rare_s11_authority_table(conditions, 'framing').round({'percentage': 1}))}

By response instruction:

{markdown_table(rare_s11_authority_table(conditions, 'response_instruction').round({'percentage': 1}))}

These are descriptive counts. No underpowered inferential tests were added.

## Offline Lexical and Thematic Audit

The analysis applies NFKC normalization and case folding only for matching. It selects the
dictionary by **reasoning-response language**, uses token boundaries for English and Spanish,
and literal Unicode substring matching for Hindi, Bengali, Tamil, Japanese, and Arabic.
The dictionaries and exact implementation are recorded in
`scripts/authority_subversion_expansion.py`. Four transparent categories are retained:
core authority/hierarchy language; broader rule/duty/obligation language; Care/Harm
language; and Loyalty/Betrayal language.

{markdown_table(theme_overall)}

For S30, **{s30_authority_any}/100** explanations contained at least one explicit
authority-adjacent rule, duty, compliance, or hierarchy expression, including
**{s30_authority_core}/100** with the narrower core hierarchy dictionary. Because Care/Harm
language appeared in all 100, the two themes co-occurred in **{s30_authority_and_care}/100**
explanations. Thus, the single-label Care/Harm codes often replaced Authority/Subversion as
the dominant human code while rule or obligation language remained present in the text.

### Thematic Counts by Model

Cells show `count/denominator (percentage)`.

{markdown_table(theme_by_model)}

### Thematic Counts by Input Language

{markdown_table(theme_by_language)}

### Thematic Counts by Condition Type

{markdown_table(theme_by_condition)}

### Co-occurrence

{markdown_table(cooccurrence)}

Matched and unmatched rows were retained for manual audit in
`results/processed/authority_theme_audit.csv`. All no-match cases were inspected, and matched
contexts were reviewed by term, scenario, and response language. Review focused on whether
matches expressed a moral rationale rather than merely repeating scenario facts. Common S11 reasoning patterns
emphasized sacrifice, expectations, filial relationship obligations, and the hurt caused by
public disclosure. Common S30 patterns emphasized safety, foreseeable risk, and protection;
some also referred to mandatory rules, protocols, compliance, or institutional procedures.
Dictionary matches do not replace the human codes and do not prove that a model adopted a
foundation. False positives remain possible when an explanation mentions a rule, duty,
responsibility, sacrifice, expectation, or safety only descriptively.

## Broader Authority/Subversion Validation Context

{markdown_table(validation_table[['scenario_id', 'Coder_A_label', 'Coder_B_label', 'Coder_C_label', 'majority_vote_label', 'agreement_pattern', 'competing_foundation']])}

Authority/Subversion was retained for **5/10 (50%)**, the lowest validation rate among the
five intended foundations in this benchmark. Three scenarios shifted to Care/Harm, one
shifted to Loyalty/Betrayal, and one was unresolved. All four resolved non-Authority
majorities were adjacent relational foundations (Care or Loyalty), compared with fewer such
shifts in each other intended category. This is descriptive benchmark context, not a test of
statistical significance.

{markdown_table(foundation_context.round({'validation_rate': 3}))}

## Manuscript-Ready Results

{manuscript_results}

## Manuscript-Ready Discussion

{manuscript_discussion}

## Manuscript-Ready Limitations

{manuscript_limitations}

## Manuscript-Ready Conclusion

For this benchmark, S30 provides strong scenario-specific evidence of consistent Care/Harm
reframing, while the instability and overlap surrounding Authority/Subversion preclude a
universal claim that models fail to reason about authority.

## Figure Caption

**Foundation framing of the two Authority/Subversion qualitative scenarios.** Distribution
of adjudicated human-coded foundation labels for model explanations of S11 and S30. S11 was
originally designed as Authority/Subversion but received a human-majority Care/Harm scenario
label and produced predominantly Loyalty/Betrayal explanations. S30 retained
Authority/Subversion under human validation, yet all model explanations were coded as
Care/Harm. The figure describes two scenarios and should not be interpreted as a general
estimate of model performance across all authority-related moral conflicts.
"""
    (REPORTS / "authority_subversion_expansion_report.md").write_text(
        report, encoding="utf-8"
    )

    claims = [
        (
            "Models systematically fail to recognize Authority/Subversion.",
            "Not supported",
            "Only two qualitative scenarios were authority-designed; S11 was relabeled by "
            "human majority, and S30 is one validated scenario. The evidence cannot estimate "
            "performance across authority conflicts generally.",
        ),
        (
            "Models rarely invoked Authority/Subversion in the two originally authority-designed qualitative scenarios.",
            "Supported with qualification",
            "Authority/Subversion appeared in 13/200 explanations (6.5%), all in S11. S11 did "
            "not retain Authority/Subversion under human scenario validation.",
        ),
        (
            "Authority/Subversion was the least stable foundation in this benchmark.",
            "Supported",
            "Only 5/10 intended Authority/Subversion scenarios retained their intended label, "
            "below Care 8/11, Fairness 9/10, Loyalty 8/10, and Sanctity 9/9.",
        ),
        (
            "Human coders and models often interpreted authority conflicts through Care/Harm or Loyalty/Betrayal.",
            "Supported with qualification",
            "Human scenario majorities shifted three Authority items to Care and one to "
            "Loyalty; explanation codes were 86 Loyalty for S11 and 100 Care for S30. This "
            "describes these benchmark items, not all authority conflicts.",
        ),
        (
            "Models reframed even a human-validated Authority/Subversion scenario.",
            "Supported with qualification",
            "S30 retained Authority/Subversion by a two-coder human majority, while all 100 "
            "model explanations were human-coded Care/Harm across every represented subgroup.",
        ),
        (
            "S30 demonstrates a universal model-family deficiency in authority reasoning.",
            "Not supported",
            "S30 is one scenario with an explicit safety cue. Cross-model consistency within "
            "that item does not establish a general model-family deficiency.",
        ),
        (
            "The result reflects benchmark ambiguity rather than model behavior.",
            "Contradicted",
            "Benchmark ambiguity explains S11 and broader category instability, but S30 "
            "retained Authority/Subversion and still showed 100/100 Care/Harm codes.",
        ),
        (
            "The result reflects model behavior rather than benchmark ambiguity.",
            "Not supported",
            "S30 supplies model-behavior evidence, but S11 and the 5/10 category validation "
            "rate show that benchmark ambiguity also contributes materially.",
        ),
    ]
    claim_frame = pd.DataFrame(claims, columns=["claim", "verdict", "exact_evidence"])
    claim_report = f"""# Authority/Subversion Claim Audit

{markdown_table(claim_frame)}

## Reviewer-Safe Synthesis

S11 mainly demonstrates overlapping moral cues and label instability. S30 provides strong
descriptive evidence of consistent Care/Harm reframing for one human-validated
Authority/Subversion scenario. The full scenario-validation set shows that
Authority/Subversion was the least stable intended category in this benchmark. Together,
these findings justify a qualified, scenario-specific interpretation, not a universal claim
about model authority reasoning.
"""
    (REPORTS / "authority_subversion_claim_audit.md").write_text(
        claim_report, encoding="utf-8"
    )


def write_reproducibility(
    diagnostics: dict[str, object],
    conditions: pd.DataFrame,
    themes: pd.DataFrame,
) -> dict[str, object]:
    source_paths = [
        QUALITATIVE_SOURCE,
        VALIDATION_SOURCE,
        MANUSCRIPT_REFERENCE,
        LEGACY_BREAKDOWN,
    ]
    output_paths = [
        PROCESSED / "authority_s11_s30_breakdown.csv",
        PROCESSED / "authority_all_scenarios_validation.csv",
        PROCESSED / "authority_foundation_validation_context.csv",
        PROCESSED / "authority_theme_audit.csv",
        PROCESSED / "authority_theme_counts.csv",
        PROCESSED / "authority_theme_cooccurrence.csv",
        PROCESSED / "authority_condition_breakdowns.csv",
        PLOTTING / "authority_s11_s30_foundation_distribution.csv",
        FIGURES / "authority_s11_s30_foundation_distribution.png",
        REPORTS / "authority_subversion_expansion_report.md",
        REPORTS / "authority_subversion_claim_audit.md",
    ]
    metadata = {
        "status": "PASS",
        "no_api_calls": True,
        "diagnostics": diagnostics,
        "all_subgroup_denominators": {
            "condition_breakdown_rows": len(conditions),
            "theme_audit_rows": len(themes),
            "model_rows_per_scenario": 25,
            "non_english_input_rows_per_language_per_scenario": 16,
            "english_baseline_rows_per_scenario": 4,
            "literal_rows_per_scenario": 48,
            "adapted_rows_per_scenario": 48,
            "english_response_rows_per_scenario_excluding_baseline": 48,
            "same_language_response_rows_per_scenario": 48,
        },
        "translated_text_dependence": (
            "Original human coding used coder-facing English translations for five reasoning "
            "languages according to study provenance. Those translations are not a distinct "
            "repository artifact. This supplementary audit therefore uses raw explanations "
            "with language-specific dictionaries; it does not recode final foundations."
        ),
        "manual_thematic_decisions": (
            "Dictionaries were conservatively separated into core authority, rule/obligation, "
            "care/harm, and loyalty/betrayal terms. Matched and unmatched cases were retained "
            "for manual review. Ambiguous factual mentions remain flagged as false-positive risks."
        ),
        "commands": [
            "py -3 scripts\\authority_subversion_expansion.py",
            "py -3 -m py_compile scripts\\authority_subversion_expansion.py",
        ],
        "source_hashes_sha256": {
            str(path.relative_to(ROOT)): sha256(path) for path in source_paths
        },
        "script_hash_sha256": sha256(Path(__file__)),
        "output_hashes_sha256": {
            str(path.relative_to(ROOT)): sha256(path) for path in output_paths
        },
        "package_versions": {
            "python": platform.python_version(),
            "pandas": pd.__version__,
            "matplotlib": matplotlib.__version__,
        },
    }
    (PROCESSED / "authority_subversion_reproducibility.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    report = f"""# Authority/Subversion Reproducibility

- Status: **PASS**
- S11 explanation rows: **{diagnostics['scenario_counts']['S11']}**
- S30 explanation rows: **{diagnostics['scenario_counts']['S30']}**
- Unique explanation rows: **{diagnostics['unique_response_ids']}**
- Authority/Subversion codes across S11/S30: **{diagnostics['authority_invocations']}/200**
- Condition identifiers per scenario: **25**
- API calls: **none**

## Exact Command

```powershell
py -3 scripts\\authority_subversion_expansion.py
py -3 -m py_compile scripts\\authority_subversion_expansion.py
```

Source hashes, output hashes, package versions, subgroup denominators, translation
dependence, and manual thematic decisions are recorded in
`results/processed/authority_subversion_reproducibility.json`.
"""
    (REPORTS / "authority_subversion_reproducibility.md").write_text(
        report, encoding="utf-8"
    )
    return metadata


def main() -> None:
    for directory in [REPORTS, PROCESSED, PLOTTING, FIGURES]:
        directory.mkdir(parents=True, exist_ok=True)
    qualitative, validation, diagnostics = load_sources()
    build_explanation_breakdown(qualitative)
    conditions = build_condition_breakdowns(qualitative)
    themes = build_theme_audit(qualitative)
    build_theme_summaries(themes)
    validation_table, foundation_context = build_validation_table(validation)
    make_figure(qualitative)
    write_reports(
        qualitative,
        validation_table,
        foundation_context,
        conditions,
        themes,
        diagnostics,
    )
    metadata = write_reproducibility(diagnostics, conditions, themes)
    summary = {
        "status": metadata["status"],
        "no_api_calls": metadata["no_api_calls"],
        "qualitative_rows": diagnostics["qualitative_rows"],
        "scenario_counts": diagnostics["scenario_counts"],
        "label_distributions": diagnostics["label_distributions"],
        "authority_invocations": diagnostics["authority_invocations"],
        "theme_counts": {
            scenario: {
                "authority_core": int(
                    themes.loc[
                        themes["scenario_id"].eq(scenario), "authority_core_explicit"
                    ].sum()
                ),
                "authority_rule_or_obligation": int(
                    themes.loc[
                        themes["scenario_id"].eq(scenario),
                        "authority_rule_or_obligation",
                    ].sum()
                ),
                "care_harm": int(
                    themes.loc[
                        themes["scenario_id"].eq(scenario), "care_harm_theme"
                    ].sum()
                ),
                "loyalty_betrayal": int(
                    themes.loc[
                        themes["scenario_id"].eq(scenario),
                        "loyalty_betrayal_theme",
                    ].sum()
                ),
            }
            for scenario in SCENARIOS
        },
    }
    (PROCESSED / "authority_subversion_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
