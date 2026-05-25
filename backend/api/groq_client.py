"""
Groq integration — generates a fully structured clinical JSON response
for the top-3 DermaVision predictions, incorporating patient context.

Returns a dict with every field the DermaDetect frontend needs:
  primaryFinding, confidence, urgency, urgencyText,
  treatmentNotes, recommendedAction, referralNote, conditionCode
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL    = "llama-3.3-70b-versatile"

# Maps DermaVision label keywords → conditionCode used by the frontend
# for treatment protocol lookup in TreatmentRecommendations.tsx
_CONDITION_CODE_MAP = [
    (["melanoma", "nevi", "moles"],                                          "melanoma"),
    (["basal cell", "actinic keratosis"],                                    "basal_cell"),
    (["seborrheic"],                                                          "seborrheic"),
    (["contact dermatitis", "poison ivy"],                                    "contact_dermatitis"),
    (["tinea", "ringworm", "candidiasis", "nail fungus",
      "scabies", "warts", "molluscum", "cellulitis", "impetigo",
      "herpes", "hpv"],                                                       "ringworm"),
    (["eczema", "atopic", "psoriasis", "lichen", "urticaria",
      "hives", "bullous", "vasculitis", "lupus", "rosacea", "acne",
      "exanthems", "drug eruption", "systemic", "vascular",
      "light disease", "pigmentation", "hair loss", "alopecia"],             "contact_dermatitis"),
]

def _derive_condition_code(label: str) -> str:
    lower = label.lower()
    for keywords, code in _CONDITION_CODE_MAP:
        if any(kw in lower for kw in keywords):
            return code
    return "ringworm"  # safe fallback


def _build_prompt(
    predictions: list[dict[str, Any]],
    patient_name: str,
    patient_age: str,
    patient_sex: str,
    symptoms: str,
) -> str:
    ranked = "\n".join(
        f"  {i+1}. {p['label']} — {p['confidence'] * 100:.1f}% confidence"
        for i, p in enumerate(predictions)
    )

    top_label      = predictions[0]["label"]
    top_confidence = round(predictions[0]["confidence"] * 100)
    condition_code = _derive_condition_code(top_label)

    # Urgency rules mirror server.ts getConditionUrgency so both stay consistent
    label_lower = top_label.lower()
    if any(k in label_lower for k in [
        "melanoma", "basal cell", "carcinoma", "vasculitis",
        "lupus", "cellulitis", "bullous", "actinic"
    ]):
        urgency      = "High"
        urgency_text = "Urgent referral indicated. Refer to specialist within 48 hours."
    elif any(k in label_lower for k in [
        "impetigo", "scabies", "herpes", "molluscum", "wart",
        "psoriasis", "lichen", "urticaria", "hive"
    ]):
        if top_confidence >= 80:
            urgency      = "High"
            urgency_text = "High-confidence finding. Refer to clinic within 48 hours for treatment initiation."
        else:
            urgency      = "Moderate"
            urgency_text = "Refer to clinic within 3 days. Condition is progressive but not immediately emergent."
    elif any(k in label_lower for k in [
        "tinea", "ringworm", "fungus", "fungal", "candida", "nail"
    ]):
        urgency      = "Moderate" if top_confidence >= 85 else "Low"
        urgency_text = (
            "Refer to clinic within 3 days. High-confidence fungal presentation; initiate topical therapy."
            if top_confidence >= 85
            else "Monitor and apply topical antifungal. Review if no improvement in 2 weeks."
        )
    elif any(k in label_lower for k in [
        "eczema", "atopic", "contact", "dermatitis", "rosacea", "acne"
    ]):
        urgency      = "Low"
        urgency_text = "Local symptom management. Re-evaluate if lesions expand or persist beyond 2 weeks."
    elif any(k in label_lower for k in ["seborrheic", "keratosis", "nevi", "mole"]):
        urgency      = "Low"
        urgency_text = "Benign finding. Routine monitoring. No urgent action required."
    else:
        if top_confidence >= 80:
            urgency      = "High"
            urgency_text = "Urgent referral indicated. Refer to specialist within 48 hours."
        elif top_confidence >= 60:
            urgency      = "Moderate"
            urgency_text = "Refer to clinic within 3 days."
        else:
            urgency      = "Low"
            urgency_text = "Monitor and review if symptoms persist beyond 2 weeks."

    patient_block = f"""Patient: {patient_name or 'Unknown'}, {patient_age or 'Unknown'} years old, {patient_sex or 'Unknown'} sex.
