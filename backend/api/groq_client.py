"""
Groq integration — generates a fully structured clinical JSON response
for the top-3 DermaVision predictions, incorporating patient context.

Architecture:
  - CONDITION_MEDICATION_DB provides medically curated drug options per condition.
  - These are injected into the Groq prompt so the LLM generates ALL clinical text
    (treatmentNotes, therapyRegimen, patientHandout, referralNote) anchored to real
    medications — not hallucinated drug names or dosages.
  - _plain_fallback() uses the same DB directly when Groq is unavailable.

Returns a dict with every field the DermaDetect frontend needs:
  primaryFinding, confidence, urgency, urgencyText,
  treatmentNotes, therapyRegimen, patientHandout,
  recommendedAction, referralNote, conditionCode
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

# ---------------------------------------------------------------------------
# Condition → conditionCode mapping (used by frontend TreatmentRecommendations)
# ---------------------------------------------------------------------------
_CONDITION_CODE_MAP = [
    (["melanoma", "nevi", "moles"],                                          "melanoma"),
    (["basal cell", "actinic keratosis", "squamous"],                        "basal_cell"),
    (["seborrheic"],                                                          "seborrheic"),
    (["contact dermatitis", "poison ivy"],                                    "contact_dermatitis"),
    (["vascular tumor", "hemangioma", "angiokeratoma", "port-wine",
      "cherry angioma", "kaposi", "pyogenic granuloma"],                     "vascular"),
    (["tinea", "ringworm", "candidiasis", "nail fungus",
      "scabies", "warts", "molluscum", "cellulitis", "impetigo",
      "herpes", "hpv"],                                                       "ringworm"),
    (["eczema", "atopic", "psoriasis", "lichen", "urticaria",
      "hives", "bullous", "vasculitis", "lupus", "rosacea", "acne",
      "exanthems", "drug eruption", "systemic", "light disease",
      "pigmentation", "hair loss", "alopecia"],                              "contact_dermatitis"),
]


def _derive_condition_code(label: str) -> str:
    lower = label.lower()
    for keywords, code in _CONDITION_CODE_MAP:
        if any(kw in lower for kw in keywords):
            return code
    return "ringworm"  # safe fallback


# ---------------------------------------------------------------------------
# CONDITION MEDICATION DATABASE
# 3+ medically curated options per condition group.
# Injected into the Groq prompt as reference; LLM writes all clinical text.
# Also used by _plain_fallback() when Groq is unavailable.
# ---------------------------------------------------------------------------
CONDITION_MEDICATION_DB: dict[str, dict[str, Any]] = {

    "melanoma": {
        "primary_medications": [
            {
                "name": "Imiquimod 5% Cream (Aldara)",
                "class": "Immune Response Modifier",
                "first_aid_role": "Topical immunotherapy for superficial lesions pending specialist review",
                "dosage": "Apply thin layer to lesion 5 nights/week for up to 6 weeks",
                "contraindications": "Do not use on open wounds; avoid in immunocompromised patients",
            },
            {
                "name": "Diclofenac Sodium 3% Gel (Solaraze)",
                "class": "NSAID / Anti-inflammatory",
                "first_aid_role": "Adjunct anti-inflammatory for actinic-related lesions",
                "dosage": "Apply twice daily; treatment duration 60–90 days",
                "contraindications": "Avoid in NSAID hypersensitivity; do not apply to broken skin",
            },
            {
                "name": "Fluorouracil (5-FU) 5% Cream (Efudex)",
                "class": "Topical Antineoplastic",
                "first_aid_role": "Interim topical chemotherapy for acral lentiginous or in-situ lesions",
                "dosage": "Apply once daily to affected area; use until erosion then cease",
                "contraindications": "Pregnancy (Category X); avoid mucous membranes; strict sun protection required",
            },
        ],
        "dos": [
            "Cover the lesion with a sterile, non-adhesive dressing to prevent trauma.",
            "Document lesion size, border irregularity, and any colour change with a photograph.",
            "Advise the patient to avoid direct sunlight on the area and apply SPF 50+ sunscreen.",
            "Ensure urgent referral paperwork is completed before patient leaves.",
        ],
        "donts": [
            "Do not biopsy or excise the lesion at the community health post level.",
            "Do not apply traditional herbal remedies or caustic substances to the lesion.",
            "Do not delay referral — melanoma is time-critical; same-day transfer is preferred.",
            "Do not allow the patient to rub, scratch, or manipulate the lesion.",
        ],
        "warning": "Melanoma carries a high risk of metastasis if not treated within the therapeutic window. All suspicious pigmented lesions with ABCDE criteria must be treated as oncological emergencies until proven otherwise by a dermatologist or oncologist.",
    },

    "basal_cell": {
        "primary_medications": [
            {
                "name": "Imiquimod 5% Cream (Aldara)",
                "class": "Immune Response Modifier / Toll-like Receptor Agonist",
                "first_aid_role": "First-line topical therapy for superficial basal cell carcinoma",
                "dosage": "Apply 5 times per week for 6 weeks; allow 8-hour contact time then wash off",
                "contraindications": "Avoid in immunosuppressed patients; do not use on nodular BCC without specialist guidance",
            },
            {
                "name": "Fluorouracil (5-FU) 5% Cream (Efudex)",
                "class": "Topical Antineoplastic / Pyrimidine Analogue",
                "first_aid_role": "Topical chemotherapy for superficial BCC and actinic keratosis",
                "dosage": "Apply twice daily for 3–6 weeks; expect inflammatory response as treatment effect",
                "contraindications": "Pregnancy (Category X); dihydropyrimidine dehydrogenase (DPD) enzyme deficiency; avoid periorbital use",
            },
            {
                "name": "Vismodegib 150mg (Erivedge) — via specialist",
                "class": "Hedgehog Pathway Inhibitor / Oral Targeted Therapy",
                "first_aid_role": "Systemic therapy for locally advanced or inoperable BCC; initiate referral for this",
                "dosage": "150mg orally once daily (specialist-prescribed only)",
                "contraindications": "Pregnancy (teratogenic); severe hepatic impairment; breastfeeding",
            },
        ],
        "dos": [
            "Apply sunscreen SPF 50+ to all lesion sites and surrounding skin.",
            "Cover lesion with clean gauze and secure with medical tape.",
            "Advise patient to avoid sun exposure on the affected area entirely.",
            "Complete urgent referral to Dermatology or Oncology unit.",
        ],
        "donts": [
            "Do not attempt excision or cauterisation at community level.",
            "Do not apply any corticosteroid cream — this will mask the lesion's growth.",
            "Do not reassure patient that it is 'just a sore' — communicate urgency clearly.",
        ],
        "warning": "Basal Cell Carcinoma, though locally invasive rather than metastatic, can cause extensive tissue destruction if untreated. Actinic keratosis lesions carry a 5–10% risk of malignant transformation. Immediate dermatology referral is mandatory.",
    },

    "seborrheic": {
        "primary_medications": [
            {
                "name": "Ketoconazole 2% Shampoo / Cream (Nizoral)",
                "class": "Antifungal / Azole",
                "first_aid_role": "First-line antifungal targeting Malassezia yeast, the causative organism",
                "dosage": "Shampoo: apply twice weekly for 4 weeks. Cream: apply twice daily to affected area for 4 weeks",
                "contraindications": "Avoid concurrent oral ketoconazole due to hepatotoxicity risk; do not use in acute scalp wounds",
            },
            {
                "name": "Selenium Sulfide 2.5% Lotion (Selsun)",
                "class": "Anti-Malassezia / Cytostatic Agent",
                "first_aid_role": "Antifungal with additional sebosuppressive properties",
                "dosage": "Apply to wet scalp/skin, leave 10 minutes, rinse. Use twice weekly.",
                "contraindications": "Avoid contact with eyes and inflamed/broken skin; avoid during pregnancy",
            },
            {
                "name": "Hydrocortisone 1% Cream",
                "class": "Low-potency Topical Corticosteroid",
                "first_aid_role": "Anti-inflammatory for acute flares with redness and pruritus",
                "dosage": "Apply thin layer twice daily to face/scalp for no more than 7 days",
                "contraindications": "Do not use on face for >7 days; avoid in rosacea; not for children under 2 years",
            },
        ],
        "dos": [
            "Instruct patient to wash face and scalp regularly with a gentle pH-balanced soap.",
            "Advise patient to keep skin moisturised to reduce scaling and dryness.",
            "Recommend patient avoid triggers: stress, cold weather, and oily cosmetics.",
            "Educate patient that seborrheic dermatitis is chronic and may require maintenance therapy.",
        ],
        "donts": [
            "Do not prescribe potent steroids (e.g. betamethasone) on the face — risk of skin atrophy.",
            "Do not use regular soap or detergents that strip skin barrier.",
            "Do not advise patient to scrub or pick scaling plaques — risks secondary infection.",
        ],
        "warning": "Seborrheic dermatitis is a chronic relapsing condition. Antifungal maintenance therapy every 2–4 weeks is often required. In immunocompromised patients (e.g. HIV), severe seborrheic dermatitis may signal disease progression — screen appropriately.",
    },

    "contact_dermatitis": {
        "primary_medications": [
            {
                "name": "Betamethasone Valerate 0.1% Cream (Betnovate)",
                "class": "Moderate-to-potent Topical Corticosteroid",
                "first_aid_role": "First-line anti-inflammatory for acute contact dermatitis flares",
                "dosage": "Apply thin layer twice daily to affected area for 7–14 days; taper gradually",
                "contraindications": "Do not apply to face, groin, or axillae for >5 days; avoid in skin infections",
            },
            {
                "name": "Chlorphenamine (Chlorpheniramine) 4mg tablets",
                "class": "First-generation H1 Antihistamine",
                "first_aid_role": "Oral antihistamine for pruritus relief in acute urticarial reactions",
                "dosage": "Adults: 4mg every 4–6 hours (max 24mg/day). Children 6–12: 2mg every 4–6 hours",
                "contraindications": "Avoid in glaucoma, prostate hypertrophy, liver disease; causes sedation — warn patient",
            },
            {
                "name": "Hydrocortisone 1% Cream + Calamine Lotion",
                "class": "Low-potency Steroid + Astringent / Antipruritic",
                "first_aid_role": "Combination for mild-moderate dermatitis and symptomatic itch relief",
                "dosage": "Calamine: apply as required to relieve itch. Hydrocortisone: twice daily for 7 days",
                "contraindications": "Calamine contraindicated in dry, cracked skin; hydrocortisone — avoid broken skin",
            },
        ],
        "dos": [
            "Immediately identify and remove the causative allergen or irritant from contact with skin.",
            "Wash affected area with clean water for at least 15 minutes after allergen exposure.",
            "Apply cool, moist compresses to reduce inflammation and burning sensation.",
            "Advise patient to wear protective gloves when handling known irritants in future.",
        ],
        "donts": [
            "Do not apply potent steroids to facial skin or under occlusion without specialist guidance.",
            "Do not allow patient to scratch affected area — this causes excoriation and secondary infection.",
            "Do not use antibiotic cream unless secondary bacterial infection is confirmed.",
            "Do not expose affected skin to heat, sunlight, or additional irritants during recovery.",
        ],
        "warning": "If contact dermatitis involves the eyes, mucous membranes, or airway (laryngeal oedema), treat as anaphylactic emergency — administer epinephrine 0.3mg IM and transfer immediately. Systemic corticosteroids (prednisolone 0.5mg/kg/day for 5–7 days) may be indicated for severe reactions.",
    },

    "ringworm": {
        "primary_medications": [
            {
                "name": "Clotrimazole 1% Cream (Canesten)",
                "class": "Topical Azole Antifungal",
                "first_aid_role": "First-line treatment for tinea corporis, tinea pedis, and cutaneous candidiasis",
                "dosage": "Apply twice daily to the lesion and 2cm beyond the border for 4 weeks",
                "contraindications": "Avoid in known azole hypersensitivity; do not use in eyes or mucous membranes",
            },
            {
                "name": "Terbinafine 1% Cream (Lamisil)",
                "class": "Allylamine Antifungal",
                "first_aid_role": "Highly effective against dermatophytes (Tinea species); faster than azoles",
                "dosage": "Apply once or twice daily for 1–2 weeks for tinea corporis; 2–6 weeks for tinea pedis",
                "contraindications": "Renal impairment (CrCl <50 ml/min) for systemic form; avoid in liver disease for oral form",
            },
            {
                "name": "Griseofulvin 500mg tablets (systemic — for extensive cases)",
                "class": "Systemic Antifungal / Microtubule Inhibitor",
                "first_aid_role": "Oral antifungal for extensive or recalcitrant tinea capitis and corporis",
                "dosage": "Adults: 500mg daily with fatty meal for 6–8 weeks. Children: 10–20mg/kg/day",
                "contraindications": "Pregnancy (teratogenic); porphyria; hepatic failure; photosensitising — advise sunscreen",
            },
        ],
        "dos": [
            "Instruct patient to keep the affected area clean and completely dry at all times.",
            "Advise patient to wear loose-fitting, breathable cotton clothing over the affected area.",
            "Wash and separately launder all clothing and bedding that contacted the affected area.",
            "Continue full treatment course even if lesion appears healed to prevent recurrence.",
        ],
        "donts": [
            "Do not apply corticosteroid cream alone — tinea incognito will mask and worsen the infection.",
            "Do not share towels, clothing, or bedding with other household members during treatment.",
            "Do not allow patient to apply herbal or lime/salt preparations to fungal lesions.",
            "Do not discontinue antifungal treatment early — minimum 4 weeks required for clearance.",
        ],
        "warning": "Tinea capitis (scalp ringworm) requires systemic therapy — topical antifungals alone are ineffective. In children, griseofulvin remains the gold standard. Inspect all close household contacts for asymptomatic infection and treat concurrently to break transmission chain.",
    },

    "vascular": {
        "primary_medications": [
            {
                "name": "Timolol 0.5% Ophthalmic Gel (Timoptic-XE) — topical off-label",
                "class": "Non-selective Beta-Blocker",
                "first_aid_role": "First-line topical therapy for infantile hemangiomas and superficial vascular lesions",
                "dosage": "Apply 1 drop topically to lesion twice daily; reassess at 4 weeks",
                "contraindications": "Bronchial asthma, COPD, cardiac conduction disorders, bradycardia; avoid in neonates <5 weeks",
            },
            {
                "name": "Propranolol 10mg/40mg tablets (systemic)",
                "class": "Non-selective Beta-Blocker (oral)",
                "first_aid_role": "Standard of care for proliferating infantile hemangiomas requiring systemic therapy",
                "dosage": "1–3 mg/kg/day in 2–3 divided doses with feeds; initiate under specialist supervision",
                "contraindications": "Asthma, RCHF, hypoglycaemia risk in infants; monitor BP and heart rate",
            },
            {
                "name": "Triamcinolone Acetonide 10mg/mL Injection (Kenalog)",
                "class": "Intralesional Corticosteroid",
                "first_aid_role": "Intralesional steroid for non-involuting vascular lesions (specialist-administered)",
                "dosage": "1–2 mg/kg per session, injected intralesionally by dermatologist; repeat at 6–8 weeks",
                "contraindications": "Active local infection; periorbital lesions (risk of retinal artery occlusion); coagulopathy",
            },
        ],
        "dos": [
            "Cover any ulcerated vascular lesion with a non-adherent sterile dressing (e.g. Mepitel).",
            "If the lesion is on the face near the eye, lip, or airway, expedite referral as emergency.",
            "Document lesion size, depth, and any active bleeding or ulceration with photographs.",
            "Advise parents/guardian to avoid any pressure, trauma, or tight clothing over the lesion.",
        ],
        "donts": [
            "Do not attempt to drain, excise, or laser-treat vascular lesions at community level.",
            "Do not apply caustic, herbal, or unverified topical preparations to vascular lesions.",
            "Do not delay referral for lesions near functionally critical areas (eye, lip, airway).",
            "Do not reassure patient/parent that all vascular tumors are benign — Kaposi sarcoma and pyogenic granuloma require pathological confirmation.",
        ],
        "warning": "Vascular tumors on the face near the eye may cause amblyopia (vision impairment) if untreated. Ulcerated hemangiomas can bleed profusely. Pyogenic granulomas may be confused with amelanotic melanoma — histopathological confirmation is essential. Any rapidly growing, friable vascular mass requires biopsy before treatment.",
    },

    "eczema": {
        "primary_medications": [
            {
                "name": "Betamethasone Valerate 0.1% Cream (Betnovate)",
                "class": "Moderate Topical Corticosteroid",
                "first_aid_role": "First-line treatment for acute eczema flares on the body",
                "dosage": "Apply thin layer once daily (body) or twice daily during flares for up to 14 days",
                "contraindications": "Do not apply to face, neck, or skin folds for >5 days; avoid in infected eczema without antibiotic cover",
            },
            {
                "name": "Tacrolimus 0.1% Ointment (Protopic)",
                "class": "Topical Calcineurin Inhibitor",
                "first_aid_role": "Steroid-sparing agent for face, eyelids, and areas requiring long-term therapy",
                "dosage": "Apply thin layer twice daily; continue until lesion clears; use 0.03% for children 2–15 years",
                "contraindications": "Active infection at site; immunocompromised patients; avoid in Netherton syndrome; theoretical malignancy risk with prolonged use",
            },
            {
                "name": "Cetirizine 10mg tablets (Zyrtec)",
                "class": "Second-generation H1 Antihistamine (non-sedating)",
                "first_aid_role": "Symptomatic relief of pruritus; reduces scratch-itch cycle",
                "dosage": "Adults and children >6 years: 10mg once daily. Children 2–6: 5mg once daily",
                "contraindications": "Severe renal impairment (CrCl <10ml/min); avoid in patients with prolonged QT interval",
            },
        ],
        "dos": [
            "Moisturise liberally with an emollient (e.g. aqueous cream, petroleum jelly) at least 3 times daily.",
            "Advise patient to bathe in lukewarm water (not hot) for maximum 10 minutes.",
            "Identify and eliminate triggers: dust mites, certain soaps, sweat, pet dander, and specific foods.",
            "Apply topical steroid 15–30 minutes after moisturiser while skin is still slightly damp.",
        ],
        "donts": [
            "Do not use potent steroids on the face, eyelids, or groin — risk of steroid-induced skin atrophy.",
            "Do not allow patient to scratch — apply cotton mittens to young children at night.",
            "Do not use fragranced soaps, detergents, or bubble baths on affected skin.",
            "Do not abruptly stop steroid therapy on large body surface areas — taper gradually.",
        ],
        "warning": "Eczema herpeticum (widespread HSV superinfection on eczematous skin) is a dermatological emergency — presents as punched-out erosions with fever. Initiate aciclovir 5mg/kg IV 8-hourly and arrange immediate hospital transfer. Secondary bacterial infection (S. aureus) requires systemic flucloxacillin or erythromycin.",
    },

    "psoriasis": {
        "primary_medications": [
            {
                "name": "Betamethasone + Calcipotriol Ointment (Daivobet / Taclonex)",
                "class": "Corticosteroid + Vitamin D3 Analogue Combination",
                "first_aid_role": "First-line combination therapy for plaque psoriasis",
                "dosage": "Apply once daily to plaques for up to 4 weeks; do not exceed 100g/week",
                "contraindications": "Pustular or erythrodermic psoriasis; hypercalcaemia; facial or intertriginous application",
            },
            {
                "name": "Coal Tar 5% Ointment / Shampoo",
                "class": "Antiproliferative / Anti-inflammatory",
                "first_aid_role": "Time-honoured treatment for scalp and chronic plaque psoriasis",
                "dosage": "Apply ointment daily or on alternate days; coal tar shampoo 2–3 times weekly",
                "contraindications": "Avoid on inflamed/infected or near facial skin; photosensitising — avoid UV exposure after application",
            },
            {
                "name": "Methotrexate 7.5–25mg weekly (systemic — via specialist)",
                "class": "Folate Antagonist / Immunosuppressant",
                "first_aid_role": "Disease-modifying agent for moderate-severe psoriasis; initiate referral for this",
                "dosage": "7.5mg oral/IM once weekly, escalate to 15–25mg; co-prescribe folic acid 5mg/week",
                "contraindications": "Pregnancy; significant hepatic/renal disease; active infection; alcohol dependency",
            },
        ],
        "dos": [
            "Moisturise daily with thick emollients to reduce scaling and plaque formation.",
            "Advise patient that stress management significantly reduces psoriasis flares.",
            "Encourage regular short sun exposure (15 minutes/day) — natural UV is therapeutic for psoriasis.",
            "Refer to dermatology for phototherapy (narrowband UVB) assessment if topicals are insufficient.",
        ],
        "donts": [
            "Do not abruptly stop systemic psoriasis therapy — rebound erythroderma is life-threatening.",
            "Do not use high-potency steroids under occlusion or on large body surface areas.",
            "Do not prescribe chloroquine or lithium — these are known psoriasis triggers.",
            "Do not apply treatments with strong fragrance or irritants to active plaques.",
        ],
        "warning": "Psoriatic arthritis develops in up to 30% of patients — enquire about joint pain and morning stiffness at every consultation. Erythrodermic or pustular psoriasis (>90% body surface area) is a medical emergency requiring hospitalisation for fluid/electrolyte management and systemic therapy under specialist care.",
    },

    "acne": {
        "primary_medications": [
            {
                "name": "Benzoyl Peroxide 5% Gel (Panoxyl, Brevoxyl)",
                "class": "Topical Antimicrobial / Comedolytic",
                "first_aid_role": "First-line treatment; kills C. acnes and prevents antibiotic resistance",
                "dosage": "Apply once daily after washing, starting with 2.5% to minimise irritation; increase to 5% after 2 weeks",
                "contraindications": "Avoid contact with hair or coloured fabrics (bleaching effect); stop if severe irritation develops",
            },
            {
                "name": "Clindamycin 1% Gel / Lotion (Dalacin-T)",
                "class": "Topical Antibiotic (Lincosamide)",
                "first_aid_role": "Reduces C. acnes colonisation and inflammation in moderate acne",
                "dosage": "Apply thin layer twice daily to affected areas; always combine with benzoyl peroxide to prevent resistance",
                "contraindications": "Never use as monotherapy (resistance); avoid in patients with antibiotic-associated colitis history",
            },
            {
                "name": "Adapalene 0.1% Gel (Differin)",
                "class": "Topical Retinoid (3rd generation)",
                "first_aid_role": "Normalises follicular keratinisation; prevents comedone formation; anti-inflammatory",
                "dosage": "Apply pea-sized amount to entire face at night; expect initial purging phase (2–4 weeks)",
                "contraindications": "Pregnancy (Category C); avoid concurrent abrasive cleansers or AHAs; strict sun protection required",
            },
        ],
        "dos": [
            "Cleanse face gently twice daily with a non-comedogenic, pH-balanced cleanser.",
            "Apply topical treatments to the entire affected zone, not just individual spots.",
            "Use oil-free, non-comedogenic moisturiser daily to counteract retinoid dryness.",
            "Advise patient to allow 8–12 weeks before assessing treatment response.",
        ],
        "donts": [
            "Do not prescribe oral antibiotics as monotherapy — always combine with topical benzoyl peroxide.",
            "Do not pop, squeeze, or pick at comedones — causes scarring and spreading infection.",
            "Do not apply toothpaste, lime juice, or harsh home remedies to acne lesions.",
            "Do not use oil-based or heavy cosmetics that will clog follicles.",
        ],
        "warning": "Nodulocystic acne can cause permanent scarring — refer early to dermatology for isotretinoin assessment. Isotretinoin (Accutane) is absolutely contraindicated in pregnancy — mandatory contraception and monthly pregnancy testing required. Depression has been reported with isotretinoin; monitor mental health during therapy.",
    },

    "cellulitis": {
        "primary_medications": [
            {
                "name": "Amoxicillin-Clavulanate 625mg (Augmentin)",
                "class": "Beta-lactam / Beta-lactamase Inhibitor Combination Antibiotic",
                "first_aid_role": "First-line oral antibiotic for non-purulent cellulitis caused by Streptococcus/Staphylococcus",
                "dosage": "Adults: 625mg (500/125) three times daily for 5–7 days; children: 25mg/kg/day in divided doses",
                "contraindications": "Penicillin or cephalosporin allergy; cholestatic jaundice with previous amoxicillin-clavulanate use",
            },
            {
                "name": "Flucloxacillin 500mg capsules",
                "class": "Penicillinase-resistant Penicillin",
                "first_aid_role": "First-choice for Staphylococcus aureus-dominant cellulitis (non-MRSA)",
                "dosage": "500mg four times daily, 30 minutes before meals, for 7–14 days",
                "contraindications": "Penicillin hypersensitivity; hepatotoxicity risk with prolonged use",
            },
            {
                "name": "Erythromycin 500mg tablets",
                "class": "Macrolide Antibiotic",
                "first_aid_role": "Alternative for penicillin-allergic patients with mild-moderate cellulitis",
                "dosage": "500mg four times daily for 7–14 days; take with food to reduce GI side effects",
                "contraindications": "QT prolongation; concurrent use of cisapride or terfenadine; hepatic impairment",
            },
        ],
        "dos": [
            "Mark the border of erythema with a skin marker pen and document time to monitor spread.",
            "Elevate the affected limb above heart level to reduce oedema and lymphatic congestion.",
            "Administer analgesia (paracetamol 1g every 6 hours) for pain and fever management.",
            "Transfer immediately to hospital if patient has fever >38.5°C, rigors, or rapidly spreading erythema.",
        ],
        "donts": [
            "Do not incise or drain non-fluctuant cellulitis — it is not an abscess and does not respond to drainage.",
            "Do not allow patient to walk extensively on an affected lower limb during acute phase.",
            "Do not apply heat or warming compresses to cellulitic skin.",
            "Do not miss systemic sepsis signs — tachycardia, hypotension, altered consciousness require emergency transfer.",
        ],
        "warning": "Necrotising fasciitis may initially resemble cellulitis. Red flags: pain disproportionate to appearance, skin crepitus, blistering, or rapid spread despite antibiotics — these require emergency surgical consultation. MRSA cellulitis requires clindamycin or trimethoprim-sulfamethoxazole; empiric treatment without culture should be avoided in recurrent cases.",
    },
}

# Condition-code → DB key mapping for fallback lookup
_CODE_TO_DB_KEY = {
    "melanoma":           "melanoma",
    "basal_cell":         "basal_cell",
    "seborrheic":         "seborrheic",
    "contact_dermatitis": "contact_dermatitis",
    "ringworm":           "ringworm",
    "vascular":           "vascular",
}

# Label keyword → DB key for direct label matching
_LABEL_TO_DB_KEY = [
    (["melanoma", "nevi", "mole"],                        "melanoma"),
    (["basal cell", "actinic", "squamous"],               "basal_cell"),
    (["seborrheic"],                                       "seborrheic"),
    (["contact dermatitis", "poison ivy"],                 "contact_dermatitis"),
    (["vascular", "hemangioma", "angiokeratoma",
      "cherry angioma", "kaposi", "pyogenic"],            "vascular"),
    (["tinea", "ringworm", "candida", "fungal", "wart",
      "molluscum", "scabies", "impetigo", "herpes",
      "cellulitis"],                                       "ringworm"),
    (["eczema", "atopic"],                                 "eczema"),
    (["psoriasis", "lichen", "urticaria", "hives"],        "psoriasis"),
    (["acne", "rosacea"],                                  "acne"),
    (["cellulitis"],                                       "cellulitis"),
]


def _get_db_entry(label: str, condition_code: str) -> dict[str, Any] | None:
    """Resolve the CONDITION_MEDICATION_DB entry for a given label/code."""
    lower = label.lower()
    for keywords, db_key in _LABEL_TO_DB_KEY:
        if any(kw in lower for kw in keywords):
            return CONDITION_MEDICATION_DB.get(db_key)
    return CONDITION_MEDICATION_DB.get(_CODE_TO_DB_KEY.get(condition_code, ""), None)


# ---------------------------------------------------------------------------
# Prompt builder — injects DB medications so LLM generates grounded text
# ---------------------------------------------------------------------------
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

    # Urgency logic
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
        "tinea", "ringworm", "fungus", "fungal", "candida", "nail",
        "vascular", "hemangioma"
    ]):
        urgency      = "Moderate" if top_confidence >= 85 else "Low"
        urgency_text = (
            "Refer to clinic within 3 days. High-confidence presentation requiring specialist assessment."
            if top_confidence >= 85
            else "Monitor and apply prescribed topical therapy. Review if no improvement in 2 weeks."
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

    # Build the medication reference block from the DB
    db_entry = _get_db_entry(top_label, condition_code)
    if db_entry:
        meds = db_entry.get("primary_medications", [])
        med_block = "\n".join(
            f"  Option {i+1}: {m['name']} | Class: {m['class']} | "
            f"First-Aid Role: {m['first_aid_role']} | "
            f"Dosage: {m['dosage']} | Contraindications: {m['contraindications']}"
            for i, m in enumerate(meds)
        )
        ref_dos   = "\n".join(f"  - {d}" for d in db_entry.get("dos", []))
        ref_donts = "\n".join(f"  - {d}" for d in db_entry.get("donts", []))
        ref_warn  = db_entry.get("warning", "")
    else:
        med_block = "  No specific medication protocol in DB — use best clinical judgment."
        ref_dos   = ""
        ref_donts = ""
        ref_warn  = ""

    patient_block = (
        f"Patient: {patient_name or 'Unknown'}, {patient_age or 'Unknown'} years old, "
        f"{patient_sex or 'Unknown'} sex.\n"
        f"Reported symptoms: {symptoms or 'None provided'}."
    )

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

CURATED MEDICATION REFERENCE (use these as your pharmacological anchor — personalise for this patient):
{med_block}

REFERENCE DOS (adapt to this patient's specific context):
{ref_dos}

REFERENCE DON'TS (adapt to this patient's specific context):
{ref_donts}

REFERENCE WARNING (incorporate medically into warningNote):
{ref_warn}

YOUR TASK:
Return ONLY a valid JSON object — no markdown wrappers, no code fences, no explanation before or after.
The JSON must have exactly these keys:

{{
  "primaryFinding":    "<clean display name for the top diagnosis, e.g. 'Basal Cell Carcinoma'>",
  "confidence":        {top_confidence},
  "urgency":           "{urgency}",
  "urgencyText":       "{urgency_text}",
  "treatmentNotes":    [
    "<Specific, patient-personalised instruction for {patient_name or 'the patient'} ({patient_age}yr {patient_sex}) — reference their symptoms '{symptoms or 'none reported'}' directly>",
    "<Second actionable step specific to {top_label} management at community level>",
    "<Third step: medication application instruction using the curated medication above>"
  ],
  "therapyRegimen": {{
    "medication": "<Full name of the primary recommended medication from the reference list above — the most appropriate for this patient's age, sex, and symptoms>",
    "regimen": "<Precise dosing schedule and frequency tailored to this patient>",
    "dosage": "<Strength, amount, and duration — be specific>",
    "contraindications": "<Contraindications most relevant to THIS patient — reference their age, sex, and any symptom flags>",
    "warningNote": "<Critical clinical warning specific to {top_label} — incorporate the reference warning and personalise>"
  }},
  "patientHandout": {{
    "dos": [
      "<Specific action 1 personalised to {patient_name or 'the patient'} and {top_label}>",
      "<Specific action 2>",
      "<Specific action 3>",
      "<Specific action 4>"
    ],
    "donts": [
      "<What {patient_name or 'the patient'} must strictly avoid — specific to {top_label}>",
      "<Second avoidance specific to this condition>",
      "<Third avoidance>"
    ]
  }},
  "recommendedAction": "<One clear sentence: name a specific facility type in Ghana, the procedure needed, and the timeframe>",
  "referralNote":      "<A detailed, multi-paragraph clinical report formatted in plain Markdown. Use real line breaks (\\n\\n between paragraphs). Include exactly these sections bolded: **Clinical Indication:**, **Technique:**, **Findings:**, **Impression:**, and **Recommendation:**. Name {patient_name or 'the patient'} explicitly. Reference the {top_confidence}% AI confidence score. Include the recommended medication from the reference list. End with the next step.>",
  "conditionCode":     "{condition_code}"
}}

RULES:
- treatmentNotes must be exactly 3 items. Each MUST reference {patient_name or 'the patient'} by name, their age/sex, OR their specific reported symptoms — these are NOT generic instructions.
- therapyRegimen MUST use one of the three medications from the CURATED MEDICATION REFERENCE above. Select the most appropriate for this patient's age and profile.
- patientHandout dos and donts MUST be specific to {top_label} and personalised — not generic skin care advice.
- recommendedAction must name a specific facility type appropriate for Ghana (e.g. Regional Hospital Dermatology Unit, District Hospital, Teaching Hospital Oncology Clinic).
- referralNote MUST use \\n for newlines within the JSON string value (standard JSON encoding). Include all 5 sections bolded.
- Do not change confidence, urgency, urgencyText, or conditionCode from the pre-computed values above.
- Return raw JSON only. Any text outside the JSON will break the parser.
"""


