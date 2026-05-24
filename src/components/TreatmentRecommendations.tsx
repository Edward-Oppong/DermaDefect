import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, 
  Pill, 
  ShieldAlert, 
  CheckSquare, 
  Square, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  Info
} from 'lucide-react';
import { DiagnosticResult, PatientDetails } from '../types';

interface TreatmentRecommendationsProps {
  finding: DiagnosticResult;
  patient: PatientDetails;
  caseId: string;
}

export interface TreatmentProtocol {
  medication: string;
  regimen: string;
  dosage: string;
  contraindications: string;
  dos: string[];
  donts: string[];
  warningNote: string;
}

// Map conditionCode to structured professional clinical guidelines
export const CONDITIONAL_GUIDELINES: Record<string, TreatmentProtocol> = {
  ringworm: {
    medication: "Topical Antifungal Agents (Terbinafine, Clotrimazole, or Miconazole)",
    regimen: "Apply a thin layer of cream to the affected lesion plus a 2cm margin of normal-appearing surrounding skin twice daily.",
    dosage: "Duration: Continue for 2 weeks after clinical symptoms disappear (typically 2-4 total weeks of treatment).",
    contraindications: "Avoid strong combination steroid/antifungal creams (such as Betamethasone-Clotrimazole) for initial therapy. Corticosteroids weaken local anti-fungal barrier response and promote tinea incognito (masked fungal progression).",
    dos: [
      "Keep infected skin areas thoroughly washed and dried, especially prior to cream application.",
      "Wear loose, highly breathable cotton clothing to minimize friction, heat, and moisture buildup.",
      "Regularly wash patient's clothing, towels, and bed linens in hot water (>60°C) to destroy persistent fungal spores."
    ],
    donts: [
      "Do not scratch the lesion, as this can cause secondary bacterial skin infection or autoinoculation to other body sites.",
      "Do not share personal clothing, towels, hairbrushes, or bedding with family members.",
      "Do not cover the treated lesion with airtight, moisture-trapping plastic bandages."
    ],
    warningNote: "If the lesion fails to improve after 14 days of compliant topical therapy, or if multiple extensive lesions appear on different body quadrants, refer the patient for oral systemic terbinafine prescription."
  },
  contact_dermatitis: {
    medication: "Mild-to-Moderate Potency Topical Corticosteroid & Protective Emollients",
    regimen: "Apply Hydrocortisone 1% or Triamcinolone acetonide 0.1% cream to active plaques as configured, followed by generous barrier-repair emollient application.",
    dosage: "Duration: Apply twice daily for 5-10 days. Sparing application on thin skin.",
    contraindications: "Do not apply medium-to-high potency steroid cream on thin skin regions (face, axillae, groin) for more than 5 days without pediatric/dermatologist oversight to prevent skin atrophy (thinning).",
    dos: [
      "Immediately identify and isolate the offending physical contact allergen (irritant soaps, watch metals, cosmetics).",
      "Apply plain lubricating ointments (pure petrolatum or ceramide barrier creams) frequently to restore stratum corneum.",
      "Apply clean, cool damp compresses for 10-15 minutes to alleviate severe local burning and active pruritus (itching)."
    ],
    donts: [
      "Do not wash the area with harsh alkaline soap, rubbing alcohol-based sanitizers, or excessively hot water.",
      "Do not wear abrasive synthetic, rough woolen, or skin-tight garments directly over the active eczema flare.",
      "Do not pop or probe any tense fluid-filled micro-vesicles that may form on the skin surface."
    ],
    warningNote: "For acute, severe allergic contact dermatitis covering >20% of the patient body surface area, refer immediately to general physicians for oral prednisone tapering treatment."
  },
  melanoma: {
    medication: "Immediate Surgical Referral for Wide Local Oncological Excision (No base topicals)",
    regimen: "Highly suspicious pigmented tumor requiring urgent staging and immunohistochemical validation. Excisional biopsy is life-saving; secondary drugs are only for metastatic disease.",
    dosage: "Surgical Margins: Typically 1cm to 2cm clear lateral margin mapped according to initial Breslow micrometer depth.",
    contraindications: "Absolutely contraindicate laser hair/vein removal, shave diagnostics, or cryo-freeze ablation on suspicious pigmented macules, as it destroys essential surgical margins needed for staging.",
    dos: [
      "Fast-track patient triage registration directly to an oncology/dermatology pathology unit.",
      "Reiterate strict daily sun-protective behavior: stay in shade during peak hours (10 AM to 4 PM), wear certified UPF 50+ clothing, and use wide brim hats.",
      "Counsel patient to monitor adjacent lymph node basins for secondary painless swelling."
    ],
    donts: [
      "Do not reassure the patient or defer follow-ups without secure biopsy findings.",
      "Do not perform narrow-shave biopsies or attempt partial drainage of suspicious dark skin nodules.",
      "Do not wait for active bleeding, weeping, or sensory pain to trigger onward referral."
    ],
    warningNote: "Cutaneous melanoma is highly aggressive and carries high risk of rapid systemic metastasis. Prompt oncologist surgical biopsy is the primary life-saving action."
  },
  basal_cell: {
    medication: "Surgical Excision, Mohs Micrographic Surgery, or Supervisory Topical Immunomodulators",
    regimen: "Standard of care is surgical clearance. Non-surgical superficial options include Topical Imiquimod 5% cream applied directly to small superficial lesions.",
    dosage: "Imiquimod course: Apply 5 times weekly for 6 consecutive weeks under healthcare provider follow-up. Standard surgical margins are 4mm.",
    contraindications: "Do not attempt standard skin curettage or cryotherapy on deep nodular BCC as microscopic roots remain unreached and can destroy underlying subcutaneous tissue.",
    dos: [
      "Ensure the lesion is clean and protected from sharp accidental micro-trauma or continuous scratching.",
      "Educate the patient that while BCC is slow-growing and rarely metastasizes, it is progressive and locally destructive.",
      "Apply light sterilizing pressure and sterile gauze if the lesion bleeds due to minor abrasion."
    ],
    donts: [
      "Do not scratch, peel, or attempt to pop pearly translucense diagnostic borders.",
      "Do not apply corrosive chemical burning formulas, acidic folk pastes, or unregulated herbal cautery.",
      "Do not delay specialist surgical appointments: microvascular invasion occurs silently over months."
    ],
    warningNote: "If left untreated, basal cell carcinoma will cause deep destruction of local tissues and bones, especially around facial structures like the eyelids, nose, or lips."
  },
  seborrheic: {
    medication: "Patient Assurances or Pruritic Symptomatic Cryotherapy & Keratolytics",
    regimen: "Completely benign non-contagious epidermal growth. Intervention is exclusively for diagnosis confirmation, physical irritation, or aesthetic patient request. Low strength salicylic acid.",
    dosage: "Liquid nitrogen cryosurgery (single light session) or topical 10% urea cream daily to soften stuck-on crusts.",
    contraindications: "Do not freeze heavily or use deep surgical cautery on high-melanin skin types (Fitzpatrick scale IV-VI) to avoid permanent cosmetic hypopigmentation or thick keloids.",
    dos: [
      "Provide complete reassuring counseling that the spot is benign and does not turn into cancer.",
      "Advise the patient to wear loose clothing if the keratosis is repeatedly rubbed or irritated by beltlines or straps.",
      "Perform careful periodic examination to ensure atypical bordering lesions don't mimic pigmented skin cancers."
    ],
    donts: [
      "Do not pick, peel, scrape, or vigorously scrub stuck-on crusts with mechanical files, which can cause bleeding.",
      "Do not spray aggressive liquid nitrogen on surrounding normal skin.",
      "Do not self-prescribe strong high-potency steroid creams to reduce non-inflamed SK height."
    ],
    warningNote: "If the patient experiences a sudden explosive crop of dozens of new itchy seborrheic keratoses over a few weeks, refer for immediate physician review to rule out internal pathology (Leser-Trélat sign)."
  }
};

