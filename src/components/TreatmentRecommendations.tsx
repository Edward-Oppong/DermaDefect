import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Pill,
  ShieldAlert,
  CheckSquare,
  Square,
  BookOpen,
  CheckCircle2,
  Info,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Stethoscope,
  Syringe,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DiagnosticResult, PatientDetails } from '../types';

interface TreatmentRecommendationsProps {
  finding: DiagnosticResult;
  patient: PatientDetails;
  caseId: string;
}

// ---------------------------------------------------------------------------
// Local medication DB — used only if backend returns no therapyRegimen.
// This is purely a UI safety-net; all primary content comes from Groq/backend.
// ---------------------------------------------------------------------------
interface MedOption {
  name: string;
  role: string;
  dosage: string;
  contraindications: string;
}

const LOCAL_MED_DB: Record<string, {
  meds: MedOption[];
  dos: string[];
  donts: string[];
  warning: string;
}> = {
  melanoma: {
    meds: [
      { name: "Imiquimod 5% Cream (Aldara)", role: "Immune response modifier for superficial lesions pending referral", dosage: "5 nights/week for up to 6 weeks", contraindications: "Immunocompromised patients; open wounds" },
      { name: "Diclofenac Sodium 3% Gel (Solaraze)", role: "NSAID anti-inflammatory for actinic-related lesions", dosage: "Twice daily for 60–90 days", contraindications: "NSAID hypersensitivity; broken skin" },
      { name: "Fluorouracil 5% Cream (Efudex)", role: "Topical antineoplastic for in-situ lesions", dosage: "Once daily until erosion then cease", contraindications: "Pregnancy (Cat X); mucous membranes" },
    ],
    dos: ["Cover lesion with sterile non-adhesive dressing.", "Apply SPF 50+ sunscreen to all surrounding skin.", "Document lesion borders with photographs.", "Complete urgent specialist referral paperwork immediately."],
    donts: ["Do not biopsy or excise at community level.", "Do not apply herbal or caustic substances to lesion.", "Do not delay referral — same-day transfer preferred.", "Do not allow patient to scratch or manipulate the lesion."],
    warning: "Melanoma carries a high risk of metastasis if not treated within the therapeutic window. Treat all suspicious pigmented lesions as oncological emergencies until proven otherwise.",
  },
  basal_cell: {
    meds: [
      { name: "Imiquimod 5% Cream (Aldara)", role: "First-line topical immunotherapy for superficial BCC", dosage: "5 times/week for 6 weeks; 8-hour contact time", contraindications: "Immunosuppressed patients; nodular BCC without specialist guidance" },
      { name: "Fluorouracil 5% Cream (Efudex)", role: "Topical chemotherapy for superficial BCC and actinic keratosis", dosage: "Twice daily for 3–6 weeks", contraindications: "Pregnancy (Cat X); DPD enzyme deficiency; periorbital use" },
      { name: "Vismodegib 150mg (Erivedge) — specialist only", role: "Systemic Hedgehog pathway inhibitor for advanced BCC", dosage: "150mg orally once daily — initiate referral for this", contraindications: "Pregnancy (teratogenic); severe hepatic impairment; breastfeeding" },
    ],
    dos: ["Apply SPF 50+ to lesion and surrounding skin.", "Cover with clean gauze secured with medical tape.", "Advise patient to avoid sun entirely on affected area.", "Complete urgent dermatology/oncology referral."],
    donts: ["Do not attempt excision at community level.", "Do not apply corticosteroids — masks lesion growth.", "Do not reassure patient — communicate urgency clearly."],
    warning: "BCC can cause extensive tissue destruction if untreated. Actinic keratosis has a 5–10% malignant transformation risk. Immediate dermatology referral is mandatory.",
  },
  vascular: {
    meds: [
      { name: "Timolol 0.5% Ophthalmic Gel (off-label topical)", role: "First-line for infantile hemangiomas and superficial vascular lesions", dosage: "1 drop topically twice daily; reassess at 4 weeks", contraindications: "Asthma; COPD; cardiac conduction disorders; neonates <5 weeks" },
      { name: "Propranolol 10–40mg (systemic)", role: "Standard of care for proliferating infantile hemangiomas", dosage: "1–3 mg/kg/day in 2–3 divided doses under specialist supervision", contraindications: "Asthma; RCHF; hypoglycaemia risk in infants" },
      { name: "Triamcinolone Acetonide 10mg/mL (Kenalog)", role: "Intralesional steroid for non-involuting lesions — specialist-administered", dosage: "1–2 mg/kg intralesionally; repeat at 6–8 weeks", contraindications: "Active local infection; periorbital lesions; coagulopathy" },
    ],
    dos: ["Cover ulcerated lesions with non-adherent sterile dressing (e.g. Mepitel).", "Expedite referral if lesion is near eye, lip, or airway.", "Document lesion size, depth, and any bleeding with photographs.", "Advise guardian to avoid pressure or tight clothing over lesion."],
    donts: ["Do not drain, excise, or attempt laser treatment at community level.", "Do not apply caustic or herbal preparations to vascular lesions.", "Do not delay referral for functionally critical area lesions.", "Do not assume all vascular tumors are benign — biopsy confirmation required."],
    warning: "Vascular lesions near the eye may cause amblyopia. Pyogenic granuloma may be confused with amelanotic melanoma — histopathological confirmation is essential. Rapidly growing, friable vascular masses require urgent biopsy.",
  },
  ringworm: {
    meds: [
      { name: "Clotrimazole 1% Cream (Canesten)", role: "First-line azole antifungal for tinea corporis and cutaneous candidiasis", dosage: "Twice daily, 2cm beyond lesion border, for 4 weeks", contraindications: "Azole hypersensitivity; eyes or mucous membranes" },
      { name: "Terbinafine 1% Cream (Lamisil)", role: "Allylamine antifungal; faster action vs dermatophytes than azoles", dosage: "Once or twice daily for 1–2 weeks", contraindications: "Renal impairment for systemic form; hepatic disease for oral form" },
      { name: "Griseofulvin 500mg tablets (extensive cases)", role: "Systemic antifungal for recalcitrant tinea capitis and corporis", dosage: "Adults: 500mg/day with fatty meal for 6–8 weeks", contraindications: "Pregnancy (teratogenic); porphyria; hepatic failure; photosensitising" },
    ],
    dos: ["Keep affected area completely clean and dry at all times.", "Wear loose-fitting, breathable cotton clothing.", "Wash and separately launder all bedding that contacted the area.", "Continue full treatment course even if lesion appears healed."],
    donts: ["Do not apply corticosteroid cream alone — tinea incognito will mask and worsen infection.", "Do not share towels, clothing, or bedding during treatment.", "Do not use herbal or lime/salt preparations on fungal lesions.", "Do not stop antifungal early — minimum 4 weeks required."],
    warning: "Tinea capitis requires systemic therapy — topical antifungals alone are ineffective. Inspect all household contacts and treat concurrently to break transmission.",
  },
  contact_dermatitis: {
    meds: [
      { name: "Betamethasone Valerate 0.1% Cream (Betnovate)", role: "First-line anti-inflammatory for acute dermatitis flares", dosage: "Thin layer twice daily for 7–14 days; taper gradually", contraindications: "Face/groin/axillae >5 days; skin infections" },
      { name: "Chlorphenamine 4mg tablets", role: "First-gen H1 antihistamine for pruritus relief", dosage: "Adults: 4mg every 4–6 hours (max 24mg/day)", contraindications: "Glaucoma; prostate hypertrophy; liver disease; causes sedation" },
      { name: "Hydrocortisone 1% Cream + Calamine Lotion", role: "Mild-moderate combination for itch and inflammation", dosage: "Calamine as required; hydrocortisone twice daily for 7 days", contraindications: "Calamine on dry cracked skin; hydrocortisone on broken skin" },
    ],
    dos: ["Immediately remove the causative allergen or irritant from contact.", "Wash affected area with clean water for ≥15 minutes.", "Apply cool, moist compresses to reduce inflammation.", "Advise patient to wear protective gloves when handling known irritants."],
    donts: ["Do not apply potent steroids to face under occlusion.", "Do not allow scratching — causes excoriation and secondary infection.", "Do not use antibiotic cream unless secondary infection is confirmed.", "Do not expose affected skin to heat, sunlight, or additional irritants."],
    warning: "If dermatitis involves eyes, mucous membranes, or airway, treat as anaphylactic emergency — administer epinephrine 0.3mg IM and transfer immediately.",
  },
  seborrheic: {
    meds: [
      { name: "Ketoconazole 2% Shampoo/Cream (Nizoral)", role: "First-line antifungal targeting Malassezia yeast", dosage: "Shampoo: twice weekly for 4 weeks. Cream: twice daily for 4 weeks", contraindications: "Avoid concurrent oral ketoconazole; acute scalp wounds" },
      { name: "Selenium Sulfide 2.5% Lotion (Selsun)", role: "Anti-Malassezia with sebosuppressive properties", dosage: "Apply, leave 10 minutes, rinse. Twice weekly.", contraindications: "Avoid eyes and inflamed/broken skin; avoid in pregnancy" },
      { name: "Hydrocortisone 1% Cream", role: "Low-potency steroid for acute flares with redness/pruritus", dosage: "Thin layer twice daily, max 7 days on face", contraindications: "Face >7 days; rosacea; children under 2 years" },
    ],
    dos: ["Wash face and scalp regularly with gentle pH-balanced soap.", "Keep skin moisturised to reduce scaling and dryness.", "Avoid triggers: stress, cold weather, and oily cosmetics.", "Educate patient this is a chronic relapsing condition requiring maintenance therapy."],
    donts: ["Do not prescribe potent steroids on the face — risk of atrophy.", "Do not use regular detergents that strip the skin barrier.", "Do not advise scrubbing or picking scaling plaques — risk of secondary infection."],
    warning: "In immunocompromised patients (e.g. HIV), severe seborrheic dermatitis may signal disease progression — screen appropriately. Maintenance antifungal therapy every 2–4 weeks is often required.",
  },
};

