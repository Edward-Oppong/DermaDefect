import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { 
  User, 
  UserPen, 
  Camera, 
  ClipboardCheck, 
  Globe, 
  CheckCircle2, 
  WifiOff, 
  Lightbulb, 
  Upload, 
  Activity, 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  Save, 
  Share2, 
  Download, 
  Search, 
  Filter, 
  ChevronRight, 
  ChevronLeft, 
  ZoomIn, 
  X, 
  PlusCircle, 
  History, 
  Loader2, 
  ArrowRight,
  HeartPulse,
  Printer,
  BookOpen,
  Home,
  Trash2,
  Clock,
  Heart
} from 'lucide-react';
import { 
  SAMPLE_CASE_TEMPLATES,
  CaseRecord, 
  PatientDetails, 
  DiagnosticResult 
} from './types';
import { TRANSLATIONS, LanguageOption } from './locales';
import { TreatmentRecommendations} from './components/TreatmentRecommendations';
import { jsPDF } from 'jspdf';
import { clearProfile, ClinicianProfile, ClinicianSetup, loadProfile } from './components/ClinicianSetup';

export default function App() {

  // ── Clinician profile ──────────────────────────────────────────────────────
  const [clinician, setClinician] = useState<ClinicianProfile | null>(() => loadProfile());

  const handleProfileComplete = (profile: ClinicianProfile) => {
    setClinician({ ...profile });
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<'home' | 'assessment-info' | 'assessment-capture' | 'assessment-review' | 'referral-note' | 'case-history'>('home');
  const [lang, setLang] = useState<LanguageOption>('English');
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  // ── Cases ──────────────────────────────────────────────────────────────────
  const [cases, setCases] = useState<CaseRecord[]>([]);

  // ── Assessment state ───────────────────────────────────────────────────────
  const [patient, setPatient] = useState<PatientDetails>({ name: '', age: '', sex: '', contactNumber: '', symptoms: '' });
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [customFileSelected, setCustomFileSelected] = useState<boolean>(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [activeAnalysisResult, setActiveAnalysisResult] = useState<DiagnosticResult | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string>('');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [referralNoteLoading, setReferralNoteLoading] = useState(false);

  // ── Prescribed Medication (Editable for Referral) ────────────────────────
  const [prescribedMedication, setPrescribedMedication] = useState<string>('');
  const [prescribedRegimen, setPrescribedRegimen] = useState<string>('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'pdf'>('card');

  useEffect(() => {
    if (activeAnalysisResult) {
      if (activeAnalysisResult.therapyRegimen) {
        setPrescribedMedication(activeAnalysisResult.therapyRegimen.medication || '');
        setPrescribedRegimen(activeAnalysisResult.therapyRegimen.regimen || '');
      } else {
        setPrescribedMedication('');
        setPrescribedRegimen('');
      }
    }
  }, [activeAnalysisResult]);

  useEffect(() => {
    if (screen === 'referral-note' && activeAnalysisResult) {
      const timer = setTimeout(() => {
        generateReferralNotePdf('preview');
      }, 500); // 500ms debounce to avoid lagging during typing
      return () => clearTimeout(timer);
    }
  }, [prescribedMedication, prescribedRegimen, activeAnalysisResult, screen]);

  // ── Case history UI ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUrgency, setFilterUrgency] = useState<'All' | 'High' | 'Moderate' | 'Low'>('All');
  const [selectedDetailsCase, setSelectedDetailsCase] = useState<CaseRecord | null>(null);
  const [zoomImage, setZoomImage] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<CaseRecord | null>(null);

  // ── FAQ state ──────────────────────────────────────────────────────────────
  const [faqOpenState, setFaqOpenState] = useState<Record<number, boolean>>({ 0: true });

  // ── Signature canvas ───────────────────────────────────────────────────────
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);

  const startDrawingSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawingSig(true);
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0A1628'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const rect = canvas.getBoundingClientRect();
    const x = ('clientX' in e) ? e.clientX - rect.left : e.touches[0].clientX - rect.left;
    const y = ('clientY' in e) ? e.clientY - rect.top  : e.touches[0].clientY - rect.top;
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const drawSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return;
    const canvas = signatureCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('clientX' in e) ? e.clientX - rect.left : e.touches[0].clientX - rect.left;
    const y = ('clientY' in e) ? e.clientY - rect.top  : e.touches[0].clientY - rect.top;
    ctx.lineTo(x, y); ctx.stroke(); e.preventDefault();
  };
  const stopDrawingSig = () => setIsDrawingSig(false);
  const clearSig = () => {
    const canvas = signatureCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // ── Sync / health ──────────────────────────────────────────────────────────
  const [dbStatus, setDbStatus]     = useState<'online' | 'offline'>('online');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'syncing'>('synced');
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [autoSyncEnabled]           = useState<boolean>(true);

  const triggerCloudSync = async (list: CaseRecord[]) => {
    if (list.length === 0) return;
    setSyncStatus('syncing');
    try {
      await Promise.all(list.map(c => fetch('/api/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })));
      setSyncStatus('synced'); setDbStatus('online');
      const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSynced(ts); localStorage.setItem('dermadetect_last_synced', ts);
    } catch { setSyncStatus('pending'); setDbStatus('offline'); }
  };

  const probeDatabaseHealth = async () => {
    try {
      const t0 = performance.now();
      const r  = await fetch('/api/health');
      if (r.ok) { setDbStatus('online'); return true; }
      setDbStatus('offline'); return false;
    } catch { setDbStatus('offline'); return false; }
  };

  useEffect(() => {
    const saved = localStorage.getItem('dermadetect_last_synced');
    if (saved) setLastSynced(saved);
  }, []);

  useEffect(() => {
    const init = async () => {
      const online = await probeDatabaseHealth();
      if (online && autoSyncEnabled && cases.length > 0) await triggerCloudSync(cases);
    };
    if (cases.length > 0) init();
    const id = setInterval(async () => {
      const online = await probeDatabaseHealth();
      if (online && autoSyncEnabled && cases.length > 0) await triggerCloudSync(cases);
    }, 15000);
    return () => clearInterval(id);
  }, [cases, autoSyncEnabled]);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError]       = useState<string | null>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Load cases ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/cases');
        if (r.ok) {
          const d = await r.json();
          if (d.cases?.length > 0) { setCases(d.cases); localStorage.setItem('dermadetect_cases', JSON.stringify(d.cases)); return; }
        }
      } catch { console.warn('Server unreachable, falling back to localStorage'); }
      const stored = localStorage.getItem('dermadetect_cases');
      try { setCases(stored ? JSON.parse(stored) : []); } catch { setCases([]); }
    };
    load();
  }, []);

  const syncCasesToStorage = (updated: CaseRecord[]) => {
    setCases(updated);
    localStorage.setItem('dermadetect_cases', JSON.stringify(updated));
  };

  const t = TRANSLATIONS[lang];

  const resetAndStartAssessment = () => {
    setPatient({ name: '', age: '', sex: '', contactNumber: '', symptoms: '' });
    setCapturedImage(null); setCustomFileSelected(false);
    setActiveAnalysisResult(null); setActiveCaseId('');
    setScreen('assessment-info'); stopWebcam();
  };

  const startWebcam = async () => {
    setIsCameraActive(true); setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { setCameraError("Webcam not accessible. Please upload from Gallery."); setIsCameraActive(false); }
  };

  const stopWebcam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null; setIsCameraActive(false);
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width  = videoRef.current.videoWidth  || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height); setCapturedImage(canvas.toDataURL('image/jpeg')); setCustomFileSelected(true); stopWebcam(); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { setCapturedImage(reader.result as string); setCustomFileSelected(true); stopWebcam(); };
    reader.readAsDataURL(file);
  };

  // ── AI Analysis ────────────────────────────────────────────────────────────
  const runAiAnalysis = async () => {
    if (!capturedImage) return;
    setAnalysisLoading(true);
    const messages = [
      "Accessing secured local database sandbox...",
      "Encrypting transmission packet according to medical standard guidelines...",
      "Extracting skin lesion pigmentation & margins...",
      "Invoking DermaDefect diagnostic model...",
      "Conducting diagnostic taxonomy matrix parsing...",
      "Finalizing triage urgency confidence ratings...",
    ];
    let i = 0; setLoadingText(messages[0]);
    const timer = setInterval(() => { i++; if (i < messages.length) setLoadingText(messages[i]); }, 700);
    try {
      const response = await fetch('/api/analyze-skin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: capturedImage, symptoms: patient.symptoms, patientInfo: { name: patient.name, age: patient.age, sex: patient.sex, contactNumber: patient.contactNumber } }),
      });
      if (!response.ok) { const e = await response.text(); throw new Error(`Server error ${response.status}: ${e}`); }
      const raw = await response.json();
      const result: DiagnosticResult = {
        primaryFinding:    raw.primaryFinding    ?? 'Unknown',
        confidence:        raw.confidence        ?? 0,
        urgency:           (['High','Moderate','Low'].includes(raw.urgency) ? raw.urgency : 'Moderate') as 'High'|'Moderate'|'Low',
        urgencyText:       raw.urgencyText       ?? '',
        treatmentNotes:    Array.isArray(raw.treatmentNotes) ? raw.treatmentNotes : [],
        recommendedAction: raw.recommendedAction ?? '',
        referralNote:      raw.referralNote      ?? '',
        conditionCode:     raw.conditionCode     ?? '',
        heatmap_b64:       raw.heatmap_b64       ?? undefined,
        therapyRegimen:    raw.therapyRegimen    ?? undefined,
        patientHandout:    raw.patientHandout    ?? undefined,
      };
      await new Promise(r => setTimeout(r, 800));
      clearInterval(timer);
      setActiveAnalysisResult(result);
      setActiveCaseId(`DD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setScreen('assessment-review');
    } catch (err) {
      clearInterval(timer);
      await new Promise(r => setTimeout(r, 800));
      window.alert(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setAnalysisLoading(false); }
  };

  // ── Lazy referral note ─────────────────────────────────────────────────────
  const handleFormatReferral = async () => {
    if (!activeAnalysisResult) return;
    if (activeAnalysisResult.referralNote) { setScreen('referral-note'); return; }
    setReferralNoteLoading(true);
    try {
      const response = await fetch('/api/referral-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predictions:     activeAnalysisResult.allPredictions ?? [],
          patient_name:    patient.name,
          patient_age:     patient.age,
          patient_sex:     patient.sex,
          symptoms:        patient.symptoms,
          primary_finding: activeAnalysisResult.primaryFinding,
          urgency:         activeAnalysisResult.urgency,
          urgency_text:    activeAnalysisResult.urgencyText,
          clinician_name:  clinician?.name  ?? '',
          facility_name:   clinician?.facilityName ?? '',
          district:        clinician?.district ?? '',
          region:          clinician?.region  ?? '',
        }),
      });
      const data = await response.json();
      setActiveAnalysisResult(prev => prev ? { ...prev, referralNote: data.referralNote } : prev);
      setScreen('referral-note');
    } catch { setScreen('referral-note'); }
    finally { setReferralNoteLoading(false); }
  };

  // ── Save case ──────────────────────────────────────────────────────────────
  const saveCaseRecord = async () => {
    if (!activeAnalysisResult || !capturedImage) return;
    const updatedFinding = {
      ...activeAnalysisResult,
      therapyRegimen: {
        ...activeAnalysisResult.therapyRegimen,
        medication: prescribedMedication,
        regimen: prescribedRegimen,
        dosage: activeAnalysisResult.therapyRegimen?.dosage || '',
        contraindications: activeAnalysisResult.therapyRegimen?.contraindications || '',
        warningNote: activeAnalysisResult.therapyRegimen?.warningNote || '',
      }
    };
    const newRecord: CaseRecord = {
      id: activeCaseId,
      patient: { ...patient },
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      finding: updatedFinding,
      image: capturedImage,
      healthWorker: clinician?.name ?? 'Unknown',
      saved: true,
    };
    setActiveAnalysisResult(updatedFinding);
    syncCasesToStorage([newRecord, ...cases]);
    try { await fetch('/api/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRecord) }); }
    catch { console.warn('Failed to persist case to server'); }
    setShowSuccessAnimation(true);
    setTimeout(() => { setShowSuccessAnimation(false); setScreen('case-history'); window.scrollTo({ top: 0, behavior: 'smooth' }); }, 1800);
  };

  // ── Delete case ────────────────────────────────────────────────────────────
  const deleteCaseRecord = async (id: string) => {
    syncCasesToStorage(cases.filter(c => c.id !== id));
    try { await fetch(`/api/cases/${id}`, { method: 'DELETE' }); } catch {}
    if (selectedDetailsCase?.id === id) setSelectedDetailsCase(null);
    setCaseToDelete(null);
  };

  // ── PDF helpers ────────────────────────────────────────────────────────────
  const clinicianName     = clinician?.name         ?? 'Health Worker';
  const clinicianRole     = clinician?.role         ?? 'Community Health Worker';
  const clinicianFacility = clinician?.facilityName ?? 'Community Clinic';
  const clinicianDistrict = clinician?.district     ?? '';
  const clinicianRegion   = clinician?.region       ?? '';
  const clinicianContact  = clinician?.contact      ?? '';

  const downloadReferralNotePdf = () => {
    if (!activeAnalysisResult) return;
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210; const pageHeight = 297; const margin = 12; const contentWidth = 186;

      // Colors
      const navyDark = [10, 51, 105];       // #0a3369 — Header background
      const borderSlate = [226, 232, 240];  // #e2e8f0
      
      const urgencyStr = activeAnalysisResult.urgency || 'Low';
      const isHigh = urgencyStr === 'High';
      const isMod = urgencyStr === 'Moderate';
      
      const urgencyColor = isHigh ? [216, 90, 48] : isMod ? [239, 159, 39] : [8, 47, 73]; // #D85A30, #EF9F27, #082F49
      
      // Clean non-Unicode alerts to prevent '%T' glitch
      const urgencyTextStr = isHigh 
        ? 'URGENT — Immediate referral required. Do not delay.' 
        : isMod 
          ? 'MODERATE — Refer to clinic within 3 days for assessment and treatment.' 
          : 'MILD — Can be managed locally. Refer if no improvement in 7 days.';
      
      const cleanRefId = activeCaseId || `DD-${new Date().getFullYear()}-00847`;

      let y = margin;

      // 1. Header Band
      doc.setFillColor(navyDark[0], navyDark[1], navyDark[2]);
      doc.rect(margin, y, contentWidth, 18, 'F');
      
      // Logo & Brand text on left
      doc.setFillColor(255, 255, 255, 0.2);
      doc.rect(margin + 5, y + 4, 10, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text('DD', margin + 7.5, y + 10.5);

      doc.setFontSize(11);
      doc.text('DermaDetect', margin + 18, y + 8);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.setTextColor(230, 240, 255);
      doc.text('AI-Powered Skin Assessment', margin + 18, y + 12);

      // Title on right
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      const titleStr = 'CLINICAL REFERRAL NOTE';
      doc.text(titleStr, margin + contentWidth - 5 - doc.getTextWidth(titleStr), y + 8);
      
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.setTextColor(230, 240, 255);
      const refStr = `REF: ${cleanRefId}`;
      doc.text(refStr, margin + contentWidth - 5 - doc.getTextWidth(refStr), y + 12);

      y += 22;

      // 2. Alert Stripe (Zero glyph glitches, smaller text size to avoid clipping)
      doc.setFillColor(urgencyColor[0], urgencyColor[1], urgencyColor[2]);
      doc.rect(margin, y, contentWidth, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); // reduced to 7.5 to fit perfectly
      
      // Draw a tiny native white circle instead of Unicode bullet to prevent %T glitch
      doc.setFillColor(255, 255, 255);
      const alertTextX = margin + (contentWidth - doc.getTextWidth(urgencyTextStr)) / 2;
      doc.circle(alertTextX - 2.5, y + 4.2, 0.7, 'F');
      doc.text(urgencyTextStr, alertTextX + 1.5, y + 6.2);

      y += 15;

      const col1Width = 100;
      const col2Width = contentWidth - col1Width - 8; // 78
      const col2X = margin + col1Width + 8;

      let leftY = y;
      let rightY = y;

      // ── LEFT COLUMN ─────────────────────────────────────────────────────────
      
      // Patient Info
      doc.setTextColor(8, 47, 73); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text('PATIENT INFORMATION', margin, leftY);
      leftY += 2;
      doc.setDrawColor(204, 251, 241); doc.setLineWidth(0.4);
      doc.line(margin, leftY, margin + col1Width, leftY);
      leftY += 4;

      const patientRows = [
        ['Full Name', patient.name || '—'],
        ['Contact Number', patient.contactNumber || '—'],
        ['Age', patient.age ? `${patient.age} years` : '—'],
        ['Sex', patient.sex || '—'],
        ['Date of Visit', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })],
        ['Patient ID', cleanRefId],
      ];

      doc.setFontSize(7.5);
      patientRows.forEach(([lbl, val]) => {
        doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
        doc.text(lbl, margin, leftY);
        doc.setTextColor(10, 22, 40); doc.setFont('helvetica', 'bold');
        doc.text(val, margin + 35, leftY);
        leftY += 4.5;
      });

      leftY += 3;

      // Referring Health Worker
      doc.setTextColor(8, 47, 73); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text('REFERRING HEALTH WORKER', margin, leftY);
      leftY += 2;
      doc.line(margin, leftY, margin + col1Width, leftY);
      leftY += 4;

      const workerRows = [
        ['Name', clinicianName],
        ['Role', clinicianRole],
        ['Facility Name', clinicianFacility],
        ['District', clinicianDistrict || '—'],
        ['Region', clinicianRegion ? `${clinicianRegion} Region` : '—'],
        ['Contact', clinicianContact || '—'],
      ];

      doc.setFontSize(7.5);
      workerRows.forEach(([lbl, val]) => {
        doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
        doc.text(lbl, margin, leftY);
        doc.setTextColor(10, 22, 40); doc.setFont('helvetica', 'bold');
        doc.text(val, margin + 35, leftY);
        leftY += 4.5;
      });

      leftY += 3;

      // Refer To
      doc.setTextColor(8, 47, 73); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text('REFER TO', margin, leftY);
      leftY += 2;
      doc.line(margin, leftY, margin + col1Width, leftY);
      leftY += 4;

      const referRows = [
        ['Facility Type', 'District Hospital / Dermatology Clinic'],
        ['Department', 'Dermatology / General OPD'],
        ['Urgency', isHigh ? 'Immediate — Do Not Delay' : isMod ? 'Within 3 days' : 'Within 7 days'],
      ];

      doc.setFontSize(7.5);
      referRows.forEach(([lbl, val]) => {
        doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
        doc.text(lbl, margin, leftY);
        if (lbl === 'Urgency') {
          doc.setTextColor(urgencyColor[0], urgencyColor[1], urgencyColor[2]); doc.setFont('helvetica', 'bold');
        } else {
          doc.setTextColor(10, 22, 40); doc.setFont('helvetica', 'bold');
        }
        doc.text(val, margin + 35, leftY);
        leftY += 4.5;
      });

      leftY += 3;

      // Health Worker's Notes
      doc.setTextColor(8, 47, 73); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text("HEALTH WORKER'S NOTES", margin, leftY);
      leftY += 2;
      doc.line(margin, leftY, margin + col1Width, leftY);
      leftY += 3.5;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.2);
      doc.rect(margin, leftY, col1Width, 14, 'DF');

      doc.setTextColor(51, 65, 85); doc.setFont('helvetica', 'italic'); doc.setFontSize(7);
      const wrappedNotes = doc.splitTextToSize(patient.symptoms?.trim() ? `"${patient.symptoms.trim()}"` : 'No additional notes recorded.', col1Width - 6);
      doc.text(wrappedNotes, margin + 3, leftY + 5);

      leftY += 18;

      // Recommended Medications (Editable Card)
      doc.setTextColor(8, 47, 73); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text("RECOMMENDED MEDICATIONS", margin, leftY);
      leftY += 2;
      doc.setDrawColor(187, 247, 208);
      doc.line(margin, leftY, margin + col1Width, leftY);
      leftY += 3.5;

      doc.setFillColor(240, 253, 244);
      doc.rect(margin, leftY, col1Width, 24, 'DF');

      doc.setTextColor(21, 128, 61); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
      doc.text('PRESCRIBED MEDICATION', margin + 3, leftY + 4.5);
      doc.setTextColor(20, 83, 45); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      doc.text(prescribedMedication || 'None Prescribed', margin + 3, leftY + 8.5);

      doc.setTextColor(21, 128, 61); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
      doc.text('DOSAGE REGIMEN / DIRECTIONS', margin + 3, leftY + 14);
      doc.setTextColor(20, 83, 45); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      const wrappedRegimen = doc.splitTextToSize(prescribedRegimen || 'No directions specified.', col1Width - 6);
      doc.text(wrappedRegimen, margin + 3, leftY + 18);

      leftY += 28;

      // ── RIGHT COLUMN (Dynamic Height Tracking & Sizing Engine) ──────────────────

      const cardStartY = rightY;

      // 1. Prepare Text & Data to pre-calculate the container height dynamically
      const isHighText = activeAnalysisResult.urgency === 'High' ? 'Urgent Referral' : isMod ? 'Moderate Urgency' : 'Mild Urgency';
      
      const descText = activeAnalysisResult.primaryFinding.toLowerCase().includes('ringworm') 
        ? "Tinea corporis is a superficial fungal infection characterised by a ring-shaped, scaly, itchy rash. Highly treatable with topical antifungal agents."
        : activeAnalysisResult.primaryFinding.toLowerCase().includes('eczema')
        ? "Atopic dermatitis is a chronic pruritic inflammatory skin condition managed with hydration, trigger avoidance, and topical anti-inflammatories."
        : activeAnalysisResult.primaryFinding.toLowerCase().includes('impetigo')
        ? "Impetigo is a highly contagious superficial bacterial skin infection characterized by honey-colored crusts. Managed with antibiotic therapy."
        : activeAnalysisResult.primaryFinding.toLowerCase().includes('scabies')
        ? "Scabies is an intensely itchy skin infestation caused by the mite Sarcoptes scabiei. Highly contagious. Managed with permethrin or ivermectin."
        : "A potential clinical skin indication detected by the assistive triage scanner. Standard clinical diagnostic procedures are recommended before commencing definitive therapy.";

      const docDetails = activeAnalysisResult.primaryFinding.toLowerCase().includes('ringworm') 
        ? ["Clotrimazole 1% cream — apply twice daily for 2–4 weeks", "Keep area clean and dry", "Avoid sharing towels or clothing"]
        : activeAnalysisResult.primaryFinding.toLowerCase().includes('eczema')
        ? ["Hydrocortisone 1% cream — apply twice daily for 7 days", "Apply thick emollient moisturizer frequently", "Avoid harsh scented soaps and hot baths"]
        : activeAnalysisResult.primaryFinding.toLowerCase().includes('impetigo')
        ? ["Mupirocin 2% topical ointment — apply 3 times daily", "Gently clean honey-colored crusts with warm soapy water", "Keep lesions covered to prevent auto-inoculation"]
        : activeAnalysisResult.primaryFinding.toLowerCase().includes('scabies')
        ? ["Permethrin 5% cream — apply from neck down, wash after 8-14 hours", "Treat all household contacts simultaneously", "Wash bedding and clothes in hot water"]
        : activeAnalysisResult.treatmentNotes?.length ? activeAnalysisResult.treatmentNotes : ["Monitor area daily for pigment or dimension shifts", "Keep the affected region clean, dry, and cool", "Refer to dermatology clinic if symptoms do not improve"];

      // Pre-calculate heights
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      const wrappedDesc = doc.splitTextToSize(descText, col2Width - 8);
      const descHeight = wrappedDesc.length * 3.3;

      let tempY = cardStartY + 33 + descHeight + 5; // offset for suggested treatment header
      let treatBulletY = tempY + 4.5;
      
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
      docDetails.slice(0, 3).forEach(item => {
        const wrappedItem = doc.splitTextToSize(item, col2Width - 10);
        treatBulletY += (wrappedItem.length * 3.4) + 1.2;
      });

      const disclaimerText = 'This is an AI-generated suggestion. Final treatment decisions rest with the clinician.';
      const cardHeight = treatBulletY - cardStartY + 6;

      // 2. Draw card background with exact pre-calculated height first
      doc.setFillColor(240, 253, 248);
      doc.setDrawColor(204, 251, 241); doc.setLineWidth(0.3);
      doc.rect(col2X, cardStartY, col2Width, cardHeight, 'DF');
      doc.setDrawColor(8, 47, 73); doc.setLineWidth(0.8);
      doc.line(col2X, cardStartY, col2X, cardStartY + cardHeight);

      // 3. Write text on top of the background
      doc.setTextColor(8, 47, 73); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text('AI ASSESSMENT', col2X + 4, cardStartY + 5.5);
      
      doc.setFillColor(240, 253, 244); doc.setDrawColor(187, 247, 208); doc.setLineWidth(0.2);
      doc.rect(col2X + col2Width - 22, cardStartY + 3, 18, 4, 'DF');
      doc.setTextColor(8, 47, 73); doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
      doc.text('ANALYSIS OK', col2X + col2Width - 19, cardStartY + 6);

      doc.setTextColor(10, 22, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(activeAnalysisResult.primaryFinding, col2X + 4, cardStartY + 13.5);

      doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.text('Detection confidence', col2X + 4, cardStartY + 19);
      doc.setTextColor(8, 47, 73); doc.setFont('helvetica', 'bold');
      const confStr = `${activeAnalysisResult.confidence}%`;
      doc.text(confStr, col2X + col2Width - 4 - doc.getTextWidth(confStr), cardStartY + 19);

      // confidence visual bar
      doc.setFillColor(241, 245, 249);
      doc.rect(col2X + 4, cardStartY + 21.5, col2Width - 8, 1.2, 'F');
      doc.setFillColor(8, 47, 73);
      doc.rect(col2X + 4, cardStartY + 21.5, (col2Width - 8) * (activeAnalysisResult.confidence / 100), 1.2, 'F');

      // Urgency badge with zero glyph glitches
      doc.setFillColor(urgencyColor[0], urgencyColor[1], urgencyColor[2]);
      doc.rect(col2X + 4, cardStartY + 25, doc.getTextWidth(isHighText) + 6, 4.5, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.2);
      doc.circle(col2X + 7, cardStartY + 27.2, 0.6, 'F'); // Draw a native circle
      doc.text(isHighText, col2X + 9, cardStartY + 28.2);

      // Assessment description text
      doc.setTextColor(71, 85, 105); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.text(wrappedDesc, col2X + 4, cardStartY + 33.5);

      // Suggested treatment header
      doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
      doc.text('SUGGESTED TREATMENT', col2X + 4, tempY);

      // Bullet points
      doc.setTextColor(10, 22, 40); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
      let renderBulletY = tempY + 4.5;
      docDetails.slice(0, 3).forEach(item => {
        const wrappedItem = doc.splitTextToSize(item, col2Width - 10);
        // Draw standard high-fidelity native bullet point circle
        doc.setFillColor(8, 47, 73);
        doc.circle(col2X + 5, renderBulletY - 1, 0.6, 'F');
        doc.text(wrappedItem, col2X + 8, renderBulletY);
        renderBulletY += (wrappedItem.length * 3.4) + 1.2;
      });

      // Disclaimer
      doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'italic'); doc.setFontSize(5.8);
      doc.text(disclaimerText, col2X + 4, cardHeight + cardStartY - 3.5);

      // Update rightY dynamically using the calculated height + spacing!
      rightY = cardStartY + cardHeight + 8;

      // Photos Block
      doc.setTextColor(8, 47, 73); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text('PHOTO TAKEN DURING ASSESSMENT', col2X, rightY);
      rightY += 2;
      doc.setDrawColor(186, 230, 253);
      doc.line(col2X, rightY, col2X + col2Width, rightY);
      rightY += 3.5;

      // Render the photos side by side in PDF
      const imgWidth = (col2Width - 4) / 2;
      const imgHeight = 32;

      let drawX = col2X;
      if (capturedImage) {
        try { doc.addImage(capturedImage, 'JPEG', drawX, rightY, imgWidth, imgHeight); } catch {}
      } else {
        doc.setFillColor(241, 245, 249); doc.rect(drawX, rightY, imgWidth, imgHeight, 'F');
        doc.setTextColor(148, 163, 184); doc.setFontSize(6);
        doc.text('NO PHOTO CAPTURED', drawX + 5, rightY + 16);
      }

      // Draw high-fidelity overlay badge for Clinical Specimen
      doc.setFillColor(8, 47, 73);
      doc.rect(drawX + 1.5, rightY + 1.5, 20, 3.8, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(4.5);
      doc.text('CLINICAL SPECIMEN', drawX + 2.5, rightY + 4.1);

      drawX += imgWidth + 4;
      if (activeAnalysisResult.heatmap_b64) {
        try { doc.addImage(`data:image/jpeg;base64,${activeAnalysisResult.heatmap_b64}`, 'JPEG', drawX, rightY, imgWidth, imgHeight); } catch {}
      } else {
        doc.setFillColor(241, 245, 249); doc.rect(drawX, rightY, imgWidth, imgHeight, 'F');
        doc.setTextColor(148, 163, 184); doc.setFontSize(6);
        doc.text('NO HEATMAP AVAILABLE', drawX + 4, rightY + 16);
      }

      // Draw high-fidelity overlay badge for AI Saliency Map
      doc.setFillColor(8, 47, 73);
      doc.rect(drawX + 1.5, rightY + 1.5, 20, 3.8, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(4.5);
      doc.text('AI SALIENCY MAP', drawX + 2.5, rightY + 4.1);

      rightY += imgHeight + 4;
      doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
      doc.text(`Photo captured: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, col2X, rightY);

      rightY += 10;

      // Synchronize column heights for signature placement
      y = Math.max(leftY, rightY) + 4;

      // 3. Signature Block
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4);
      doc.line(margin, y, margin + contentWidth, y);
      y += 4;

      const sigWidth = contentWidth / 2 - 4;
      const sigHeight = 12;

      // Attending Clinician Signature
      doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.text('HEALTH WORKER SIGNATURE', margin, y);
      
      const sigCanvas = signatureCanvasRef.current;
      if (sigCanvas) {
        try {
          const sigImg = sigCanvas.toDataURL('image/png');
          doc.addImage(sigImg, 'PNG', margin, y + 2, sigWidth, sigHeight);
        } catch {}
      } else {
        doc.setFillColor(248, 250, 252); doc.rect(margin, y + 2, sigWidth, sigHeight, 'F');
      }

      doc.setTextColor(10, 22, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text(clinicianName, margin, y + sigHeight + 5);
      doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.text(`${clinicianRole} · ${clinicianFacility}`, margin, y + sigHeight + 8);
      doc.text(`Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, margin, y + sigHeight + 11);

      // Receiving Clinician Signature Stamp Box
      const stampX = margin + contentWidth / 2 + 4;
      doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.text('RECEIVING CLINICIAN STAMP / SIGNATURE', stampX, y);
      
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
      doc.rect(stampX, y + 2, sigWidth, sigHeight, 'DF');
      doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
      doc.text('PLACE CLINICAL STAMP HERE', stampX + (sigWidth - doc.getTextWidth('PLACE CLINICAL STAMP HERE')) / 2, y + 2 + sigHeight / 2 + 1);

      doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5);
      const textToReceiving = '* To be completed at receiving facility';
      doc.text(textToReceiving, margin + contentWidth - doc.getTextWidth(textToReceiving), y + sigHeight + 11);

      // 4. Footer
      const footerY = pageHeight - margin - 22;
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4);
      doc.line(margin, footerY, margin + contentWidth, footerY);

      doc.setFillColor(248, 250, 252);
      doc.rect(margin, footerY + 1, contentWidth, 21, 'F');

      // Left brand in footer (zero glyph glitches)
      doc.setTextColor(71, 85, 105); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      // Draw native bullet point circle instead of Unicode bullet to prevent %T glitch
      doc.circle(margin + 5, footerY + 4.8, 0.7, 'F');
      doc.text('DermaDetect AI', margin + 7.5, footerY + 6);
      doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
      doc.text('Generated by DermaDetect — AI Skin Assessment Tool', margin + 4, footerY + 9.5);

      // Right timestamp refs
      doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8);
      const refsHeader = 'TIMESTAMP & REFERRAL REFS';
      doc.text(refsHeader, margin + contentWidth - 4 - doc.getTextWidth(refsHeader), footerY + 6);
      doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
      const refsLine1 = `Ref: ${cleanRefId}`;
      const refsLine2 = `Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      doc.text(refsLine1, margin + contentWidth - 4 - doc.getTextWidth(refsLine1), footerY + 9.5);
      doc.text(refsLine2, margin + contentWidth - 4 - doc.getTextWidth(refsLine2), footerY + 13);

      // Centered disclaimer
      doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.2);
      doc.line(margin + 4, footerY + 15, margin + contentWidth - 4, footerY + 15);
      
      doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'italic'); doc.setFontSize(6.2);
      const disclaimer = 'This referral note was generated with AI assistance. It is intended to support, not replace, clinical judgment.';
      doc.text(disclaimer, margin + (contentWidth - doc.getTextWidth(disclaimer)) / 2, footerY + 19);

      // Save PDF
      doc.save(`Clinical_Referral_Note_${cleanRefId}_${patient.name.trim().replace(/\s+/g, '_')}.pdf`);
    } catch (err: any) {
      alert('PDF generation failed: ' + err.message);
    }
  };

  const downloadPdfRecord = (record: CaseRecord) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210; const pageHeight = 297; const margin = 15; const contentWidth = 180;
     // Primary brand colors
      const primaryColor = [14, 116, 144];    // cyan-700 — main interactive blue
      const primaryDark = [8, 47, 73];        // sky-950 — deep navy for backgrounds/headers

      // Backgrounds & surfaces
      const paperBg = [240, 249, 255];        // sky-50 — near-white with a blue tint
      const borderSlate = [186, 230, 253];    // sky-200 — soft blue-tinted border

      // Text
      const textGray = [30, 58, 138];         // indigo-900 — deep blue-toned body text (replaces neutral gray)

      // Semantic accents (shifted cooler to match theme)
      const accentRed = [157, 23, 77];        // rose-800 — errors/danger (kept punchy, slightly cooler)
      const accentOrange = [161, 98, 7];      // amber-700 — warnings (muted gold instead of orange)
      const accentGreen = [6, 95, 70];        // emerald-800 — success (teal-leaning green)

      const urgencyStr = record.finding.urgency || 'Low';
      let severityColor = accentGreen;
      if (urgencyStr === 'High') severityColor = accentRed;
      else if (urgencyStr === 'Moderate') severityColor = accentOrange;

      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(margin, 12, 180, 1.5, 'F');
      let y = 24;
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.circle(margin + 4, y, 3, 'F');
      doc.setDrawColor(255,255,255); doc.setLineWidth(0.6);
      doc.line(margin+4, y-1.5, margin+4, y+1.5); doc.line(margin+2.5, y, margin+5.5, y);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica','bold'); doc.setFontSize(10);
      doc.text('DERMADETECT™ CLINICAL CASE DOSSIER', margin+10, y-1);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
      doc.text('FIELD OBSERVATION & DIAGNOSTIC RECORD', margin+10, y+2.5);
      doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
      doc.setFont('helvetica','bold'); doc.setFontSize(11);
      const docTitle = 'CLINICAL REFERRAL DOSSIER';
      doc.text(docTitle, pageWidth-margin-doc.getTextWidth(docTitle), y+1);
      y += 8;
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]); doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth-margin, y);
      y += 6;
      doc.setFillColor(paperBg[0], paperBg[1], paperBg[2]);
      doc.rect(margin, y, contentWidth, 36, 'F');
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]); doc.setLineWidth(0.3);
      doc.rect(margin, y, contentWidth, 36, 'D');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
      doc.text('PATIENT ANTHROPOMETRIC RECORD', margin+6, y+6);
      doc.text('CLINICAL IDENTIFIER METADATA', margin+96, y+6);
      doc.line(margin+90, y+3, margin+90, y+33);
      doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]); doc.setFontSize(8);
      let rowY = y + 13;
      doc.setFont('helvetica','bold'); doc.text('Full Name:', margin+6, rowY);
      doc.setFont('helvetica','normal'); doc.text(record.patient.name, margin+28, rowY);
      doc.setFont('helvetica','bold'); doc.text('Case Reference:', margin+96, rowY);
      doc.setFont('helvetica','normal'); doc.text(record.id, margin+125, rowY);
      rowY += 5;
      doc.setFont('helvetica','bold'); doc.text('Age / Gender:', margin+6, rowY);
      doc.setFont('helvetica','normal'); doc.text(`${record.patient.age} Yrs  /  ${record.patient.sex}`, margin+28, rowY);
      doc.setFont('helvetica','bold'); doc.text('Assessment Date:', margin+96, rowY);
      doc.setFont('helvetica','normal'); doc.text(record.date || new Date().toLocaleDateString(), margin+125, rowY);
      rowY += 5;
      doc.setFont('helvetica','bold'); doc.text('Symptom Notes:', margin+6, rowY);
      doc.setFont('helvetica','italic');
      const wrappedSx = doc.splitTextToSize(`"${record.patient.symptoms || 'None reported'}"`, 56);
      doc.text(wrappedSx, margin+28, rowY);
      doc.setFont('helvetica','bold'); doc.text('Triage Officer:', margin+96, rowY);
      doc.setFont('helvetica','normal'); doc.text(record.healthWorker || clinicianName, margin+125, rowY);
      y += 44;
      doc.setFillColor(paperBg[0], paperBg[1], paperBg[2]);
      doc.rect(margin, y, contentWidth, 24, 'F');
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]); doc.setLineWidth(0.3);
      doc.rect(margin, y, contentWidth, 24, 'D');
      doc.setFillColor(severityColor[0], severityColor[1], severityColor[2]);
      doc.rect(margin, y, 4, 24, 'F');
      doc.setTextColor(textGray[0], textGray[1], textGray[2]); doc.setFont('helvetica','bold'); doc.setFontSize(8);
      doc.text('PRIMARY TRIAGE CLASSIFICATION GUIDELINE TARGET', margin+8, y+6);
      doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]); doc.setFont('helvetica','bold'); doc.setFontSize(11);
      doc.text(record.finding.primaryFinding, margin+8, y+13);
      doc.setFontSize(8.5); doc.setTextColor(textGray[0], textGray[1], textGray[2]); doc.setFont('helvetica','normal');
      doc.text('Confidence Score: ', margin+8, y+19);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]); doc.setFont('helvetica','bold');
      doc.text(`${record.finding.confidence}% match`, margin+35, y+19);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]); doc.setFont('helvetica','normal');
      doc.text(' |  Triage Priority Level: ', margin+55, y+19);
      doc.setTextColor(severityColor[0], severityColor[1], severityColor[2]); doc.setFont('helvetica','bold');
      doc.text(`${urgencyStr} Severity`, margin+90, y+19);
      y += 31;
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]); doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.text('I. CLINICAL IMAGE SPECIMEN SNAPSHOT', margin, y);
      doc.text('II. SUPPORTIVE PRACTICAL OUTPATIENT DIRECTIVE', margin+82, y);
      y += 2.5;
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]); doc.setLineWidth(0.4);
      doc.line(margin, y, margin+74, y); doc.line(margin+82, y, pageWidth-margin, y);
      y += 5;
      const imageBoxY = y;
      let imgOk = false;
      if (record.image) { try { doc.addImage(record.image, 'JPEG', margin, y, 74, 52); imgOk = true; } catch {} }
      if (!imgOk) {
        doc.setFillColor(242,245,248); doc.rect(margin, y, 74, 52, 'F');
        doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]); doc.rect(margin, y, 74, 52, 'D');
        doc.setTextColor(textGray[0], textGray[1], textGray[2]); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
        doc.text('VISUAL DERMAL SPECIMEN RECORD', margin+14, y+24);
      }
      doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
      const actionLines = doc.splitTextToSize(`Onward Action Plan: ${record.finding.recommendedAction}`, 94);
      doc.text(actionLines, margin+82, y);
      let notesY = y + actionLines.length * 4 + 2;
      doc.setTextColor(textGray[0], textGray[1], textGray[2]); doc.setFont('helvetica','normal'); doc.setFontSize(8);
      (record.finding.treatmentNotes || []).forEach(note => {
        const bl = doc.splitTextToSize(`• ${note}`, 94);
        if (notesY + bl.length * 4 < imageBoxY + 54) { doc.text(bl, margin+82, notesY); notesY += bl.length * 4 + 1; }
      });
      y = Math.max(imageBoxY + 52, notesY) + 8;
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFillColor(paperBg[0], paperBg[1], paperBg[2]);
      doc.rect(margin, y, contentWidth, 20, 'F'); doc.rect(margin, y, contentWidth, 20, 'D');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
      doc.text('OFFICIAL MOH REFERRAL TRANSCRIPT VALIDATION SEAL', margin+5, y+5);
      doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]); doc.setFont('helvetica','normal'); doc.setFontSize(7);
      doc.text('1. Generative diagnostic handbooks conform to clinical protocol V8.46 guidelines.', margin+5, y+10);
      doc.text('2. Local sandboxed key integration verified. Regional medical handovers active.', margin+5, y+14);
      doc.setLineWidth(0.4); doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(pageWidth-margin-32, y+3, 27, 14, 'D');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]); doc.setFont('helvetica','bold'); doc.setFontSize(7);
      doc.text('VERIFIED DOSSIER', pageWidth-margin-30, y+8);
      doc.setFontSize(5); doc.text('MOH TRANSCRIPT SYSTEMS', pageWidth-margin-29, y+13);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]); doc.setLineWidth(0.3);
      doc.line(margin, pageHeight-14, pageWidth-margin, pageHeight-14);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]); doc.setFont('helvetica','normal'); doc.setFontSize(6.5);
      doc.text('Dermatological clinical referral handout generated within browser environment.', margin, pageHeight-10);
      doc.text('Page 1 of 2', pageWidth-margin-doc.getTextWidth('Page 1 of 2'), pageHeight-10);

      // Page 2
      doc.addPage(); y = 20;
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]); doc.rect(margin, 12, 180, 1.5, 'F');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]); doc.setFont('helvetica','bold'); doc.setFontSize(10);
      doc.text('SUPPORTIVE TREATMENT RECIPE & PHARMACOLOGICAL DOSES', margin, y+3);
      const rightH = 'SECURE PROTOCOL DISPENSING SCHEME';
      doc.setTextColor(textGray[0], textGray[1], textGray[2]); doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
      doc.text(rightH, pageWidth-margin-doc.getTextWidth(rightH), y+3);
      y += 10;
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]); doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth-margin, y); y += 8;
     
     
      y = pageHeight - 34;
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]); doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth-margin, y);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]); doc.setFont('helvetica','normal'); doc.setFontSize(6.8);
      doc.text(`Digital Verification Signature: ${record.healthWorker || clinicianName}`, margin, y+5);
      doc.text(`System Unique Sign-key Hash: SHA256-${record.id.slice(0,12).toUpperCase()}...`, margin, y+9);
      doc.setFontSize(7); doc.line(pageWidth-margin-45, y+12, pageWidth-margin, y+12);
      doc.text('Attending Clinician Authenticated Stamp', pageWidth-margin-45, y+16);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]); doc.setLineWidth(0.3);
      doc.line(margin, pageHeight-14, pageWidth-margin, pageHeight-14);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]); doc.setFont('helvetica','normal'); doc.setFontSize(6.5);
      doc.text('Approved by National Digital Health Authority.', margin, pageHeight-10);
      doc.text('Page 2 of 2', pageWidth-margin-doc.getTextWidth('Page 2 of 2'), pageHeight-10);
      doc.save(`Clinical_Referral_Note_${record.id}_${record.patient.name.trim().replace(/\s+/g,'_')}.pdf`);
    } catch (err: any) { alert('PDF generation failed: ' + err.message); }
  };

  // ── Processed cases ────────────────────────────────────────────────────────
  const processedCases = cases.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchSearch = item.patient.name.toLowerCase().includes(q) || item.finding.primaryFinding.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
    const matchUrgency = filterUrgency === 'All' || item.finding.urgency === filterUrgency;
    return matchSearch && matchUrgency;
  });

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <>
      {!clinician ? (
        <ClinicianSetup onComplete={handleProfileComplete} />
      ) : (
        <div className="min-h-screen bg-[#f7fafc] text-[#181c1e] font-sans antialiased flex flex-col">

          {/* ── HEADER ── */}
          <header className="bg-[#001B2E]/65 backdrop-blur-md border-b border-white/10 fixed top-0 left-0 right-0 z-50 h-20 shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
            <div className="flex justify-between items-center w-full px-6 md:px-12 max-w-7xl mx-auto h-full">
              <div onClick={() => { setScreen('home'); stopWebcam(); }} className="flex items-center gap-4 cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00A6FB] via-[#003554] to-[#001B2E] flex items-center justify-center text-white font-display font-bold text-sm shadow-[inset_0_1px_3px_rgba(255,255,255,0.4)] transition-transform group-hover:scale-105">DD</div>
                <div className="flex flex-col">
                  <span className="font-display font-bold text-[#F0F4F8] text-xl tracking-tight leading-none">Derma<span className="text-[#00A6FB]">Defect</span></span>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[#00A6FB]/80 font-semibold mt-1">Clinical Diagnostics</span>
                </div>
              </div>

              <nav className="hidden md:flex items-center gap-10 h-full">
                {[
                  { label: t.newAssessment, action: resetAndStartAssessment, active: ['assessment-info','assessment-capture','assessment-review','referral-note'].includes(screen) },
                  { label: t.caseHistory,   action: () => { setScreen('case-history'); stopWebcam(); }, active: screen === 'case-history' },
                ].map(({ label, action, active }) => (
                  <button key={label} onClick={action} className={`font-sans text-sm font-medium transition-all duration-300 h-full relative flex items-center ${active ? 'text-white font-semibold' : 'text-[#F0F4F8]/60 hover:text-white'}`}>
                    {label}
                    {active && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-[#00A6FB] rounded-t-full shadow-[0_-2px_12px_rgba(0,166,251,0.8)]" />}
                  </button>
                ))}
              </nav>

              <div className="flex items-center gap-3">
                {/* Clinician badge */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
                  <div className="w-6 h-6 rounded-full bg-[#00A6FB] flex items-center justify-center text-white font-bold text-[10px]">
                    {clinician.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-bold text-white leading-none">{clinician.name}</p>
                    <p className="text-[9px] text-white/60 leading-none mt-0.5">{clinician.role}</p>
                  </div>
                  <button onClick={() => { clearProfile(); setClinician(null); }} title="Switch profile" className="ml-1 text-white/40 hover:text-white/80 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>

              
              </div>
            </div>
          </header>

          {/* ── MAIN ── */}
          <main className="flex-1 pt-14 pb-20 md:pb-0 flex flex-col">

            {/* HOME */}
            {screen === 'home' && (
              <div className="flex-1 flex flex-col relative overflow-hidden bg-[#F8F9FA]">

                {/* Hero */}
                <section className="relative min-h-screen flex flex-col overflow-hidden bg-[#001B2E] text-[#F0F4F8]">
                  <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=2400&q=80" alt="" className="w-full h-full object-cover opacity-45 mix-blend-luminosity filter contrast-125 brightness-110" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#001B2E]/10 to-[#001B2E]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#001B2E_90%)]" />
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70vw] h-[50vh] bg-[#00A6FB]/10 blur-[150px] rounded-full pointer-events-none z-0" />
                  <div className="max-w-4xl mx-auto w-full px-6 md:px-12 pt-19 pb-24 flex flex-col items-center justify-center text-center relative z-10 my-auto">
                    <div className="w-fit mb-8">
                      <span className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-white/[0.03] backdrop-blur-md border border-white/10 text-[11px] uppercase tracking-[0.25em] text-[#F0F4F8] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00A6FB] shadow-[0_0_10px_#00A6FB]" />
                        Dermatology Support for General Practice
                      </span>
                    </div>
                    <h1 className="font-display font-light text-white text-4xl sm:text-6xl md:text-7xl leading-[1.1] tracking-tight mb-8 drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                      Diagnostic support, <br/>
                      <span className="font-bold bg-gradient-to-r from-white via-[#00A6FB] to-[#00A6FB] bg-clip-text text-transparent">built for clinicians.</span>
                    </h1>
                    <p className="text-[#F0F4F8]/85 text-base md:text-xl leading-relaxed max-w-2xl font-sans font-light mb-12 drop-shadow-sm">
                      DermaDefect provides physicians with instant, evidence-backed reference mapping and diagnostic cross-examinations.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full sm:w-auto">
                      <button onClick={resetAndStartAssessment} className="w-full sm:w-auto h-14 px-12 bg-[#00A6FB] text-[#001B2E] font-sans font-semibold text-base rounded-full shadow-[0_10px_25px_rgba(0,166,251,0.25)] hover:bg-white hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-95">
                        <PlusCircle className="w-5 h-5" /><span>Begin Assessment</span>
                      </button>
                      <a href="#how-it-works" className="w-full sm:w-auto h-14 px-12 border border-white/10 text-[#F0F4F8] bg-white/[0.04] backdrop-blur-md font-sans font-semibold text-base rounded-full hover:bg-white/[0.1] hover:border-white/20 transition-all flex items-center justify-center gap-3 active:scale-95">
                        <span>Read Clinical Protocol</span><ArrowRight className="w-4 h-4 opacity-70 text-[#00A6FB]" />
                      </a>
                    </div>
                  </div>
                </section>

                {/* Stats section */}
                <section className="py-24 md:py-32 px-6 md:px-12 bg-white relative z-10 select-none">
                  <div className="max-w-4xl mx-auto text-center mb-20">
                    <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#00A6FB]/5 border border-[#00A6FB]/10 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#00A6FB]">The Clinical Disparity</span>
                    <h2 className="font-display font-bold text-[#001B2E] text-3xl sm:text-5xl tracking-tight mt-4 leading-[1.15]">Africa has fewer than 1 dermatologist<br className="hidden md:block"/> per million people.</h2>
                    <div className="w-16 h-1 bg-[#00A6FB] rounded-full mx-auto mt-6 opacity-60" />
                    <p className="text-base md:text-lg text-[#003554]/75 font-sans font-light leading-relaxed mt-6 max-w-2xl mx-auto">Skin diseases are among the most common reasons for primary clinic visits — yet most go misdiagnosed or untreated at the community level.</p>
                  </div>
                  <div className="max-w-6xl mx-auto bg-gradient-to-b from-white to-[#F0F4F8]/30 rounded-3xl border border-[#003554]/10 overflow-hidden shadow-[0_20px_50px_rgba(0,27,46,0.04)]">
                    <div className="grid grid-cols-1 lg:grid-cols-12">
                      <div className="lg:col-span-7 relative min-h-[350px] sm:min-h-[450px] overflow-hidden">
                        <img src="https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1600&q=80" alt="" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-[#001B2E]/95 via-[#001B2E]/70 to-transparent z-10" />
                        <div className="absolute bottom-12 left-12 z-20 max-w-sm text-left">
                          <span className="text-[10px] text-[#00A6FB] font-bold uppercase tracking-widest block mb-2">Field Support Optimization</span>
                          <h3 className="text-white font-display font-bold text-2xl leading-tight">Empowering frontlines in local community clinics.</h3>
                        </div>
                      </div>
                      <div className="lg:col-span-5 p-8 md:p-10 flex flex-col justify-center gap-6">
                        {[
                          { icon: <Heart className="w-5 h-5" />, stat: '1 in 3', label: 'Affected Annually', desc: 'Ghanaians affected by common, preventable dermatological conditions every year.' },
                          { icon: <Clock className="w-5 h-5" />, stat: '72 Hours', label: 'Average Rural Wait', desc: 'Mean commute and wait times to consult specialists in metropolitan centers.' },
                          { icon: <AlertTriangle className="w-5 h-5" />, stat: '60%', label: 'Initial Misdiagnosis', desc: 'Cases misdiagnosed at community care outposts without assistive workflows.', red: true },
                        ].map(({ icon, stat, label, desc, red }) => (
                          <div key={stat} className="bg-white p-6 rounded-2xl border border-[#003554]/5 shadow-sm hover:border-[#00A6FB]/20 transition-all duration-300">
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${red ? 'bg-red-500/10 text-red-500' : 'bg-[#00A6FB]/10 text-[#00A6FB]'}`}>{icon}</div>
                              <div>
                                <h3 className="font-display font-bold text-3xl text-[#001B2E] tracking-tight">{stat}</h3>
                                <p className={`text-[10px] uppercase tracking-widest font-bold mt-0.5 ${red ? 'text-red-500/70' : 'text-[#003554]/50'}`}>{label}</p>
                              </div>
                            </div>
                            <p className="text-xs text-[#003554]/70 leading-relaxed mt-3 font-light">{desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* How it works */}
                <span id="how-it-works" className="-mt-20 pt-5 block" />
                <section className="relative py-24 md:py-32 px-6 md:px-12 bg-[#F8FAFC] border-t border-slate-200 select-none overflow-hidden">
                  <div className="max-w-4xl mx-auto text-center mb-16 relative z-10">
                    <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#00A6FB]/5 border border-[#00A6FB]/10 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00A6FB]">The Protocol</span>
                    <h2 className="font-display font-bold text-slate-900 text-3xl sm:text-5xl tracking-tight mt-4 leading-tight">Three steps. Two seconds. <span className="text-[#00A6FB]">One life changed.</span></h2>
                  </div>
                  <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch relative z-10">
                    {[
                      { step: '01', title: 'Capture Image', desc: 'The clinician captures a clear frame of the skin anomaly directly within the device browser, or uploads from local device storage.' },
                      { step: '02', title: 'Reference Map', desc: 'The internal software engine evaluates key visual structural parameters locally, formatting confirmed criteria markers in under two seconds.' },
                      { step: '03', title: 'Action Results', desc: 'Review structural indices, confirm urgency tiers, and copy instantly generated case summaries formatted for local referral networks.' },
                    ].map(({ step, title, desc }) => (
                      <div key={step} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-4 hover:shadow-lg hover:border-[#00A6FB]/30 transition-all duration-300">
                        <div className="aspect-[1.6] w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
                          <img src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80" alt="" className="w-full h-full object-cover filter brightness-95" />
                        </div>
                        <div className="flex items-start justify-between pt-2">
                          <div>
                            <span className="text-[10px] text-[#00A6FB] font-bold uppercase tracking-widest">Step {step}</span>
                            <h3 className="font-display font-bold text-lg text-slate-900 mt-0.5">{title}</h3>
                          </div>
                          <span className="text-xl font-display font-light text-slate-300">{step}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed font-light">{desc}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* CTA */}
                <section className="py-20 md:py-28 px-4 md:px-8 bg-gradient-to-br from-[#0A1628] to-[#0F2D1F] text-white relative z-10 select-none overflow-hidden text-center border-t border-white/5">
                  <div className="max-w-4xl mx-auto space-y-7 relative z-10">
                    <h2 className="font-display font-black text-white text-3xl sm:text-4xl leading-tight tracking-tight">Ready to bring AI-powered skin care to your clinic?</h2>
                    <p className="text-slate-300 font-sans text-sm sm:text-base leading-relaxed max-w-xl mx-auto">DermaDetect is free to use, works offline, and takes less than 2 minutes to learn.</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3.5 max-w-md mx-auto">
                      <button onClick={resetAndStartAssessment} className="w-full sm:w-auto h-13 px-8 bg-[#00A6FB] text-[#001B2E] font-display font-bold text-sm rounded-xl flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 hover:-translate-y-0.5 transition-all">
                        <PlusCircle className="w-5 h-5" /><span>Start Using DermaDetect</span>
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 pt-10 border-t border-white/5 font-mono text-[10.5px] text-slate-400">
                      <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#082F49]" />🔒 Patient data stays on your device</span>
                      <span className="flex items-center gap-2"><WifiOff className="w-4 h-4 text-[#EF9F27]" />📶 Works without internet</span>
                      <span className="flex items-center gap-2"><Globe className="w-4 h-4 text-[#32c494]" />🌍 Built for African healthcare</span>
                    </div>
                  </div>
                </section>

                {/* FAQ */}
                <section className="bg-white py-16 md:py-24 border-b border-slate-200 select-none">
                  <div className="max-w-4xl mx-auto px-4">
                    <div className="text-center mb-12">
                      <span className="text-xs font-bold font-mono tracking-widest text-[#082F49] uppercase">FAQ</span>
                      <h2 className="font-display font-black text-slate-900 text-2xl md:text-3xl tracking-tight mt-2.5">Privacy, Scope & Safety FAQ</h2>
                    </div>
                    <div className="space-y-4">
                      {[
                        { q: "What skin conditions can DermaDetect help with?", a: "The system assists in recognizing conditions including Tinea Corporis, Eczema, Impetigo, Scabies, Melanoma, Basal Cell Carcinoma, and more. It aids clinical triaging but does not replace a doctor's examination." },
                        { q: "How is patient data kept private and secure?", a: "All image evaluation occurs locally on your browser. No patient records or photographs are sent to external servers without your explicit action." },
                        { q: "Can I generate and download clinical reports offline?", a: "Yes. Once loaded, report compilation operates fully offline. You can generate, preview, and download patient summaries or referral notes directly to your local device." },
                      ].map((faq, idx) => {
                        const isOpen = !!faqOpenState[idx];
                        return (
                          <div key={idx} className="border border-[#bccac1]/75 rounded-xl overflow-hidden transition-all duration-300 bg-[#F8F9FA]/50">
                            <button onClick={() => setFaqOpenState({ ...faqOpenState, [idx]: !isOpen })} className="w-full text-left p-5 flex justify-between items-center font-display font-bold text-sm text-[#181c1e] cursor-pointer">
                              <span>{faq.q}</span>
                              <span className="text-[#082F49] text-lg font-bold ml-4">{isOpen ? '−' : '+'}</span>
                            </button>
                            {isOpen && <div className="px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-dashed border-slate-200">{faq.a}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* Footer */}
                <footer className="bg-[#0A121D] text-slate-300 pt-16 pb-10 border-t-2 border-[#082F49]/30">
                  <div className="max-w-6xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/5 text-xs">
                    <div className="md:col-span-5 space-y-4">
                      <div className="flex items-center gap-2.5 text-white">
                        <div className="w-8 h-8 rounded-lg bg-[#082F49] flex items-center justify-center font-black text-sm select-none">DD</div>
                        <span className="font-display font-extrabold text-base text-white">DermaDetect</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed text-xs">DermaDetect is an open-source assistive screening tool designed to expand primary care diagnostic support in community, rural, and outreach settings.</p>
                      <p className="text-slate-500 text-[10.5px] leading-relaxed">*This is a clinical decision support tool and does not replace professional medical advice or formal diagnosis.</p>
                    </div>
                    <div className="md:col-span-2 space-y-3">
                      <h4 className="font-display font-bold text-white text-xs uppercase tracking-wider">Clinical Tools</h4>
                      <ul className="space-y-2 text-slate-400">
                        <li><button onClick={resetAndStartAssessment} className="hover:text-white transition-colors">Start Assessment</button></li>
                        <li><button onClick={() => setScreen('case-history')} className="hover:text-white transition-colors">View Patient Roster</button></li>
                      </ul>
                    </div>
                    <div className="md:col-span-3 space-y-3">
                      <h4 className="font-display font-bold text-white text-xs uppercase tracking-wider">Device Privacy</h4>
                      <p className="text-slate-400 leading-relaxed text-[11px]">All processing occurs locally within your browser. No sensitive patient data is transmitted to remote servers.</p>
                    </div>
                  </div>
                  <div className="max-w-6xl mx-auto px-4 md:px-8 pt-8 flex justify-between items-center text-[11px] text-slate-400">
                    <span>© {new Date().getFullYear()} DermaDetect Telehealth Systems.</span>
                  </div>
                </footer>
              </div>
            )}

            {/* ASSESSMENT FLOW */}
            {(screen === 'assessment-info' || screen === 'assessment-capture' || screen === 'assessment-review' || screen === 'referral-note') && (
              <div className="flex-1 flex flex-col md:flex-row">
                {/* Sidebar */}
                <aside className="w-full md:w-64 bg-slate-50 md:border-r border-slate-200 py-4 md:py-6 px-4 flex flex-col md:min-h-[calc(100vh-3.5rem)] select-none">
                  <div className="mb-6 hidden md:block mt-7">
                    <h2 className="font-display font-bold text-base text-slate-900">Assessment Progress</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Clinical Workflow Protocol</p>
                  </div>
                  <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                    {[
                      { label: 'Step 1: Patient Info',   icon: <UserPen className="w-4 h-4 shrink-0" />,    id: 'assessment-info',    enabled: true },
                      { label: 'Step 2: Skin Capture',   icon: <Camera className="w-4 h-4 shrink-0" />,     id: 'assessment-capture', enabled: !!patient.name },
                      { label: 'Step 3: Action Results', icon: <ClipboardCheck className="w-4 h-4 shrink-0" />, id: 'assessment-review', enabled: !!activeAnalysisResult },
                    ].map(({ label, icon, id, enabled }) => (
                      <div key={id} onClick={() => { if (enabled) setScreen(id as any); }}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all grow md:grow-0 shrink-0 ${!enabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${screen === id ? 'bg-[#00A6FB] text-white font-semibold shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'}`}>
                        {icon}<span className="font-display text-xs font-medium whitespace-nowrap">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto hidden md:block pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2 px-1 text-slate-400">
                      <ShieldCheck className="w-4 h-4 text-[#00A6FB]" />
                      <span className="font-sans font-semibold text-[9px] tracking-wider uppercase">Secure Diagnostic Link</span>
                    </div>
                  </div>
                </aside>

                <div className="flex-1 flex flex-col pt-4 md:pt-0">

                  {/* Step 1: Patient Info */}
                  {screen === 'assessment-info' && (
                    <div className="p-4 md:p-8 flex-1 flex items-center justify-center canvas-bg mt-7">
                      <div className="bg-white border border-[#bccac1] rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-sm">
                        <header className="mb-6">
                          <h2 className="font-display font-extrabold text-xl md:text-2xl text-[#181c1e]">Patient Details</h2>
                          <p className="text-xs text-[#3d4943] mt-1.5">Record basic patient identifiers, demographics, and symptom definitions.</p>
                        </header>
                        <form className="space-y-5" onSubmit={e => { e.preventDefault(); if (patient.name) setScreen('assessment-capture'); }}>
                          <div className="space-y-1.5">
                            <label className="font-display text-xs font-bold text-[#181c1e] block">Patient Full Name</label>
                            <input type="text" required value={patient.name} onChange={e => setPatient({...patient, name: e.target.value})} placeholder="Full legal name" className="w-full h-11 px-3.5 border border-[#bccac1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0077b6] bg-white text-sm transition-all" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="font-display text-xs font-bold text-[#181c1e] block">Age (Years)</label>
                              <input type="number" required min="0" max="125" value={patient.age} onChange={e => setPatient({...patient, age: e.target.value})} placeholder="e.g. 34" className="w-full h-11 px-3.5 border border-[#bccac1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0077b6] bg-white text-sm transition-all" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="font-display text-xs font-bold text-[#181c1e] block">Sex Selection</label>
                              <div className="flex h-11 border border-[#bccac1] rounded-lg overflow-hidden bg-white">
                                {['Male','Female'].map((s, i) => (
                                  <React.Fragment key={s}>
                                    {i > 0 && <div className="w-[1px] bg-[#bccac1]" />}
                                    <button type="button" onClick={() => setPatient({...patient, sex: s as any})} className={`flex-1 text-xs font-bold transition-all ${patient.sex === s ? 'bg-[#d6e0f6] text-[#121c2c]' : 'text-[#3d4943] hover:bg-[#f1f4f6]'}`}>{s}</button>
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="font-display text-xs font-bold text-[#181c1e] block">Patient Contact Number</label>
                            <input type="tel" required value={patient.contactNumber} onChange={e => setPatient({...patient, contactNumber: e.target.value})} placeholder="0200000000" max={10} className="w-full h-11 px-3.5 border border-[#bccac1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0077b6] bg-white text-sm transition-all" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="font-display text-xs font-bold text-[#181c1e] block">Brief Symptom Description</label>
                            <textarea rows={3} value={patient.symptoms} onChange={e => setPatient({...patient, symptoms: e.target.value})} placeholder="Describe lesion duration, localized itch, flareups, and changes observed on the skin..." className="w-full p-3 border border-[#bccac1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0077b6] bg-white text-sm transition-all resize-none" />
                          </div>
                          <div className="pt-2">
                            <button type="submit" disabled={!patient.name || !patient.age || !patient.sex || !patient.contactNumber} className="w-full h-11 bg-[#0077b6] hover:bg-[#0096c7] disabled:bg-[#bccac1] disabled:cursor-not-allowed text-white font-display font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                              <span>Next Step: Capture Skin Image</span><ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Capture */}
                  {screen === 'assessment-capture' && (
                    <div className="p-4 md:p-8 flex-1 canvas-bg mt-7">
                      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        <div className="space-y-6">
                          <div>
                            <span className="inline-block bg-[#ebeef0] text-[#555f71] px-2.5 py-0.5 rounded-full font-display font-semibold text-[10px] mb-2 uppercase tracking-wide">Assessment Phase 02</span>
                            <h2 className="font-display font-extrabold text-[#181c1e] text-2xl">Capture Skin Image</h2>
                            <p className="text-sm text-[#3d4943] mt-2 leading-relaxed">For accurate AI triage evaluation, capture a sharp close-up photo of the patient's skin lesion.</p>
                          </div>
                          <div className="bg-white border border-[#bccac1] p-4 rounded-xl flex gap-3">
                            <div className="p-2 bg-[#d6e0f6] rounded-full text-[#0077b6] h-fit"><Lightbulb className="w-5 h-5" /></div>
                            <div>
                              <h4 className="font-display font-bold text-xs text-[#181c1e]">Photography Tip</h4>
                              <p className="text-[11px] text-[#3d4943] mt-1 leading-relaxed">Use natural lighting if possible. Avoid using direct camera flash over wet or oily ulcers.</p>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-3">
                            {isCameraActive ? (
                              <button onClick={captureFrame} className="flex-1 h-11 bg-[#0077b6] text-white rounded-lg font-display font-bold text-sm hover:bg-[#0096c7] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                                <Camera className="w-5 h-5 animate-pulse" />Snaps Assessment Frame
                              </button>
                            ) : (
                              <button onClick={startWebcam} className="flex-1 h-11 bg-[#0077b6] text-white rounded-lg font-display font-bold text-sm hover:bg-[#0096c7] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                                <Camera className="w-5 h-5" />Take Photo with Camera
                              </button>
                            )}
                            <label className="flex-1 h-11 border-2 border-dashed border-[#0077b6] text-[#0077b6] bg-white rounded-lg font-display font-bold text-sm hover:bg-[#f1f4f6] transition-all flex items-center justify-center gap-2 cursor-pointer">
                              <Upload className="w-5 h-5" /><span>Upload from Gallery</span>
                              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                            </label>
                          </div>
                          {isCameraActive && <button onClick={stopWebcam} className="w-full h-9 bg-[#ffdad6] text-[#93000a] text-xs font-bold rounded-lg hover:bg-red-200 transition-colors">Cancel Camera Stream</button>}
                        </div>
                        <div className="space-y-4">
                          <div className="bg-white border rounded-2xl p-4 border-[#bccac1]">
                            <h3 className="font-display text-xs font-bold text-[#181c1e] mb-3 uppercase tracking-wider">Assessment Preview</h3>
                            <div className="aspect-[4/5] bg-[#ebeef0] border-2 border-dashed border-[#bccac1] rounded-xl overflow-hidden flex flex-col items-center justify-center p-4 relative">
                              {isCameraActive && !capturedImage && <video ref={videoRef} autoPlay className="w-full h-full object-cover rounded-lg absolute inset-0" />}
                              {capturedImage ? (
                                <img src={capturedImage} alt="Clinic Skin Frame" className="w-full h-full object-cover rounded-lg absolute inset-0" />
                              ) : (!isCameraActive && (
                                <div className="text-center p-6 space-y-3 pointer-events-none">
                                  <span className="w-12 h-12 rounded-full bg-[#f1f4f6] border border-[#bccac1] flex items-center justify-center text-[#6d7a73] mx-auto"><Camera className="w-6 h-6" /></span>
                                  <p className="font-display font-extrabold text-sm text-[#3d4943]">No active image captured</p>
                                </div>
                              ))}
                              {cameraError && !capturedImage && (
                                <div className="absolute inset-0 bg-[#ffdad6]/95 flex items-center justify-center p-6 text-center z-10 rounded-lg">
                                  <p className="text-xs font-semibold text-[#93000a] leading-relaxed">{cameraError}</p>
                                </div>
                              )}
                            </div>
                            {capturedImage && (
                              <div className="mt-4 p-3 bg-[#f0f9ff] rounded-xl border border-[#bccac1] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-5 h-5 text-[#0077b6]" />
                                  <span className="text-xs font-bold text-[#181c1e]">{customFileSelected ? 'Local File Selected' : 'Specimen Pre-loaded'}</span>
                                </div>
                                <button onClick={() => { setCapturedImage(null); setCustomFileSelected(false); }} className="text-xs font-bold text-[#ba1a1a] hover:underline">Reset Choice</button>
                              </div>
                            )}
                          </div>
                          {capturedImage && (
                            <button onClick={runAiAnalysis} disabled={analysisLoading} className="w-full h-12 bg-[#0077b6] hover:bg-[#0096c7] text-white rounded-xl font-display font-extrabold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95 transition-all">
                              <Activity className="w-5 h-5" /><span>Analyse Skin Condition</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Results */}
                  {screen === 'assessment-review' && activeAnalysisResult && (
                    <div className="p-4 md:p-8 flex-1 bg-[#F8FAFC] mt-7 select-none">
                      <div className="max-w-4xl mx-auto space-y-6">
                        <header className="border-b border-slate-200 pb-4">
                          <h2 className="font-display font-bold text-2xl text-slate-900">Assessment Results</h2>
                          <p className="text-xs text-slate-500 mt-1.5">Review structural profile classifications and matching reference criteria metrics.</p>
                        </header>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                          <div className="md:col-span-7 space-y-6">
                            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
                              <span className="text-[#00A6FB] font-sans font-bold text-[10px] tracking-wider uppercase block">Primary Medical Profile Finding</span>
                              <div className="flex justify-between items-start mt-1.5 mb-4">
                                <h3 className="font-display font-bold text-xl md:text-2xl text-slate-900">{activeAnalysisResult.primaryFinding}</h3>
                                <div className="bg-slate-50 px-3 py-1 rounded-xl flex flex-col items-end shrink-0 border border-slate-200">
                                  <span className="font-display font-bold text-[#00A6FB] text-xl leading-none">{activeAnalysisResult.confidence}%</span>
                                  <span className="text-[9px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">Match</span>
                                </div>
                              </div>
                              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-[#00A6FB]" style={{ width: `${activeAnalysisResult.confidence}%` }} />
                              </div>
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-[#0077b6] uppercase tracking-wider border-b border-[#f1f4f6] pb-2 mb-4">AI Clinical Evaluation</h3>
                              <div className="space-y-6">
                                <div className="bg-white border border-[#bccac1] p-6 rounded-xl shadow-sm">
                                  {activeAnalysisResult.referralNote ? (
                                    <ReactMarkdown components={{
                                      strong: ({ node, ...props }) => <strong className="block font-bold text-[#0077b6] text-xs uppercase tracking-wider mt-5 mb-2 pb-1 border-b border-slate-100" {...props} />,
                                      p:      ({ node, ...props }) => <p className="text-sm text-slate-700 leading-relaxed mb-3 font-normal" {...props} />,
                                      ul:     ({ node, ...props }) => <ul className="space-y-1.5 mb-3 ml-4" {...props} />,
                                      li:     ({ node, ...props }) => <li className="text-sm text-slate-700 leading-relaxed list-disc" {...props} />,
                                    }}>{activeAnalysisResult.referralNote}</ReactMarkdown>
                                  ) : (
                                    <p className="text-slate-400 italic text-sm">No clinical narrative generated yet. Click "Format Referral Summary" to generate.</p>
                                  )}
                                </div>
                                <div className="print:hidden">
                                  <TreatmentRecommendations finding={activeAnalysisResult} patient={patient} caseId={activeCaseId || 'NEW-CASE'} />
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="md:col-span-5 space-y-6">
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                              <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center text-xs font-medium text-slate-600">
                                <span>Patient Lesion Frame</span>
                                <span className="text-[10px] text-slate-400 font-mono uppercase">IMG_REFERENCE.jpg</span>
                              </div>
                              <div className="aspect-square bg-slate-50 relative">
                                {capturedImage && <img src={capturedImage} alt="Captured skin lesion" className="w-full h-full object-cover filter brightness-95" />}
                              </div>
                              {activeAnalysisResult.heatmap_b64 && (
                                <div className="aspect-square bg-slate-50 relative pt-3">
                                  <div className="bg-[#e0e3e5] overflow-hidden border border-[#bccac1] relative aspect-square">
                                    <img src={`data:image/jpeg;base64,${activeAnalysisResult.heatmap_b64}`} alt="AI Saliency Map" className="w-full h-full object-cover" />
                                    <div className="absolute top-2 left-2 bg-[#0077b6]/80 text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wide">AI Saliency Map</div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className={`p-4 rounded-2xl border flex items-start gap-3 shadow-sm ${activeAnalysisResult.urgency==='High' ? 'bg-rose-50 border-rose-200' : activeAnalysisResult.urgency==='Moderate' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                              <div className={`p-1.5 rounded-lg shrink-0 text-white ${activeAnalysisResult.urgency==='High' ? 'bg-rose-600' : activeAnalysisResult.urgency==='Moderate' ? 'bg-amber-600' : 'bg-slate-600'}`}>
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                              <div className="space-y-1">
                                <span className="font-sans font-bold text-[10px] tracking-wider uppercase block">Triage Metric: {activeAnalysisResult.urgency} Urgency</span>
                                <p className="text-xs text-slate-600 leading-relaxed font-light">{activeAnalysisResult.urgencyText}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-3">
                          <button onClick={handleFormatReferral} disabled={referralNoteLoading} className="h-11 px-6 border border-slate-200 text-slate-700 bg-white font-display font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                            {referralNoteLoading ? <><Loader2 className="w-4 h-4 animate-spin text-[#00A6FB]" /><span>Generating Note...</span></> : <><FileText className="w-4 h-4 text-[#00A6FB]" /><span>Format Referral Summary</span></>}
                          </button>
                          <button onClick={saveCaseRecord} className="h-11 px-8 bg-[#00A6FB] text-white font-display font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-[#008cc4] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md">
                            <Save className="w-4 h-4" /><span>Commit Case Record</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Referral Note */}
                  {screen === 'referral-note' && activeAnalysisResult && (() => {
                    const getConditionDetails = (name: string) => {
                      const n = name.toLowerCase();
                      if (n.includes('ringworm') || n.includes('tinea')) return { description: "Tinea corporis is a superficial fungal infection characterised by a ring-shaped, scaly, itchy rash. Highly treatable with topical antifungal agents.", suggestions: ["Clotrimazole 1% cream — apply twice daily for 2–4 weeks", "Keep area clean and dry", "Avoid sharing towels or clothing"] };
                      if (n.includes('eczema') || n.includes('atopic') || n.includes('dermatitis')) return { description: "Atopic dermatitis is a chronic pruritic inflammatory skin condition managed with hydration, trigger avoidance, and topical anti-inflammatories.", suggestions: ["Hydrocortisone 1% cream — apply twice daily for 7 days", "Apply thick emollient moisturizer frequently", "Avoid harsh scented soaps and hot baths"] };
                      if (n.includes('impetigo')) return { description: "Impetigo is a highly contagious superficial bacterial skin infection characterized by honey-colored crusts. Managed with antibiotic therapy.", suggestions: ["Mupirocin 2% topical ointment — apply 3 times daily", "Gently clean honey-colored crusts with warm soapy water", "Keep lesions covered to prevent auto-inoculation"] };
                      if (n.includes('scabies')) return { description: "Scabies is an intensely itchy skin infestation caused by the mite Sarcoptes scabiei. Highly contagious. Managed with permethrin or ivermectin.", suggestions: ["Permethrin 5% cream — apply from neck down, wash after 8-14 hours", "Treat all household contacts simultaneously", "Wash bedding and clothes in hot water"] };
                      return { description: "A potential clinical skin indication detected by the assistive triage scanner. Standard clinical diagnostic procedures are recommended before commencing definitive therapy.", suggestions: activeAnalysisResult.treatmentNotes?.length ? activeAnalysisResult.treatmentNotes : ["Monitor area daily for pigment or dimension shifts", "Keep the affected region clean, dry, and cool", "Refer to dermatology clinic if symptoms do not improve"] };
                    };
                    const docDetails   = getConditionDetails(activeAnalysisResult.primaryFinding);
                    const isHigh       = activeAnalysisResult.urgency === 'High';
                    const isMod        = activeAnalysisResult.urgency === 'Moderate';
                    const urgencyHex   = isHigh ? '#D85A30' : isMod ? '#EF9F27' : '#082F49';
                    const urgencyStrip = isHigh ? '● URGENT — Immediate referral required. Do not delay.' : isMod ? '● MODERATE — Refer to clinic within 3 days for assessment and treatment.' : '● MILD — Can be managed locally. Refer if no improvement in 7 days.';
                    const urgencyBadge = isHigh ? '● Urgent Referral' : isMod ? '● Moderate Urgency' : '● Mild Urgency';
                    const cleanRefId   = activeCaseId || `DD-${new Date().getFullYear()}-00847`;

                    return (
                      <div className="p-4 md:p-8 flex-1 bg-slate-50 min-h-screen grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto w-full font-sans select-none">
                        {/* Left panel */}
                        <div className="lg:col-span-4 space-y-4 no-print shrink-0 w-full">
                          <div className="bg-white border border-slate-200 p-6 rounded-xl space-y-4 shadow-sm">
                            <div className="flex items-center gap-2">
                              <Printer className="w-5 h-5" style={{ color: '#082F49' }} />
                              <h4 className="font-display font-bold text-sm text-[#0A1628]">Referral Note Actions</h4>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">This structured note details the verified findings and can be printed or shared.</p>
                            <div className="space-y-2 pt-2">
                              <button onClick={downloadReferralNotePdf} className="w-full h-11 bg-[#082F49] hover:bg-[#032D49]/30 text-white font-display font-medium text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                                <Printer className="w-4 h-4" /><span>Download as PDF</span>
                              </button>
                              <a href={`https://wa.me/?text=DermaDetect%20Referral%20Note%20for%20${encodeURIComponent(patient.name||'Patient')}%20—%20${encodeURIComponent(activeAnalysisResult.primaryFinding)}%20—%20${isHigh?'URGENT':isMod?'MODERATE':'MILD'}%20urgency.`} target="_blank" rel="noreferrer" className="w-full h-11 bg-[#082F49]/40 hover:bg-[#082F49]/60 text-white font-display font-medium text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                                <Share2 className="w-4 h-4" /><span>Share via WhatsApp</span>
                              </a>
                            </div>
                          </div>
                          <button onClick={() => setScreen('assessment-review')} className="w-full h-10 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                            <ChevronLeft className="w-4 h-4" /><span>Return to Review Stage</span>
                          </button>
                        </div>

                        {/* Document */}
                        <div className="lg:col-span-8 flex justify-center w-full print-wrapper">
                          <div className="bg-white border-l-[4px] border-y border-r border-slate-200 w-full max-w-2xl p-6 md:p-8 rounded-xl shadow-md flex flex-col text-[#0A1628] font-sans leading-relaxed">
                            {/* Header band */}
                            <div className="flex justify-between items-center bg-[#0a3369] text-white px-5 py-4 rounded-lg mb-4 h-16">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-md bg-white/20 flex items-center justify-center font-black text-white shrink-0">DD</div>
                                <div>
                                  <h3 className="font-display font-extrabold text-base tracking-tight leading-none text-white">DermaDetect</h3>
                                  <p className="text-[10px] text-white/85 font-mono mt-1 font-semibold leading-none">AI-Powered Skin Assessment</p>
                                </div>
                              </div>
                              <div className="h-10 w-[1px] bg-white/20 mx-4 hidden sm:block" />
                              <div className="text-right flex-1 sm:flex-initial">
                                <span className="font-display font-black text-xs sm:text-sm tracking-widest block uppercase text-white">CLINICAL REFERRAL NOTE</span>
                                <span className="text-[9px] font-mono text-white/95 mt-1 block uppercase tracking-wider">REF: {cleanRefId}</span>
                              </div>
                            </div>

                            {/* Alert stripe */}
                            <div className="w-full h-9 flex items-center justify-center px-4 mb-6 rounded text-white text-[11px] font-bold" style={{ backgroundColor: urgencyHex }}>
                              {urgencyStrip}
                            </div>

                            {/* Two-column body */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                              {/* Left col */}
                              <div className="md:col-span-7 space-y-6">
                                {/* Patient info */}
                                <div className="space-y-2 text-left">
                                  <h4 className="text-[11px] font-bold font-mono tracking-widest text-[#082F49] uppercase border-b border-teal-100 pb-1">PATIENT INFORMATION</h4>
                                  <div className="divide-y divide-slate-100 text-xs">
                                    {[
                                      ['Full Name', patient.name || '—'],
                                      ['Contact Number', patient.contactNumber || '—'],
                                      ['Age', patient.age ? `${patient.age} years` : '—'],
                                      ['Sex', patient.sex || '—'],
                                      ['Date of Visit', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })],
                                      ['Patient ID', cleanRefId],
                                    ].map(([label, val]) => (
                                      <div key={label} className="grid grid-cols-3 py-2">
                                        <span className="text-slate-500 font-medium col-span-1">{label}</span>
                                        <span className="font-semibold text-[#0A1628] col-span-2 text-right md:text-left">{val}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Referring health worker — uses real clinician data */}
                                <div className="space-y-2 text-left">
                                  <h4 className="text-[11px] font-bold font-mono tracking-widest text-[#082F49] uppercase border-b border-teal-100 pb-1">REFERRING HEALTH WORKER</h4>
                                  <div className="divide-y divide-slate-100 text-xs">
                                    {[
                                      ['Name',          clinicianName],
                                      ['Role',          clinicianRole],
                                      ['Facility Name', clinicianFacility],
                                      ['District',      clinicianDistrict || '—'],
                                      ['Region',        clinicianRegion ? `${clinicianRegion} Region` : '—'],
                                      ['Contact',       clinicianContact || '—'],
                                    ].map(([label, val]) => (
                                      <div key={label} className="grid grid-cols-3 py-2">
                                        <span className="text-slate-500 font-medium col-span-1">{label}</span>
                                        <span className="font-semibold text-[#0A1628] col-span-2 text-right md:text-left">{val}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Refer to */}
                                <div className="space-y-2 text-left">
                                  <h4 className="text-[11px] font-bold font-mono tracking-widest text-[#082F49] uppercase border-b border-teal-100 pb-1">REFER TO</h4>
                                  <div className="divide-y divide-slate-100 text-xs">
                                    <div className="grid grid-cols-3 py-2"><span className="text-slate-500 font-medium col-span-1">Facility Type</span><span className="font-semibold text-[#0A1628] col-span-2 text-right md:text-left">District Hospital / Dermatology Clinic</span></div>
                                    <div className="grid grid-cols-3 py-2"><span className="text-slate-500 font-medium col-span-1">Department</span><span className="font-semibold text-slate-600 col-span-2 text-right md:text-left">Dermatology / General OPD</span></div>
                                    <div className="grid grid-cols-3 py-2"><span className="text-slate-500 font-medium col-span-1">Urgency</span><span className={`font-bold col-span-2 text-right md:text-left ${isHigh ? 'text-rose-600' : isMod ? 'text-amber-600' : 'text-[#082F49]'}`}>{isHigh ? 'Immediate — Do Not Delay' : isMod ? 'Within 3 days' : 'Within 7 days'}</span></div>
                                  </div>
                                </div>

                                {/* Health worker notes */}
                                <div className="space-y-2 text-left">
                                  <h4 className="text-[11px] font-bold font-mono tracking-widest text-[#082F49] uppercase border-b border-teal-100 pb-1">HEALTH WORKER'S NOTES</h4>
                                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg text-xs leading-relaxed text-slate-700 min-h-[60px]">
                                    {patient.symptoms?.trim() ? <p className="italic">"{patient.symptoms.trim()}"</p> : <p className="text-slate-400 italic">No additional notes recorded.</p>}
                                  </div>
                                </div>

                                {/* Recommended Medications (Editable Card) */}
                                <div className="space-y-2 text-left avoid-break">
                                  <h4 className="text-[11px] font-bold font-mono tracking-widest text-[#082F49] uppercase border-b border-teal-100 pb-1">RECOMMENDED MEDICATIONS <span className="no-print text-emerald-600 font-sans tracking-normal normal-case font-semibold text-[10px]"> (editable)</span></h4>
                                  <div className="p-3.5 bg-[#F0FDF4] border border-[#DCFCE7] rounded-lg text-xs space-y-3 shadow-xs">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] text-[#15803D] uppercase font-bold tracking-wider">Prescribed Medication</span>
                                      <input 
                                        type="text" 
                                        value={prescribedMedication} 
                                        onChange={(e) => setPrescribedMedication(e.target.value)} 
                                        className="w-full bg-white border border-[#BBF7D0] rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#15803D] text-xs font-semibold text-[#14532D]"
                                        placeholder="e.g. Timolol 0.5% Ophthalmic Gel"
                                      />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] text-[#15803D] uppercase font-bold tracking-wider">Dosage Regimen / Directions</span>
                                      <textarea 
                                        rows={2} 
                                        value={prescribedRegimen} 
                                        onChange={(e) => setPrescribedRegimen(e.target.value)} 
                                        className="w-full bg-white border border-[#BBF7D0] rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#15803D] text-xs leading-relaxed text-[#14532D] resize-none"
                                        placeholder="e.g. Apply twice daily to the affected areas for 2 weeks."
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right col */}
                              <div className="md:col-span-5 space-y-6">
                                <div className="p-4 bg-[#F0FDF8] border-l-2 border-l-[#082F49] rounded-r-xl border border-teal-100/35 text-left space-y-4 shadow-sm">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-bold font-mono tracking-widest text-[#082F49] uppercase">AI ASSESSMENT</span>
                                    <span className="px-2 py-0.5 bg-teal-50 border border-teal-100 text-[9px] uppercase font-bold text-[#082F49] rounded">ANALYSIS OK</span>
                                  </div>
                                  <div className="space-y-1.5">
                                    <h3 className="font-display font-black text-[#0A1628] text-base leading-snug">{activeAnalysisResult.primaryFinding}</h3>
                                    <div className="flex justify-between items-center text-[11px] font-medium text-slate-500">
                                      <span>Detection confidence</span>
                                      <span className="font-mono font-bold text-[#082F49]">{activeAnalysisResult.confidence}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-[#082F49] rounded-full" style={{ width: `${activeAnalysisResult.confidence}%` }} />
                                    </div>
                                  </div>
                                  <div className="pt-1">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full text-white leading-none" style={{ backgroundColor: urgencyHex }}>{urgencyBadge}</span>
                                  </div>
                                  <p className="text-slate-600 text-xs leading-relaxed">{docDetails.description}</p>
                                  <div className="space-y-2 pt-2.5 border-t border-teal-100/40">
                                    <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase block">SUGGESTED TREATMENT</span>
                                    <div className="flex flex-col gap-1.5">
                                      {docDetails.suggestions.map((item, id) => (
                                        <div key={id} className="flex gap-1.5 items-start text-xs text-[#0A1628]">
                                          <span className="inline-block mt-1 w-1.5 h-1.5 bg-[#082F49] rounded-full shrink-0" /><span>{item}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <p className="text-[9.5px] italic text-slate-400 leading-normal pt-1.5 border-t border-teal-100/20">This is an AI-generated suggestion. Final treatment decisions rest with the receiving clinician.</p>
                                </div>

                                {/* Photo */}
                                <div className="space-y-2 text-left">
                                  <h4 className="text-[11px] font-bold font-mono tracking-widest text-[#082F49] uppercase py-1 border-b border-sky-300">
  PHOTO TAKEN DURING ASSESSMENT
</h4>
                                  <div className="relative aspect-square w-full rounded-xl border border-slate-150 overflow-hidden bg-slate-50 shrink-0">
                                    {capturedImage ? (
                                      <img src={capturedImage} alt="Skin lesion" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                        <Activity className="w-8 h-8 animate-pulse" />
                                        <span className="text-[10px] font-semibold tracking-wider uppercase mt-2">NO PHOTO CAPTURED</span>
                                      </div>
                                    )}
                                    <div className="absolute top-2.5 left-2.5 bg-[#082F49]/85 backdrop-blur-xs px-2 py-1 rounded text-[9px] font-bold font-mono text-white select-none tracking-widest uppercase">Clinical Specimen</div>
                                    <div className="absolute bottom-2.5 right-2.5 bg-slate-900/40 backdrop-blur-xs px-2 py-1 rounded text-[9px] font-bold font-mono text-white/95 select-none tracking-widest uppercase">DermaDetect AI</div>
                                  </div>
                                  <div className="relative aspect-square w-full rounded-xl border border-slate-150 overflow-hidden bg-slate-50 shrink-0">
                                    {activeAnalysisResult.heatmap_b64 ? (
                                      <img src={`data:image/png;base64,${activeAnalysisResult.heatmap_b64}`} alt="Skin lesion" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                        <Activity className="w-8 h-8 animate-pulse" />
                                        <span className="text-[10px] font-semibold tracking-wider uppercase mt-2">NO HEATMAP AVAILABLE</span>
                                      </div>
                                    )}
                                    <div className="absolute top-2.5 left-2.5 bg-[#082F49]/85 backdrop-blur-xs px-2 py-1 rounded text-[9px] font-bold font-mono text-white select-none tracking-widest uppercase">AI Saliency Map</div>
                                    <div className="absolute bottom-2.5 right-2.5 bg-slate-900/40 backdrop-blur-xs px-2 py-1 rounded text-[9px] font-bold font-mono text-white/95 select-none tracking-widest uppercase">DermaDetect AI</div>
                                  </div>
                                  <span className="text-[10px] text-slate-400 mt-1 block font-mono">Photo captured: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                              </div>
                            </div>

                            {/* Signature block */}
                            <div className="grid grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-200 text-left">
                              <div className="space-y-2.5">
                                <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase block">HEALTH WORKER SIGNATURE</span>
                                <div className="relative">
                                  <canvas ref={signatureCanvasRef} onMouseDown={startDrawingSig} onMouseMove={drawSig} onMouseUp={stopDrawingSig} onMouseLeave={stopDrawingSig} onTouchStart={startDrawingSig} onTouchMove={drawSig} onTouchEnd={stopDrawingSig} className="w-full h-16 border border-dashed border-slate-300 rounded-lg bg-slate-50 cursor-crosshair" width={240} height={64} />
                                  <button onClick={clearSig} className="absolute top-1.5 right-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white border border-slate-200 text-slate-500 rounded hover:bg-slate-50 no-print">Clear</button>
                                </div>
                                <div className="text-xs">
                                  <p className="font-bold text-[#0A1628]">{clinicianName}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">{clinicianRole} · {clinicianFacility}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                </div>
                              </div>
                              <div className="space-y-2.5 flex flex-col justify-between">
                                <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase block">RECEIVING CLINICIAN STAMP / SIGNATURE</span>
                                <div className="h-16 w-full border border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50 text-center text-slate-300">
                                  <span className="text-[9px] font-mono tracking-wider font-semibold uppercase">PLACE CLINICAL STAMP HERE</span>
                                </div>
                                <div className="text-[10px] text-[#3d4943] text-right italic">* To be completed at receiving facility</div>
                              </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-8 pt-4 border-t border-slate-200 bg-slate-50/80 p-4 rounded-b-xl flex flex-col gap-4 text-[10.5px] text-slate-400">
                              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                {/* Left side */}
                                <div className="text-left space-y-1">
                                  <div className="flex items-center gap-1.5 font-bold text-slate-500">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#082F49]" /><span>DermaDetect AI</span>
                                  </div>
                                  <p className="text-[9.5px]">Generated by DermaDetect — AI Skin Assessment Tool</p>
                                </div>

                                {/* Right side */}
                                <div className="text-right space-y-1">
                                  <p className="font-mono font-bold uppercase text-slate-500">TIMESTAMP & REFERRAL REFS</p>
                                  <p className="text-[9.5px]">Ref: <span className="font-semibold">{cleanRefId}</span></p>
                                  <p className="text-[9.5px]">Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                                </div>
                              </div>

                              {/* Bottom center */}
                              <div className="text-center border-t border-slate-100/50 pt-2 text-[9px] leading-normal text-slate-400 max-w-xl mx-auto">
                                This referral note was generated with AI assistance. It is intended to support, not replace, clinical judgment.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>
            )}

            {/* CASE HISTORY */}
            {screen === 'case-history' && (
              <section className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-8 py-8 flex flex-col justify-between">
                <div className="grow space-y-6">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#bccac1] pb-4 mt-7">
                    <div>
                      <h1 className="font-display font-extrabold text-2xl md:text-3xl text-[#181c1e]">Case History Logs</h1>
                      <p className="text-xs text-[#3d4943] mt-1.5">Browse fully registered patient skin diagnostics and triage urgencies.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative min-w-[200px] shrink-0">
                        <Search className="w-4 h-4 text-[#3d4943] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search patient or diagnosis..." className="w-full text-xs h-9 pl-9 pr-3.5 bg-white border border-[#bccac1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0077b6]" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Filter className="w-4 h-4 text-[#3d4943]" />
                        <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value as any)} className="text-xs h-9 px-2 bg-white border border-[#bccac1] rounded-lg focus:outline-none text-[#181c1e] font-semibold">
                          <option value="All">All Urgencies</option>
                          <option value="High">High Urgency</option>
                          <option value="Moderate">Moderate Urgency</option>
                          <option value="Low">Low Urgency</option>
                        </select>
                      </div>
                      <button onClick={() => { const b = new Blob([JSON.stringify(cases,null,2)],{type:'application/json'}); const u=URL.createObjectURL(b); const l=document.createElement('a'); l.href=u; l.download=`DermaDetect_Assessments_${new Date().toISOString().slice(0,10)}.json`; l.click(); }} className="h-9 px-4 bg-[#0077b6] hover:bg-[#0096c7] text-white flex items-center gap-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-sm">
                        <Download className="w-4 h-4" /><span>Export</span>
                      </button>
                      <button onClick={resetAndStartAssessment} className="h-9 px-4 bg-[#0077b6] hover:bg-[#0096c7] text-white flex items-center gap-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-sm">
                        <PlusCircle className="w-4 h-4" /><span>New</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border border-[#bccac1] rounded-2xl overflow-hidden shadow-sm">
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#f1f4f6] text-[#3d4943] text-xs font-bold border-b border-[#bccac1]">
                            {['Patient Name','Assessment Date','Clinical Finding','Urgency Triage',''].map(h => <th key={h} className="px-5 py-3 uppercase tracking-wider">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ebeef0]">
                          {processedCases.length > 0 ? processedCases.map(item => (
                            <tr key={item.id} onClick={() => setSelectedDetailsCase(item)} className="hover:bg-[#f1f4f6] transition-colors cursor-pointer group text-xs text-[#181c1e] font-semibold">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-[#d6e0f6] text-[#121c2c] flex items-center justify-center font-bold font-display select-none">{item.patient.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
                                  <div><p className="font-bold text-sm text-[#181c1e] group-hover:text-[#0077b6]">{item.patient.name}</p><p className="text-[10px] text-[#3d4943] font-mono">CASE REF: {item.id}</p></div>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-[#3d4943]">{item.date}</td>
                              <td className="px-5 py-4"><span className="px-2.5 py-1 rounded bg-[#ebeef0] text-[#181c1e] font-bold text-[10px] border border-[#bccac1]">{item.finding?.primaryFinding || 'Unclassified'}</span></td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${item.finding?.urgency==='High'?'bg-[#ba1a1a]':item.finding?.urgency==='Moderate'?'bg-[#e65100]':'bg-[#2e7d32]'}`} />
                                  <span className={`font-bold ${item.finding?.urgency==='High'?'text-[#ba1a1a]':item.finding?.urgency==='Moderate'?'text-[#e65100]':'text-[#2e7d32]'}`}>{item.finding?.urgency||'Low'}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5">
                                  <button onClick={e => { e.stopPropagation(); downloadPdfRecord(item); }} title="Download PDF" className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-full transition-colors cursor-pointer"><Download className="w-4 h-4" /></button>
                                  <button onClick={e => { e.stopPropagation(); setCaseToDelete(item); }} title="Delete" className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-full transition-colors cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                                  <button onClick={() => setSelectedDetailsCase(item)} title="View" className="text-[#0077b6] hover:bg-[#f0f9ff] p-1.5 rounded-full transition-colors cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </tr>
                          )) : (
                            <tr><td colSpan={5} className="text-center py-12 text-[#3d4943] font-medium">No patient case history found. Start a New Assessment to record a case.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile list */}
                    <div className="block md:hidden divide-y divide-[#ebeef0]">
                      {processedCases.length > 0 ? processedCases.map(item => (
                        <div key={item.id} onClick={() => setSelectedDetailsCase(item)} className="p-4 hover:bg-[#f1f4f6] transition-colors cursor-pointer space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[#d6e0f6] text-[#121c2c] flex items-center justify-center font-bold font-display select-none shrink-0">{item.patient.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
                              <div className="min-w-0"><p className="font-bold text-sm text-[#181c1e] truncate">{item.patient.name}</p><p className="text-[10px] text-[#3d4943] font-mono">REF: {item.id}</p></div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`w-2 h-2 rounded-full ${item.finding?.urgency==='High'?'bg-[#ba1a1a]':item.finding?.urgency==='Moderate'?'bg-[#e65100]':'bg-[#2e7d32]'}`} />
                              <span className={`font-bold text-xs ${item.finding?.urgency==='High'?'text-[#ba1a1a]':item.finding?.urgency==='Moderate'?'text-[#e65100]':'text-[#2e7d32]'}`}>{item.finding?.urgency||'Low'}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-end text-xs pt-1">
                            <div className="space-y-1.5 min-w-0">
                              <p className="text-[10px] text-[#3d4943]">Date: <strong>{item.date}</strong></p>
                              <span className="inline-block px-2 py-0.5 rounded bg-[#ebeef0] text-[#181c1e] text-[10px] border border-[#bccac1] font-bold truncate max-w-[160px]">{item.finding?.primaryFinding||'Unclassified'}</span>
                            </div>
                            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                              <button onClick={e => { e.stopPropagation(); downloadPdfRecord(item); }} className="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-lg border border-emerald-100 cursor-pointer"><Download className="w-4 h-4" /></button>
                              <button onClick={e => { e.stopPropagation(); setCaseToDelete(item); }} className="w-8 h-8 flex items-center justify-center text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-100 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                              <button onClick={() => setSelectedDetailsCase(item)} className="w-8 h-8 flex items-center justify-center text-[#0077b6] hover:bg-[#f0f9ff] rounded-lg border border-sky-100 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      )) : <div className="text-center py-12 text-[#3d4943] font-medium text-xs">No cases found.</div>}
                    </div>

                    <footer className="px-5 py-3.5 bg-[#f1f4f6] flex justify-between items-center border-t border-[#bccac1] text-xs font-semibold text-[#181c1e]">
                      <span>Showing {processedCases.length} of {cases.length} entries</span>
                    </footer>
                  </div>
                </div>
              </section>
            )}

          </main>

          {/* Footer bar */}
          <footer className="bg-[#ebeef0] border-t border-[#bccac1] py-4 select-none no-print">
            <div className="max-w-5xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-xs font-semibold text-[#555f71]">© {new Date().getFullYear()} DermaDetect • Community Health Digital System</div>
              <div className="flex items-center gap-4 text-xs font-semibold text-[#3d4943]">
                <div className="flex items-center gap-1.5 text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span>Dermal Analysis Toolkit Active</span></div>
                <span className="text-[#bccac1]">|</span>
                <button onClick={() => alert('DermaDetect HIPAA Compliant. No personal metrics logged remotely.')} className="hover:underline">Privacy Policy</button>
              </div>
            </div>
          </footer>

          {/* Loading modal */}
          {analysisLoading && (
            <div className="fixed inset-0 bg-[#181c1e]/60 backdrop-blur-md flex items-center justify-center z-[100] px-4">
              <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center border border-[#bccac1] shadow-2xl space-y-4">
                <Loader2 className="w-14 h-14 text-[#0077b6] animate-spin mx-auto" />
                <h3 className="font-display font-extrabold text-[#181c1e] text-lg">AI Dermatological Diagnostic Analysis</h3>
                <p className="text-xs text-[#3d4943] max-w-xs mx-auto animate-pulse leading-relaxed">{loadingText}</p>
              </div>
            </div>
          )}

          {/* Case detail modal */}
          {selectedDetailsCase && (
            <div className="fixed inset-0 bg-[#181c1e]/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4" onClick={e => { if(e.target===e.currentTarget) setSelectedDetailsCase(null); }}>
              <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-[#bccac1]">
                <div className="p-5 border-b border-[#bccac1] flex justify-between items-center bg-[#f1f4f6]">
                  <div>
                    <span className="text-[10px] text-[#0077b6] font-black tracking-widest uppercase block leading-none">Case History Vault</span>
                    <h2 className="font-display font-extrabold text-base md:text-lg text-[#181c1e] mt-2 block">Patient Assessment: {selectedDetailsCase.patient.name}</h2>
                  </div>
                  <button onClick={() => setSelectedDetailsCase(null)} className="p-1.5 hover:bg-[#e0e3e5] rounded-full transition-colors"><X className="w-5 h-5 text-[#3d4943]" /></button>
                </div>
                <div className="p-6 md:p-8 space-y-6 max-h-[72vh] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-[#f1f4f6]">
                    <div className="space-y-4 text-xs font-semibold">
                      <h3 className="font-display font-bold text-xs text-[#3d4943] uppercase tracking-wider border-b border-[#bccac1] pb-1">Patient Profile</h3>
                      <div className="space-y-1"><p className="text-[10px] text-[#6d7a73] uppercase tracking-wider">Full Legal Name</p><p className="text-sm font-bold text-[#181c1e]">{selectedDetailsCase.patient.name}</p></div>
                      <div className="space-y-1"><p className="text-[10px] text-[#6d7a73] uppercase tracking-wider">Case ID / Gender / Age</p><p className="text-[#181c1e]">{selectedDetailsCase.id} • {selectedDetailsCase.patient.sex} • {selectedDetailsCase.patient.age} Yrs</p></div>
                    </div>
                    <div className="space-y-4 text-xs font-semibold">
                      <h3 className="font-display font-bold text-xs text-[#3d4943] uppercase tracking-wider border-b border-[#bccac1] pb-1">Medical Indicators</h3>
                      <div className="space-y-1"><p className="text-[10px] text-[#6d7a73] uppercase tracking-wider">Primary Finding</p><p className="text-sm font-bold text-[#181c1e]">{selectedDetailsCase.finding.primaryFinding}</p></div>
                      <div className="space-y-1"><p className="text-[10px] text-[#6d7a73] uppercase tracking-wider">Urgency</p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${selectedDetailsCase.finding.urgency==='High'?'bg-[#ffdad6] border-[#ba1a1a] text-[#93000a]':selectedDetailsCase.finding.urgency==='Moderate'?'bg-[#ffe0b2] border-[#ffe0b2] text-[#e65100]':'bg-[#e8f5e9] border-[#c8e6c9] text-[#2e7d32]'}`}>
                          {selectedDetailsCase.finding.urgency} Urgency ({selectedDetailsCase.finding.confidence}% Match)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-display text-xs font-bold text-[#3d4943] uppercase tracking-wider border-b border-[#bccac1] pb-1">Lesion Specimen Media</h3>
                    <div className={`aspect-video rounded-xl overflow-hidden relative border border-[#bccac1] bg-[#f1f4f6] cursor-pointer group ${zoomImage?'h-auto max-h-[450px]':''}`}>
                      <img src={selectedDetailsCase.image} alt="Clinical specimen" className={`w-full h-full object-cover transition-all ${zoomImage?'object-contain bg-black':'group-hover:scale-105'}`} />
                      <div onClick={() => setZoomImage(!zoomImage)} className="absolute bottom-3 right-3 bg-white/90 px-3 py-1 border border-[#bccac1] rounded-lg text-xs font-bold text-[#181c1e] flex items-center gap-1.5 shadow-md">
                        <ZoomIn className="w-4 h-4 text-[#0077b6]" /><span>{zoomImage?'Normal View':'Full Zoom View'}</span>
                      </div>
                    </div>
                  </div>
                  {selectedDetailsCase.patient.symptoms && (
                    <div className="space-y-2">
                      <h3 className="font-display text-xs font-bold text-[#3d4943] uppercase tracking-wider border-b border-[#bccac1] pb-1">Patient Observation Symptoms</h3>
                      <p className="text-xs text-[#3d4943] italic leading-relaxed p-3 border-l-2 border-[#0077b6] bg-[#f1f4f6] rounded-r-lg">"{selectedDetailsCase.patient.symptoms}"</p>
                    </div>
                  )}
                  <div className="space-y-3">
                    <h3 className="font-display text-xs font-bold text-[#3d4943] uppercase tracking-wider border-b border-[#bccac1] pb-1">Clinical Recommended Actions</h3>
                    <p className="text-sm font-bold text-[#181c1e] leading-relaxed">{selectedDetailsCase.finding.recommendedAction}</p>
                    <TreatmentRecommendations finding={selectedDetailsCase.finding} patient={selectedDetailsCase.patient} caseId={selectedDetailsCase.id} />
                  </div>
                </div>
                <div className="p-4 bg-[#f1f4f6] flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-[#bccac1]">
                  <button onClick={() => setCaseToDelete(selectedDetailsCase)} className="w-full sm:w-auto h-10 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer order-last sm:order-first">
                    <Trash2 className="w-4 h-4" /><span>Delete Case</span>
                  </button>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button onClick={() => setSelectedDetailsCase(null)} className="h-10 px-5 text-xs font-bold text-[#3d4943] hover:bg-[#e0e3e5] rounded-xl border border-[#bccac1] bg-white transition-colors cursor-pointer">Close View</button>
                    <button onClick={() => downloadPdfRecord(selectedDetailsCase)} className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                      <Download className="w-4 h-4" /><span>Download Report</span>
                    </button>
                    <button onClick={() => { setPatient(selectedDetailsCase.patient); setCapturedImage(selectedDetailsCase.image); setActiveAnalysisResult(selectedDetailsCase.finding); setActiveCaseId(selectedDetailsCase.id); setSelectedDetailsCase(null); setScreen('referral-note'); }} className="h-10 px-6 bg-[#0077b6] hover:bg-[#0096c7] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                      <FileText className="w-4 h-4" /><span>Format Referral Note</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success animation */}
          {showSuccessAnimation && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm p-8 text-center shadow-2xl border border-slate-100">
                <div className="checkmark-wrapper mb-6">
                  <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                    <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                    <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                  </svg>
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900 tracking-tight mb-2">Case Saved Successfully</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">Diagnostic findings have been safely synced to patient records.</p>
                <div className="inline-flex items-center gap-1.5 text-xs text-[#0077b6] font-mono font-bold bg-[#f0f9ff] px-3 py-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-[#0077b6] animate-pulse" />REF ID: {activeCaseId}
                </div>
              </div>
            </div>
          )}

          {/* Delete confirmation */}
          {caseToDelete && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-md p-6 md:p-8 shadow-2xl border border-slate-100 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0"><AlertTriangle className="w-6 h-6 animate-pulse" /></div>
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-bold text-slate-900 tracking-tight">Delete Patient Case Record</h3>
                    <p className="text-xs text-[#6d7a73]">You are about to permanently remove this case history. This process is irreversible.</p>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                  {[['Patient Full Name:', caseToDelete.patient.name],['Case Reference ID:', caseToDelete.id],['Clinical Finding:', caseToDelete.finding.primaryFinding]].map(([l,v]) => (
                    <div key={l} className="flex justify-between items-center text-slate-500"><span>{l}</span><span className="font-bold text-slate-800">{v}</span></div>
                  ))}
                </div>
                <div className="flex gap-3 justify-end pt-2 text-xs font-bold">
                  <button onClick={() => setCaseToDelete(null)} className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 cursor-pointer">Cancel, Keep Record</button>
                  <button onClick={() => deleteCaseRecord(caseToDelete.id)} className="h-10 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl flex items-center gap-1.5 cursor-pointer">
                    <Trash2 className="w-4 h-4" /><span>Yes, Permanently Delete</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mobile nav */}
          <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#bccac1] z-40 flex items-center justify-around px-4 md:hidden no-print shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
            {[
              { icon: <Home className="w-5 h-5" />,       label: 'Home',     action: () => { setScreen('home'); stopWebcam(); }, active: screen==='home' },
              { icon: <PlusCircle className="w-5 h-5" />, label: 'New Case', action: resetAndStartAssessment, active: ['assessment-info','assessment-capture','assessment-review'].includes(screen) },
              { icon: <History className="w-5 h-5" />,    label: 'Logs',     action: () => { setScreen('case-history'); stopWebcam(); }, active: screen==='case-history' },
            ].map(({ icon, label, action, active }) => (
              <button key={label} onClick={action} className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors ${active?'text-[#0077b6]':'text-[#3d4943] hover:text-[#0077b6]'}`}>
                {icon}<span>{label}</span>
              </button>
            ))}
          </div>

        </div>
      )}
    </>
  );
}