Reported symptoms: {symptoms or 'None provided'}."""

    return f"""You are a board-certified dermatologist generating a structured clinical report for a community health worker system in Ghana.

PATIENT CONTEXT:
{patient_block}

DERMAVISION MODEL OUTPUT (ranked differential):
{ranked}

PRE-COMPUTED TRIAGE:
  Primary finding : {top_label}
  Confidence      : {top_confidence}%
  Urgency level   : {urgency}
  Urgency guidance: {urgency_text}
  Condition code  : {condition_code}

YOUR TASK:
Return ONLY a valid JSON object — no markdown wrappers, no code fences, no explanation before or after.
The JSON must have exactly these keys:

{{
  "primaryFinding":    "<clean display name for the top diagnosis, e.g. 'Basal Cell Carcinoma'>",
  "confidence":        {top_confidence},
  "urgency":           "{urgency}",
  "urgencyText":       "{urgency_text}",
  "treatmentNotes":    [
    "<specific actionable instruction for the health worker, 1 sentence>",
    "<second instruction>",
    "<third instruction>"
  ],
  "therapyRegimen": {{
    "medication": "<specific medication name>",
    "regimen": "<dosing schedule/frequency>",
    "dosage": "<strength/amount>",
    "contraindications": "<when to avoid>",
    "warningNote": "<critical clinical warning>"
  }},
  "patientHandout": {{
    "dos": [
      "<specific supportive care action 1>",
      "<specific supportive care action 2>",
      "<specific supportive care action 3>"
    ],
    "donts": [
      "<what the patient should strictly avoid 1>",
      "<what the patient should strictly avoid 2>"
    ]
  }},
  "recommendedAction": "<one clear sentence: where to refer, what procedure, what timeframe>",
  "referralNote":      "<A detailed, multi-paragraph clinical report formatted in Markdown with escaped newlines (\\n). It must include the following sections exactly, bolded like this: **Clinical Indication:**, **Technique:**, **Findings:**, **Impression:**, and **Recommendation:**. Be highly detailed and write in formal medical prose suitable for a printed referral letter to a receiving clinician.>",
  "conditionCode":     "{condition_code}"
}}

