/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PatientDetails {
  name: string;
  age: string;
  sex: 'Male' | 'Female' | '';
  symptoms: string;
}

export interface DiagnosticResult {
  primaryFinding: string;
  confidence: number;
  urgency: 'High' | 'Moderate' | 'Low';
  urgencyText: string;
  treatmentNotes: string[];
  recommendedAction: string;
  conditionCode: string; // e.g. "basal_cell", "ringworm", "melanoma", "contact_dermatitis", "seborrheic"
}

export interface CaseRecord {
  id: string; // e.g. "DD-2026-8842"
  patient: PatientDetails;
  date: string;
  finding: DiagnosticResult;
  image: string; // Base64 or hotlinked URL
  healthWorker: string;
  saved: boolean;
}

// Initial mockup data to populate the Case History table match the design screenshots
export const INITIAL_CASES: CaseRecord[] = [
  {
    id: "DD-2024-4429",
    patient: {
      name: "John Doe",
      age: "62",
      sex: "Male",
      symptoms: "Patient reports lesion has grown 2mm over the last 3 months. Occasional itching. No bleeding observed at time of assessment."
    },
    date: "Oct 24, 2024",
    finding: {
      primaryFinding: "Basal Cell Carcinoma",
      confidence: 85,
      urgency: "High",
      urgencyText: "Refer to dermatology unit within 7 days for biopsy. Standard clinical referral path recommended.",
      treatmentNotes: [
        "Advise patient to avoid excessive sun exposure and use high-factor sunscreen.",
        "Keep the lesion clean and dry, monitor for any rapid growth or ulceration.",
        "Avoid picking, scratching, or irritating the affected area."
      ],
      recommendedAction: "Refer to District Hospital Oncology/Dermatology Unit for surgical excision or confirmatory punch biopsy.",
      conditionCode: "Basal Cell Carcinoma"
    },
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDJWwej8fG1lAVKpAwYOypgyLYNsrdpWfozoAsdmuPBa3mcTKWl8MGOIvtoCGFjmFjPlgUa9VbGsrXGAUZB-8uZRSa95vHUZGCzf7usU1pk-L5TRU--GbrIxaRc5I5RLjCMmFzVlyuPCHoXuV3ivl0MVLr1MbuOJWu_je3TJlufKdqZaUvFoVVWZAC6SsthwSmkPJunsVT9kj0zdsET_eHEPvgMEoEMw4gL2IxGHhRFKtWjbLlSuduZNqQmNtnVjib54dWqMAsTmw",
    healthWorker: "K. Mensah",
    saved: true
  },
  {
    id: "DD-2024-1124",
    patient: {
      name: "Anita Sharma",
      age: "28",
      sex: "Female",
      symptoms: "Intense redness and itching on the left wrist after wearing a new metallic watch band. Onset was 2 days ago."
    },
    date: "Oct 22, 2024",
    finding: {
      primaryFinding: "Contact Dermatitis",
      confidence: 94,
      urgency: "Low",
      urgencyText: "Symptoms are local and stable. Self-recovery or standard health worker monitoring is sufficient.",
      treatmentNotes: [
        "Identify and remove the offending allergen (metallic watch band).",
        "Apply standard 1% hydrocortisone cream twice daily for up to 7 days.",
        "Recommend cold compresses to alleviate intense local itching."
      ],
      recommendedAction: "Local outpatient symptom management. Instruct patient to return if symptoms persist beyond two weeks.",
      conditionCode: "Contact Dermatitis"
    },
    image: "https://images.unsplash.com/photo-1584634731339-252c5aba1957?q=80&w=1000&auto=format&fit=crop",
    healthWorker: "K. Mensah",
    saved: true
  },
  {
    id: "DD-2024-8832",
    patient: {
      name: "Mark Kim",
      age: "41",
      sex: "Male",
      symptoms: "Yellowish, greasy scale along the nasolabial fold and eyebrows. Mild itching, present off-and-on for several months."
    },
    date: "Oct 20, 2024",
    finding: {
      primaryFinding: "Seborrheic Keratosis",
      confidence: 90,
      urgency: "Moderate",
      urgencyText: "Benign condition, but requires clinical advice to differentiate from dangerous melanocytic lesions.",
      treatmentNotes: [
        "Reassure the patient of the completely benign nature of the keratosis.",
        "Advise against picking or scratching the lesion to prevent secondary bacterial infection.",
        "Monitor for changes in size, symmetry, or border definitions."
      ],
      recommendedAction: "General dermatologist outpatient consult for electro-desciccation, cryotherapy, or cosmetic removal if desired.",
      conditionCode: "Seborrheic Keratosis"
    },
    image: "https://images.unsplash.com/photo-1579684389782-64d84b5e901a?q=80&w=1000&auto=format&fit=crop",
    healthWorker: "K. Mensah",
    saved: true
  },
  {
    id: "DD-2024-5541",
    patient: {
      name: "Beatriz Lopez",
      age: "35",
      sex: "Female",
      symptoms: "Irregularly shaped dark mole on the upper back, noted by a family member. Color variation is present."
    },
    date: "Oct 19, 2024",
    finding: {
      primaryFinding: "Melanoma Suspect",
      confidence: 78,
      urgency: "High",
      urgencyText: "High clinical suspicion. Strict, immediate referral is indicated to rule out invasive malignancy.",
      treatmentNotes: [
        "Strictly avoid sun exposure; wear protective clothing over the affected region.",
        "Do not apply topical creams or manipulate the mole in any way.",
        "Advise the patient that prompt specialist inspection is extremely critical."
      ],
      recommendedAction: "Immediate fast-track referral to Regional Hospital Dermatology Unit for excisional biopsy and histopathology mapping.",
      conditionCode: "Melanoma Suspect"
    },
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAUjVE8wZ6DDtv9UMNjcEGTjaMsrXlKUSwmyBxhcBMIuoAfm4lDuLam_m1KE4cEfP0Q2ghmz1scV8wzPTQ56YQI7XyBuURndFrwx6Eq9Os-dV_NJtuLsBU1I_WiWDhC8E1FXIw7b0EaCA6DQc6uCnRytpU4HwvBWRbcDDISfesiNUBMkx5hIrR83tPvFK6IR8OGKEKWnONxTgL5R_K_yVOnkGH1NslpLZynMavEL8caKy6AWd6v4KPZig4a4m0Ug_sjpuo1lTg6YA",
    healthWorker: "K. Mensah",
    saved: true
  }
];

