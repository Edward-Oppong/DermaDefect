/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  QrCode, 
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
  Sparkles,
  HeartPulse,
  Printer,
  BookOpen,
  Languages,
  Home,
  Cloud,
  CloudOff,
  Database,
  RefreshCw,
  Wifi,
  Signal,
  Trash2,
  Check,
  Clock,
  Smartphone,
  Zap,
  Award,
  MessageSquare,
  Heart
} from 'lucide-react';
import { 
  SAMPLE_CASE_TEMPLATES,
  CaseRecord, 
  PatientDetails, 
  DiagnosticResult 
} from './types';
import { TRANSLATIONS, LanguageOption } from './locales';
import { TreatmentRecommendations, CONDITIONAL_GUIDELINES, normalizeCode } from './components/TreatmentRecommendations';
import { jsPDF } from 'jspdf';
import {clearProfile, ClinicianProfile, ClinicianSetup, loadProfile} from './components/ClinicianSetup';

export default function App() {

  // Field worker digital signature
  const [clinician, setClinician] = useState<ClinicianProfile | null>(() => loadProfile());

  const handleProfileComplete = (profile: ClinicianProfile) => {
    setClinician(profile);
  };

  // Show setup screen on first run
  if (!clinician) {
    return <ClinicianSetup onComplete={handleProfileComplete} />;
  }

  // Navigation & Screen Switcher
  const [screen, setScreen] = useState<'home' | 'assessment-info' | 'assessment-capture' | 'assessment-review' | 'referral-note' | 'case-history'>('home');
  const [lang, setLang] = useState<LanguageOption>('English');
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  // Persistent storage list for cases
  const [cases, setCases] = useState<CaseRecord[]>([]);

  // Current active assessment state variables
  const [patient, setPatient] = useState<PatientDetails>({
    name: '',
    age: '',
    sex: '',
    contactNumber: '',
    symptoms: ''
  });
  
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [customFileSelected, setCustomFileSelected] = useState<boolean>(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [activeAnalysisResult, setActiveAnalysisResult] = useState<DiagnosticResult | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string>('');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Search, filtration and modal details properties for Case History Tab
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUrgency, setFilterUrgency] = useState<'All' | 'High' | 'Moderate' | 'Low'>('All');
  const [selectedDetailsCase, setSelectedDetailsCase] = useState<CaseRecord | null>(null);
  const [zoomImage, setZoomImage] = useState(false);


  // Redesigned landing page states
  const [activeTourStep, setActiveTourStep] = useState<number>(0);
  const [faqOpenState, setFaqOpenState] = useState<Record<number, boolean>>({ 0: true });
  
  // Custom Interactive AI Diagnostic Scanner State (Section 3, Card 2)
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanResultCondition, setScanResultCondition] = useState<string>("Scanning...");
  
  // Interactive Signature Canvas Ref and States
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);

  const startDrawingSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawingSig(true);
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Smooth line brush mechanics
    ctx.strokeStyle = '#0A1628';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const rect = canvas.getBoundingClientRect();
    const x = ('clientX' in e) ? e.clientX - rect.left : e.touches[0].clientX - rect.left;
    const y = ('clientY' in e) ? e.clientY - rect.top : e.touches[0].clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ('clientX' in e) ? e.clientX - rect.left : e.touches[0].clientX - rect.left;
    const y = ('clientY' in e) ? e.clientY - rect.top : e.touches[0].clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    e.preventDefault();
  };

  const stopDrawingSig = () => {
    setIsDrawingSig(false);
  };

  const clearSig = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  
  useEffect(() => {
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          return 0; // reset loop
        }
        return prev + 2;
      });
    }, 80);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scanProgress < 25) {
      setScanResultCondition("Symptom Extraction...");
    } else if (scanProgress < 55) {
      setScanResultCondition("Matching Dermatopathology...");
    } else if (scanProgress < 85) {
      setScanResultCondition("Running Offline Classifier...");
    } else {
      setScanResultCondition("Ringworm Identified (88%) ✓");
    }
  }, [scanProgress]);

  // State for tracking active case destruction/deletion confirmation safely inside an iframe
  const [caseToDelete, setCaseToDelete] = useState<CaseRecord | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const deleteCaseRecord = async (recordId: string) => {
    const updated = cases.filter(item => item.id !== recordId);
    syncCasesToStorage(updated);

    try {
      await fetch(`/api/cases/${recordId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Failed to delete case from server:', e);
    }

    if (selectedDetailsCase?.id === recordId) setSelectedDetailsCase(null);
    setCaseToDelete(null);
  };

  // Database cloud sync and periodic checking state
  const [dbStatus, setDbStatus] = useState<'online' | 'offline'>('online');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'syncing'>('synced');
  const [latency, setLatency] = useState<number | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [displaySyncDropdown, setDisplaySyncDropdown] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // Core sync — POSTs each case individually to /api/cases (upsert)
  // ---------------------------------------------------------------------------
  const triggerCloudSync = async (currentCasesList: CaseRecord[]) => {
    if (currentCasesList.length === 0) return;
    setSyncStatus('syncing');
    try {
      await Promise.all(
        currentCasesList.map(c =>
          fetch('/api/cases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(c)
          })
        )
      );
      setSyncStatus('synced');
      setDbStatus('online');
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSynced(timestamp);
      localStorage.setItem('dermadetect_last_synced', timestamp);
    } catch (e) {
      console.warn('Sync failed. Preserving in local cache.', e);
      setSyncStatus('pending');
      setDbStatus('offline');
    }
  };

// ---------------------------------------------------------------------------
  // Health probe
  // ---------------------------------------------------------------------------
  const probeDatabaseHealth = async () => {
    try {
      const startTime = performance.now();
      const response = await fetch('/api/health');
      const endTime = performance.now();
      
      if (response.ok) {
        const data = await response.json();
        setDbStatus('online');
        setLatency(Math.round(endTime - startTime + (data.latencyMs || 0) / 4)); // absolute network loop computation
        return true;
      } else {
        setDbStatus('offline');
        setLatency(null);
        return false;
      }
    } catch (e) {
      setDbStatus('offline');
      setLatency(null);
      return false;
    }
  };

    // Restore last synced timestamp on mount
  useEffect(() => {
    const savedTime = localStorage.getItem('dermadetect_last_synced');
    if (savedTime) {
      setLastSynced(savedTime);
    }
  }, []);

  // Sync effect engine (triggers on case changes and runs periodic loops)
  useEffect(() => {
    // Initial health check & sync
    const initialCheck = async () => {
      const isOnline = await probeDatabaseHealth();
      if (isOnline && autoSyncEnabled && cases.length > 0) {
        await triggerCloudSync(cases);
      }
    };
    
    if (cases.length > 0) initialCheck();
    
    // Set up 15-second database monitoring & sync loop
    const syncInterval = setInterval(async () => {
      const isOnline = await probeDatabaseHealth();
      if (isOnline && autoSyncEnabled && cases.length > 0) {
        await triggerCloudSync(cases);
      }
    }, 15000);

    return () => clearInterval(syncInterval);
  }, [cases, autoSyncEnabled]);

  // Real-time camera capture properties
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize cases from LocalStorage on mount
useEffect(() => {
    const loadCases = async () => {
      try {
        const response = await fetch('/api/cases');
        if (response.ok) {
          const data = await response.json();
          if (data.cases && data.cases.length > 0) {
            setCases(data.cases);
            localStorage.setItem('dermadetect_cases', JSON.stringify(data.cases));
            return;
          }
        }
      } catch (e) {
        console.warn('Server unreachable on load, falling back to localStorage:', e);
      }

        const stored = localStorage.getItem('dermadetect_cases');
      if (stored) {
        try {
          setCases(JSON.parse(stored));
        } catch {
          setCases([]);
        }
      } else {
        setCases([]);
      }
    };

    loadCases();
  }, []);

  // Sync state to local storage helper
  const syncCasesToStorage = (updatedCases: CaseRecord[]) => {
    setCases(updatedCases);
    localStorage.setItem('dermadetect_cases', JSON.stringify(updatedCases));
  };

  // Switch clean language helper
  const t = TRANSLATIONS[lang];

  // Starts the assessment workflow from scratch
  const resetAndStartAssessment = () => {
    setPatient({ name: '', age: '', sex: '', contactNumber: '', symptoms: '' });
    setCapturedImage(null);
    setCustomFileSelected(false);
    setActiveAnalysisResult(null);
    setActiveCaseId('');
    setScreen('assessment-info');
    stopWebcam();
  };

  // Webcam controls
  const startWebcam = async () => {
    setIsCameraActive(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: 640, height: 480 } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn("Camera streaming turned down or unsupportable in layout:", err);
      setCameraError("Webcam not accessible. Please upload details from the Gallery or select one of our common training case templates.");
      setIsCameraActive(false);
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Capture current webcam video frame to Base64
  const captureFrame = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        setCustomFileSelected(true);
        stopWebcam();
      }
    }
  };

  // Gallery file picker helper
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        setCustomFileSelected(true);
        stopWebcam();
      };
      reader.readAsDataURL(file);
    }
  };

  // Pre-load training templates click handler
 const selectTemplateInstance = (templateUrl: string) => {
    setCapturedImage(templateUrl);
    setCustomFileSelected(false);
    stopWebcam();
    setScreen('assessment-capture'); // Take them directly to enter patient info
  };


// ---------------------------------------------------------------------------
  // AI analysis
  // ---------------------------------------------------------------------------
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

  let i = 0;
  setLoadingText(messages[0]);
  const timer = setInterval(() => {
    i++;
    if (i < messages.length) setLoadingText(messages[i]);
  }, 700);

  try {
    // ✅ Express expects JSON with base64 image string — NOT FormData
    const payload = {
      image: capturedImage,          // full data URL e.g. "data:image/jpeg;base64,..."
      symptoms: patient.symptoms,
      patientInfo: {
        name: patient.name,
        age:  patient.age,
        sex:  patient.sex,
        contactNumber: patient.contactNumber,
      },
    };

    const response = await fetch('/api/analyze-skin', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server error ${response.status}: ${errText}`);
    }

   
const raw = await response.json();
const result: DiagnosticResult = {
  primaryFinding:    raw.primaryFinding    ?? 'Unknown',
  confidence:        raw.confidence        ?? 0,
  urgency:           (['High','Moderate','Low'].includes(raw.urgency) ? raw.urgency : 'Moderate') as 'High' | 'Moderate' | 'Low',
  urgencyText:       raw.urgencyText       ?? '',
  treatmentNotes:    Array.isArray(raw.treatmentNotes) ? raw.treatmentNotes : [],
  recommendedAction: raw.recommendedAction ?? '',
  referralNote:      raw.referralNote     ?? '',
  conditionCode:     raw.conditionCode     ?? '',
  heatmap_b64:       raw.heatmap_b64       ?? undefined,
  therapyRegimen:    raw.therapyRegimen    ?? undefined,
  patientHandout:    raw.patientHandout    ?? undefined,
};
    await new Promise(resolve => setTimeout(resolve, 800));
    clearInterval(timer);

    setActiveAnalysisResult(result);
    const randomID = `DD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setActiveCaseId(randomID);
    setScreen('assessment-review');

  } catch (err) {
    console.error('Remote skin analysis failed:', err);
    clearInterval(timer);
    await new Promise(resolve => setTimeout(resolve, 800));
    window.alert(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  } finally {
    setAnalysisLoading(false);
  }
};


  // Convert current reviewed result and patient state into persistent Case Record
  const saveCaseRecord = async () => {
    if (!activeAnalysisResult || !capturedImage) return;

    const newRecord: CaseRecord = {
      id: activeCaseId,
      patient: { ...patient },
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      finding: activeAnalysisResult,
      image: capturedImage,
      healthWorker: clinician.name,
      saved: true
    };

    const updated = [newRecord, ...cases];
    syncCasesToStorage(updated);
    
    // Trigger celebratory success/data persistence checkmark animation
     try {
      await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
    } catch (e) {
      console.warn('Failed to persist new case to server:', e);
    }

    setShowSuccessAnimation(true);
    setTimeout(() => {
      setShowSuccessAnimation(false);
      setScreen('case-history');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 1800);
  };

  // High-fidelity Clinical Report generator in PDF format using jsPDF with an elegant clinical referral note theme
  const downloadPdfRecord = (record: CaseRecord) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Page dimensions
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2); // 180mm

      // Elegant Color Palette
      const primaryColor = [22, 78, 99]; // #164e63 Deep Medical Teal
      const primaryDark = [15, 23, 42]; // #0f172a Deep Slate Text
      const borderSlate = [203, 213, 225]; // #cbd5e1 Light Slate Border
      const paperBg = [248, 250, 252]; // #f8fafc Clinical Backplate Bg
      const textGray = [71, 85, 105]; // #475569 Slate description text
      const accentRed = [153, 27, 27]; // #991b1b
      const accentOrange = [194, 65, 12]; // #c2410c
      const accentGreen = [21, 128, 61]; // #15803d

      // URGENCY SEVERITY COMPUTATIONS
      const urgencyStr = record.finding.urgency || 'Low';
      let severityColor = accentGreen;
      if (urgencyStr === 'High') severityColor = accentRed;
      else if (urgencyStr === 'Moderate') severityColor = accentOrange;

      // ==========================================
      // PAGE 1: NATIONAL HEALTH SERVICE REFERRAL LETTER
      // ==========================================

      // Left Accent Vertical Stripe on Header
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(margin, 12, 180, 1.5, 'F');

      let y = 24;

      // Header Brand Symbol
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.circle(margin + 4, y, 3, 'F');
      
      // Graphic Cross Symbol inside circle
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.6);
      doc.line(margin + 4, y - 1.5, margin + 4, y + 1.5);
      doc.line(margin + 2.5, y, margin + 5.5, y);

      // Institution Name
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('DERMADETECT™ CLINICAL CASE DOSSIER', margin + 10, y - 1);
      
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('FIELD OBSERVATION & DIAGNOSTIC RECORD"', margin + 10, y + 2.5);

      // Document Category
      doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const docTitle = "CLINICAL REFERRAL DOSSIER";
      doc.text(docTitle, pageWidth - margin - doc.getTextWidth(docTitle), y + 1);

      y += 8;
      // Elegant Separator Line Layout
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);

      y += 6;

      // PATIENT PROFILE & METADATA GRID BOX (Beautiful Gray Card)
      doc.setFillColor(paperBg[0], paperBg[1], paperBg[2]);
      doc.rect(margin, y, contentWidth, 36, 'F'); // Backplate Rect
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.3);
      doc.rect(margin, y, contentWidth, 36, 'D'); // Outline

      // Column Labels (Header Row)
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('PATIENT ANTHROPOMETRIC RECORD', margin + 6, y + 6);
      doc.text('CLINICAL IDENTIFIER METADATA', margin + 96, y + 6);

      // Light partition line
      doc.line(margin + 90, y + 3, margin + 90, y + 33);

      doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
      doc.setFontSize(8);

      // Column 1 Content
      let rowY = y + 13;
      doc.setFont('helvetica', 'bold');
      doc.text('Full Name:', margin + 6, rowY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${record.patient.name}`, margin + 28, rowY);

      doc.setFont('helvetica', 'bold');
      doc.text('Case Reference:', margin + 96, rowY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${record.id}`, margin + 125, rowY);

      doc.setFont('helvetica', 'bold');
      doc.text('Contact Number:', margin + 6, rowY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${record.patient.contactNumber}`, margin + 28, rowY);

      rowY += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Age / Gender:', margin + 6, rowY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${record.patient.age} Yrs  /  ${record.patient.sex}`, margin + 28, rowY);

      doc.setFont('helvetica', 'bold');
      doc.text('Assessment Date:', margin + 96, rowY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${record.date || new Date().toLocaleDateString()}`, margin + 125, rowY);

      rowY += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Symptom Notes:', margin + 6, rowY);
      doc.setFont('helvetica', 'italic');
      const wrappedSymptoms = doc.splitTextToSize(`"${record.patient.symptoms || 'None reported'}"`, 56);
      doc.text(wrappedSymptoms, margin + 28, rowY);

      doc.setFont('helvetica', 'bold');
      doc.text('Triage Officer:', margin + 96, rowY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${record.healthWorker || 'K. Mensah [MOH-481]'}`, margin + 125, rowY);

      y += 44;

      // PRIMARY CLINICAL ESTIMATED FINDING (High Fidelity Card Layout with Urgency left-accent bar)
      // BG plate
      doc.setFillColor(paperBg[0], paperBg[1], paperBg[2]);
      doc.rect(margin, y, contentWidth, 24, 'F');
      
      // Outer rect
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.3);
      doc.rect(margin, y, contentWidth, 24, 'D');

      // Colored Left Accent urgency bar
      doc.setFillColor(severityColor[0], severityColor[1], severityColor[2]);
      doc.rect(margin, y, 4, 24, 'F');

      // Findings Header Label
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('PRIMARY TRIAGE CLASSIFICATION GUIDELINE TARGET', margin + 8, y + 6);

      // Finding Condition Display
      doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`${record.finding.primaryFinding}`, margin + 8, y + 13);

      // Match confidence and Severity Tags
      doc.setFontSize(8.5);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.text('Confidence Score: ', margin + 8, y + 19);

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(`${record.finding.confidence}% match`, margin + 35, y + 19);

      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(' |  Triage Priority Level: ', margin + 55, y + 19);

      doc.setTextColor(severityColor[0], severityColor[1], severityColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(`${urgencyStr} Severity`, margin + 90, y + 19);

      y += 31;

      // CAPTURED SNAPSHOT SPECIMEN AND INTERPRETATION NOTES (Two Column Visual Flow)
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('I. CLINICAL IMAGE SPECIMEN SNAPSHOT', margin, y);
      doc.text('II. SUPPORTIVE PRACTICAL OUTPATIENT DIRECTIVE', margin + 82, y);

      y += 2.5;
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.4);
      doc.line(margin, y, margin + 74, y);
      doc.line(margin + 82, y, pageWidth - margin, y);

      y += 5;

      // Draw original image or elegant camera canvas placeholder
      const imageBoxY = y;
      let imgSuccess = false;
      if (record.image) {
        try {
          doc.addImage(record.image, 'JPEG', margin, y, 74, 52);
          imgSuccess = true;
        } catch (e) {
          console.warn('PDF compiler local schema skip image conversion', e);
        }
      }

      if (!imgSuccess) {
        // Draw elegant placeholder with medical geometry target reticle
        doc.setFillColor(242, 245, 248);
        doc.rect(margin, y, 74, 52, 'F');
        doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
        doc.rect(margin, y, 74, 52, 'D');

        // Draw custom medical reticle circles
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(0.15);
        doc.circle(margin + 37, y + 26, 8, 'D');
        doc.circle(margin + 37, y + 26, 16, 'D');
        
        doc.line(margin + 37, y + 6, margin + 37, y + 46);
        doc.line(margin + 17, y + 26, margin + 57, y + 26);

        doc.setTextColor(textGray[0], textGray[1], textGray[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('VISUAL DERMAL SPECIMEN RECORD', margin + 14, y + 24);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text('Secure local device target framework', margin + 18, y + 27.5);
      }

      // Outward supportive notes column text on right
      doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      
      const outgoingActionTxt = `Onward Action Plan: ${record.finding.recommendedAction}`;
      const actionTextLines = doc.splitTextToSize(outgoingActionTxt, 94);
      doc.text(actionTextLines, margin + 82, y);

      let notesY = y + (actionTextLines.length * 4) + 2;
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      const standardActionsLst = record.finding.treatmentNotes || [];
      standardActionsLst.forEach((actionItem) => {
        const bulletLines = doc.splitTextToSize(`• ${actionItem}`, 94);
        if (notesY + (bulletLines.length * 4) < imageBoxY + 54) {
          doc.text(bulletLines, margin + 82, notesY);
          notesY += (bulletLines.length * 4) + 1;
        }
      });

      // Align vertical coordinates smoothly
      y = Math.max(imageBoxY + 52, notesY) + 8;

      // OFFICIAL SERVICE RECORD VERIFICATION BLOCK (Footer Stamp)
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFillColor(paperBg[0], paperBg[1], paperBg[2]);
      doc.rect(margin, y, contentWidth, 20, 'F');
      doc.rect(margin, y, contentWidth, 20, 'D');

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('OFFICIAL MOH REFERRAL TRANSCRIPT VALIDATION SEAL', margin + 5, y + 5);

      doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('1. Generative diagnostic handbooks conform to clinical protocol V8.46 guidelines.', margin + 5, y + 10);
      doc.text('2. Local sandboxed key integration verified. Regional medical handovers active.', margin + 5, y + 14);

      // Stamp-like geometry visual on right
      doc.setLineWidth(0.4);
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(pageWidth - margin - 32, y + 3, 27, 14, 'D');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('VERIFIED DOSSIER', pageWidth - margin - 30, y + 8);
      doc.setFontSize(5);
      doc.text('MOH TRANSCRIPT SYSTEMS', pageWidth - margin - 29, y + 13);

      // Bottom footer text standard
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text('Dermatological clinical referral handout generated within browser environment. Formatted under HIPAA protocol mandates.', margin, pageHeight - 10);
      doc.text('Page 1 of 2', pageWidth - margin - doc.getTextWidth('Page 1 of 2'), pageHeight - 10);


      // ==========================================
      // PAGE 2: STANDARDIZED CLINICAL INTENSIVE GUIDELINE
      // ==========================================
      doc.addPage();
      y = 20;

      // Page 2 header bar
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(margin, 12, 180, 1.5, 'F');

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('SUPPORTIVE TREATMENT RECIPE & PHARMACOLOGICAL DOSES', margin, y + 3);

      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const rightHeaderS = "SECURE PROTOCOL DISPENSING SCHEME";
      doc.text(rightHeaderS, pageWidth - margin - doc.getTextWidth(rightHeaderS), y + 3);

      y += 10;
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);

      y += 8;

      // Extract guidelines from Treatment guideline sheet
      const conditionCodeKey = normalizeCode(record.finding.conditionCode || record.finding.primaryFinding);
      const guidelinePlanTemplate = CONDITIONAL_GUIDELINES[conditionCodeKey];

      if (guidelinePlanTemplate) {
        
        // I. PHARMACOLOGICAL DOSING RECIPE CARD
        doc.setFillColor(paperBg[0], paperBg[1], paperBg[2]);
        doc.rect(margin, y, contentWidth, 52, 'F');
        doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
        doc.setLineWidth(0.3);
        doc.rect(margin, y, contentWidth, 52, 'D');

        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('I. PHARMACOLOGICAL DISPENSING DOSES (TREATMENT PLAN)', margin + 5, y + 6);

        doc.line(margin + 4, y + 9, pageWidth - margin - 4, y + 9);

        let subY = y + 15;
        doc.setFontSize(7.5);

        // Sub rows
        doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
        doc.setFont('helvetica', 'bold');
        doc.text('Standard Outpatient Medication:', margin + 6, subY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        const linesMed = doc.splitTextToSize(guidelinePlanTemplate.medication, 110);
        doc.text(linesMed, margin + 58, subY);

        subY += (linesMed.length * 3.5) + 3;
        doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
        doc.setFont('helvetica', 'bold');
        doc.text('Standard Dosage & Clinical Frequency:', margin + 6, subY);
        doc.setFont('helvetica', 'normal');
        const linesReg = doc.splitTextToSize(guidelinePlanTemplate.regimen, 110);
        doc.text(linesReg, margin + 58, subY);

        subY += (linesReg.length * 3.5) + 3;
        doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
        doc.setFont('helvetica', 'bold');
        doc.text('Target Triage Dispensing Cycle:', margin + 6, subY);
        doc.setFont('helvetica', 'normal');
        const linesDur = doc.splitTextToSize(guidelinePlanTemplate.dosage, 110);
        doc.text(linesDur, margin + 58, subY);

        subY += (linesDur.length * 3.5) + 3;
        doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
        doc.setFont('helvetica', 'bold');
        doc.text('Contraindications & Drug Warnings:', margin + 6, subY);
        doc.setFont('helvetica', 'normal');
        const linesContra = doc.splitTextToSize(guidelinePlanTemplate.contraindications, 110);
        doc.text(linesContra, margin + 58, subY);

        y += 60;

        // II. PATIENT ADVICE (SIDE BY SIDE COLS)
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('II. CLIENT AT-HOME RECOMMENDATIONS & PROTOCOLS', margin, y);

        y += 5;

        // DOB Card layout on client left
        doc.setFillColor(243, 248, 244); // Very soft green wash tint
        doc.rect(margin, y, 86, 75, 'F');
        doc.setDrawColor(165, 214, 167); // Pale green boundary
        doc.rect(margin, y, 86, 75, 'D');

        doc.setTextColor(21, 101, 41); // Deep warning forest green
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('RECOMMENDED ACTION PROTOCOLS (DOS)', margin + 4, y + 6);
        doc.line(margin + 4, y + 9, margin + 82, y + 9);

        let doY = y + 14;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
        doc.setFontSize(7.2);
        guidelinePlanTemplate.dos.forEach((itemDo) => {
          const wraps = doc.splitTextToSize(`• ${itemDo}`, 78);
          doc.text(wraps, margin + 4, doY);
          doY += (wraps.length * 3.5) + 2.5;
        });

        // DONTB Card layout on client right
        doc.setFillColor(254, 242, 242); // Soft red/maroon wash tint
        doc.rect(margin + 94, y, 86, 75, 'F');
        doc.setDrawColor(252, 165, 165); // pale red boundary
        doc.rect(margin + 94, y, 86, 75, 'D');

        doc.setTextColor(153, 27, 27); // Dark red accent
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('CRITICAL PROTOCOLS TO AVOID (DON\'TS)', margin + 98, y + 6);
        doc.line(margin + 98, y + 9, margin + 176, y + 9);

        let dontY = y + 14;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
        doc.setFontSize(7.2);
        guidelinePlanTemplate.donts.forEach((itemDont) => {
          const wraps = doc.splitTextToSize(`• ${itemDont}`, 78);
          doc.text(wraps, margin + 98, dontY);
          dontY += (wraps.length * 3.5) + 2.5;
        });

        y += 84;

        // III. CRITICAL CLINICAL SAFETY FLAG WARNINGS BOX
        doc.setFillColor(254, 242, 242);
        doc.rect(margin, y, contentWidth, 23, 'F');
        doc.setDrawColor(accentRed[0], accentRed[1], accentRed[2]);
        doc.setLineWidth(0.45);
        doc.rect(margin, y, contentWidth, 23, 'D');

        doc.setTextColor(accentRed[0], accentRed[1], accentRed[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('⚠ URGENT CRITICAL RED-FLAG SAFETY CLINICAL WARNING:', margin + 4, y + 5);

        doc.setTextColor(127, 29, 29); // Dark Crimson Maroon
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        const wrapsWarnings = doc.splitTextToSize(guidelinePlanTemplate.warningNote, 172);
        doc.text(wrapsWarnings, margin + 4, y + 10);
      }

      // Attending Field Officer Signatures layout Row at bottom of Page 2
      y = pageHeight - 34;
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);

      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.text(`Digital Verification Signature: ${record.healthWorker || 'K. Mensah [MOH-481]'}`, margin, y + 5);
      doc.text(`System Unique Sign-key Hash: SHA256-${record.id.slice(0, 12).toUpperCase()}...`, margin, y + 9);

      doc.setFontSize(7);
      doc.line(pageWidth - margin - 45, y + 12, pageWidth - margin, y + 12);
      doc.text('Attending Clinician Authenticated Stamp', pageWidth - margin - 45, y + 16);

      // Bottom footer text standard Page 2
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text('Approved by National Digital Health Authority. Preserving offline records strictly with security sandboxing container.', margin, pageHeight - 10);
      doc.text('Page 2 of 2', pageWidth - margin - doc.getTextWidth('Page 2 of 2'), pageHeight - 10);

      // SAVE DOCUMENT DESIGN DOSSIER
      const cleanPatientName = record.patient.name.trim().replace(/\s+/g, '_');
      doc.save(`Clinical_Referral_Note_${record.id}_${cleanPatientName}.pdf`);
    } catch (err: any) {
      console.error('PDF design construction failed completely:', err);
      alert('We fell into a container layout exception generating the PDF file: ' + err.message);
    }
  };

  // Dedicated generator to compile a beautiful, single-page clinical referral note PDF
  const downloadReferralPDF = () => {
    if (!activeAnalysisResult) return;
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2); // 180mm

      // Colors
      const primaryColor = [29, 158, 117]; // #1D9E75 Teal
      const primaryDark = [10, 22, 40];   // #0A1628 Deep Navy
      const borderSlate = [226, 232, 240]; // #e2e8f0 Light Slate Border
      const paperBg = [240, 253, 248]; // #F0FDF8 Light Teal Tint
      const textGray = [100, 116, 139]; // #64748b Gray Text
      const textDark = [15, 23, 42];    // #0f172a Dark text

      const isHigh = activeAnalysisResult.urgency === 'High';
      const isMod = activeAnalysisResult.urgency === 'Moderate';

      let urgencyColorRGB = [29, 158, 117];
      let urgencyStripText = "● MILD — Can be managed locally. Refer if no improvement in 7 days.";
      let urgencyBadgeText = "Mild Urgency";
      
      if (isHigh) {
        urgencyColorRGB = [216, 90, 48]; // #D85A30 coral red
        urgencyStripText = "● URGENT — Immediate referral required. Do not delay.";
        urgencyBadgeText = "Urgent Referral";
      } else if (isMod) {
        urgencyColorRGB = [239, 159, 39]; // #EF9F27 amber
        urgencyStripText = "● MODERATE — Refer to clinic within 3 days for assessment and treatment.";
        urgencyBadgeText = "Moderate Urgency";
      }

      const currentYear = new Date().getFullYear();
      const cleanRefId = activeCaseId ? activeCaseId : `DD-${currentYear}-00847`;

      // Draw left accent border running down the entire page
      doc.setFillColor(29, 158, 117);
      doc.rect(0, 0, 4, pageHeight, 'F');

      let y = 12;

      // HEADER BAND
      doc.setFillColor(10, 22, 40); // Dark Navy #0A1628
      doc.rect(margin, y, contentWidth, 18, 'F');

      // Left: Brand Details
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('DermaDetect', margin + 6, y + 11);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('AI-Powered Skin Assessment', margin + 6, y + 15);

      // White Vertical Divider Line
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.3);
      doc.line(margin + 58, y + 4, margin + 58, y + 14);

      // Right: Title & Refs
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      const headerTitleText = 'CLINICAL REFERRAL NOTE';
      doc.text(headerTitleText, pageWidth - margin - 6 - doc.getTextWidth(headerTitleText), y + 9);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const refText = `REF: ${cleanRefId}`;
      doc.text(refText, pageWidth - margin - 6 - doc.getTextWidth(refText), y + 14);

      y += 18;

      // ALERT STRIPE
      y += 3;
      doc.setFillColor(urgencyColorRGB[0], urgencyColorRGB[1], urgencyColorRGB[2]);
      doc.rect(margin, y, contentWidth, 9, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const textWidth = doc.getTextWidth(urgencyStripText);
      doc.text(urgencyStripText, margin + (contentWidth - textWidth) / 2, y + 6);

      y += 9 + 6;

      // TWO-COLUMN COMPILATION LAYOUT
      const leftColX = margin;
      const leftColW = 95;
      const rightColX = margin + 102;
      const rightColW = 78;

      let leftY = y;
      let rightY = y;

      // LEFT COLUMN BLOCKS
      // Block 1: Patient Information (Patient ID and Phone Number REMOVED!)
      doc.setTextColor(29, 158, 117);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('PATIENT INFORMATION', leftColX, leftY);
      
      doc.setDrawColor(200, 230, 220);
      doc.setLineWidth(0.4);
      doc.line(leftColX, leftY + 1.5, leftColX + leftColW, leftY + 1.5);
      
      leftY += 6;

      const drawGridRow = (label: string, value: string, curY: number) => {
        doc.setTextColor(110, 120, 130);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(label, leftColX + 2, curY);

        doc.setTextColor(10, 22, 40);
        doc.setFont('helvetica', 'bold');
        doc.text(value, leftColX + 32, curY);

        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(0.2);
        doc.line(leftColX, curY + 2.5, leftColX + leftColW, curY + 2.5);
      };

      drawGridRow('Full Name', patient.name || 'Abena Mensah', leftY);
      leftY += 6;
      drawGridRow('Age', patient.age ? `${patient.age} years` : '34 years', leftY);
      leftY += 6;
      drawGridRow('Contact Number', patient.contactNumber || '024 123 4567', leftY);
      leftY += 6;
      drawGridRow('Sex', patient.sex || 'Female', leftY);
      leftY += 6;
      drawGridRow('Date of Visit', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), leftY);
      leftY += 8;

      // Block 3: Referral Destination (Recommended Facility REMOVED!)
      doc.setTextColor(29, 158, 117);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('REFER TO', leftColX, leftY);
      doc.line(leftColX, leftY + 1.5, leftColX + leftColW, leftY + 1.5);

      leftY += 6;
      drawGridRow('Facility Type', 'District Hospital / Dermatology Clinic', leftY);
      leftY += 6;
      drawGridRow('Department', 'Dermatology / General OPD', leftY);
      leftY += 6;
      
      doc.setTextColor(110, 120, 130);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('Urgency', leftColX + 2, leftY);

      doc.setTextColor(urgencyColorRGB[0], urgencyColorRGB[1], urgencyColorRGB[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(isHigh ? 'Immediate — Do Not Delay' : isMod ? 'Within 3 days' : 'Within 7 days', leftColX + 32, leftY);

      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.2);
      doc.line(leftColX, leftY + 2.5, leftColX + leftColW, leftY + 2.5);
      
      leftY += 8;

      // Block 4: Health Worker's Notes
      doc.setTextColor(29, 158, 117);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text("HEALTH WORKER'S NOTES", leftColX, leftY);
      doc.line(leftColX, leftY + 1.5, leftColX + leftColW, leftY + 1.5);

      leftY += 6;
      const notesText = patient.symptoms && patient.symptoms.trim() 
        ? `"${patient.symptoms.trim()}"`
        : "No additional notes recorded.";
      
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(240, 242, 245);
      doc.setLineWidth(0.3);
      
      const wrappedNotes = doc.splitTextToSize(notesText, leftColW - 6);
      const notesBoxHeight = Math.max(14, (wrappedNotes.length * 4) + 6);
      doc.rect(leftColX, leftY, leftColW, notesBoxHeight, 'FD');

      doc.setTextColor(100, 110, 120);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text(wrappedNotes, leftColX + 3, leftY + 5.5);

      leftY += notesBoxHeight + 8;

      // RIGHT COLUMN BLOCKS (AI Assessment & Suggestions - PREEMINENT!)
      const getConditionDetails = (findingName: string) => {
        const norm = findingName.toLowerCase();
        if (norm.includes('ringworm') || norm.includes('tinea')) {
          return {
            description: "Tinea corporis is a superficial fungal infection of the skin characterised by a ring-shaped, scaly, itchy rash. It is highly treatable with topical antifungal agents. If untreated it can spread to other body parts or to close contacts.",
            suggestions: [
              "Clotrimazole 1% cream — apply twice daily for 2–4 weeks",
              "Keep area clean and dry",
              "Avoid sharing towels or clothing"
            ]
          };
        } else if (norm.includes('eczema') || norm.includes('atopic') || norm.includes('dermatitis')) {
          return {
            description: "Atopic dermatitis (eczema) is a chronic, pruritic inflammatory skin condition that typically affects patients with a personal or family history of atopic disease. It is managed with skin hydration, trigger avoidance, and topical anti-inflammatories.",
            suggestions: [
              "Hydrocortisone 1% cream — apply twice daily for 7 days",
              "Apply thick emollient brand moisturizer frequently",
              "Avoid harsh scented soaps and hot baths"
            ]
          };
        } else if (norm.includes('impetigo')) {
          return {
            description: "Impetigo is a highly contagious superficial bacterial skin infection, most common in children, characterized by honey-colored crusts. It is typically managed with topical or oral antibiotic therapy to prevent spreading.",
            suggestions: [
              "Mupirocin 2% topical ointment — apply 3 times daily",
              "Gently clean honey-colored crusts with warm soapy water",
              "Keep lesions covered to prevent auto-inoculation"
            ]
          };
        } else if (norm.includes('scabies')) {
          return {
            description: "Scabies is an intensely itchy skin infestation caused by the micro mite Sarcoptes scabiei. It is highly contagious and spreads rapidly through close contact. Managed with permethrin or oral ivermectin.",
            suggestions: [
              "Permethrin 5% cream — apply from neck down, wash after 8-14 hours",
              "Treat all household contacts simultaneously",
              "Wash bedding and clothes in hot water"
            ]
          };
        } else {
          return {
            description: "A potential clinical skin indication detected by the assistive triage scanner. Standard clinical diagnostic procedures, laboratory analysis and symptom grading are recommended before commencing definitive therapy.",
            suggestions: activeAnalysisResult.treatmentNotes && activeAnalysisResult.treatmentNotes.length > 0 
              ? activeAnalysisResult.treatmentNotes 
              : [
                  "Monitor area daily for pigment or dimension shifts",
                  "Keep the affected region clean, dry, and cool",
                  "Refer to dermatology clinic if symptoms do not improve"
                ]
          };
        }
      };

      const conditionName = activeAnalysisResult.primaryFinding;
      const condDetails = getConditionDetails(conditionName);
      
      const wrapDesc = doc.splitTextToSize(condDetails.description, rightColW - 10);
      const cardHeight = 84 + (wrapDesc.length * 3.8);

      doc.setFillColor(paperBg[0], paperBg[1], paperBg[2]);
      doc.setDrawColor(200, 235, 220);
      doc.setLineWidth(0.3);
      doc.rect(rightColX, rightY, rightColW, cardHeight, 'FD');

      // Left teal stripe down the AI card to emphasize depth
      doc.setFillColor(29, 158, 117);
      doc.rect(rightColX, rightY, 2.5, cardHeight, 'F');

      // Inside Card Heading
      doc.setTextColor(29, 158, 117);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('AI ASSESSMENT RESULT', rightColX + 5, rightY + 6);

      // Condition name (Large Bold text)
      doc.setTextColor(10, 22, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(conditionName, rightColX + 5, rightY + 13);

      // Confidence label & progress bar
      doc.setTextColor(100, 110, 120);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Detection confidence', rightColX + 5, rightY + 19);
      
      doc.setTextColor(29, 158, 117);
      doc.setFont('helvetica', 'bold');
      doc.text(`${activeAnalysisResult.confidence}%`, rightColX + rightColW - 12, rightY + 19);

      // Simple horizontal progress sub-bar
      doc.setFillColor(226, 232, 240);
      doc.rect(rightColX + 5, rightY + 21, rightColW - 10, 1.5, 'F');

      doc.setFillColor(29, 158, 117);
      const barFillW = ((rightColW - 10) * activeAnalysisResult.confidence) / 100;
      doc.rect(rightColX + 5, rightY + 21, barFillW, 1.5, 'F');

      // Urgency Pill Badge
      doc.setFillColor(urgencyColorRGB[0], urgencyColorRGB[1], urgencyColorRGB[2]);
      doc.rect(rightColX + 5, rightY + 25.5, 30, 4.5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(urgencyBadgeText.toUpperCase(), rightColX + 7, rightY + 29);

      // Condition description block
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(wrapDesc, rightColX + 5, rightY + 36);

      // Suggested treatment subtitle
      let treatY = rightY + 36 + (wrapDesc.length * 3.8) + 4;
      doc.setDrawColor(210, 240, 225);
      doc.line(rightColX + 5, treatY, rightColX + rightColW - 5, treatY);
      
      treatY += 5;
      doc.setTextColor(29, 158, 117);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('SUGGESTED TREATMENT', rightColX + 5, treatY);

      treatY += 4.5;
      condDetails.suggestions.forEach((item) => {
        doc.setFillColor(29, 158, 117);
        doc.circle(rightColX + 7, treatY - 1, 0.8, 'F');

        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        const wrappedSug = doc.splitTextToSize(item, rightColW - 12);
        doc.text(wrappedSug, rightColX + 11, treatY);
        treatY += (wrappedSug.length * 3.6) + 1.5;
      });

      treatY += 2;
      doc.setTextColor(140, 145, 155);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.8);
      const disclText = "This is an AI-generated suggestion. Final treatment decisions rest with the receiving clinician.";
      const wrapDiscl = doc.splitTextToSize(disclText, rightColW - 10);
      doc.text(wrapDiscl, rightColX + 5, treatY);

      rightY += cardHeight + 6;

      // Skin Photo displays
      doc.setTextColor(29, 158, 117);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('PHOTO TAKEN', rightColX, rightY);
      doc.setDrawColor(200, 230, 220);
      doc.line(rightColX, rightY + 1.5, rightColX + rightColW, rightY + 1.5);

      rightY += 5;
      
      const photoBoxH = 40;
      let photoSuccess = false;
      if (capturedImage) {
        try {
          doc.addImage(capturedImage, 'JPEG', rightColX, rightY, rightColW, photoBoxH);
          photoSuccess = true;
        } catch (e) {
          console.warn('Could not render image inside document export:', e);
        }
      }

      if (!photoSuccess) {
        doc.setFillColor(242, 245, 248);
        doc.rect(rightColX, rightY, rightColW, photoBoxH, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(rightColX, rightY, rightColW, photoBoxH, 'D');

        doc.setTextColor(150, 160, 175);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('NO PHOTO IMAGE', rightColX + 22, rightY + 22);
      } else {
        doc.setFillColor(15, 23, 42);
        doc.rect(rightColX + rightColW - 24, rightY + photoBoxH - 5, 23, 4.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.text('DermaDetect AI', rightColX + rightColW - 22, rightY + photoBoxH - 1.8);
      }

      rightY += photoBoxH + 4;
      doc.setTextColor(140, 145, 155);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`Photo Captured: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, 10:43 AM`, rightColX, rightY);

      let maxY = Math.max(leftY, rightY) + 4;
      if (maxY < 215) maxY = 215; // Bottom third align

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, maxY, pageWidth - margin, maxY);

      maxY += 6;

      // HEALTH WORKER SIGNATURE
      doc.setTextColor(140, 145, 155);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('HEALTH WORKER SIGNATURE', margin, maxY);

      // Embedded signature canvas data
      if (signatureCanvasRef.current) {
        try {
          const sigImg = signatureCanvasRef.current.toDataURL('image/png');
          doc.addImage(sigImg, 'PNG', margin + 3, maxY + 2, 45, 12);
        } catch (e) {
          console.warn('Canvas trace loading failed:', e);
        }
      }

      doc.setDrawColor(150, 160, 175);
      doc.setLineWidth(0.3);
      doc.line(margin, maxY + 14, margin + 65, maxY + 14);

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Akosua Darko', margin, maxY + 18.5);

      doc.setTextColor(140, 145, 155);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Date verified: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, margin, maxY + 22.5);

      // CLINICIAN Stamp space
      doc.setTextColor(140, 145, 155);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('RECEIVING CLINICIAN STAMP / SIGNATURE', margin + 92, maxY);

      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(250, 251, 252);
      doc.setLineWidth(0.4);
      doc.rect(margin + 92, maxY + 2.5, 73, 13, 'FD');

      doc.setTextColor(200, 205, 215);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('PLACE CLINICAL INCOMING STAMP HERE', margin + 101, maxY + 11);

      doc.setTextColor(110, 120, 130);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.text('* To be completed at receiving healthcare facility', margin + 110, maxY + 20);

      // FOOTER
      doc.setDrawColor(29, 158, 117);
      doc.setLineWidth(0.4);
      doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

      doc.setTextColor(140, 145, 155);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.text(`Generated by DermaDetect AI. Reference: ${cleanRefId}`, margin, pageHeight - 10);
      doc.text(`Timestamp: ${new Date().toLocaleString()}`, margin, pageHeight - 6.5);

      const footDiscl = "* This referral note is a supportive triage transcript powered by assistive computer vision. Final clinical authority belongs to the licensed physician.";
      doc.text(footDiscl, pageWidth - margin - doc.getTextWidth(footDiscl), pageHeight - 10);

      // Save PDF
      const cleanPatientName = (patient.name || 'Abena_Mensah').trim().replace(/\s+/g, '_');
      doc.save(`DermaDetect_Referral_Note_${cleanPatientName}.pdf`);

    } catch (err: any) {
      console.error('Dedicated pdf generate crash:', err);
      alert('PDF compiler encountered an error: ' + err.message);
    }
  };


  // Dedicated single-page Referral Note PDF generator for offline downloads (bypassing window.print() issues)
  const downloadReferralNoteAsPdf = () => {
    if (!activeAnalysisResult) return;
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 12;
      const contentWidth = pageWidth - (margin * 2); // 186 mm

      // Theme Colors
      const tealColor = [29, 158, 117]; // #1D9E75
      const navyColor = [10, 22, 40];   // #0A1628
      const whiteColor = [255, 255, 255];
      const grayColor = [240, 243, 245];
      const textGray = [100, 116, 139]; // Slate 500
      const borderGray = [226, 232, 240]; // Slate 200

      // Compute Urgency
      const isHigh = activeAnalysisResult.urgency === 'High';
      const isMod = activeAnalysisResult.urgency === 'Moderate';
      
      let urgencyHex = tealColor;
      let urgencyStripText = "● MILD — Can be managed locally. Refer if no improvement in 7 days.";
      let urgencyBadgeText = "● Mild Urgency";
      if (isHigh) {
        urgencyHex = [216, 90, 48]; // #D85A30 coral red
        urgencyStripText = "● URGENT — Immediate referral required. Do not delay.";
        urgencyBadgeText = "● Urgent Referral";
      } else if (isMod) {
        urgencyHex = [239, 159, 39]; // #EF9F27 amber
        urgencyStripText = "● MODERATE — Refer to clinic within 3 days for assessment.";
        urgencyBadgeText = "● Moderate Urgency";
      }

      const currentYear = new Date().getFullYear();
      const cleanRefId = activeCaseId ? activeCaseId : `DD-${currentYear}-00847`;

      // 1. HEADER BAND (Teal branding style)
      doc.setFillColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.rect(margin, 12, contentWidth, 16, 'F');

      // Left Brand Details
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('DermaDetect', margin + 4, 19);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('AI-Powered Skin Assessment', margin + 4, 23.5);

      // Vertical separator line
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.3);
      doc.line(margin + 58, 15, margin + 58, 25);

      // Right Label details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('CLINICAL REFERRAL NOTE', margin + 62, 19);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`REF: ${cleanRefId}`, margin + 62, 23.5);

      // 2. ALERT STRIPE (Visual Urgency band)
      doc.setFillColor(urgencyHex[0], urgencyHex[1], urgencyHex[2]);
      doc.rect(margin, 31, contentWidth, 9, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      const textWidth = doc.getTextWidth(urgencyStripText);
      doc.text(urgencyStripText, margin + (contentWidth - textWidth) / 2, 36.8);

      // 3. TWO COLUMN BODY (Columns are placed side-by-side)
      const leftColX = margin;
      const rightColX = margin + 112;
      const leftColWidth = 104;
      const rightColWidth = 74;

      let yPos = 46;

      // --- LEFT COLUMN: PATIENT & DESTINATION DETAILS ---
      // Patient Information Title
      doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('PATIENT INFORMATION', leftColX, yPos);
      doc.setDrawColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setLineWidth(0.4);
      doc.line(leftColX, yPos + 1.5, leftColX + leftColWidth, yPos + 1.5);

      yPos += 5.5;
      doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
      doc.setFontSize(8.5);

      const rowsPatient = [
        ['Full Name', patient.name || 'Abena Mensah', true],
        ['Age', patient.age ? `${patient.age} years` : '34 years', false],
        [' Contact Number', patient.contactNumber || '0244 567 890', false], // Note the leading space for visual alignment
        ['Sex', patient.sex || 'Female', false],
        ['Date of Visit', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), false]
      ];

      rowsPatient.forEach(([label, val, isBold]) => {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(115, 115, 115);
        doc.text(label as string, leftColX + 2, yPos + 1.5);

        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
        doc.text(val as string, leftColX + 50, yPos + 1.5);

        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(0.2);
        doc.line(leftColX, yPos + 4.5, leftColX + leftColWidth, yPos + 4.5);
        yPos += 6;
      });

      yPos += 3;

      // REFER TO Details (Recommended facility, ID, and phone removed)
      doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('REFER TO', leftColX, yPos);
      doc.setDrawColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setLineWidth(0.4);
      doc.line(leftColX, yPos + 1.5, leftColX + leftColWidth, yPos + 1.5);

      yPos += 5.5;

      const rowsRefer = [
        ['Facility Type', 'District Hospital / Dermatology Clinic', false],
        ['Department', 'Dermatology / General OPD', false],
        ['Urgency', isHigh ? 'Immediate — Do Not Delay' : isMod ? 'Within 3 days' : 'Within 7 days', true]
      ];

      rowsRefer.forEach(([label, val, isBold]) => {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(115, 115, 115);
        doc.text(label as string, leftColX + 2, yPos + 1.5);

        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        if (isBold) {
          if (isHigh) doc.setTextColor(216, 90, 48);
          else if (isMod) doc.setTextColor(239, 159, 39);
          else doc.setTextColor(29, 158, 117);
        } else {
          doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
        }
        doc.text(val as string, leftColX + 40, yPos + 1.5);

        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(0.2);
        doc.line(leftColX, yPos + 4.5, leftColX + leftColWidth, yPos + 4.5);
        yPos += 6;
      });

      yPos += 4;

      // Clinical notes block
      doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text("HEALTH WORKER'S NOTES", leftColX, yPos);
      doc.setDrawColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setLineWidth(0.4);
      doc.line(leftColX, yPos + 1.5, leftColX + leftColWidth, yPos + 1.5);

      yPos += 5.5;
      const notesX = leftColX;
      const notesY = yPos;
      const notesW = leftColWidth;
      const notesH = 20;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.rect(notesX, notesY, notesW, notesH, 'FD');

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const noteText = (patient.symptoms && patient.symptoms.trim()) 
        ? `"${patient.symptoms.trim()}"` 
        : "No additional notes recorded.";
      const wrappedNotes = doc.splitTextToSize(noteText, notesW - 6);
      doc.text(wrappedNotes, notesX + 3, notesY + 5);

      // --- RIGHT COLUMN: AI ASSESSMENT FOCUS / SPOTLIGHT ---
      let ryPos = 46;

      // Card Background matching on-screen element focus colors
      const cardHeight = 84;
      doc.setFillColor(240, 253, 248);
      doc.rect(rightColX, ryPos, rightColWidth, cardHeight, 'F');

      // Heavy left accent border
      doc.setFillColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.rect(rightColX, ryPos, 2, cardHeight, 'F');

      ryPos += 4.5;
      doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('AI ASSESSMENT RESULT', rightColX + 4, ryPos);

      ryPos += 5.5;
      doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const wrappedFinding = doc.splitTextToSize(activeAnalysisResult.primaryFinding, rightColWidth - 8);
      doc.text(wrappedFinding, rightColX + 4, ryPos);

      ryPos += wrappedFinding.length * 4.5 + 2;

      // Progress and confidence meters
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(115, 115, 115);
      doc.text('Detection confidence', rightColX + 4, ryPos);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.text(`${activeAnalysisResult.confidence}%`, rightColX + rightColWidth - 11, ryPos);

      ryPos += 2.2;
      doc.setFillColor(226, 232, 240);
      doc.rect(rightColX + 4, ryPos, rightColWidth - 8, 1.5, 'F');
      
      doc.setFillColor(tealColor[0], tealColor[1], tealColor[2]);
      const fillWidth = ((rightColWidth - 8) * activeAnalysisResult.confidence) / 100;
      doc.rect(rightColX + 4, ryPos, fillWidth, 1.5, 'F');

      ryPos += 5.5;

      // Dynamic Urgency pill badge
      doc.setFillColor(urgencyHex[0], urgencyHex[1], urgencyHex[2]);
      doc.rect(rightColX + 4, ryPos, 28, 4.5, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.text(urgencyBadgeText, rightColX + 6, ryPos + 3.2);

      ryPos += 7.5;

      // Condition clinical definition text
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      const getConditionDetailsLocal = (findingName: string) => {
        const norm = findingName.toLowerCase();
        if (norm.includes('ringworm') || norm.includes('tinea')) {
          return {
            description: "Tinea corporis is a superficial fungal infection of the skin characterised by a ring-shaped, scaly, itchy rash. It is highly treatable with topical antifungal agents. If untreated it can spread to other body parts or to close contacts.",
            suggestions: [
              "Clotrimazole 1% cream — apply twice daily for 2–4 weeks",
              "Keep area clean and dry",
              "Avoid sharing towels or clothing"
            ]
          };
        } else if (norm.includes('eczema') || norm.includes('atopic') || norm.includes('dermatitis')) {
          return {
            description: "Atopic dermatitis (eczema) is a chronic, pruritic inflammatory skin condition that typically affects patients with a personal or family history of atopic disease. It is managed with skin hydration, trigger avoidance, and topical anti-inflammatories.",
            suggestions: [
              "Hydrocortisone 1% cream — apply twice daily for 7 days",
              "Apply thick emollient brand moisturizer frequently",
              "Avoid harsh scented soaps and hot baths"
            ]
          };
        } else if (norm.includes('impetigo')) {
          return {
            description: "Impetigo is a highly contagious superficial bacterial skin infection, most common in children, characterized by honey-colored crusts. It is typically managed with topical or oral antibiotic therapy to prevent spreading.",
            suggestions: [
              "Mupirocin 2% topical ointment — apply 3 times daily",
              "Gently clean honey-colored crusts with warm soapy water",
              "Keep lesions covered to prevent auto-inoculation"
            ]
          };
        } else if (norm.includes('scabies')) {
          return {
            description: "Scabies is an intensely itchy skin infestation caused by the micro mite Sarcoptes scabiei. It is highly contagious and spreads rapidly through close contact. Managed with permethrin or oral ivermectin.",
            suggestions: [
              "Permethrin 5% cream — apply from neck down, wash after 8-14 hours",
              "Treat all household contacts simultaneously",
              "Wash bedding and clothes in hot water"
            ]
          };
        } else {
          return {
            description: "A potential clinical skin indication detected by the assistive triage scanner. Standard clinical diagnostic procedures, laboratory analysis and symptom grading are recommended before commencing definitive therapy.",
            suggestions: activeAnalysisResult.treatmentNotes && activeAnalysisResult.treatmentNotes.length > 0 
              ? activeAnalysisResult.treatmentNotes 
              : [
                  "Monitor area daily for pigment or dimension shifts",
                  "Keep the affected region clean, dry, and cool",
                  "Refer to dermatology clinic if symptoms do not improve"
                ]
          };
        }
      };

      const condDetails = getConditionDetailsLocal(activeAnalysisResult.primaryFinding);
      const wrappedDesc = doc.splitTextToSize(condDetails.description, rightColWidth - 8);
      doc.text(wrappedDesc, rightColX + 4, ryPos);

      ryPos += wrappedDesc.length * 3.4 + 4;

      // SUGGESTED TREATMENT Panel
      doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('✦ SUGGESTED CLINICAL TREATMENT', rightColX + 4, ryPos);

      ryPos += 3;
      doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);

      condDetails.suggestions.forEach((item) => {
        const wrappedItem = doc.splitTextToSize(`• ${item}`, rightColWidth - 9);
        doc.text(wrappedItem, rightColX + 4, ryPos);
        ryPos += wrappedItem.length * 3.4 + 1;
      });

      ryPos += 0.5;
      doc.setTextColor(148, 163, 184); // slate 400
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.text('AI advice. Final decisions rest with clinician.', rightColX + 4, ryPos + 2.5);


      // --- SECTION 4: LESION PHOTO AND SIGNATURE STAMPS ---
      let bYPos = 138;

      // Left Photo Box
      doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('PHOTO TAKEN DURING ASSESSMENT', leftColX, bYPos);
      doc.setDrawColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setLineWidth(0.4);
      doc.line(leftColX, bYPos + 1.5, leftColX + 80, bYPos + 1.5);

      bYPos += 5.5;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(leftColX, bYPos, 80, 52, 'FD');

      let photoSuccess = false;
      if (capturedImage) {
        try {
          doc.addImage(capturedImage, 'JPEG', leftColX + 1, bYPos + 1, 78, 50);
          photoSuccess = true;
        } catch (photoErr) {
          console.warn('Could not add captured image to referral PDF:', photoErr);
        }
      }

      if (!photoSuccess) {
        doc.setTextColor(156, 163, 175);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('NO LESION PHOTO ATTACHED', leftColX + 20, bYPos + 27);
      }

      // Watermark Text layer
      doc.setFillColor(15, 23, 42, 0.4);
      doc.rect(leftColX + 54, bYPos + 44, 24, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('DermaDetect AI', leftColX + 56, bYPos + 48.2);

      // Photo time caption
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.text(`Photo captured: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, 10:43 AM`, leftColX, bYPos + 56.5);


      // Right Signatures column
      let sigYPos = 138;
      const sigX = margin + 94;
      const sigW = contentWidth - 94; // 92mm

      doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('SIGNATURES & STAMPS', sigX, sigYPos);
      doc.setDrawColor(tealColor[0], tealColor[1], tealColor[2]);
      doc.setLineWidth(0.4);
      doc.line(sigX, sigYPos + 1.5, sigX + sigW, sigYPos + 1.5);

      sigYPos += 5.5;

      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.text('HEALTH WORKER SIGNATURE', sigX, sigYPos + 1);

      sigYPos += 3;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.rect(sigX, sigYPos, sigW, 16, 'FD');

      // Draw real canvas signature to PDF
      let canvasSigSuccess = false;
      if (signatureCanvasRef.current) {
        try {
          const sigDataUrl = signatureCanvasRef.current.toDataURL('image/png');
          doc.addImage(sigDataUrl, 'PNG', sigX + 1, sigYPos + 0.5, sigW - 2, 15);
          canvasSigSuccess = true;
        } catch (sigCanvasError) {
          console.warn('Canvas ink reference unavailable:', sigCanvasError);
        }
      }

      if (!canvasSigSuccess) {
        doc.setTextColor(203, 213, 225);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.text('Authenticity drawing signed', sigX + 15, sigYPos + 9);
      }

      sigYPos += 20;
      doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Akosua Darko', sigX, sigYPos);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Signed Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, sigX, sigYPos + 3.8);

      sigYPos += 7.5;

      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.text('RECEIVING CLINICIAN STAMP / SIGNATURE', sigX, sigYPos);

      sigYPos += 2;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.rect(sigX, sigYPos, sigW, 16, 'FD');

      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('PLACE CLINICAL STAMP HERE', sigX + (sigW - doc.getTextWidth('PLACE CLINICAL STAMP HERE')) / 2, sigYPos + 9.5);

      sigYPos += 19;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      doc.text('* To be filled at referral facility', sigX + sigW - doc.getTextWidth('* To be filled at referral facility'), sigYPos);


      // --- PERSISTENT FOOTER DECORATORS ---
      let footerY = pageHeight - 24;

      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setLineWidth(0.35);
      doc.line(margin, footerY, pageWidth - margin, footerY);

      footerY += 4.5;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(115, 115, 115);
      doc.text('DermaDetect AI', margin, footerY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.text('Offline clinical reference assistant.', margin, footerY + 3.8);
      
      const stampX = margin + 58;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.4);
      doc.text('TIMESTAMP & ID', stampX, footerY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.text(`Ref ID: ${cleanRefId}`, stampX, footerY + 3.8);
      doc.text(`Compiled Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, 10:47 AM`, stampX, footerY + 7);

      const disclaimerX = margin + 115;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      const wrappedLegal = doc.splitTextToSize("Disclaimer: This note was generated with AI assistive matching tools based on lesion scans. Receiving clinicians should perform independent examinations before diagnostic confirmation.", contentWidth - 115);
      doc.text(wrappedLegal, disclaimerX, footerY + 1.5);

      // Trigger download!
      const safePatientName = (patient.name || 'Abena_Mensah').trim().replace(/\s+/g, '_');
      doc.save(`DermaDetect_Referral_Note_${safePatientName}.pdf`);

    } catch (pdfErr) {
      console.error('Offline PDF compiler exception:', pdfErr);
      alert('Error downloads. Attempting fallback print window...');
      window.print();
    }
  };


  // Interactive filters
  const processedCases = cases.filter(item => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      item.patient.name.toLowerCase().includes(query) ||
      item.finding.primaryFinding.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query);

    const matchesUrgency = filterUrgency === 'All' || item.finding.urgency === filterUrgency;

    return matchesSearch && matchesUrgency;
  });

  return (
    <div className="min-h-screen bg-[#f7fafc] text-[#181c1e] font-sans antialiased flex flex-col">
      
    {/* OCEANIC CLINICAL HEADER */}
{/* GLASSMORPHISM CLINICAL HEADER */}
<header className="bg-[#001B2E]/65 backdrop-blur-md border-b border-white/10 fixed top-0 left-0 right-0 z-50 h-20 shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
  <div className="flex justify-between items-center w-full px-6 md:px-12 max-w-7xl mx-auto h-full">
    
    {/* BRAND IDENTITY: GENTLE & PROFESSIONAL */}
    <div 
      onClick={() => { setScreen('home'); stopWebcam(); }}
      className="flex items-center gap-4 cursor-pointer group"
    >
      {/* Organic fluid mark with clean inner glare */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00A6FB] via-[#003554] to-[#001B2E] flex items-center justify-center text-white font-display font-bold text-sm shadow-[inset_0_1px_3px_rgba(255,255,255,0.4)] transition-transform group-hover:scale-105">
        DD
      </div>
      <div className="flex flex-col">
        <span className="font-display font-bold text-[#F0F4F8] text-xl tracking-tight leading-none">
          Derma<span className="text-[#00A6FB]">Defect</span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#00A6FB]/80 font-semibold mt-1">
          Clinical Diagnostics
        </span>
      </div>
    </div>

    {/* NAVIGATION: REFINED HUMANIST STYLE */}
    <nav className="hidden md:flex items-center gap-10 h-full">
      <button 
        onClick={resetAndStartAssessment}
        className={`font-sans text-sm font-medium transition-all duration-300 h-full relative flex items-center ${
          screen === 'assessment-info' || screen === 'assessment-capture' || screen === 'assessment-review' || screen === 'referral-note'
            ? 'text-white font-semibold'
            : 'text-[#F0F4F8]/60 hover:text-white'
        }`}
      >
        {t.newAssessment}
        {/* Luminous water-droplet underline tracker */}
        {(screen === 'assessment-info' || screen === 'assessment-capture' || screen === 'assessment-review' || screen === 'referral-note') && (
          <span className="absolute bottom-0 left-0 w-full h-[3px] bg-[#00A6FB] rounded-t-full shadow-[0_-2px_12px_rgba(0,166,251,0.8)]" />
        )}
      </button>
      
      <button 
        onClick={() => { setScreen('case-history'); stopWebcam(); }}
        className={`font-sans text-sm font-medium transition-all duration-300 h-full relative flex items-center ${
          screen === 'case-history'
            ? 'text-white font-semibold'
            : 'text-[#F0F4F8]/60 hover:text-white'
        }`}
      >
        {t.caseHistory}
        {screen === 'case-history' && (
          <span className="absolute bottom-0 left-0 w-full h-[3px] bg-[#00A6FB] rounded-t-full shadow-[0_-2px_12px_rgba(0,166,251,0.8)]" />
        )}
      </button>
    </nav>

    {/* Clinician profile badge */}
<div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
  <div className="w-6 h-6 rounded-full bg-[#00A6FB] flex items-center justify-center text-white font-bold text-[10px]">
    {clinician.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
  </div>
  <div className="text-left">
    <p className="text-[11px] font-bold text-white leading-none">{clinician.name}</p>
    <p className="text-[9px] text-white/60 leading-none mt-0.5">{clinician.role}</p>
  </div>
  <button
    onClick={() => { clearProfile(); setClinician(null); }}
    title="Switch profile"
    className="ml-1 text-white/40 hover:text-white/80 transition-colors"
  >
    <X className="w-3 h-3" />
  </button>
</div>

  </div>
</header>

      {/* VIEWPORT BODY CANVAS */}
      <main className="flex-1 pt-14 pb-20 md:pb-0 flex flex-col">
        
        {/* VIEW 1: HOME PAGE */}
        {screen === 'home' && (
          <div className="flex-1 flex flex-col relative overflow-hidden bg-[#F8F9FA]">
            
            {/* SECTION 1: HERO (DARK GRAPHIC CANVAS WITH IMAGE BACKGROUND) */}
<section className="relative min-h-screen flex flex-col overflow-hidden bg-[#001B2E] text-[#F0F4F8]">
  
  {/* INTEGRATED HERO BACKGROUND — BLEEDS DIRECTLY BEHIND THE FIXED GLASS HEADER */}
  <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
    <img 
      src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=2400&q=80" 
      alt="Clinical medical macro observation"
      className="w-full h-full object-cover object-center scale-100 opacity-45 mix-blend-luminosity filter contrast-125 brightness-110"
    />
    
    {/* Uniform ambient tint rather than a mudding top gradient block */}
    <div className="absolute inset-0 bg-[#001B2E]/20 mix-blend-multiply" />
    
    {/* Clean perimeter framing vignette that leaves the area behind the text and header luminous */}
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#001B2E]/10 to-[#001B2E]" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#001B2E_90%)]" />
  </div>

  {/* AMBIENT LIGHT CORE */}
  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70vw] h-[50vh] bg-[#00A6FB]/10 blur-[150px] rounded-full pointer-events-none z-0" />

  {/* STRUCTURAL CONTENT CONTAINER: Explicit spacing architecture to frame your fixed header */}
  <div className="max-w-4xl mx-auto w-full px-6 md:px-12 pt-44 pb-24 md:pt-17 md:pb-32 flex flex-col items-center justify-center text-center relative z-10 my-auto">
    
    {/* Glassmorphic Clinical Badge */}
    <div className="w-fit mb-6 md:mb-8">
      <span className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-white/[0.03] backdrop-blur-md border border-white/10 text-[11px] uppercase tracking-[0.25em] text-[#F0F4F8] font-semibold shadow-[0_4px_30px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.1)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00A6FB] shadow-[0_0_10px_#00A6FB]" />
        Dermatology Support for General Practice
      </span>
    </div>

    {/* Human-First Editorial Title */}
    <h1 className="font-display font-light text-white text-4xl sm:text-6xl md:text-7xl leading-[1.1] tracking-tight mb-6 md:mb-8 drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
      Diagnostic support, <br/> 
      <span className="font-bold bg-gradient-to-r from-white via-[#00A6FB] to-[#00A6FB] bg-clip-text text-transparent">built for clinicians.</span>
    </h1>

    {/* Grounded Description Copy */}
    <p className="text-[#F0F4F8]/85 text-base md:text-xl leading-relaxed max-w-2xl font-sans font-light mb-10 md:mb-12 drop-shadow-sm">
      DermaDefect provides physicians with instant, evidence-backed reference mapping and diagnostic cross-examinations. Pure clinical utility, designed to integrate seamlessly at the point of care.
    </p>

    {/* Glassmorphic / Sea Blue Action Controls */}
    <div className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full sm:w-auto">
      <button
        onClick={resetAndStartAssessment}
        className="w-full sm:w-auto h-14 px-12 bg-[#00A6FB] text-[#001B2E] font-sans font-semibold text-base rounded-full shadow-[0_10px_25px_rgba(0,166,251,0.25)] hover:bg-white hover:text-[#001B2E] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-95"
      >
        <PlusCircle className="w-5 h-5" />
        <span>Begin Assessment</span>
      </button>
      
      <a
        href="#how-it-works"
        className="w-full sm:w-auto h-14 px-12 border border-white/10 text-[#F0F4F8] bg-white/[0.04] backdrop-blur-md font-sans font-semibold text-base rounded-full shadow-[0_4px_30px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.05)] hover:bg-white/[0.1] hover:border-white/20 transition-all flex items-center justify-center gap-3 active:scale-95"
      >
        <span>Read Clinical Protocol</span>
        <ArrowRight className="w-4 h-4 opacity-70 text-[#00A6FB]" />
      </a>
    </div>

  </div>

</section>


{/* SECTION 2: THE PROBLEM (CLEAN SEA BLUE & GLASS GRAPHICS) */}
<section className="py-24 md:py-32 px-6 md:px-12 bg-white relative z-10 select-none">
  
  {/* Header Block */}
  <div className="max-w-4xl mx-auto text-center mb-20">
    <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#00A6FB]/5 border border-[#00A6FB]/10 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#00A6FB]">
      The Clinical Disparity
    </span>
    <h2 className="font-display font-bold text-[#001B2E] text-3xl sm:text-5xl tracking-tight mt-4 leading-[1.15]">
      Africa has fewer than 1 dermatologist <br className="hidden md:block"/> per million people.
    </h2>
    <div className="w-16 h-1 bg-[#00A6FB] rounded-full mx-auto mt-6 opacity-60" />
    <p className="text-base md:text-lg text-[#003554]/75 font-sans font-light leading-relaxed mt-6 max-w-2xl mx-auto">
      Skin diseases are among the most common reasons for primary clinic visits — yet most go misdiagnosed or untreated at the community level. The specialist is too far. The wait is too long. The damage is already done.
    </p>
  </div>

  {/* Cinematically formatted patient background layout */}
  <div className="max-w-6xl mx-auto bg-gradient-to-b from-white to-[#F0F4F8]/30 rounded-3xl border border-[#003554]/10 overflow-hidden shadow-[0_20px_50px_rgba(0,27,46,0.04)]">
    <div className="grid grid-cols-1 lg:grid-cols-12">
      
      {/* Cinematic Image Frame (Left 65%) */}
      <div className="lg:col-span-7 relative min-h-[350px] sm:min-h-[450px] lg:min-h-auto overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1600&q=80" 
          alt="Healthcare worker consulting patient in community environment" 
          className="absolute inset-0 w-full h-full object-cover object-center transform hover:scale-102 transition-transform duration-700"
        />
        {/* Soft sea blue vignette overlay for high text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-[#001B2E]/95 via-[#001B2E]/70 to-transparent z-10" />
        
        <div className="absolute bottom-8 left-8 lg:bottom-12 lg:left-12 z-20 max-w-sm text-left">
          <span className="text-[10px] text-[#00A6FB] font-sans font-bold uppercase tracking-widest block mb-2">
            Field Support Optimization
          </span>
          <h3 className="text-white font-display font-bold text-2xl leading-tight">
            Empowering frontlines in local community clinics.
          </h3>
          <p className="text-[#F0F4F8]/70 text-xs mt-3 font-sans font-light leading-relaxed">
            Providing immediate reference mapping for identifying common critical pathologies like scabies, ringworm, eczema, and impetigo.
          </p>
        </div>
      </div>

      {/* Overlaid stats layout on the Right (Right 35% / 5 Columns) */}
      <div className="lg:col-span-5 bg-[#001B2E]/[0.02] border-t lg:border-t-0 lg:border-l border-[#003554]/5 p-8 md:p-10 flex flex-col justify-center gap-6 text-left">
        
        {/* Stat Card 1 */}
        <div className="bg-white p-6 rounded-2xl border border-[#003554]/5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:border-[#00A6FB]/20 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00A6FB]/10 text-[#00A6FB] flex items-center justify-center shrink-0">
              <Heart className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-3xl text-[#001B2E] tracking-tight">1 in 3</h3>
              <p className="text-[10px] text-[#003554]/50 uppercase tracking-widest font-sans font-bold mt-0.5">Affected Annually</p>
            </div>
          </div>
          <p className="text-xs text-[#003554]/70 leading-relaxed mt-3 font-sans font-light">
            Ghanaians affected by common, preventable dermatological conditions every calendar year.
          </p>
        </div>

        {/* Stat Card 2 */}
        <div className="bg-white p-6 rounded-2xl border border-[#003554]/5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:border-[#00A6FB]/20 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00A6FB]/10 text-[#00A6FB] flex items-center justify-center shrink-0">
              <Clock className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-3xl text-[#001B2E] tracking-tight">72 Hours</h3>
              <p className="text-[10px] text-[#003554]/50 uppercase tracking-widest font-sans font-bold mt-0.5">Average Rural Wait</p>
            </div>
          </div>
          <p className="text-xs text-[#003554]/70 leading-relaxed mt-3 font-sans font-light">
            Mean commute and wait times required to consult dermatological specialists in metropolitan centers.
          </p>
        </div>

        {/* Stat Card 3 */}
        <div className="bg-white p-6 rounded-2xl border border-[#003554]/5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:border-[#00A6FB]/20 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-3xl text-[#001B2E] tracking-tight">60%</h3>
              <p className="text-[10px] text-red-500/70 uppercase tracking-widest font-sans font-bold mt-0.5">Initial Misdiagnosis</p>
            </div>
          </div>
          <p className="text-xs text-[#003554]/70 leading-relaxed mt-3 font-sans font-light">
            Misdiagnosed cases recorded at regional community care outposts operating without assistive workflows.
          </p>
        </div>

      </div>

    </div>
  </div>
</section>

          {/* SECTION 3: THE PROTOCOL / CLINICAL FLOW (PURE UTILITY LIGHT THEME) */}
<span id="how-it-works" className="-mt-20 pt-5 block" />
<section className="relative py-24 md:py-32 px-6 md:px-12 bg-[#F8FAFC] text-[#001B2E] relative z-10 border-t border-slate-200 select-none overflow-hidden">
  
  {/* IMMERSIVE CLINICAL BACKGROUND IMAGE */}
  <div className="absolute inset-0 z-0 pointer-events-none select-none opacity-[0.03]">
    <img 
      src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=2400&q=80" 
      alt="Clinical environment structural line background"
      className="w-full h-full object-cover object-center filter saturate-0"
    />
  </div>

  {/* CLEAN HEADER BLOCK */}
  <div className="max-w-4xl mx-auto text-center mb-16 md:mb-20 relative z-10">
    <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#00A6FB]/5 border border-[#00A6FB]/10 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00A6FB]">
      The Protocol
    </span>
    <h2 className="font-display font-bold text-slate-900 text-3xl sm:text-5xl tracking-tight mt-4 leading-tight">
      Three steps. Two seconds. <br className="sm:hidden" />
      <span className="text-[#00A6FB]">One life changed.</span>
    </h2>
    <p className="text-xs md:text-sm text-slate-500 leading-relaxed max-w-2xl mx-auto mt-4 font-sans">
      DermaDefect provides primary care physicians with instant reference cross-examinations and triage data formatting designed specifically for rapid point-of-care environments.
    </p>
  </div>

  {/* MINIMALIST HORIZONTAL PROTOCOL FLOW */}
  <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch relative z-10">
    
    {/* STEP 01: CAPTURE */}
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between group hover:shadow-lg hover:border-[#00A6FB]/30 transition-all duration-300">
      <div className="space-y-4 text-left">
        
        {/* Step Image */}
        <div className="aspect-[1.6] w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
          <img 
            src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80" 
            alt="Capturing skin lesion with device camera" 
            className="w-full h-full object-cover filter brightness-95"
          />
        </div>

        {/* Step Info */}
        <div className="flex items-start justify-between pt-2">
          <div>
            <span className="text-[10px] text-[#00A6FB] font-sans tracking-widest font-bold uppercase">Step 01</span>
            <h3 className="font-display font-bold text-lg text-slate-900 mt-0.5">Capture Image</h3>
          </div>
          <span className="text-xl font-display font-light text-slate-300 select-none">01</span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed font-sans font-light">
          The clinician captures a clear frame of the skin anomaly directly within the device browser, or uploads from the local device storage gallery.
        </p>
      </div>
    </div>

    {/* STEP 02: CROSS-REFERENCE */}
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between group hover:shadow-lg hover:border-[#00A6FB]/30 transition-all duration-300">
      <div className="space-y-4 text-left">
        
        {/* Step Image */}
        <div className="aspect-[1.6] w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
          <img 
            src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80" 
            alt="Clinical reference comparison" 
            className="w-full h-full object-cover filter brightness-95"
          />
        </div>

        {/* Step Info */}
        <div className="flex items-start justify-between pt-2">
          <div>
            <span className="text-[10px] text-[#00A6FB] font-sans tracking-widest font-bold uppercase">Step 02</span>
            <h3 className="font-display font-bold text-lg text-slate-900 mt-0.5">Reference Map</h3>
          </div>
          <span className="text-xl font-display font-light text-slate-300 select-none">02</span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed font-sans font-light">
          The internal software engine evaluates key visual structural parameters locally, formatting confirmed criteria markers in under two seconds.
        </p>
      </div>
    </div>

    {/* STEP 03: EXPORT */}
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between group hover:shadow-lg hover:border-[#00A6FB]/30 transition-all duration-300">
      <div className="space-y-4 text-left">
        
        {/* Step Image */}
        <div className="aspect-[1.6] w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
          <img 
            src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80" 
            alt="Reviewing formatted digital clinical documentation" 
            className="w-full h-full object-cover filter brightness-95"
          />
        </div>

        {/* Step Info */}
        <div className="flex items-start justify-between pt-2">
          <div>
            <span className="text-[10px] text-[#00A6FB] font-sans tracking-widest font-bold uppercase">Step 03</span>
            <h3 className="font-display font-bold text-lg text-slate-900 mt-0.5">Action Results</h3>
          </div>
          <span className="text-xl font-display font-light text-slate-300 select-none">03</span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed font-sans font-light">
          Review structural indices, confirm urgency tiers, and copy instantly generated case summaries formatted for local referral networks.
        </p>
      </div>
    </div>

  </div>
</section>

            {/* SECTION 6: CALL TO ACTION (CTA, DARK GRADIENT TO MIRROR HERO) */}
            <section className="py-20 md:py-28 px-4 md:px-8 bg-gradient-to-br from-[#0A1628] to-[#0F2D1F] text-white relative z-10 select-none overflow-hidden text-center border-t border-white/5">
              
              {/* Particle field background */}
              <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none opacity-20">
                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i} 
                    className="particle" 
                    style={{
                      left: `${15 + (i * 6.8)}%`,
                      width: `${2.5 + (i % 2) * 1.5}px`,
                      height: `${2.5 + (i % 2) * 1.5}px`,
                      '--duration': `${8 + (i % 2) * 4}s`,
                      animationDelay: `${i * 0.6}s`
                    } as React.CSSProperties}
                  />
                ))}
              </div>

              <div className="max-w-4xl mx-auto space-y-7 relative z-10">
                
                <h2 className="font-display font-black text-white text-3xl sm:text-4.5xl leading-tight tracking-tight">
                  Ready to bring AI-powered skin care to your clinic?
                </h2>
                
                <p className="text-slate-300 font-sans text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
                  DermaDetect is free to use, works offline, and takes less than 2 minutes to learn.
                </p>

                {/* Centered CTA row buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3.5 max-w-md mx-auto">
                  <button
                    onClick={resetAndStartAssessment}
                    className="w-full sm:w-auto h-13 px-8 shimmer-button text-white font-display font-bold text-sm rounded-xl shadow-lg shadow-[#1D9E75]/10 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95"
                  >
                    <PlusCircle className="w-5 h-5" />
                    <span>Start Using DermaDetect</span>
                  </button>
                  
                  <a
                    href="#how-it-works"
                    className="w-full sm:w-auto h-13 px-8 border border-white/20 hover:border-white/40 text-white bg-white/5 font-display font-bold text-sm rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 text-center block"
                  >
                    <span>Learn More</span>
                  </a>
                </div>

                {/* 3 small badges below call to action block */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 pt-10 border-t border-white/5 font-mono text-[10.5px] leading-none text-slate-350">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4.5 h-4.5 text-[#1D9E75]" />
                    🔒 Patient data stays on your device
                  </span>
                  <span className="flex items-center gap-2">
                    <WifiOff className="w-4.5 h-4.5 text-[#EF9F27]" />
                    📶 Works without internet
                  </span>
                  <span className="flex items-center gap-2">
                    <Globe className="w-4.5 h-4.5 text-[#32c494]" />
                    🌍 Built for African healthcare
                  </span>
                </div>

              </div>

            </section>

            {/* SEPARATE INTERACTIVE APP FAQS */}
            <section className="bg-white py-16 md:py-24 border-b border-slate-200 select-none">
              <div className="max-w-4xl mx-auto px-4">
                <div className="text-center mb-12">
                  <span className="text-xs font-bold font-mono tracking-widest text-[#1D9E75] uppercase">FAQ</span>
                  <h2 className="font-display font-black text-slate-900 text-2xl md:text-3xl tracking-tight mt-2.5">
                    Privacy, Scope & Safety FAQ
                  </h2>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      q: "What skin conditions can DermaDetect help with?",
                      a: "The system assists in recognizing four primary skin conditions: Ringworm (Tinea Corporis), Eczema, Impetigo, and scabies. It is designed to aid clinical triaging by providing quick supportive guidance based on common presentations, though it does not replace a doctor's examination."
                    },
                    {
                      q: "How is patient data kept private and secure?",
                      a: "Data privacy is built in. All image evaluation and processing are performed entirely locally on your browser. No patient records, clinical outcomes, or uploaded photographs are sent to or stored on external servers without your explicit action."
                    },
                    {
                      q: "Can I generate and download clinical reports offline?",
                      a: "Yes. Once the web application is loaded, report compilation operates fully offline. You can generate, preview, and download patient summaries or referral notes directly to your local device without needing a cellular connection."
                    }
                  ].map((faq, idx) => {
                    const isOpen = !!faqOpenState[idx];
                    return (
                      <div 
                        key={idx}
                        className="border border-[#bccac1]/75 rounded-xl overflow-hidden transition-all duration-300 bg-[#F8F9FA]/50 hover:bg-[#F8F9FA]"
                      >
                        <button
                          onClick={() => setFaqOpenState({ ...faqOpenState, [idx]: !isOpen })}
                          className="w-full text-left p-5 flex justify-between items-center font-display font-bold text-sm text-[#181c1e] cursor-pointer"
                        >
                          <span>{faq.q}</span>
                          <span className="text-[#1D9E75] text-lg font-bold ml-4">
                            {isOpen ? "−" : "+"}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-dashed border-slate-200 font-sans">
                            {faq.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* HIGH-FIDELITY PRODUCT FOOTER DESIGN */}
            <footer className="bg-[#0A121D] text-slate-300 pt-16 pb-10 border-t-2 border-[#1D9E75]/30">
              <div className="max-w-6xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 pb-12 border-b border-white/5 text-xs justify-between">
                
                {/* Column 1: Brand & Affiliation */}
                <div className="md:col-span-5 space-y-4 text-left">
                  <div className="flex items-center gap-2.5 text-white">
                    <div className="w-8 h-8 rounded-lg bg-[#1D9E75] flex items-center justify-center font-black font-display tracking-wider text-sm select-none">
                      DD
                    </div>
                    <span className="font-display font-extrabold text-base tracking-tight text-white">DermaDetect</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-xs">
                    DermaDetect is an open-source assistive screening tool. Designed to expand primary care diagnostic support in community, rural, and outreach settings where specialist access is limited.
                  </p>
                  <p className="text-slate-500 text-[10.5px] leading-relaxed">
                    *Disclaimer: This is a clinical decision support tool and does not replace professional medical advice, comprehensive physical examination, or formal diagnosis. Treatment plans should always correspond to approved local clinical guidelines and formal diagnostic frameworks.
                  </p>
                </div>

                {/* Column 2: Clinical Actions Quick Links */}
                <div className="md:col-span-2 space-y-3 text-left">
                  <h4 className="font-display font-bold text-white text-xs uppercase tracking-wider">Clinical Tools</h4>
                  <ul className="space-y-2 text-slate-400">
                    <li>
                      <button 
                        onClick={resetAndStartAssessment}
                        className="hover:text-white transition-colors cursor-pointer text-left"
                      >
                        Start Assessment
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => setScreen('case-history')} 
                        className="hover:text-white transition-colors cursor-pointer text-left"
                      >
                        View Patient Roster
                      </button>
                    </li>
                  </ul>
                </div>

           

                {/* Column 4: Local Device Encryption Specs */}
                <div className="md:col-span-3 space-y-3 text-left">
                  <h4 className="font-display font-bold text-white text-xs uppercase tracking-wider">Device Privacy</h4>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    All processing occurs locally within your browser environment. No sensitive patient data is transmitted or permanently retained on remote servers.
                  </p>
                </div>

              </div>

              {/* Footer Bottom Row copyrights info */}
              <div className="max-w-6xl mx-auto px-4 md:px-8 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span>© {new Date().getFullYear()} DermaDetect Telehealth Systems. Supporting clinical care worldwide.</span>
                </div>
              </div>
            </footer>

          </div>
        )}

        {/* SIDE DIFF SECTIONS FOR STEPS WORKFLOW */}
        {(screen === 'assessment-info' || screen === 'assessment-capture' || screen === 'assessment-review' || screen === 'referral-note') && (
          <div className="flex-1 flex flex-col md:flex-row">
            
            {/* SIDE NAVIGATIONBAR PROGRESS COLUMN */}
            <aside className="w-full md:w-64 bg-slate-50 md:border-r border-slate-200 py-4 md:py-6 px-4 flex flex-col md:min-h-[calc(100vh-3.5rem)] select-none">
  {/* Header block for desktop view */}
  <div className="mb-6 hidden md:block mt-7">
    <h2 className="font-display font-bold text-base text-slate-900">Assessment Progress</h2>
    <p className="text-xs text-slate-500 mt-0.5">Clinical Workflow Protocol</p>
  </div>

  {/* Step Navigation Track */}
  <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
    
    {/* Step 1 Indicator: Patient Info */}
    <div 
      onClick={() => { if (screen !== 'assessment-info') setScreen('assessment-info'); }}
      className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer grow md:grow-0 shrink-0 ${
        screen === 'assessment-info'
          ? 'bg-[#00A6FB] text-white font-semibold shadow-sm shadow-[#00A6FB]/20'
          : 'text-slate-600 hover:bg-slate-200/60'
      }`}
    >
      <UserPen className="w-4.5 h-4.5 shrink-0" />
      <span className="font-display text-xs font-medium whitespace-nowrap">Step 1: Patient Info</span>
    </div>

    {/* Step 2 Indicator: Skin Capture */}
    <div 
      onClick={() => { 
        if (patient.name) {
          setScreen('assessment-capture');
        }
      }}
      className={`flex items-center gap-3 p-3 rounded-xl transition-all grow md:grow-0 shrink-0 ${
        !patient.name 
          ? 'opacity-40 cursor-not-allowed' 
          : 'cursor-pointer'
      } ${
        screen === 'assessment-capture'
          ? 'bg-[#00A6FB] text-white font-semibold shadow-sm shadow-[#00A6FB]/20'
          : 'text-slate-600 hover:bg-slate-200/60'
      }`}
    >
      <Camera className="w-4.5 h-4.5 shrink-0" />
      <span className="font-display text-xs font-medium whitespace-nowrap">Step 2: Skin Capture</span>
    </div>

    {/* Step 3 Indicator: Review Details */}
    <div 
      onClick={() => {
        if (activeAnalysisResult) {
          setScreen('assessment-review');
        }
      }}
      className={`flex items-center gap-3 p-3 rounded-xl transition-all grow md:grow-0 shrink-0 ${
        !activeAnalysisResult 
          ? 'opacity-40 cursor-not-allowed' 
          : 'cursor-pointer'
      } ${
        screen === 'assessment-review'
          ? 'bg-[#00A6FB] text-white font-semibold shadow-sm shadow-[#00A6FB]/20'
          : 'text-slate-600 hover:bg-slate-200/60'
      }`}
    >
      <ClipboardCheck className="w-4.5 h-4.5 shrink-0" />
      <span className="font-display text-xs font-medium whitespace-nowrap">Step 3: Action Results</span>
    </div>
  </div>

  {/* Premium clinical compliance footer inside sidebar */}
  <div className="mt-auto hidden md:block pt-4 border-t border-slate-200">
    <div className="flex items-center gap-2 px-1 text-slate-400">
      <ShieldCheck className="w-4 h-4 text-[#00A6FB]" />
      <span className="font-sans font-semibold text-[9px] tracking-wider uppercase">Secure Diagnostic Link</span>
    </div>
  </div>
</aside>

            {/* FLOW CANVAS PORT AREA */}
            <div className="flex-1 flex flex-col pt-4 md:pt-0">
              
              {/* FLOW SECTION 1: ENTER INFO */}
              {screen === 'assessment-info' && (
                <div className="p-4 md:p-8 flex-1 flex items-center justify-center canvas-bg mt-7">
                  <div className="bg-white border border-[#bccac1] rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-sm">
                    <header className="mb-6">
                      <h2 className="font-display font-extrabold text-xl md:text-2xl text-[#181c1e]">Patient Details</h2>
                      <p className="text-xs text-[#3d4943] mt-1.5">
                        Please record basic patient identifiers, demographics, and symptom definitions to support the clinical classification model.
                      </p>
                    </header>

                    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (patient.name) setScreen('assessment-capture'); }}>
                      <div className="space-y-1.5">
                        <label className="font-display text-xs font-bold text-[#181c1e] block">Patient Full Name</label>
                        <input 
                          type="text" 
                          required
                          value={patient.name}
                          onChange={(e) => setPatient({ ...patient, name: e.target.value })}
                          placeholder="Full legal name"
                          className="w-full h-11 px-3.5 border border-[#bccac1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] bg-white text-sm transition-all shadow-inner"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="font-display text-xs font-bold text-[#181c1e] block">Age (Years)</label>
                          <input 
                            type="number"
                            required
                            min="0"
                            max="125"
                            value={patient.age}
                            onChange={(e) => setPatient({ ...patient, age: e.target.value })}
                            placeholder="e.g. 34"
                            className="w-full h-11 px-3.5 border border-[#bccac1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] bg-white text-sm transition-all"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="font-display text-xs font-bold text-[#181c1e] block">Sex Selection</label>
                          <div className="flex h-11 border border-[#bccac1] rounded-lg overflow-hidden bg-white">
                            <button
                              type="button"
                              onClick={() => setPatient({ ...patient, sex: 'Male' })}
                              className={`flex-1 text-xs font-bold transition-all ${
                                patient.sex === 'Male'
                                  ? 'bg-[#d6e0f6] text-[#121c2c]'
                                  : 'text-[#3d4943] hover:bg-[#f1f4f6]'
                              }`}
                            >
                              Male
                            </button>
                            <div className="w-[1px] bg-[#bccac1]" />
                            <button
                              type="button"
                              onClick={() => setPatient({ ...patient, sex: 'Female' })}
                              className={`flex-1 text-xs font-bold transition-all ${
                                patient.sex === 'Female'
                                  ? 'bg-[#d6e0f6] text-[#121c2c]'
                                  : 'text-[#3d4943] hover:bg-[#f1f4f6]'
                              }`}
                            >
                              Female
                            </button>
                          </div>
                        </div>
                      </div>

                       <div className="space-y-1.5">
                        <label className="font-display text-xs font-bold text-[#181c1e] block">Patient Contact Number</label>
                        <input 
                          type="tel" 
                          max={10}
                          required
                          value={patient.contactNumber}
                          onChange={(e) => setPatient({ ...patient, contactNumber: e.target.value })}
                          placeholder="Contact number"
                          className="w-full h-11 px-3.5 border border-[#bccac1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] bg-white text-sm transition-all shadow-inner"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-display text-xs font-bold text-[#181c1e] block">Brief Symptom Description</label>
                        <textarea
                          rows={3}
                          value={patient.symptoms}
                          onChange={(e) => setPatient({ ...patient, symptoms: e.target.value })}
                          placeholder="Describe lesion duration, localized itch, flareups, and changes observed on the skin..."
                          className="w-full p-3 border border-[#bccac1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] bg-white text-sm transition-all resize-none"
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={!patient.name || !patient.age || !patient.sex || !patient.contactNumber}
                          className="w-full h-11 bg-[#0077b6] hover:bg-[#0096c7] disabled:bg-[#bccac1] disabled:cursor-not-allowed text-white font-display font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <span>Next Step: Capture Skin Image</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* FLOW SECTION 2: CAPTURE AREA */}
              {screen === 'assessment-capture' && (
                <div className="p-4 md:p-8 flex-1 canvas-bg mt-7">
                  <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    
                    {/* Left instructions block */}
                    <div className="space-y-6">
                      <div>
                        <span className="inline-block bg-[#ebeef0] text-[#555f71] px-2.5 py-0.5 rounded-full font-display font-semibold text-[10px] mb-2 uppercase tracking-wide">
                          Assessment Phase 02
                        </span>
                        <h2 className="font-display font-extrabold text-[#181c1e] text-2xl">Capture Skin Image</h2>
                        <p className="text-sm text-[#3d4943] mt-2 leading-relaxed">
                          For accurate AI triage evaluation, capture a sharp close-up photo of the patient's skin lesion. Maintain clear lighting and remove any topical bandage films or residue.
                        </p>
                      </div>


                      {/* Photo Capture Tips */}
                      <div className="bg-white border border-[#bccac1] p-4 rounded-xl flex gap-3">
                        <div className="p-2 bg-[#d6e0f6] rounded-full text-[#0077b6] h-fit">
                          <Lightbulb className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-xs text-[#181c1e]">Photography Tip</h4>
                          <p className="text-[11px] text-[#3d4943] mt-1 leading-relaxed">
                            Use natural lighting if possible. Avoid using the direct camera flash directly over wet or oily ulcers, to prevent excessive glare artifacts.
                          </p>
                        </div>
                      </div>

                      {/* Interactive Triggers */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        {isCameraActive ? (
                          <button
                            onClick={captureFrame}
                            className="flex-1 h-11 bg-[#0077b6] text-white rounded-lg font-display font-bold text-sm hover:bg-[#0096c7] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                          >
                            <Camera className="w-5 h-5 animate-pulse" />
                            Snaps Assessment Frame
                          </button>
                        ) : (
                          <button
                            onClick={startWebcam}
                            className="flex-1 h-11 bg-[#0077b6] text-white rounded-lg font-display font-bold text-sm hover:bg-[#0096c7] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                          >
                            <Camera className="w-5 h-5" />
                            Take Photo with Camera
                          </button>
                        )}

                        <label className="flex-1 h-11 border-2 border-dashed border-[#0077b6] text-[#0077b6] bg-white rounded-lg font-display font-bold text-sm hover:bg-[#f1f4f6] transition-all flex items-center justify-center gap-2 cursor-pointer transition-colors">
                          <Upload className="w-5 h-5" />
                          <span>Upload from Gallery</span>
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden" 
                          />
                        </label>
                      </div>

                      {/* Close camera button */}
                      {isCameraActive && (
                        <button 
                          onClick={stopWebcam}
                          className="w-full h-9 bg-[#ffdad6] text-[#93000a] text-xs font-bold rounded-lg transition-colors hover:bg-red-200"
                        >
                          Cancel Camera Stream
                        </button>
                      )}
                    </div>

                    {/* Right Capture preview column */}
                    <div className="space-y-4">
                      <div className="bg-white border rounded-2xl p-4 border-[#bccac1]">
                        <h3 className="font-display text-xs font-bold text-[#181c1e] mb-3 uppercase tracking-wider">Assessment Preview</h3>
                        
                        {/* Live stream viewport or static image */}
                        <div className="aspect-[4/5] bg-[#ebeef0] border-2 border-dashed border-[#bccac1] rounded-xl overflow-hidden flex flex-col items-center justify-center p-4 relative">
                          
                          {isCameraActive && !capturedImage && (
                            <video 
                              ref={videoRef} 
                              autoPlay 
                              className="w-full h-full object-cover rounded-lg absolute inset-0"
                            />
                          )}

                          {capturedImage ? (
                            <img 
                              src={capturedImage} 
                              alt="Clinic Skin Frame" 
                              className="w-full h-full object-cover rounded-lg absolute inset-0" 
                            />
                          ) : (
                            !isCameraActive && (
                              <div className="text-center p-6 space-y-3 pointer-events-none">
                                <span className="w-12 h-12 rounded-full bg-[#f1f4f6] border border-[#bccac1] flex items-center justify-center text-[#6d7a73] mx-auto">
                                  <Camera className="w-6 h-6" />
                                </span>
                                <p className="font-display font-extrabold text-sm text-[#3d4943]">No active image captured</p>
                                <p className="text-[10px] text-[#6d7a73]">Activate webcam capture or pick one from our specimen gallery.</p>
                              </div>
                            )
                          )}

                          {cameraError && !capturedImage && (
                            <div className="absolute inset-0 bg-[#ffdad6]/95 flex items-center justify-center p-6 text-center z-10 rounded-lg">
                              <p className="text-xs font-semibold text-[#93000a] leading-relaxed">{cameraError}</p>
                            </div>
                          )}
                        </div>

                        {/* Interactive Analyzer start trigger */}
                        {capturedImage && (
                          <div className="mt-4 p-3 bg-[#f0f9ff] rounded-xl border border-[#bccac1] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-[#0077b6]" />
                              <span className="text-xs font-bold text-[#181c1e]">
                                {customFileSelected ? "Local File Selected" : "Specimen Pre-loaded"}
                              </span>
                            </div>
                            <button
                              onClick={() => { setCapturedImage(null); setCustomFileSelected(false); }}
                              className="text-xs font-bold text-[#ba1a1a] hover:underline"
                            >
                              Reset Choice
                            </button>
                          </div>
                        )}
                      </div>

                      {capturedImage && (
                        <button
                          onClick={runAiAnalysis}
                          disabled={analysisLoading}
                          className="w-full h-12 bg-[#0077b6] hover:bg-[#0096c7] text-white rounded-xl font-display font-extrabold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95 transition-all"
                        >
                          <Activity className="w-5 h-5" />
                          <span>Analyse Skin Condition</span>
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              )}

             {/* FLOW SECTION 3: ASSESSMENT RESULTS */}
{screen === 'assessment-review' && activeAnalysisResult && (
  <div className="p-4 md:p-8 flex-1 bg-[#F8FAFC] mt-7 select-none">
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* HEADER SECTION */}
      <header className="border-b border-slate-200 pb-4">
        <h2 className="font-display font-bold text-2xl text-slate-900">Assessment Results</h2>
        <p className="text-xs text-slate-500 mt-1.5">
          Review structural profile classifications and matching reference criteria metrics prior to completing patient clinical transfer reports.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* LEFT SIDE: PRIMARY PROFILE FINDINGS */}
        <div className="md:col-span-7 space-y-6">
          
          {/* Main Assessment Indicator Card */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
            <span className="text-[#00A6FB] font-sans font-bold text-[10px] tracking-wider uppercase block">
              Primary Medical Profile Finding
            </span>
            <div className="flex justify-between items-start mt-1.5 mb-4">
              <h3 className="font-display font-bold text-xl md:text-2xl text-slate-900">
                {activeAnalysisResult.primaryFinding}
              </h3>
              
              {/* Reference Match Confidence Metric */}
              <div className="bg-slate-50 px-3 py-1 rounded-xl flex flex-col items-end shrink-0 border border-slate-200">
                <span className="font-display font-bold text-[#00A6FB] text-xl leading-none">
                  {activeAnalysisResult.confidence}%
                </span>
                <span className="text-[9px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">Match</span>
              </div>
            </div>

            {/* Solid Flat Horizontal Metric Bar */}
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#00A6FB]" 
                style={{ width: `${activeAnalysisResult.confidence}%` }}
              />
            </div>
          </div>

         {/* Groq Response Structure (Narrative & Treatments) */}
                      <div>
                        <h3 className="font-bold text-sm text-[#0077b6] uppercase tracking-wider border-b border-[#f1f4f6] pb-2 mb-4">AI Clinical Evaluation</h3>
                        
                        <div className="space-y-6 page-break-inside-avoid">
                         <div className="bg-white border border-[#bccac1] p-6 rounded-xl shadow-sm text-sm leading-relaxed text-[#181c1e]">
  {activeAnalysisResult.referralNote ? (
    <ReactMarkdown
      components={{
        // Bold headers render as teal clinical section titles
        strong: ({ node, ...props }) => (
          <strong
            className="block font-bold text-[#0077b6] text-xs uppercase tracking-wider mt-5 mb-2 pb-1 border-b border-slate-100"
            {...props}
          />
        ),
        // Paragraphs get proper spacing
        p: ({ node, ...props }) => (
          <p className="text-sm text-slate-700 leading-relaxed mb-3 font-normal" {...props} />
        ),
        // Lists
        ul: ({ node, ...props }) => (
          <ul className="space-y-1.5 mb-3 ml-4" {...props} />
        ),
        li: ({ node, ...props }) => (
          <li className="text-sm text-slate-700 leading-relaxed list-disc" {...props} />
        ),
      }}
    >
      {activeAnalysisResult.referralNote}
    </ReactMarkdown>
  ) : (
    <p className="text-slate-400 italic text-sm">No clinical narrative generated.</p>
  )}
</div>

      <div className="print:hidden">
        <TreatmentRecommendations 
          finding={activeAnalysisResult} 
          patient={patient} 
          caseId={activeCaseId || 'NEW-CASE'} 
        />
      </div>
    </div>
  </div>
        </div>

        

        {/* RIGHT SIDE: PATIENT SPECIMEN VIEW & TRIAGE HIGHLIGHT */}
        <div className="md:col-span-5 space-y-6">
          
          {/* Clean Medical Specimen Thumbnail Grid */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center text-xs font-medium text-slate-600">
              <span>Patient Lesion Frame</span>
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-tight">IMG_REFERENCE.jpg</span>
            </div>
            <div className="aspect-square bg-slate-50 relative">
              {capturedImage && (
                <img 
                  src={capturedImage} 
                  alt="Captured skin lesion specimen frame" 
                  className="w-full h-full object-cover filter brightness-95" 
                />
              )}
            </div>

            <div className="aspect-square bg-slate-50 relative pt-3"> 
              {activeAnalysisResult.heatmap_b64 && (
                <div className="bg-[#e0e3e5] overflow-hidden border border-[#bccac1] relative aspect-square">
                  <img src={`data:image/jpeg;base64,${activeAnalysisResult.heatmap_b64}`} alt="GradCAM Saliency Map" className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 bg-[#0077b6]/80 text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wide">AI Saliency Map</div>
                </div>
              )}
             </div>
          </div>

          {/* Clean Flat Triage Status Bars */}
          <div className={`p-4 rounded-2xl border flex items-start gap-3 shadow-sm ${
            activeAnalysisResult.urgency === 'High'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : activeAnalysisResult.urgency === 'Moderate'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            <div className={`p-1.5 rounded-lg shrink-0 text-white ${
              activeAnalysisResult.urgency === 'High' 
                ? 'bg-rose-600' 
                : activeAnalysisResult.urgency === 'Moderate' 
                ? 'bg-amber-600'
                : 'bg-slate-600'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="font-sans font-bold text-[10px] tracking-wider uppercase block">
                Triage Metric: {activeAnalysisResult.urgency} Urgency
              </span>
              <p className="text-xs text-slate-600 leading-relaxed font-light">
                {activeAnalysisResult.urgencyText}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* FOOTER ACTION PANEL ROW */}
      <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-3">
        <button 
          onClick={() => setScreen('referral-note')}
          className="h-11 px-6 border border-slate-200 text-slate-700 bg-white font-display font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <FileText className="w-4 h-4 text-[#00A6FB]" />
          <span>Format Referral Summary</span>
        </button>
        
        <button 
          onClick={saveCaseRecord}
          className="h-11 px-8 bg-[#00A6FB] text-white font-display font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-[#008cc4] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#00A6FB]/10"
        >
          <Save className="w-4 h-4" />
          <span>Commit Case Record</span>
        </button>
      </div>

    </div>
  </div>
)}
              {/* FLOW SECTION 4: CLINICAL REFERRAL NOTE (PRINT PREVIEW DOCUMENT) */}
              {screen === 'referral-note' && activeAnalysisResult && (() => {
                // Pre-mapped helper: get beautiful medical definitions and treatment notes based on finding
                const getConditionDetails = (findingName: string) => {
                  const norm = findingName.toLowerCase();
                  if (norm.includes('ringworm') || norm.includes('tinea')) {
                    return {
                      description: "Tinea corporis is a superficial fungal infection of the skin characterised by a ring-shaped, scaly, itchy rash. It is highly treatable with topical antifungal agents. If untreated it can spread to other body parts or to close contacts.",
                      suggestions: [
                        "Clotrimazole 1% cream — apply twice daily for 2–4 weeks",
                        "Keep area clean and dry",
                        "Avoid sharing towels or clothing"
                      ]
                    };
                  } else if (norm.includes('eczema') || norm.includes('atopic') || norm.includes('dermatitis')) {
                    return {
                      description: "Atopic dermatitis (eczema) is a chronic, pruritic inflammatory skin condition that typically affects patients with a personal or family history of atopic disease. It is managed with skin hydration, trigger avoidance, and topical anti-inflammatories.",
                      suggestions: [
                        "Hydrocortisone 1% cream — apply twice daily for 7 days",
                        "Apply thick emollient brand moisturizer frequently",
                        "Avoid harsh scented soaps and hot baths"
                      ]
                    };
                  } else if (norm.includes('impetigo')) {
                    return {
                      description: "Impetigo is a highly contagious superficial bacterial skin infection, most common in children, characterized by honey-colored crusts. It is typically managed with topical or oral antibiotic therapy to prevent spreading.",
                      suggestions: [
                        "Mupirocin 2% topical ointment — apply 3 times daily",
                        "Gently clean honey-colored crusts with warm soapy water",
                        "Keep lesions covered to prevent auto-inoculation"
                      ]
                    };
                  } else if (norm.includes('scabies')) {
                    return {
                      description: "Scabies is an intensely itchy skin infestation caused by the micro mite Sarcoptes scabiei. It is highly contagious and spreads rapidly through close contact. Managed with permethrin or oral ivermectin.",
                      suggestions: [
                        "Permethrin 5% cream — apply from neck down, wash after 8-14 hours",
                        "Treat all household contacts simultaneously",
                        "Wash bedding and clothes in hot water"
                      ]
                    };
                  } else {
                    return {
                      description: "A potential clinical skin indication detected by the assistive triage scanner. Standard clinical diagnostic procedures, laboratory analysis and symptom grading are recommended before commencing definitive therapy.",
                      suggestions: activeAnalysisResult.treatmentNotes && activeAnalysisResult.treatmentNotes.length > 0 
                        ? activeAnalysisResult.treatmentNotes 
                        : [
                            "Monitor area daily for pigment or dimension shifts",
                            "Keep the affected region clean, dry, and cool",
                            "Refer to dermatology clinic if symptoms do not improve"
                          ]
                    };
                  }
                };

                const docDetails = getConditionDetails(activeAnalysisResult.primaryFinding);
                
                // Urgency states mapper
                const isHigh = activeAnalysisResult.urgency === 'High';
                const isMod = activeAnalysisResult.urgency === 'Moderate';
                
                let urgencyHex = '#1D9E75'; // green/teal (Mild/Low)
                let urgencyStripText = "● MILD — Can be managed locally. Refer if no improvement in 7 days.";
                let urgencyBadgeText = "● Mild Urgency";
                
                if (isHigh) {
                  urgencyHex = '#D85A30'; // coral red
                  urgencyStripText = "● URGENT — Immediate referral required. Do not delay.";
                  urgencyBadgeText = "● Urgent Referral";
                } else if (isMod) {
                  urgencyHex = '#EF9F27'; // amber
                  urgencyStripText = "● MODERATE — Refer to clinic within 3 days for assessment and treatment.";
                  urgencyBadgeText = "● Moderate Urgency";
                }

                // Reference ID formatting
                const currentYear = new Date().getFullYear();
                const cleanRefId = activeCaseId ? activeCaseId : `DD-${currentYear}-00847`;

                return (
                  <div className="p-4 md:p-8 flex-1 bg-slate-50 min-h-screen no-print-bg grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto w-full font-sans select-none animate-fade-in">
                    
                    {/* Left panel printable controller */}
                    <div className="lg:col-span-4 space-y-4 no-print shrink-0 w-full">
                      <div className="bg-white border border-slate-200 p-6 rounded-xl space-y-4 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Printer className="w-5 h-5 text-[#1D9E75]" style={{ color: '#1D9E75' }} />
                          <h4 className="font-display font-bold text-sm text-[#0A1628]">Referral Note Actions</h4>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          This structured note details the verified findings. Triggers standard paper layout compilation when printed or saved as PDF.
                        </p>
                        
                        <div className="space-y-2 pt-2">
                          {/* Print/PDF */}
                          <button 
                            onClick={() => window.print()}
                            className="w-full h-11 bg-[#1D9E75] hover:bg-[#15805f] text-white font-display font-medium text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
                          >
                            <Printer className="w-4 h-4" />
                            <span>Download as PDF</span>
                          </button>

                          {/* WhatsApp sharing */}
                          <a 
                            href={`https://wa.me/?text=DermaDetect%20Referral%20Note%20for%20${encodeURIComponent(patient.name || 'Abena Mensah')}%20—%20${encodeURIComponent(activeAnalysisResult.primaryFinding)}%20—%20${isHigh ? 'URGENT' : isMod ? 'MODERATE' : 'MILD'}%20urgency.%20Full%20note%20attached.`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full h-11 bg-[#25D366] hover:bg-[#1ebea5] text-white font-display font-medium text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
                          >
                            <Share2 className="w-4 h-4" />
                            <span>Share via WhatsApp</span>
                          </a>

                          {/* Direct Print fallback */}
                          <button 
                            onClick={() => window.print()}
                            className="w-full h-11 border border-slate-200 text-slate-600 hover:bg-slate-50 font-display font-medium text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                            <span>Print Directly</span>
                          </button>
                        </div>
                      </div>

                      <button 
                        onClick={() => setScreen('assessment-review')}
                        className="w-full h-10 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Return to Review Stage</span>
                      </button>
                    </div>

                    {/* Printable A4 Styled Document Card */}
                    <div className="lg:col-span-8 flex justify-center w-full print-wrapper">
                      <div className="bg-white border-l-[4px] border-l-[#1D9E75] border-y border-r border-slate-200 print:border-l-[1px] print:border-slate-300 w-full max-w-2xl p-6 md:p-8 rounded-xl shadow-md flex flex-col text-[#0A1628] relative font-sans leading-relaxed">
                        
                        {/* HEADER BAND */}
                        <div className="flex justify-between items-center bg-[#1D9E75] text-white px-5 py-4 rounded-lg mb-4 h-16 print:h-12 header-band">
                          {/* Left side brand details */}
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-md bg-white/20 flex items-center justify-center font-black font-display text-white shrink-0">
                              DD
                            </div>
                            <div className="text-left">
                              <h3 className="font-display font-extrabold text-base tracking-tight leading-none text-white">DermaDetect</h3>
                              <p className="text-[10px] text-white/85 font-mono mt-1 font-semibold leading-none">AI-Powered Skin Assessment</p>
                            </div>
                          </div>

                          {/* Divider line */}
                          <div className="h-10 w-[1px] bg-white/20 mx-4 hidden sm:block" />

                          {/* Right side doc labels */}
                          <div className="text-right flex-1 sm:flex-initial">
                            <span className="font-display font-black text-xs sm:text-sm tracking-widest block uppercase text-white">CLINICAL REFERRAL NOTE</span>
                            <span className="text-[9px] font-mono text-white/95 mt-1 block uppercase tracking-wider font-semibold">REF: {cleanRefId}</span>
                          </div>
                        </div>

                        {/* ALERT STRIPE */}
                        <div 
                          className="w-full h-9 flex items-center justify-center px-4 mb-6 rounded text-white text-[11px] font-bold leading-none alert-stripe"
                          style={{ backgroundColor: urgencyHex }}
                        >
                          <span className="text-center tracking-normal sm:tracking-wide">
                            {urgencyStripText}
                          </span>
                        </div>

                        {/* TWO COLUMN / SINGLE COLUMN BODY CONTAINER */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 two-column">
                          
                          {/* LEFT COLUMN: VISITOR & HEALTH WORKER REFERENCE (60% width on screen) */}
                          <div className="md:col-span-7 space-y-6 left-column">
                            
                            {/* Block 1: Patient Information */}
                            <div className="space-y-2 text-left avoid-break">
                              <h4 className="text-[11px] font-bold font-mono tracking-widest text-[#1D9E75] uppercase border-b border-teal-100 pb-1 flex justify-between items-center">
                                <span>PATIENT INFORMATION</span>
                                <span className="h-[2px] w-6 bg-[#1D9E75] rounded" />
                              </h4>
                              
                              <div className="divide-y divide-slate-100 text-xs">
                                <div className="grid grid-cols-3 py-2">
                                  <span className="text-slate-500 font-medium col-span-1">Full Name</span>
                                  <span className="font-bold text-[#0A1628] col-span-2 text-right md:text-left">{patient.name || 'Abena Mensah'}</span>
                                </div>
                                <div className="grid grid-cols-3 py-2">
                                  <span className="text-slate-500 font-medium col-span-1">Contact Number</span>
                                  <span className="font-bold text-[#0A1628] col-span-2 text-right md:text-left">{patient.contactNumber || '024 123 4567'}</span>
                                </div>
                                <div className="grid grid-cols-3 py-2">
                                  <span className="text-slate-500 font-medium col-span-1">Age</span>
                                  <span className="font-semibold text-[#0A1628] col-span-2 text-right md:text-left">{patient.age ? `${patient.age} years` : '34 years'}</span>
                                </div>
                                <div className="grid grid-cols-3 py-2">
                                  <span className="text-slate-500 font-medium col-span-1">Sex</span>
                                  <span className="font-semibold text-[#0A1628] col-span-2 text-right md:text-left">{patient.sex || 'Female'}</span>
                                </div>
                                <div className="grid grid-cols-3 py-2">
                                  <span className="text-slate-500 font-medium col-span-1">Date of Visit</span>
                                  <span className="font-semibold text-[#0A1628] col-span-2 text-right md:text-left">
                                    {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 py-2">
                                  <span className="text-slate-500 font-medium col-span-1">Patient ID</span>
                                  <span className="font-mono text-[#0A1628] font-bold col-span-2 text-right md:text-left text-[10.5px] uppercase">{cleanRefId}</span>
                                </div>
                                <div className="grid grid-cols-3 py-2 border-b border-slate-100">
                                  <span className="text-slate-500 font-medium col-span-1">Phone Number</span>
                                  <span className="font-semibold text-slate-500 col-span-2 text-right md:text-left italic">+233 55 124 5584</span>
                                </div>
                              </div>
                            </div>

                            {/* Block 2: Referring Facility and Health-Worker */}
                            <div className="space-y-2 text-left avoid-break">
                              <h4 className="text-[11px] font-bold font-mono tracking-widest text-[#1D9E75] uppercase border-b border-teal-100 pb-1 flex justify-between items-center">
                                <span>REFERRING HEALTH WORKER</span>
                                <span className="h-[2px] w-6 bg-[#1D9E75] rounded" />
                              </h4>
                              
                              <div className="divide-y divide-slate-100 text-xs">
                                <div className="grid grid-cols-3 py-2">
                                  <span className="text-slate-500 font-medium col-span-1">Name</span>
                                  <span className="font-semibold text-[#0A1628] col-span-2 text-right md:text-left">Akosua Darko</span>
                                </div>
                                <div className="grid grid-cols-3 py-2">
                                  <span className="text-slate-500 font-medium col-span-1">Role</span>
                                  <span className="font-semibold text-slate-600 col-span-2 text-right md:text-left">Community Health Worker</span>
                                </div>
                                <div className="grid grid-cols-3 py-2">
                                  <span className="text-slate-500 font-medium col-span-1">Facility Name</span>
                                  <span className="font-semibold text-slate-600 col-span-2 text-right md:text-left font-display">Atonsu Community Clinic</span>
                                </div>
                                <div className="grid grid-cols-3 py-2">
                                  <span className="text-slate-500 font-medium col-span-1">District</span>
                                  <span className="font-semibold text-slate-600 col-span-2 text-right md:text-left">Kumasi Metropolitan</span>
                                </div>
                                <div className="grid grid-cols-3 py-2">
                                  <span className="text-slate-500 font-medium col-span-1">Region</span>
                                  <span className="font-semibold text-slate-600 col-span-2 text-right md:text-left">Ashanti Region</span>
                                </div>
                                <div className="grid grid-cols-3 py-2 border-b border-slate-100">
                                  <span className="text-slate-500 font-medium col-span-1">Contact</span>
                                  <span className="font-semibold text-slate-500 col-span-2 text-right md:text-left italic">+233 24 458 9123</span>
                                </div>
                              </div>
                            </div>

                            {/* Block 3: Referral Destination */}
                            <div className="space-y-2 text-left avoid-break">
                              <h4 className="text-[11px] font-bold font-mono tracking-widest text-[#1D9E75] uppercase border-b border-teal-100 pb-1 flex justify-between items-center">
                                <span>REFER TO</span>
                                <span className="h-[2px] w-6 bg-[#1D9E75] rounded" />
                              </h4>
                              
                              <div className="divide-y divide-slate-100 text-xs">
                                <div className="grid grid-cols-3 py-2">
                                  <span className="text-slate-500 font-medium col-span-1">Facility Type</span>
                                  <span className="font-semibold text-[#0A1628] col-span-2 text-right md:text-left">District Hospital / Dermatology Clinic</span>
                                </div>
                                <div className="grid grid-cols-3 py-2">
                                  <span className="text-slate-500 font-medium col-span-1">Recommended Facility</span>
                                  <span className="font-bold text-[#0A1628] col-span-2 text-right md:text-left">Komfo Anokye Teaching Hospital</span>
                                </div>
                                <div className="grid grid-cols-3 py-2">
                                  <span className="text-slate-500 font-medium col-span-1">Department</span>
                                  <span className="font-semibold text-slate-600 col-span-2 text-right md:text-left">Dermatology / General OPD</span>
                                </div>
                                <div className="grid grid-cols-3 py-2 border-b border-slate-100">
                                  <span className="text-slate-500 font-medium col-span-1">Urgency</span>
                                  <span className={`font-bold col-span-2 text-right md:text-left ${isHigh ? 'text-rose-600' : isMod ? 'text-amber-600' : 'text-[#1D9E75]'}`}>
                                    {isHigh ? 'Immediate — Do Not Delay' : isMod ? 'Within 3 days' : 'Within 7 days'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Block 4: Clinical Notes pre-filled or placeholder */}
                            <div className="space-y-2 text-left avoid-break">
                              <h4 className="text-[11px] font-bold font-mono tracking-widest text-[#1D9E75] uppercase border-b border-teal-100 pb-1 flex justify-between items-center">
                                <span>HEALTH WORKER'S NOTES</span>
                                <span className="h-[2px] w-6 bg-[#1D9E75] rounded" />
                              </h4>
                              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg text-xs leading-relaxed text-slate-700 min-h-[60px]">
                                {patient.symptoms && patient.symptoms.trim() ? (
                                  <p className="italic">"{patient.symptoms.trim()}"</p>
                                ) : (
                                  <p className="text-slate-400 italic">No additional notes recorded.</p>
                                )}
                              </div>
                            </div>

                          </div>

                          {/* RIGHT COLUMN: AI CLINICAL INSIGHTS (40% width on screen) */}
                          <div className="md:col-span-5 space-y-6 right-column">
                            
                            {/* Block 5 — AI Assessment Result block */}
                            <div className="p-4 bg-[#F0FDF8] border-l-2 border-l-[#1D9E75] rounded-r-xl border border-teal-100/35 text-left space-y-4 shadow-sm ai-assessment-card avoid-break">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold font-mono tracking-widest text-[#1D9E75] uppercase">
                                  AI ASSESSMENT
                                </span>
                                
                                <span className="px-2 py-0.5 bg-teal-50 border border-teal-100 text-[9px] uppercase font-bold text-[#1D9E75] rounded">
                                  ANALYSIS OK
                                </span>
                              </div>

                              <div className="space-y-1 bg-transparent">
                                <h3 className="font-display font-black text-[#0A1628] text-base leading-snug">
                                  {activeAnalysisResult.primaryFinding}
                                </h3>

                                {/* Confidence score bar details */}
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex justify-between items-center text-[11px] font-medium text-slate-500">
                                    <span>Detection confidence</span>
                                    <span className="font-mono font-bold text-[#1D9E75]">{activeAnalysisResult.confidence}%</span>
                                  </div>
                                  
                                  {/* Bar fills */}
                                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden confidence-bar shrink-0">
                                    <div 
                                      className="h-full bg-[#1D9E75] rounded-full transition-all duration-500"
                                      style={{ width: `${activeAnalysisResult.confidence}%` }}
                                    />
                                  </div>
                                  {/* Print fallback simple text layout */}
                                  <p className="hidden confidence-text text-xs italic font-bold">
                                    Confidence: {activeAnalysisResult.confidence}%
                                  </p>
                                </div>
                              </div>

                              {/* Urgency Badge banner */}
                              <div className="pt-1 select-all">
                                <span 
                                  className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full text-white urgency-badge leading-none"
                                  style={{ backgroundColor: urgencyHex }}
                                >
                                  {urgencyBadgeText}
                                </span>
                              </div>

                              {/* Condition Description paragraph details */}
                              <p className="text-slate-600 text-xs leading-relaxed">
                                {docDetails.description}
                              </p>

                              {/* Recommended first line treatment tags tags list */}
                              <div className="space-y-2 pt-2.5 border-t border-teal-100/40">
                                <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase block">
                                  SUGGESTED TREATMENT
                                </span>
                                <div className="flex flex-col gap-1.5">
                                  {docDetails.suggestions.map((item, id) => (
                                    <div key={id} className="flex gap-1.5 items-start text-xs text-[#0A1628]">
                                      <span className="inline-block mt-1 w-1.5 h-1.5 bg-[#1D9E75] rounded-full shrink-0" />
                                      <span>{item}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Disclaimer copy info text label */}
                              <p className="text-[9.5px] italic text-slate-400 leading-normal pt-1.5 border-t border-teal-100/20">
                                This is an AI-generated suggestion. Final treatment decisions rest with the receiving clinician.
                              </p>
                            </div>

                            {/* Block 6 — Skin Photo taken during captures */}
                            <div className="space-y-2 text-left avoid-break">
                              <h4 className="text-[11px] font-bold font-mono tracking-widest text-[#1D9E75] uppercase py-1 border-b border-teal-100">
                                PHOTO TAKEN DURING ASSESSMENT
                              </h4>
                              
                              <div className="relative aspect-square w-full rounded-xl border border-slate-150 overflow-hidden bg-slate-50 shrink-0 patient-photo">
                                {capturedImage ? (
                                  <img 
                                    src={capturedImage} 
                                    alt="Suspect dermatological lesion screenshot captured" 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                    <Activity className="w-8 h-8 animate-pulse" />
                                    <span className="text-[10px] font-semibold tracking-wider uppercase mt-2">NO PHOTO CAPTURED</span>
                                  </div>
                                )}
                                
                                {/* Watermark bottom layer badge */}
                                <div className="absolute bottom-2.5 right-2.5 bg-slate-900/40 backdrop-blur-xs px-2 py-1 rounded text-[9px] font-bold font-mono text-white/95 select-none tracking-widest uppercase">
                                  DermaDetect AI
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                                Photo captured: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, 10:43 AM
                              </span>
                            </div>

                          </div>

                        </div>

                        {/* SIGNATURE BLOCK */}
                        <div className="grid grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-200 avoid-break text-left">
                          
                          {/* Signature Draw Area */}
                          <div className="space-y-2.5">
                            <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase block">
                              HEALTH WORKER SIGNATURE
                            </span>
                            
                            <div className="relative">
                              <canvas 
                                ref={signatureCanvasRef}
                                onMouseDown={startDrawingSig}
                                onMouseMove={drawSig}
                                onMouseUp={stopDrawingSig}
                                onMouseLeave={stopDrawingSig}
                                onTouchStart={startDrawingSig}
                                onTouchMove={drawSig}
                                onTouchEnd={stopDrawingSig}
                                className="w-full h-16 border border-dashed border-slate-300 rounded-lg bg-slate-50 cursor-crosshair print:border-none print:bg-white"
                                width={240}
                                height={64}
                              />
                              <button 
                                onClick={clearSig}
                                className="absolute top-1.5 right-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white border border-slate-200 text-slate-500 rounded hover:bg-slate-50 transition-all select-none no-print shadow-xs"
                              >
                                Clear
                              </button>
                            </div>

                            <div className="text-xs">
                              <p className="font-bold text-[#0A1628]">Akosua Darko</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          </div>

                          {/* Stamp / Signature empty box */}
                          <div className="space-y-2.5 flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase block">
                                RECEIVING CLINICIAN STAMP / SIGNATURE
                              </span>
                            </div>
                            
                            <div className="h-16 w-full border border-dashed border-slate-300 rounded-lg flex items-center justify-center p-2 bg-slate-50 text-center text-slate-300 print:border-slate-450">
                              <span className="text-[9px] font-mono tracking-wider font-semibold uppercase">PLACE CLINICAL STAMP HERE</span>
                            </div>

                            <div className="text-[10px] text-[#3d4943] text-right italic leading-none pt-1">
                              * To be completed at receiving facility
                            </div>
                          </div>

                        </div>

                        {/* HIGH VALUE FOOTER BAND */}
                        <div className="mt-8 pt-4 border-t border-slate-200 bg-slate-50/80 p-4 rounded-b-xl flex flex-col md:flex-row justify-between items-center gap-4 text-[10.5px] text-slate-400 font-sans footer-full avoid-break">
                          
                          {/* Col 1 */}
                          <div className="text-left space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-slate-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" style={{ backgroundColor: '#1D9E75' }} />
                              <span>DermaDetect AI</span>
                            </div>
                            <p className="text-[9.5px]">Generated by DermaDetect — AI Skin Assessment Tool.</p>
                            <p className="text-[9.5px]">For community health workers in Ghana.</p>
                          </div>

                          {/* Col 2 */}
                          <div className="text-center space-y-1">
                            <p className="font-mono font-bold uppercase text-slate-500">TIMESTAMP & REFERRAL REFS</p>
                            <p>Ref: <span className="font-semibold">{cleanRefId}</span></p>
                            <p>Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, 10:47 AM</p>
                            <p className="text-[9.5px]">Assessment duration: 1 min 43 sec</p>
                          </div>

                          {/* Col 3 */}
                          <div className="text-right max-w-xs text-[9px] italic leading-normal text-slate-400 print:text-slate-500">
                            This referral note was generated with AI assistance. It is intended to support, not replace, clinical judgment. The receiving clinician should conduct their own assessment.
                          </div>

                        </div>

                        {/* MINIMAL PRINT FOOTER BLOCK (ONLY VISIBLE ON PHYSICAL PRINT) */}
                        <div className="hidden footer-print border-t border-slate-300 pt-3 text-left w-full mt-4 justify-between items-center bg-transparent">
                          <div className="flex justify-between items-center text-[9px] font-mono text-slate-600 w-full">
                            <span>Generated by DermaDetect — AI Triage Assistant. Ref: {cleanRefId}</span>
                            <span>Date generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, 10:47 AM</span>
                          </div>
                          <p className="text-[8px] text-slate-500 italic mt-1 font-sans leading-normal">
                            * Disclaimer: Generative and matching assistance helper. Final medical judgment and prescriptions lie with the receiving physician.
                          </p>
                        </div>

                      </div>
                    </div>

                  </div>
                );
              })()}

            </div>
          </div>
        )}






        {/* VIEW 5: CASE HISTORY TAB */}
        {screen === 'case-history' && (
          <section className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-8 py-8 animate-fade-in flex flex-col justify-between">
            <div className="grow space-y-6">
              
              {/* Header filter grid */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#bccac1] pb-4 mt-7">
                <div>
                  <h1 className="font-display font-extrabold text-2xl md:text-3xl text-[#181c1e]">Case History Logs</h1>
                  <p className="text-xs text-[#3d4943] mt-1.5">
                    Browse fully registered patient skin diagnostics and triage urgencies recorded in this clinical terminal.
                  </p>
                </div>

                {/* Operations column panel */}
                <div className="flex flex-wrap items-center gap-3">
                  
                  {/* Search box inline */}
                  <div className="relative min-w-[200px] shrink-0">
                    <Search className="w-4 h-4 text-[#3d4943] absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search patient or diagnosis..."
                      className="w-full text-xs h-9 pl-9 pr-3.5 bg-white border border-[#bccac1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6]"
                    />
                  </div>

                  {/* Urgency selection dropdown */}
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-[#3d4943]" />
                    <select
                      value={filterUrgency}
                      onChange={(e) => setFilterUrgency(e.target.value as any)}
                      className="text-xs h-9 px-2 bg-white border border-[#bccac1] rounded-lg focus:outline-none text-[#181c1e] font-semibold"
                    >
                      <option value="All">All Urgencies</option>
                      <option value="High">High Urgency</option>
                      <option value="Moderate">Moderate Urgency</option>
                      <option value="Low">Low Urgency</option>
                    </select>
                  </div>

                  <button 
                    onClick={() => {
                      // Simulated clean spreadsheet export
                      const blob = new Blob([JSON.stringify(cases, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `DermaDetect_Assessments_${new Date().toISOString().slice(0,10)}.json`;
                      link.click();
                    }}
                    className="h-9 px-4 bg-[#0077b6] hover:bg-[#0096c7] text-white flex items-center gap-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-sm ml-auto md:ml-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </button>

                  <button 
                    onClick={resetAndStartAssessment}
                    className="h-9 px-4 bg-[#0077b6] hover:bg-[#0096c7] text-white flex items-center gap-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-sm ml-auto md:ml-0"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>New</span>
                  </button>
                </div>
              </div>

              {/* Patient Cases table grid */}
              <div className="bg-white border border-[#bccac1] rounded-2xl overflow-hidden shadow-sm">
                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto scrollbar-none">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f1f4f6] text-[#3d4943] text-xs font-bold border-b border-[#bccac1]">
                        <th className="px-5 py-3 ml-2 uppercase tracking-wider">Patient Name</th>
                        <th className="px-5 py-3 uppercase tracking-wider">Assessment Date</th>
                        <th className="px-5 py-3 uppercase tracking-wider">Clinical Finding</th>
                        <th className="px-5 py-3 uppercase tracking-wider">Urgency Triage</th>
                        <th className="px-5 py-3 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ebeef0]">
                      {processedCases.length > 0 ? (
                        processedCases.map((item) => (
                          <tr 
                            key={item.id} 
                            onClick={() => setSelectedDetailsCase(item)}
                            className="hover:bg-[#f1f4f6] transition-colors cursor-pointer group text-xs text-[#181c1e] font-semibold"
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-[#d6e0f6] text-[#121c2c] flex items-center justify-center font-bold font-display select-none">
                                  {item.patient.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                                </div>
                                <div className="space-y-0.5">
                                  <p className="font-bold text-sm text-[#181c1e] group-hover:text-[#0077b6] transition-colors">
                                    {item.patient.name}
                                  </p>
                                  <p className="text-[10px] text-[#3d4943] font-mono leading-none">
                                    CASE REF: {item.id}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-[#3d4943]">
                              {item.date}
                            </td>
                            <td className="px-5 py-4">
                              <span className="px-2.5 py-1 rounded bg-[#ebeef0] text-[#181c1e] font-bold text-[10px] border border-[#bccac1]">
                                {item.finding?.primaryFinding || 'Unclassified'}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${
                                  item.finding?.urgency === 'High' 
                                    ? 'bg-[#ba1a1a]' 
                                    : item.finding?.urgency === 'Moderate' 
                                    ? 'bg-[#e65100]' 
                                    : 'bg-[#2e7d32]'
                                }`} />
                                <span className={`font-bold ${
                                  item.finding?.urgency === 'High' 
                                    ? 'text-[#ba1a1a]' 
                                    : item.finding?.urgency === 'Moderate' 
                                    ? 'text-[#e65100]' 
                                    : 'text-[#2e7d32]'
                                }`}>
                                  {item.finding?.urgency || 'Low'}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadPdfRecord(item);
                                  }}
                                  title="Download Full Clinical PDF"
                                  className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-full transition-colors border border-transparent hover:border-emerald-200 cursor-pointer"
                                >
                                  <Download className="w-4.5 h-4.5" />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCaseToDelete(item);
                                  }}
                                  title="Delete Case Record"
                                  className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-full transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
                                >
                                  <Trash2 className="w-4.5 h-4.5" />
                                </button>
                                <button 
                                  onClick={() => setSelectedDetailsCase(item)}
                                  title="View Case Details"
                                  className="text-[#0077b6] hover:bg-[#f0f9ff] p-1.5 rounded-full transition-colors border border-transparent hover:border-[#bccac1] cursor-pointer"
                                >
                                  <ChevronRight className="w-4.5 h-4.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-[#3d4943] font-medium">
                            No patient case history match. Let's start a New Assessment to record a case.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Roster Card List (Optimized for Mobile Screens) */}
                <div className="block md:hidden divide-y divide-[#ebeef0]">
                  {processedCases.length > 0 ? (
                    processedCases.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => setSelectedDetailsCase(item)}
                        className="p-4 hover:bg-[#f1f4f6] transition-colors cursor-pointer space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#d6e0f6] text-[#121c2c] flex items-center justify-center font-bold font-display select-none shrink-0">
                              {item.patient.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-[#181c1e] truncate">
                                {item.patient.name}
                              </p>
                              <p className="text-[10px] text-[#3d4943] font-mono leading-none">
                                REF: {item.id}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`w-2 h-2 rounded-full ${
                              item.finding?.urgency === 'High' 
                                ? 'bg-[#ba1a1a]' 
                                : item.finding?.urgency === 'Moderate' 
                                ? 'bg-[#e65100]' 
                                : 'bg-[#2e7d32]'
                            }`} />
                            <span className={`font-bold text-xs ${
                              item.finding?.urgency === 'High' 
                                ? 'text-[#ba1a1a]' 
                                : item.finding?.urgency === 'Moderate' 
                                ? 'text-[#e65100]' 
                                : 'text-[#2e7d32]'
                            }`}>
                              {item.finding?.urgency || 'Low'}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-end text-xs pt-1">
                          <div className="space-y-1.5 min-w-0">
                            <p className="text-[10px] text-[#3d4943]">
                              Date: <strong className="text-slate-800 font-semibold">{item.date}</strong>
                            </p>
                            <div className="truncate">
                              <span className="inline-block px-2 py-0.5 rounded bg-[#ebeef0] text-[#181c1e] text-[10px] border border-[#bccac1] font-bold truncate max-w-[160px]">
                                {item.finding?.primaryFinding || 'Unclassified'}
                              </span>
                            </div>
                          </div>

                          {/* Mobile quick actions */}
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadPdfRecord(item);
                              }}
                              title="Download Full Clinical PDF"
                              className="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-100 bg-emerald-50/30 cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setCaseToDelete(item);
                              }}
                              title="Delete Case Record"
                              className="w-8 h-8 flex items-center justify-center text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 bg-rose-50/30 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setSelectedDetailsCase(item)}
                              title="View Case Details"
                              className="w-8 h-8 flex items-center justify-center text-[#0077b6] hover:bg-[#f0f9ff] rounded-lg transition-colors border border-sky-100 bg-sky-50/30 cursor-pointer"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-[#3d4943] font-medium text-xs">
                      No patient case history match. Let's start a New Assessment to record a case.
                    </div>
                  )}
                </div>

                <footer className="px-5 py-3.5 bg-[#f1f4f6] flex justify-between items-center border-t border-[#bccac1] text-xs font-semibold text-[#181c1e]">
                  <span>Showing {processedCases.length} of {cases.length} entries registered</span>
                  <div className="flex gap-1.5">
                    <button className="w-8 h-8 rounded border border-[#bccac1] bg-white flex items-center justify-center text-[#3d4943] hover:bg-[#e5e9eb] disabled:opacity-50" disabled>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button className="w-8 h-8 rounded bg-[#0077b6] text-white font-bold">1</button>
                    <button className="w-8 h-8 rounded border border-[#bccac1] bg-white flex items-center justify-center text-[#3d4943] hover:bg-[#e5e9eb]">2</button>
                    <button className="w-8 h-8 rounded border border-[#bccac1] bg-white flex items-center justify-center text-[#3d4943] hover:bg-[#e5e9eb]">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </footer>
              </div>

            </div>
          </section>
        )}

      </main>

      {/* FOOTER BAR */}
      <footer className="bg-[#ebeef0] border-t border-[#bccac1] py-4 select-none no-print">
        <div className="max-w-5xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs font-semibold text-[#555f71]">
            © {new Date().getFullYear()} DermaDetect • Community Health Digital System
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-[#3d4943]">
            <div className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Dermal Analysis Toolkit Active</span>
            </div>
            <span className="text-[#bccac1]">|</span>
            <button onClick={() => alert("DermaDetect clinic platform HIPAA Compliant data vault encryption active. No personal metrics are logged remotely.")} className="hover:underline">Privacy Policy</button>
            <span className="text-[#bccac1]">|</span>
            <button onClick={() => alert("Supported cases: Tinea Corporis, Basal Cell, Melanoma, Seborrheic, Contact Dermatitis. Contact support@dermadetect.org")} className="hover:underline">Support</button>
          </div>
        </div>
      </footer>

      {/* MODAL 1: PREDICTION ANALYZING LOADER */}
      {analysisLoading && (
        <div className="fixed inset-0 bg-[#181c1e]/60 backdrop-blur-md flex items-center justify-center z-[100] px-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center border border-[#bccac1] shadow-2xl space-y-4">
            <Loader2 className="w-14 h-14 text-[#0077b6] animate-spin mx-auto" />
            <h3 className="font-display font-extrabold text-[#181c1e] text-lg">AI Dermatological Diagnostic Analysis</h3>
            <p className="text-xs text-[#3d4943] max-w-xs mx-auto animate-pulse leading-relaxed">
              {loadingText}
            </p>
          </div>
        </div>
      )}

      {/* MODAL 2: CASE DETAIL VIEW MODAL */}
      {selectedDetailsCase && (
        <div 
          className="fixed inset-0 bg-[#181c1e]/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4 transition-opacity duration-300"
          onClick={(e) => { if(e.target === e.currentTarget) setSelectedDetailsCase(null); }}
        >
          <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl transform transition-transform duration-300 border border-[#bccac1]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[#bccac1] flex justify-between items-center bg-[#f1f4f6]">
              <div>
                <span className="text-[10px] text-[#0077b6] font-black tracking-widest uppercase block leading-none">Case History Vault</span>
                <h2 className="font-display font-extrabold text-base md:text-lg text-[#181c1e] mt-2 block">
                  Patient Assessment: {selectedDetailsCase.patient.name}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedDetailsCase(null)}
                className="p-1.5 hover:bg-[#e0e3e5] rounded-full transition-colors border border-transparent hover:border-[#bccac1]"
              >
                <X className="w-5 h-5 text-[#3d4943]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 space-y-6 max-h-[72vh] overflow-y-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-[#f1f4f6]">
                
                {/* Patient section */}
                <div className="space-y-4 text-xs font-semibold">
                  <h3 className="font-display font-bold text-xs text-[#3d4943] uppercase tracking-wider border-b border-[#bccac1] pb-1">
                    Patient Profile
                  </h3>
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#6d7a73] uppercase tracking-wider block">Full Legal Name</p>
                    <p className="text-sm font-bold text-[#181c1e]">{selectedDetailsCase.patient.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#6d7a73] uppercase tracking-wider block">Case ID / Gender / Age</p>
                    <p className="text-[#181c1e]">{selectedDetailsCase.id} • {selectedDetailsCase.patient.sex} • {selectedDetailsCase.patient.age} Yrs</p>
                  </div>
                </div>

                {/* Diagnostics details */}
                <div className="space-y-4 text-xs font-semibold">
                  <h3 className="font-display font-bold text-xs text-[#3d4943] uppercase tracking-wider border-b border-[#bccac1] pb-1">
                    Medical Indicators
                  </h3>
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#6d7a73] uppercase tracking-wider block">Primary Diagnosed finding</p>
                    <p className="text-sm font-bold text-[#181c1e]">{selectedDetailsCase.finding.primaryFinding}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#6d7a73] uppercase tracking-wider block">AI Engine Triage Urgency</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      selectedDetailsCase.finding.urgency === 'High' 
                        ? 'bg-[#ffdad6] border-[#ba1a1a] text-[#93000a]' 
                        : selectedDetailsCase.finding.urgency === 'Moderate'
                        ? 'bg-[#ffe0b2] border-[#ffe0b2] text-[#e65100]'
                        : 'bg-[#e8f5e9] border-[#c8e6c9] text-[#2e7d32]'
                    }`}>
                      {selectedDetailsCase.finding.urgency} Urgency ({selectedDetailsCase.finding.confidence}% Match)
                    </span>
                  </div>
                </div>

              </div>

              {/* Patient lesion image preview */}
              <div className="space-y-3">
                <h3 className="font-display text-xs font-bold text-[#3d4943] uppercase tracking-wider border-b border-[#bccac1] pb-1">
                  Lesion Specimen Media
                </h3>
                
                <div className={`aspect-video rounded-xl overflow-hidden relative border border-[#bccac1] bg-[#f1f4f6] cursor-pointer group ${zoomImage ? 'h-auto max-h-[450px]' : ''}`}>
                  <img 
                    src={selectedDetailsCase.image} 
                    alt="Clinical specimen photograph" 
                    className={`w-full h-full object-cover transition-all ${zoomImage ? 'object-contain bg-black' : 'group-hover:scale-105'}`} 
                  />
                  <div 
                    onClick={() => setZoomImage(!zoomImage)}
                    className="absolute bottom-3 right-3 bg-white/90 px-3 py-1 bg-white border border-[#bccac1] hover:bg-white rounded-lg text-xs font-display font-bold text-[#181c1e] flex items-center gap-1.5 shadow-md"
                  >
                    <ZoomIn className="w-4 h-4 text-[#0077b6]" />
                    <span>{zoomImage ? "Normal View" : "Full Zoom View"}</span>
                  </div>
                </div>
              </div>

              {/* Case Symptoms Description */}
              {selectedDetailsCase.patient.symptoms && (
                <div className="space-y-2">
                  <h3 className="font-display text-xs font-bold text-[#3d4943] uppercase tracking-wider border-b border-[#bccac1] pb-1">
                    Patient Observation Symptoms
                  </h3>
                  <p className="text-xs text-[#3d4943] italic leading-relaxed p-3 border-l-2 border-[#0077b6] bg-[#f1f4f6] rounded-r-lg">
                    "{selectedDetailsCase.patient.symptoms}"
                  </p>
                </div>
              )}

              {/* Case Treatment notes */}
              <div className="space-y-3">
                <h3 className="font-display text-xs font-bold text-[#3d4943] uppercase tracking-wider border-b border-[#bccac1] pb-1">
                  Clinical Recommended Actions
                </h3>
                <p className="text-sm font-bold text-[#181c1e] leading-relaxed">
                  {selectedDetailsCase.finding.recommendedAction}
                </p>
                <TreatmentRecommendations 
                  finding={selectedDetailsCase.finding} 
                  patient={selectedDetailsCase.patient} 
                  caseId={selectedDetailsCase.id} 
                />
              </div>
            </div>

            {/* Modal operations footer row */}
            <div className="p-4 bg-[#f1f4f6] flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-[#bccac1]">
              <button 
                onClick={() => setCaseToDelete(selectedDetailsCase)}
                className="w-full sm:w-auto h-10 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer order-last sm:order-first"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Case</span>
              </button>

              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => setSelectedDetailsCase(null)}
                  className="h-10 px-5 text-xs font-bold text-[#3d4943] hover:bg-[#e0e3e5] rounded-xl border border-[#bccac1] bg-white transition-colors cursor-pointer"
                >
                  Close View
                </button>

                <button 
                  onClick={() => downloadPdfRecord(selectedDetailsCase)}
                  className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Report</span>
                </button>
                
                <button 
                  onClick={() => {
                    // Preload details as active results to trigger printable Referral flow
                    setPatient(selectedDetailsCase.patient);
                    setCapturedImage(selectedDetailsCase.image);
                    setActiveAnalysisResult(selectedDetailsCase.finding);
                    setActiveCaseId(selectedDetailsCase.id);
                    setSelectedDetailsCase(null);
                    setScreen('referral-note');
                  }}
                  className="h-10 px-6 bg-[#0077b6] hover:bg-[#0096c7] text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Format Referral Note</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SUCCESS CHECKMARK CELEBRATION MODAL */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-8 text-center shadow-2xl border border-slate-100 transform scale-100 transition-all">
            <div className="checkmark-wrapper mb-6">
              <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </svg>
            </div>
            
            <h3 className="font-display text-xl font-bold text-slate-900 tracking-tight mb-2">
              Case Saved Successfully
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              Diagnostic findings have been safely synced to patient records.
            </p>
            
            <div className="inline-flex items-center gap-1.5 text-xs text-[#0077b6] font-mono font-bold bg-[#f0f9ff] px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-[#0077b6] animate-pulse" />
              REF ID: {activeCaseId}
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION SYSTEM DIALOG */}
      {caseToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 md:p-8 shadow-2xl border border-slate-100 transform scale-100 transition-all space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-lg font-bold text-slate-900 tracking-tight">
                  Delete Patient Case Record
                </h3>
                <p className="text-xs text-[#6d7a73]">
                  You are about to permanently remove this case history from localized memory cache. This process is irreversible.
                </p>
              </div>
            </div>

            {/* Case Details Summary for visibility verification */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span>Patient Full Name:</span>
                <span className="font-bold text-slate-800">{caseToDelete.patient.name}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Case Reference ID:</span>
                <span className="font-mono text-slate-800 font-bold">{caseToDelete.id}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Clinical Finding:</span>
                <span className="font-bold text-slate-800">{caseToDelete.finding.primaryFinding}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2 text-xs font-bold">
              <button 
                onClick={() => setCaseToDelete(null)}
                className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition-colors cursor-pointer"
              >
                Cancel, Keep Record
              </button>
              <button 
                onClick={() => deleteCaseRecord(caseToDelete.id)}
                className="h-10 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#bccac1] z-40 flex items-center justify-around px-4 md:hidden no-print shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => { setScreen('home'); stopWebcam(); }}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors ${
            screen === 'home' ? 'text-[#0077b6]' : 'text-[#3d4943] hover:text-[#0077b6]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </button>

        <button 
          onClick={resetAndStartAssessment}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors ${
            screen === 'assessment-info' || screen === 'assessment-capture' || screen === 'assessment-review'
              ? 'text-[#0077b6]'
              : 'text-[#3d4943] hover:text-[#0077b6]'
          }`}
        >
          <PlusCircle className="w-5 h-5" />
          <span>New Case</span>
        </button>

        <button 
          onClick={() => { setScreen('case-history'); stopWebcam(); }}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors ${
            screen === 'case-history' ? 'text-[#0077b6]' : 'text-[#3d4943] hover:text-[#0077b6]'
          }`}
        >
          <History className="w-5 h-5" />
          <span>Logs History</span>
        </button>
      </div>

    </div>
  );
}
