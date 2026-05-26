/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PatientDetails {
  name: string;
  age: string;
  sex: "Male" | "Female" | "";
  symptoms: string;
  contactNumber: string;
}

export interface DiagnosticResult {
  primaryFinding: string;
  confidence: number;
  urgency: "High" | "Moderate" | "Low";
  urgencyText: string;
  treatmentNotes: string[];
  recommendedAction: string;
  referralNote: string;
  conditionCode: string;
  heatmap_b64?: string;
  therapyRegimen?: {
    medication: string;
    regimen: string;
    dosage: string;
    contraindications: string;
    warningNote: string;
  };
  patientHandout?: {
    dos: string[];
    donts: string[];
  };
}

export interface CaseRecord {
  id: string;
  patient: PatientDetails;
  date: string;
  finding: DiagnosticResult;
  image: string;
  healthWorker: string;
  saved: boolean;
}

export interface SampleCaseTemplate {
  name: string;
  code: string;
  rating: number;
  imageUrl: string;
}

export const SAMPLE_CASE_TEMPLATES: SampleCaseTemplate[] = [
  {
    name: "Ringworm (Tinea Corporis)",
    code: "ringworm",
    rating: 88,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA8KGSxrPjHTcaboI6_Op6bZScikBOOxXbw3DzW5_BKMKj7_edTv4AuPaEgMn5cM2AXQHsJ66DwxyXLoyXWJ-XZyRPZ11HNM7GLm-_bZxKRu8J4rOeK0qxOPCv2ixDlvhnC3E2YrOtw_bKY8X2eVQzDTvyxGNBRoiEWIsoGqSiwhLR3WYs9L80Za6jZYNo97myWwkeNy_Sxc6LRLgIbIIL5T-i38BqeVoBOF8CABavAfn3GjoM59yx9gr5m6U-gb3byltWLqZW2ww",
  },
  {
    name: "Contact Dermatitis (Metal Rash)",
    code: "contact_dermatitis",
    rating: 94,
    imageUrl:
      "https://images.unsplash.com/photo-1584634731339-252c5aba1957?q=80&w=1000&auto=format&fit=crop",
  },
  {
    name: "Basal Cell Carcinoma (Suspected)",
    code: "basal_cell",
    rating: 85,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDJWwej8fG1lAVKpAwYOypgyLYNsrdpWfozoAsdmuPBa3mcTKWl8MGOIvtoCGFjmFjPlgUa9VbGsrXGAUZB-8uZRSa95vHUZGCzf7usU1pk-L5TRU--GbrIxaRc5I5RLjCMmFzVlyuPCHoXuV3ivl0MVLr1MbuOJWu_je3TJlufKdqZaUvFoVVWZAC6SsthwSmkPJunsVT9kj0zdsET_eHEPvgMEoEMw4gL2IxGHhRFKtWjbLlSuduZNqQmNtnVjib54dWqMAsTmw",
  },
  {
    name: "Melanoma (Highly Suspect)",
    code: "melanoma",
    rating: 78,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAUjVE8wZ6DDtv9UMNjcEGTjaMsrXlKUSwmyBxhcBMIuoAfm4lDuLam_m1KE4cEfP0Q2ghmz1scV8wzPTQ56YQI7XyBuURndFrwx6Eq9Os-dV_NJtuLsBU1I_WiWDhC8E1FXIw7b0EaCA6DQc6uCnRytpU4HwvBWRbcDDISfesiNUBMkx5hIrR83tPvFK6IR8OGKEKWnONxTgL5R_K_yVOnkGH1NslpLZynMavEL8caKy6AWd6v4KPZig4a4m0Ug_sjpuo1lTg6YA",
  },
];