export const normalizeCode = (code: string | undefined): string => {
  if (!code) return 'ringworm';
  const c = code.toLowerCase().trim();
  if (c.includes('ringworm') || c.includes('tinea') || c.includes('corporis')) return 'ringworm';
  if (c.includes('contact') || c.includes('dermatitis') || c.includes('allergy')) return 'contact_dermatitis';
  if (c.includes('melanoma') || c.includes('pigment')) return 'melanoma';
  if (c.includes('basal') || c.includes('carcinoma') || c.includes('pearly')) return 'basal_cell';
  if (c.includes('seborrheic') || c.includes('keratosis')) return 'seborrheic';
  return 'ringworm'; // safe fallback
};

export const TreatmentRecommendations: React.FC<TreatmentRecommendationsProps> = ({ finding, patient, caseId }) => {
  const codeKey = normalizeCode(finding.conditionCode || finding.primaryFinding);
  const guide = CONDITIONAL_GUIDELINES[codeKey];

  const [activeTab, setActiveTab] = useState<'immediate' | 'clinical' | 'patient'>('immediate');
  
  // Track checked local checklists for the health worker, persisted in memory/state
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Reset checklists when caseId changes
    setCompletedSteps({});
  }, [caseId]);

  const toggleStep = (stepText: string) => {
    setCompletedSteps(prev => ({
      ...prev,
      [stepText]: !prev[stepText]
    }));
  };

  const immediateActions = [
    ...(finding.treatmentNotes || []),
    `Ensure patient understands referral urgency: ${finding.urgencyText || 'Observe condition'}.`,
    `Hand over written Case ID (${caseId}) for hospital matching.`
  ];

  const totalSteps = immediateActions.length;
  const completedCount = immediateActions.filter(step => completedSteps[step]).length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className="bg-white border border-[#bccac1] rounded-2xl overflow-hidden shadow-sm transition-all" id="treatment-recommendations-portal">
      {/* Header bar */}
      <div className="bg-[#f0f9ff] px-5 py-4 border-b border-[#bccac1] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-[#0077b6] shrink-0" />
          <div>
            <h3 className="font-display font-extrabold text-sm text-[#181c1e] uppercase tracking-wide">
              Clinical Care & Supportive Treatment Guide
            </h3>
            <p className="text-[10px] text-[#3d4943] font-semibold">
              Personalized management portal for <span className="font-bold text-[#0077b6]">{finding.primaryFinding}</span>
            </p>
          </div>
        </div>
        
        {/* Progress pill */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-[#bccac1] self-start sm:self-auto shadow-xs">
          <span className="text-[10px] font-bold text-[#3d4943] uppercase tracking-wider">Triage Steps:</span>
          <div className="w-12 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="bg-[#0077b6] h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="font-mono text-[10px] font-extrabold text-[#0077b6]">{completedCount}/{totalSteps}</span>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-100 bg-[#f1f4f6] text-xs font-bold font-display overflow-x-auto scrollbar-none select-none">
        <button
          onClick={() => setActiveTab('immediate')}
          className={`flex-1 min-w-[125px] py-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'immediate'
              ? 'border-[#0077b6] text-[#0077b6] bg-white font-extrabold'
              : 'border-transparent text-[#3d4943] hover:text-[#0077b6] hover:bg-white/50'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Immediate Care Checklist</span>
        </button>
        <button
          onClick={() => setActiveTab('clinical')}
          className={`flex-1 min-w-[125px] py-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'clinical'
              ? 'border-[#0077b6] text-[#0077b6] bg-white font-extrabold'
              : 'border-transparent text-[#3d4943] hover:text-[#0077b6] hover:bg-white/50'
          }`}
        >
          <Pill className="w-3.5 h-3.5" />
          <span>Therapy Regimen (Rx)</span>
        </button>
        <button
          onClick={() => setActiveTab('patient')}
          className={`flex-1 min-w-[125px] py-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'patient'
              ? 'border-[#0077b6] text-[#0077b6] bg-white font-extrabold'
              : 'border-transparent text-[#3d4943] hover:text-[#0077b6] hover:bg-white/50'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Patient Handout (Do's & Don'ts)</span>
        </button>
      </div>

      {/* Tab panel contents */}
      <div className="p-5 font-semibold text-xs text-[#3d4943]">
        
        {/* TAB 1: IMMEDIATE CARE CHECKLIST */}
        {activeTab === 'immediate' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-[#f0f9ff] text-[#005f73] p-3 rounded-xl border border-sky-100 leading-relaxed">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-[11px]">
                Health Workers: Complete these supportive actions and tick them off before patient discharges or transfers to clinic posts.
              </p>
            </div>

            <div className="space-y-2.5">
              {immediateActions.map((step, idx) => {
                const isChecked = !!completedSteps[step];
                return (
                  <div
                    key={idx}
                    onClick={() => toggleStep(step)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <button className="mt-0.5 shrink-0 text-[#0077b6]">
                      {isChecked ? (
                        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                      ) : (
                        <Square className="w-4.5 h-4.5 text-slate-400" />
                      )}
                    </button>
                    <span className={`text-xs select-none transition-colors ${isChecked ? 'line-through text-slate-400' : ''}`}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>

            {progressPercent === 100 && (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 p-3 rounded-xl animate-fade-in text-xs font-bold">
                <CheckCircle2 className="w-4.5 h-4.5" />
                <span>Excellent! All immediate supportive steps are completed for Patient {patient.name || 'Anonymous'}.</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CLINICAL DRUG & THERAPY REGIMENS */}
        {activeTab === 'clinical' && guide && (
          <div className="space-y-4">
            {/* Standard Drug monograph card */}
            <div className="border border-[#bccac1] rounded-xl p-4 space-y-3.5 bg-white">
              <div className="flex items-center gap-1.5 text-slate-900 border-b border-slate-100 pb-2">
                <Pill className="w-4 h-4 text-[#0077b6] shrink-0" />
                <h4 className="font-display font-bold text-xs">Standard Pharmacological Guidelines</h4>
              </div>

              <div className="space-y-2.5">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest block leading-none">Primary Medication Class</span>
                  <span className="text-xs font-bold text-[#0077b6] mt-0.5 block">{guide.medication}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest block leading-none">Standard Regimen & Method</span>
                  <span className="text-xs text-slate-800 mt-0.5 block font-normal leading-relaxed">{guide.regimen}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest block leading-none">Standard Dosage / Duration Guidance</span>
                  <span className="text-xs text-slate-800 mt-0.5 block font-mono">{guide.dosage}</span>
                </div>

                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-[9px] text-amber-700 uppercase tracking-widest block font-extrabold leading-none">Contraindications & Drug Cautions</span>
                  <p className="text-[10.5px] text-amber-800 font-normal leading-relaxed mt-1">{guide.contraindications}</p>
                </div>
              </div>
            </div>

            {/* Warning block */}
            <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl leading-relaxed">
              <ShieldAlert className="w-5 h-5 text-rose-600 mt-0.5 shrink-0 animate-pulse" />
              <div>
                <span className="font-display font-bold text-[10px] text-rose-700 tracking-wider uppercase block">Critical Clinical Safeguards & Warning Details</span>
                <p className="text-[10.5px] font-normal text-rose-900 mt-0.5">
                  {guide.warningNote}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PATIENT DOS & DON'TS HANDOUT */}
        {activeTab === 'patient' && guide && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-[#f0f9ff] text-[#005f73] p-3 rounded-xl border border-sky-100 text-xs">
              <BookOpen className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[11px] font-normal leading-relaxed">
                Provide these instructions to the patient or guardian for home management before clinic follow-ups.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Do's card */}
              <div className="border border-emerald-100 rounded-xl p-4 bg-emerald-50/20 space-y-2.5">
                <div className="flex items-center gap-1.5 text-emerald-800 border-b border-emerald-100 pb-2">
                  <ThumbsUp className="w-4 h-4 text-emerald-600" />
                  <span className="font-display font-bold text-xs uppercase tracking-wide">Patient Care Dos</span>
                </div>
                <ul className="space-y-2.5">
                  {guide.dos.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs text-slate-800 font-normal leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Don'ts card */}
              <div className="border border-rose-100 rounded-xl p-4 bg-rose-50/20 space-y-2.5">
                <div className="flex items-center gap-1.5 text-rose-800 border-b border-rose-100 pb-2">
                  <ThumbsDown className="w-4 h-4 text-rose-500" />
                  <span className="font-display font-bold text-xs uppercase tracking-wide">Patient Cautions (Don'ts)</span>
                </div>
                <ul className="space-y-2.5">
                  {guide.donts.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs text-slate-800 font-normal leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