function getLocalEntry(conditionCode: string, primaryFinding: string) {
  const lower = primaryFinding.toLowerCase();
  if (lower.includes("melanoma") || lower.includes("nevi")) return LOCAL_MED_DB["melanoma"];
  if (lower.includes("basal") || lower.includes("actinic") || lower.includes("squamous")) return LOCAL_MED_DB["basal_cell"];
  if (lower.includes("vascular") || lower.includes("hemangioma") || lower.includes("angio")) return LOCAL_MED_DB["vascular"];
  if (lower.includes("tinea") || lower.includes("ringworm") || lower.includes("fungal") || lower.includes("candida")) return LOCAL_MED_DB["ringworm"];
  if (lower.includes("contact") || lower.includes("dermatitis") || lower.includes("eczema") || lower.includes("atopic")) return LOCAL_MED_DB["contact_dermatitis"];
  if (lower.includes("seborrheic")) return LOCAL_MED_DB["seborrheic"];
  return LOCAL_MED_DB[conditionCode] || null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const TreatmentRecommendations: React.FC<TreatmentRecommendationsProps> = ({ finding, patient, caseId }) => {
  const [activeTab, setActiveTab] = useState<'immediate' | 'clinical' | 'patient'>('immediate');
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [expandedMed, setExpandedMed] = useState<number | null>(0);

  useEffect(() => {
    setCompletedSteps({});
    setExpandedMed(0);
  }, [caseId]);

  const toggleStep = (stepText: string) => {
    setCompletedSteps(prev => ({ ...prev, [stepText]: !prev[stepText] }));
  };

  // Build the checklist — condition-specific treatmentNotes from backend + 2 standard triage steps
  const immediateActions = [
    ...(finding.treatmentNotes || []),
    `Communicate triage urgency to ${patient.name || 'patient'}: ${finding.urgencyText || 'Follow up as directed.'}`,
    `Hand over written Case ID (${caseId}) for hospital matching and referral tracking.`,
  ];

  const totalSteps      = immediateActions.length;
  const completedCount  = immediateActions.filter(s => completedSteps[s]).length;
  const progressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  // Therapy data — prefer backend Groq response, fall back to local DB
  const guideRx  = finding.therapyRegimen;
  const guidePt  = finding.patientHandout;
  const localEntry = getLocalEntry(finding.conditionCode, finding.primaryFinding);

  // Urgency badge color
  const urgencyColors = {
    High:     { bg: "bg-rose-50",   border: "border-rose-200",   text: "text-rose-800",   badge: "bg-rose-100 text-rose-700" },
    Moderate: { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-800",  badge: "bg-amber-100 text-amber-700" },
    Low:      { bg: "bg-emerald-50",border: "border-emerald-200",text: "text-emerald-800",badge: "bg-emerald-100 text-emerald-700" },
  };
  const uc = urgencyColors[finding.urgency] || urgencyColors["Low"];

  return (
    <div className="bg-white border border-[#bccac1] rounded-2xl overflow-hidden shadow-sm" id="treatment-recommendations-portal">

      {/* ── Header bar ─────────────────────────────────────────────── */}
      <div className="bg-[#f0f9ff] px-5 py-4 border-b border-[#bccac1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <HeartPulse className="w-5 h-5 text-[#0077b6] shrink-0" />
          <div>
            <h3 className="font-display font-extrabold text-sm text-[#181c1e] uppercase tracking-wide">
              Clinical Care &amp; Supportive Treatment Guide
            </h3>
            <p className="text-[10px] text-[#3d4943] font-semibold mt-0.5">
              Personalised management protocol for&nbsp;
              <span className="font-bold text-[#0077b6]">{finding.primaryFinding}</span>
              {patient.name && <> &mdash; Patient: <span className="text-[#181c1e]">{patient.name}</span></>}
            </p>
          </div>
        </div>

        {/* Triage progress pill */}
        <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${uc.bg} ${uc.border} self-start sm:self-auto`}>
          <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${uc.text}`} />
          <span className={`text-[10px] font-bold uppercase tracking-wider ${uc.text}`}>
            {finding.urgency} Urgency
          </span>
          <span className="text-[10px] text-slate-400">|</span>
          <span className="text-[10px] font-bold text-[#3d4943] uppercase tracking-wider">Steps:</span>
          <div className="w-10 bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#0077b6] h-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="font-mono text-[10px] font-extrabold text-[#0077b6]">{completedCount}/{totalSteps}</span>
        </div>
      </div>

      {/* ── Navigation tabs ──────────────────────────────────────── */}
      <div className="flex border-b border-slate-100 bg-[#f1f4f6] text-xs font-bold font-display overflow-x-auto scrollbar-none select-none">
        {([
          { id: 'immediate', icon: CheckSquare, label: 'Immediate Care Checklist' },
          { id: 'clinical',  icon: Pill,        label: 'Therapy Regimen (Rx)' },
          { id: 'patient',   icon: BookOpen,    label: "Patient Handout (Do's & Don'ts)" },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[130px] py-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === tab.id
                ? 'border-[#0077b6] text-[#0077b6] bg-white font-extrabold'
                : 'border-transparent text-[#3d4943] hover:text-[#0077b6] hover:bg-white/50'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5 shrink-0" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab panel ────────────────────────────────────────────── */}
      <div className="p-5 text-xs text-[#3d4943]">

        {/* ━━━ TAB 1: IMMEDIATE CARE CHECKLIST ━━━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'immediate' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-[#f0f9ff] text-[#005f73] p-3 rounded-xl border border-sky-100 leading-relaxed">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-[11px] font-semibold">
                Health Workers: The following steps are specific to <strong>{finding.primaryFinding}</strong> management
                {patient.name && <> for <strong>{patient.name}</strong></>}. Tick each off before patient discharge or transfer.
              </p>
            </div>

            <div className="space-y-2">
              {immediateActions.map((step, idx) => {
                const isChecked = !!completedSteps[step];
                return (
                  <div
                    key={idx}
                    onClick={() => toggleStep(step)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-white border-slate-200 hover:border-[#0077b6]/30 hover:bg-[#f0f9ff]/60 text-slate-800'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      {isChecked
                        ? <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                        : <Square className="w-4.5 h-4.5 text-slate-300" />}
                    </span>
                    <span className={`text-[11px] font-medium select-none leading-relaxed ${isChecked ? 'line-through text-slate-400' : ''}`}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>

            {progressPercent === 100 && (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs font-bold animate-fade-in">
                <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
                <span>All immediate care steps completed for {patient.name || 'this patient'}. Safe to transfer.</span>
              </div>
            )}
          </div>
        )}

        {/* ━━━ TAB 2: THERAPY REGIMEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'clinical' && (
          <div className="space-y-4">
            {guideRx ? (
              <>
                {/* Primary Groq-generated drug card */}
                <div className="border border-[#0077b6]/20 rounded-xl bg-[#f0f9ff] p-4 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#0077b6]/10">
                    <Stethoscope className="w-4 h-4 text-[#0077b6]" />
                    <h4 className="font-display font-bold text-xs text-[#181c1e]">
                      AI-Recommended Pharmacological Regimen
                    </h4>
                    <span className="ml-auto text-[9px] font-bold bg-[#0077b6] text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Primary Rx
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5">Medication</span>
                      <span className="text-xs font-bold text-[#0077b6]">{guideRx.medication}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5">Dosage &amp; Duration</span>
                        <span className="text-xs text-slate-800 font-mono leading-relaxed">{guideRx.dosage}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5">Administration Regimen</span>
                        <span className="text-xs text-slate-800 leading-relaxed">{guideRx.regimen}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <span className="text-[9px] text-amber-700 uppercase tracking-widest block font-extrabold mb-1">Contraindications &amp; Cautions</span>
                      <p className="text-[10.5px] text-amber-900 font-normal leading-relaxed">{guideRx.contraindications}</p>
                    </div>
                  </div>
                </div>

                {/* Critical warning block */}
                {guideRx.warningNote && (
                  <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl">
                    <ShieldAlert className="w-5 h-5 text-rose-600 mt-0.5 shrink-0 animate-pulse" />
                    <div>
                      <span className="font-display font-bold text-[9px] text-rose-700 tracking-wider uppercase block mb-0.5">
                        Critical Clinical Safeguards
                      </span>
                      <p className="text-[10.5px] font-normal text-rose-900 leading-relaxed">{guideRx.warningNote}</p>
                    </div>
                  </div>
                )}

                {/* Supplementary options from local DB */}
                {localEntry && localEntry.meds.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Syringe className="w-3.5 h-3.5" />
                      Additional Pharmacological Options
                    </p>
                    {localEntry.meds.slice(1).map((med, idx) => {
                      const isOpen = expandedMed === idx + 1;
                      return (
                        <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                          <button
                            onClick={() => setExpandedMed(isOpen ? null : idx + 1)}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                Option {idx + 2}
                              </span>
                              <span className="text-xs font-bold text-slate-800">{med.name}</span>
                            </div>
                            {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-3 bg-slate-50 border-t border-slate-100 space-y-2 pt-2.5">
                              <div>
                                <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5">Clinical Role</span>
                                <span className="text-[11px] text-slate-700">{med.role}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5">Dosage</span>
                                  <span className="text-[11px] font-mono text-slate-800">{med.dosage}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5">Contraindications</span>
                                  <span className="text-[11px] text-amber-800">{med.contraindications}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : localEntry ? (
              /* Fallback: show full local DB medications */
              <>
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-800">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-normal leading-relaxed">
                    AI-generated regimen unavailable — displaying evidence-based protocol options for <strong>{finding.primaryFinding}</strong>.
                  </p>
                </div>
                <div className="space-y-2.5">
                  {localEntry.meds.map((med, idx) => {
                    const isOpen = expandedMed === idx;
                    return (
                      <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedMed(isOpen ? null : idx)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-[#f0f9ff] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              idx === 0 ? 'bg-[#0077b6] text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {idx === 0 ? 'Primary' : `Option ${idx + 1}`}
                            </span>
                            <span className="text-xs font-bold text-slate-800">{med.name}</span>
                          </div>
                          {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-3 bg-slate-50 border-t border-slate-100 space-y-2.5 pt-2.5">
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5">Clinical Role</span>
                              <span className="text-[11px] text-slate-700 leading-relaxed">{med.role}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5">Dosage &amp; Duration</span>
                                <span className="text-[11px] font-mono text-slate-800">{med.dosage}</span>
                              </div>
                              <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                                <span className="text-[9px] text-amber-700 uppercase tracking-widest block font-bold mb-0.5">Contraindications</span>
                                <span className="text-[11px] text-amber-900">{med.contraindications}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {localEntry.warning && (
                  <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
                    <ShieldAlert className="w-5 h-5 text-rose-600 mt-0.5 shrink-0 animate-pulse" />
                    <div>
                      <span className="font-display font-bold text-[9px] text-rose-700 uppercase tracking-wider block mb-0.5">Critical Clinical Warning</span>
                      <p className="text-[10.5px] text-rose-900 font-normal leading-relaxed">{localEntry.warning}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-slate-400 font-normal text-xs">
                No pharmacological protocol available for this condition. Follow standard MOH clinical guidelines.
              </div>
            )}
          </div>
        )}

        {/* ━━━ TAB 3: PATIENT HANDOUT ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'patient' && (
          <div className="space-y-4">
            {/* Resolve dos/donts: backend → local DB → empty message */}
            {(() => {
              const dos   = guidePt?.dos?.length   ? guidePt.dos   : localEntry?.dos   || [];
              const donts = guidePt?.donts?.length  ? guidePt.donts : localEntry?.donts || [];
              const hasContent = dos.length > 0 || donts.length > 0;

              if (!hasContent) {
                return (
                  <div className="text-center py-8 text-slate-400 font-normal text-xs">
                    No patient handout data available. Follow standard community health protocols.
                  </div>
                );
              }

              return (
                <>
                  <div className="flex items-start gap-2 bg-[#f0f9ff] text-[#005f73] p-3 rounded-xl border border-sky-100">
                    <BookOpen className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-normal leading-relaxed">
                      Provide these instructions to <strong>{patient.name || 'the patient'}</strong> or guardian for home management of <strong>{finding.primaryFinding}</strong> before clinic follow-ups.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Do's */}
                    <div className="border border-emerald-100 rounded-xl p-4 bg-emerald-50/30 space-y-3">
                      <div className="flex items-center gap-1.5 pb-2 border-b border-emerald-100">
                        <ThumbsUp className="w-4 h-4 text-emerald-600" />
                        <span className="font-display font-bold text-xs text-emerald-800 uppercase tracking-wide">What To Do</span>
                      </div>
                      <ul className="space-y-2.5">
                        {dos.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px] text-slate-800 font-normal leading-relaxed">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Don'ts */}
                    <div className="border border-rose-100 rounded-xl p-4 bg-rose-50/30 space-y-3">
                      <div className="flex items-center gap-1.5 pb-2 border-b border-rose-100">
                        <ThumbsDown className="w-4 h-4 text-rose-500" />
                        <span className="font-display font-bold text-xs text-rose-800 uppercase tracking-wide">What To Avoid</span>
                      </div>
                      <ul className="space-y-2.5">
                        {donts.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px] text-slate-800 font-normal leading-relaxed">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Show local warning if no backend data */}
                  {!guidePt && localEntry?.warning && (
                    <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
                      <ShieldAlert className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-display font-bold text-[9px] text-rose-700 uppercase tracking-wider block mb-0.5">
                          Clinical Warning for {finding.primaryFinding}
                        </span>
                        <p className="text-[10.5px] text-rose-900 font-normal leading-relaxed">{localEntry.warning}</p>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
};