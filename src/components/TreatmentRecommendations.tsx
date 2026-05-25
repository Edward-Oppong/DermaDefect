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
  ThumbsDown
} from 'lucide-react';
import { DiagnosticResult, PatientDetails } from '../types';

interface TreatmentRecommendationsProps {
  finding: DiagnosticResult;
  patient: PatientDetails;
  caseId: string;
}

export const TreatmentRecommendations: React.FC<TreatmentRecommendationsProps> = ({ finding, patient, caseId }) => {
  const [activeTab, setActiveTab] = useState<'immediate' | 'clinical' | 'patient'>('immediate');
  
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
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

  const guideRx = finding.therapyRegimen;
  const guidePt = finding.patientHandout;

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
        {activeTab === 'clinical' && (
          <div className="space-y-4">
            {guideRx ? (
              <>
                {/* Standard Drug monograph card */}
                <div className="border border-[#bccac1] rounded-xl p-4 space-y-3.5 bg-white">
                  <div className="flex items-center gap-1.5 text-slate-900 border-b border-slate-100 pb-2">
                    <Pill className="w-4 h-4 text-[#0077b6] shrink-0" />
                    <h4 className="font-display font-bold text-xs">Standard Pharmacological Guidelines</h4>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest block leading-none">Primary Medication Class</span>
                      <span className="text-xs font-bold text-[#0077b6] mt-0.5 block">{guideRx.medication}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest block leading-none">Standard Regimen & Method</span>
                      <span className="text-xs text-slate-800 mt-0.5 block font-normal leading-relaxed">{guideRx.regimen}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest block leading-none">Standard Dosage / Duration Guidance</span>
                      <span className="text-xs text-slate-800 mt-0.5 block font-mono">{guideRx.dosage}</span>
                    </div>

                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <span className="text-[9px] text-amber-700 uppercase tracking-widest block font-extrabold leading-none">Contraindications & Drug Cautions</span>
                      <p className="text-[10.5px] text-amber-800 font-normal leading-relaxed mt-1">{guideRx.contraindications}</p>
                    </div>
                  </div>
                </div>

                {/* Warning block */}
                <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl leading-relaxed">
                  <ShieldAlert className="w-5 h-5 text-rose-600 mt-0.5 shrink-0 animate-pulse" />
                  <div>
                    <span className="font-display font-bold text-[10px] text-rose-700 tracking-wider uppercase block">Critical Clinical Safeguards & Warning Details</span>
                    <p className="text-[10.5px] font-normal text-rose-900 mt-0.5">
                      {guideRx.warningNote}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-slate-500 font-normal">
                No advanced therapy regimen generated by the AI for this case. Follow standard local protocols.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PATIENT DOS & DON'TS HANDOUT */}
        {activeTab === 'patient' && (
          <div className="space-y-4">
            {guidePt ? (
              <>
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
                      {guidePt.dos.map((item, index) => (
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
                      {guidePt.donts.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-xs text-slate-800 font-normal leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-slate-500 font-normal">
                No specific patient handout generated by the AI for this case. Follow standard local protocols.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
