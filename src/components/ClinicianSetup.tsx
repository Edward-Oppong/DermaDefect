import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Stethoscope, 
  Building2, 
  MapPin, 
  Phone, 
  ChevronRight,
  CheckCircle2,
  Shield
} from 'lucide-react';

export interface ClinicianProfile {
  name: string;
  role: string;
  facilityName: string;
  district: string;
  region: string;
  contact: string;
}

const REGIONS = [
  "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern",
  "Greater Accra", "North East", "Northern", "Oti", "Savannah",
  "Upper East", "Upper West", "Volta", "Western", "Western North"
];

const ROLES = [
  "Community Health Worker",
  "Nurse",
  "Physician Assistant",
  "Medical Officer",
  "Dermatology Specialist",
  "General Practitioner",
  "Midwife",
  "Other"
];

interface Props {
  onComplete: (profile: ClinicianProfile) => void;
}

export const STORAGE_KEY = 'dermadetect_clinician_profile';

export const loadProfile = (): ClinicianProfile | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const saveProfile = (profile: ClinicianProfile): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
};

export const clearProfile = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const ClinicianSetup: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [profile, setProfile] = useState<ClinicianProfile>({
    name: '',
    role: '',
    facilityName: '',
    district: '',
    region: '',
    contact: '',
  });
  const [errors, setErrors] = useState<Partial<ClinicianProfile>>({});

  const update = (field: keyof ClinicianProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateStep1 = () => {
    const e: Partial<ClinicianProfile> = {};
    if (!profile.name.trim())    e.name = 'Full name is required';
    if (!profile.role)           e.role = 'Please select your role';
    if (!profile.contact.trim()) e.contact = 'Contact number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Partial<ClinicianProfile> = {};
    if (!profile.facilityName.trim()) e.facilityName = 'Facility name is required';
    if (!profile.district.trim())     e.district = 'District is required';
    if (!profile.region)              e.region = 'Please select your region';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handleComplete = () => {
    if (!validateStep2()) return;
    saveProfile(profile);
    onComplete(profile);
  };

  const inputClass = (field: keyof ClinicianProfile) =>
    `w-full h-11 px-4 rounded-xl border text-sm font-medium transition-all outline-none
     bg-white text-[#0A1628] placeholder:text-slate-400
     ${errors[field]
       ? 'border-rose-400 focus:ring-2 focus:ring-rose-200'
       : 'border-slate-200 focus:border-[#00A6FB] focus:ring-2 focus:ring-[#00A6FB]/20'
     }`;

  const selectClass = (field: keyof ClinicianProfile) =>
    `w-full h-11 px-4 rounded-xl border text-sm font-medium transition-all outline-none
     bg-white text-[#0A1628] appearance-none
     ${errors[field]
       ? 'border-rose-400 focus:ring-2 focus:ring-rose-200'
       : 'border-slate-200 focus:border-[#00A6FB] focus:ring-2 focus:ring-[#00A6FB]/20'
     }`;

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center p-4">
      
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <img 
      src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=2400&q=80" 
      alt="Clinical medical macro observation"
      className="w-full h-full object-cover object-center scale-100 opacity-45 mix-blend-luminosity filter contrast-125 brightness-110"
    />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#00A6FB]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#001B2E]/5 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#001B2E] mb-4 shadow-lg">
            <span className="font-black text-white text-lg tracking-tight">DD</span>
          </div>
          <h1 className="font-display font-bold text-2xl text-[#001B2E] tracking-tight">
            Clinician Profile Setup
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 font-normal">
            This information will appear on all clinical reports and referral notes.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-6 px-1">
          <div className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= 1 ? 'bg-[#00A6FB] text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
            </div>
            <span className={`text-xs font-semibold transition-colors ${
              step === 1 ? 'text-[#00A6FB]' : 'text-slate-400'
            }`}>Personal Info</span>
          </div>
          <div className="h-px flex-1 bg-slate-200" />
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className={`text-xs font-semibold transition-colors ${
              step === 2 ? 'text-[#00A6FB]' : 'text-slate-400'
            }`}>Facility Info</span>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= 2 ? 'bg-[#00A6FB] text-white' : 'bg-slate-200 text-slate-500'
            }`}>2</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <AnimatePresence mode="wait">

            {/* STEP 1: Personal Info */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="p-6 space-y-4"
              >
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-[#00A6FB]/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-[#00A6FB]" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-sm text-[#001B2E]">Personal Information</h2>
                    <p className="text-[10px] text-slate-400">Your identity on all clinical documents</p>
                  </div>
                </div>

                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Full Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder="e.g. Akosua Darko"
                    className={inputClass('name')}
                  />
                  {errors.name && <p className="text-[10px] text-rose-500 font-medium">{errors.name}</p>}
                </div>

                {/* Role */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Role / Designation <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <select
                      value={profile.role}
                      onChange={e => update('role', e.target.value)}
                      className={selectClass('role')}
                    >
                      <option value="">Select your role...</option>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <Stethoscope className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  {errors.role && <p className="text-[10px] text-rose-500 font-medium">{errors.role}</p>}
                </div>

                {/* Contact */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Contact Number <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={profile.contact}
                      onChange={e => update('contact', e.target.value)}
                      placeholder="+233 24 000 0000"
                      className={inputClass('contact')}
                    />
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  {errors.contact && <p className="text-[10px] text-rose-500 font-medium">{errors.contact}</p>}
                </div>

                <button
                  onClick={handleNext}
                  className="w-full h-11 bg-[#00A6FB] hover:bg-[#008cc4] text-white font-display font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 mt-2 shadow-sm active:scale-[0.98]"
                >
                  <span>Continue to Facility Info</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* STEP 2: Facility Info */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
                className="p-6 space-y-4"
              >
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-[#00A6FB]/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-[#00A6FB]" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-sm text-[#001B2E]">Facility Information</h2>
                    <p className="text-[10px] text-slate-400">Your clinic details for referral documents</p>
                  </div>
                </div>

                {/* Facility Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Facility Name <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <input
                      type="text"
                      value={profile.facilityName}
                      onChange={e => update('facilityName', e.target.value)}
                      placeholder="e.g. Atonsu Community Clinic"
                      className={inputClass('facilityName')}
                    />
                    <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  {errors.facilityName && <p className="text-[10px] text-rose-500 font-medium">{errors.facilityName}</p>}
                </div>

                {/* District */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">District <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <input
                      type="text"
                      value={profile.district}
                      onChange={e => update('district', e.target.value)}
                      placeholder="e.g. Kumasi Metropolitan"
                      className={inputClass('district')}
                    />
                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  {errors.district && <p className="text-[10px] text-rose-500 font-medium">{errors.district}</p>}
                </div>

                {/* Region */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Region <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <select
                      value={profile.region}
                      onChange={e => update('region', e.target.value)}
                      className={selectClass('region')}
                    >
                      <option value="">Select region...</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r} Region</option>)}
                    </select>
                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  {errors.region && <p className="text-[10px] text-rose-500 font-medium">{errors.region}</p>}
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="h-11 px-5 border border-slate-200 text-slate-600 font-display font-bold text-sm rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleComplete}
                    className="flex-1 h-11 bg-[#001B2E] hover:bg-[#003554] text-white font-display font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Profile & Continue</span>
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Privacy note */}
        <div className="flex items-center justify-center gap-2 mt-5 text-[11px] text-slate-400">
          <Shield className="w-3.5 h-3.5" />
          <span>Saved locally on this device only. Never uploaded to any server.</span>
        </div>
      </motion.div>
    </div>
  );
};