RULES:
- treatmentNotes must be exactly 3 items, each a single actionable sentence for a community health worker in a low-resource setting.
- therapyRegimen and patientHandout must contain highly specific, medically accurate recommendations for the {top_label}.
- recommendedAction must name a specific facility type (e.g. District Hospital Dermatology Unit) appropriate for Ghana.
- referralNote MUST include the 5 specific section headers wrapped in Markdown bolding (**Header:**). It must mention {patient_name or 'the patient'} by name, reference the AI confidence score, and end with the recommended next step.
- Do not invent patient details not provided above.
- Do not change the confidence, urgency, urgencyText, or conditionCode values — use exactly what is pre-computed above.
- Return raw JSON only. Any text outside the JSON will break the parser.
"""


def generate_clinical_response(
    predictions:  list[dict[str, Any]],
    patient_name: str = "",
    patient_age:  str = "",
    patient_sex:  str = "",
    symptoms:     str = "",
) -> dict[str, Any]:
    """
    Call Groq and return a fully structured dict ready for the frontend.
    Falls back to _plain_fallback() if Groq is unavailable or returns bad JSON.
    """
    api_key = settings.GROQ_API_KEY
    if not api_key:
        logger.warning("GROQ_API_KEY not set — using plain fallback.")
        return _plain_fallback(predictions)

    prompt = _build_prompt(predictions, patient_name, patient_age, patient_sex, symptoms)

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a clinical dermatology AI assistant. "
                    "You output only valid JSON. No markdown. No explanation. No code fences. "
                    "Your entire response must be parseable by json.loads()."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens":  700,
    }

    try:
        with httpx.Client(timeout=30) as client:
            response = client.post(
                GROQ_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type":  "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            raw = response.json()["choices"][0]["message"]["content"].strip()

            # Strip accidental markdown fences if the model disobeys
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()

            result = json.loads(raw)

            # Guarantee every key exists even if the model omits one
            top = predictions[0]
            result.setdefault("primaryFinding",    top["label"])
            result.setdefault("confidence",        round(top["confidence"] * 100))
            result.setdefault("conditionCode",     _derive_condition_code(top["label"]))
            result.setdefault("treatmentNotes",    [])
            result.setdefault("recommendedAction", "Refer to appropriate specialist.")
            result.setdefault("referralNote",      result.get("recommendedAction", ""))

            logger.info(
                "Groq structured response OK — finding: %s, urgency: %s",
                result.get("primaryFinding"),
                result.get("urgency"),
            )
            return result

    except json.JSONDecodeError as exc:
        logger.error("Groq returned invalid JSON: %s | raw: %.200s", exc, raw if 'raw' in dir() else '?')
    except httpx.HTTPStatusError as exc:
        logger.error("Groq HTTP error %s: %s", exc.response.status_code, exc.response.text)
    except Exception as exc:
        logger.error("Groq request failed: %s", exc)

    return _plain_fallback(predictions)


# ---------------------------------------------------------------------------
# Legacy shim — keeps existing views.py calls working without changes
# until views.py is updated to call generate_clinical_response() directly.
# ---------------------------------------------------------------------------
def generate_narrative(predictions: list[dict[str, Any]]) -> str:
    """Deprecated shim. Use generate_clinical_response() instead."""
    result = generate_clinical_response(predictions)
    return result.get("referralNote") or result.get("recommendedAction", "")


def _plain_fallback(predictions: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Returns a valid structured dict when Groq is unavailable.
    Uses the same urgency logic as the main prompt builder.
    """
    top            = predictions[0]
    top_label      = top["label"]
    top_confidence = round(top["confidence"] * 100)
    condition_code = _derive_condition_code(top_label)

    label_lower = top_label.lower()
    if any(k in label_lower for k in [
        "melanoma", "basal cell", "carcinoma", "vasculitis",
        "lupus", "cellulitis", "bullous", "actinic"
    ]):
        urgency      = "High"
        urgency_text = "Urgent referral indicated. Refer to specialist within 48 hours."
    elif top_confidence >= 80:
        urgency      = "High"
        urgency_text = "Urgent referral indicated. Refer to specialist within 48 hours."
    elif top_confidence >= 60:
        urgency      = "Moderate"
        urgency_text = "Refer to clinic within 3 days."
    else:
        urgency      = "Low"
        urgency_text = "Monitor and review if symptoms persist beyond 2 weeks."

    others = predictions[1:]
    differential = ", ".join(
        f"{p['label']} ({round(p['confidence'] * 100)}%)" for p in others
    )

    return {
        "primaryFinding":    top_label,
        "confidence":        top_confidence,
        "urgency":           urgency,
        "urgencyText":       urgency_text,
        "treatmentNotes": [
            "Keep the affected area clean and dry.",
            "Avoid scratching or picking at the lesion.",
            "Follow up at the nearest clinic if symptoms worsen.",
        ],
        "therapyRegimen": {
            "medication": "Topical symptomatic relief",
            "regimen": "Apply twice daily as needed",
            "dosage": "Thin layer",
            "contraindications": "Do not apply to broken skin",
            "warningNote": "Discontinue if irritation worsens."
        },
        "patientHandout": {
            "dos": ["Keep area clean", "Monitor for changes"],
            "donts": ["Do not scratch", "Do not apply unverified home remedies"]
        },
        "recommendedAction": (
            f"Refer to District Hospital Dermatology Unit for assessment of {top_label}."
        ),
        "referralNote": (
            f"**Clinical Indication:**\\n"
            f"The patient presented with {top_label} symptoms.\\n\\n"
            f"**Findings:**\\n"
            f"The DermaVision AI system identified {top_label} as the primary finding "
            f"with {top_confidence}% confidence. "
            f"Differential considerations include {differential}.\\n\\n"
            f"**Recommendation:**\\n"
            f"Clinical correlation and specialist review are strongly recommended."
        ),
        "conditionCode": condition_code,
    }