# ---------------------------------------------------------------------------
# Main Groq call
# ---------------------------------------------------------------------------
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
        return _plain_fallback(predictions, patient_name, patient_age, patient_sex, symptoms)

    prompt = _build_prompt(predictions, patient_name, patient_age, patient_sex, symptoms)

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a clinical dermatology AI assistant for a community health worker system. "
                    "You output only valid JSON. No markdown. No explanation. No code fences. "
                    "Your entire response must be parseable by json.loads(). "
                    "All clinical text must be specific to the patient provided — never generic."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.25,
        "max_tokens":  2500,
    }

    raw = ""
    try:
        with httpx.Client(timeout=45) as client:
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
                raw = raw.split("```", 2)[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()
            # Also strip trailing fences
            if raw.endswith("```"):
                raw = raw[:-3].strip()

            result = json.loads(raw)

            # Guarantee every key exists even if the model omits one
            top = predictions[0]
            result.setdefault("primaryFinding",    top["label"])
            result.setdefault("confidence",        round(top["confidence"] * 100))
            result.setdefault("conditionCode",     _derive_condition_code(top["label"]))
            result.setdefault("treatmentNotes",    [])
            result.setdefault("recommendedAction", "Refer to appropriate specialist.")
            result.setdefault("referralNote",      result.get("recommendedAction", ""))

            # Post-process referralNote: ensure real newlines reach the frontend
            if isinstance(result.get("referralNote"), str):
                result["referralNote"] = (
                    result["referralNote"]
                    .replace("\\n\\n", "\n\n")
                    .replace("\\n", "\n")
                )

            logger.info(
                "Groq structured response OK — finding: %s, urgency: %s",
                result.get("primaryFinding"),
                result.get("urgency"),
            )
            return result

    except json.JSONDecodeError as exc:
        logger.error("Groq returned invalid JSON: %s | raw: %.400s", exc, raw)
    except httpx.HTTPStatusError as exc:
        logger.error("Groq HTTP error %s: %s", exc.response.status_code, exc.response.text)
    except Exception as exc:
        logger.error("Groq request failed: %s", exc)

    return _plain_fallback(predictions, patient_name, patient_age, patient_sex, symptoms)


# ---------------------------------------------------------------------------
# Legacy shim — keeps existing views.py calls working
# ---------------------------------------------------------------------------
def generate_narrative(predictions: list[dict[str, Any]]) -> str:
    """Deprecated shim. Use generate_clinical_response() instead."""
    result = generate_clinical_response(predictions)
    return result.get("referralNote") or result.get("recommendedAction", "")


# ---------------------------------------------------------------------------
# Offline fallback — uses CONDITION_MEDICATION_DB for real clinical data
# ---------------------------------------------------------------------------
def _plain_fallback(
    predictions:  list[dict[str, Any]],
    patient_name: str = "",
    patient_age:  str = "",
    patient_sex:  str = "",
    symptoms:     str = "",
) -> dict[str, Any]:
    """
    Returns a valid structured dict when Groq is unavailable.
    Pulls from CONDITION_MEDICATION_DB for medically accurate content.
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

    name_ref    = patient_name or "the patient"
    age_ref     = f"{patient_age}-year-old" if patient_age else "adult"
    sex_ref     = patient_sex.lower() if patient_sex else "patient"
    symptom_ref = symptoms or "the presenting lesion"

    db_entry = _get_db_entry(top_label, condition_code)

    if db_entry:
        meds        = db_entry.get("primary_medications", [])
        primary_med = meds[0] if meds else None
        dos         = db_entry.get("dos", ["Keep area clean.", "Monitor for changes.", "Follow up as directed."])
        donts       = db_entry.get("donts", ["Do not scratch.", "Do not apply unverified home remedies."])
        warning     = db_entry.get("warning", "Follow standard clinical protocols.")

        therapy_regimen = {
            "medication":        primary_med["name"] if primary_med else "Topical symptomatic relief",
            "regimen":           primary_med["dosage"] if primary_med else "Apply twice daily as directed",
            "dosage":            primary_med["dosage"] if primary_med else "As directed by clinician",
            "contraindications": primary_med["contraindications"] if primary_med else "Consult prescriber",
            "warningNote":       warning,
        } if primary_med else {
            "medication":        "Topical symptomatic relief",
            "regimen":           "Apply twice daily as needed",
            "dosage":            "Thin layer",
            "contraindications": "Do not apply to broken skin",
            "warningNote":       warning,
        }

        treatment_notes = [
            f"Apply {primary_med['name'] if primary_med else 'prescribed topical'} to {name_ref}'s affected area as directed — {primary_med['dosage'] if primary_med else 'twice daily'}.",
            f"For this {age_ref} {sex_ref} presenting with {symptom_ref}: ensure area is clean and dry before each medication application.",
            f"Ensure {name_ref} understands the full treatment course duration for {top_label} — do not stop early even if symptoms improve.",
        ]
    else:
        therapy_regimen = {
            "medication":        "Topical symptomatic relief",
            "regimen":           "Apply twice daily as needed",
            "dosage":            "Thin layer to affected area",
            "contraindications": "Do not apply to broken skin",
            "warningNote":       "Consult a qualified clinician for specific guidance on this condition.",
        }
        dos   = ["Keep affected area clean and dry.", "Monitor for changes in size or appearance.", "Follow up at the nearest clinic if symptoms worsen."]
        donts = ["Do not scratch or pick at the lesion.", "Do not apply unverified home remedies."]
        treatment_notes = [
            f"Keep {name_ref}'s affected area clean and dry, and monitor for any changes in size, colour, or texture.",
            f"Avoid scratching or picking at the lesion — advise {name_ref} to cover it with a clean, non-adhesive dressing.",
            f"Follow up at the nearest clinic if {symptom_ref} worsens or does not improve within 2 weeks.",
        ]

    return {
        "primaryFinding":    top_label,
        "confidence":        top_confidence,
        "urgency":           urgency,
        "urgencyText":       urgency_text,
        "treatmentNotes":    treatment_notes,
        "therapyRegimen":    therapy_regimen,
        "patientHandout": {
            "dos":   dos,
            "donts": donts,
        },
        "recommendedAction": (
            f"Refer {name_ref} to the District Hospital Dermatology Unit for clinical assessment of {top_label}."
        ),
        "referralNote": (
            f"**Clinical Indication:**\n\n"
            f"{name_ref} ({age_ref} {sex_ref}) presented with {symptom_ref} consistent with {top_label}.\n\n"
            f"**Technique:**\n\n"
            f"Clinical photography and DermaVision AI skin analysis system (DINOv2-based) were utilised for assessment.\n\n"
            f"**Findings:**\n\n"
            f"The DermaVision AI system identified {top_label} as the primary diagnosis with {top_confidence}% model confidence. "
            f"Differential considerations include: {differential}.\n\n"
            f"**Impression:**\n\n"
            f"Findings are consistent with {top_label} based on visual lesion characteristics. "
            f"Triage urgency has been classified as {urgency}.\n\n"
            f"**Recommendation:**\n\n"
            f"Clinical correlation and specialist review are strongly recommended. "
            f"{urgency_text} Refer to the District Hospital Dermatology Unit for confirmation and initiation of definitive treatment."
        ),
        "conditionCode": condition_code,
    }