export interface SampleCaseTemplate {
  name: string;
  code: string;
  rating: number;
  imageUrl: string;
  finding: DiagnosticResult;
}

// High quality clinical sample condition templates that a worker can select in the capturing stage
export const SAMPLE_CASE_TEMPLATES: SampleCaseTemplate[] = [
  {
    name: "Ringworm (Tinea Corporis)",
    code: "ringworm",
    rating: 88,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuA8KGSxrPjHTcaboI6_Op6bZScikBOOxXbw3DzW5_BKMKj7_edTv4AuPaEgMn5cM2AXQHsJ66DwxyXLoyXWJ-XZyRPZ11HNM7GLm-_bZxKRu8J4rOeK0qxOPCv2ixDlvhnC3E2YrOtw_bKY8X2eVQzDTvyxGNBRoiEWIsoGqSiwhLR3WYs9L80Za6jZYNo97myWwkeNy_Sxc6LRLgIbIIL5T-i38BqeVoBOF8CABavAfn3GjoM59yx9gr5m6U-gb3byltWLqZW2ww",
    finding: {
      primaryFinding: "Ringworm (Tinea Corporis)",
      confidence: 88,
      urgency: "Moderate",
      urgencyText: "Refer to clinic within 3 days. Symptoms are progressive but non-emergent.",
      treatmentNotes: [
        "Advise patient to keep the affected skin area clean and dry.",
        "Avoid sharing personal items like towels, comb, or clothing with family members.",
        "Apply over-the-counter antifungal cream (e.g., Clotrimazole or Miconazole) twice daily until pediatric or clinical review."
      ],
      recommendedAction: "Refer to District Hospital Dermatology Unit or general health post for confirmatory biopsy and initiation of systemic antifungal therapy.",
      conditionCode: "Ringworm"
    }
  },
  {
    name: "Contact Dermatitis (Metal Rash)",
    code: "contact_dermatitis",
    rating: 94,
    imageUrl: "https://images.unsplash.com/photo-1584634731339-252c5aba1957?q=80&w=1000&auto=format&fit=crop",
    finding: {
      primaryFinding: "Contact Dermatitis",
      confidence: 94,
      urgency: "Low",
      urgencyText: "Local symptoms are stable and manageable with standard home care checks.",
      treatmentNotes: [
        "Identify and completely isolate the contact allergen (e.g. soaps, metals, cosmetics).",
        "Instruct patient to avoid scratching to prevent opportunistic bacterial infections.",
        "Apply cooling compresses or mild standard topical corticosteroids if requested."
      ],
      recommendedAction: "Local health post therapy. Re-evaluate if lesions expand or do not subside in 10-14 days.",
      conditionCode: "Contact Dermatitis"
    }
  },
  {
    name: "Basal Cell Carcinoma (Suspected)",
    code: "basal_cell",
    rating: 85,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDJWwej8fG1lAVKpAwYOypgyLYNsrdpWfozoAsdmuPBa3mcTKWl8MGOIvtoCGFjmFjPlgUa9VbGsrXGAUZB-8uZRSa95vHUZGCzf7usU1pk-L5TRU--GbrIxaRc5I5RLjCMmFzVlyuPCHoXuV3ivl0MVLr1MbuOJWu_je3TJlufKdqZaUvFoVVWZAC6SsthwSmkPJunsVT9kj0zdsET_eHEPvgMEoEMw4gL2IxGHhRFKtWjbLlSuduZNqQmNtnVjib54dWqMAsTmw",
    finding: {
      primaryFinding: "Basal Cell Carcinoma",
      confidence: 85,
      urgency: "High",
      urgencyText: "Refer to dermatology within 7 days. Progressively enlarging classic pearly nodule with telangiectasia.",
      treatmentNotes: [
        "Instruct patient strictly in sun protective behaviors (broad-spectrum sunscreen, wide hats).",
        "Keep the area clean, avoid picking or surgical probing in unauthorized environments.",
        "Monitor for border elevation, pigment changes, local bleeding or weeping."
      ],
      recommendedAction: "Refer to District Hospital Surgery/Oncology Unit for excision biopsy under local anesthesia.",
      conditionCode: "Basal Cell"
    }
  },
  {
    name: "Melanoma (Highly Suspect)",
    code: "melanoma",
    rating: 78,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAUjVE8wZ6DDtv9UMNjcEGTjaMsrXlKUSwmyBxhcBMIuoAfm4lDuLam_m1KE4cEfP0Q2ghmz1scV8wzPTQ56YQI7XyBuURndFrwx6Eq9Os-dV_NJtuLsBU1I_WiWDhC8E1FXIw7b0EaCA6DQc6uCnRytpU4HwvBWRbcDDISfesiNUBMkx5hIrR83tPvFK6IR8OGKEKWnONxTgL5R_K_yVOnkGH1NslpLZynMavEL8caKy6AWd6v4KPZig4a4m0Ug_sjpuo1lTg6YA",
    finding: {
      primaryFinding: "Melanoma Suspect",
      confidence: 78,
      urgency: "High",
      urgencyText: "Urgent primary triage indicated! Highly suspicious borders and mixed pigmentation.",
      treatmentNotes: [
        "Patient must be fast-tracked for professional specialist pathology consult.",
        "Strictly protect the mole from ultraviolet radiation.",
        "Educate patient in the ABCDE melanoma rule to monitor other spots."
      ],
      recommendedAction: "Immediate dermatologist fast-track referral for wide local excision and lymph node mapping.",
      conditionCode: "Melanoma"
    }
  }
];
