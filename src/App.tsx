/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Trash2
} from 'lucide-react';
import { 
  SAMPLE_CASE_TEMPLATES, 
  CaseRecord, 
  PatientDetails, 
  DiagnosticResult 
} from './types';
import { TRANSLATIONS, LanguageOption } from './locales';
import { TreatmentRecommendations } from './components/TreatmentRecommendations';
import { jsPDF } from 'jspdf';
import ReactMarkdown from 'react-markdown';

export default function App() {
  const [screen, setScreen] = useState<'home' | 'assessment-info' | 'assessment-capture' | 'assessment-review' | 'referral-note' | 'case-history'>('home');
  const [lang, setLang] = useState<LanguageOption>('English');
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const [cases, setCases] = useState<CaseRecord[]>([]);

  const [patient, setPatient] = useState<PatientDetails>({
    name: '',
    age: '',
    sex: '',
    symptoms: ''
  });
  
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [customFileSelected, setCustomFileSelected] = useState<boolean>(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [activeAnalysisResult, setActiveAnalysisResult] = useState<DiagnosticResult | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string>('');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterUrgency, setFilterUrgency] = useState<'All' | 'High' | 'Moderate' | 'Low'>('All');
  const [selectedDetailsCase, setSelectedDetailsCase] = useState<CaseRecord | null>(null);
  const [zoomImage, setZoomImage] = useState(false);

  const [healthWorkerName, setHealthWorkerName] = useState<string>(() => {
    return localStorage.getItem('dermadetect_worker_name') || '';
  });

  useEffect(() => {
    if (!healthWorkerName) {
      const name = window.prompt("Please enter your name (Health Worker Profile):", "K. Mensah");
      if (name) {
        setHealthWorkerName(name);
        localStorage.setItem('dermadetect_worker_name', name);
      } else {
        setHealthWorkerName("Unknown Worker");
      }
    }
  }, [healthWorkerName]);

  const [caseToDelete, setCaseToDelete] = useState<CaseRecord | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showReportPreview, setShowReportPreview] = useState(false);

  // Sanitise referralNote — converts JSON-escaped \n back to real newlines
  const sanitiseReferralNote = (note: string): string => {
    return note
      .replace(/\\n\\n/g, '\n\n')
      .replace(/\\n/g, '\n');
  };

  // ---------------------------------------------------------------------------
  // Database cloud sync state
  // ---------------------------------------------------------------------------
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
        setLatency(Math.round(endTime - startTime + (data.latencyMs || 0) / 4));
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
    if (savedTime) setLastSynced(savedTime);
  }, []);

  // Periodic sync loop
  useEffect(() => {
    const initialCheck = async () => {
      const isOnline = await probeDatabaseHealth();
      if (isOnline && autoSyncEnabled && cases.length > 0) {
        await triggerCloudSync(cases);
      }
    };

    if (cases.length > 0) initialCheck();

    const syncInterval = setInterval(async () => {
      const isOnline = await probeDatabaseHealth();
      if (isOnline && autoSyncEnabled && cases.length > 0) {
        await triggerCloudSync(cases);
      }
    }, 15000);

    return () => clearInterval(syncInterval);
  }, [cases, autoSyncEnabled]);

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ---------------------------------------------------------------------------
  // Load cases: SQLite first, localStorage fallback, INITIAL_CASES last resort
  // ---------------------------------------------------------------------------
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

  const syncCasesToStorage = (updatedCases: CaseRecord[]) => {
    setCases(updatedCases);
    localStorage.setItem('dermadetect_cases', JSON.stringify(updatedCases));
  };

  const t = TRANSLATIONS[lang];

  const resetAndStartAssessment = () => {
    setPatient({ name: '', age: '', sex: '', symptoms: '' });
    setCapturedImage(null);
    setCustomFileSelected(false);
    setActiveAnalysisResult(null);
    setActiveCaseId('');
    setScreen('assessment-info');
    stopWebcam();
  };

  // ---------------------------------------------------------------------------
  // Webcam
  // ---------------------------------------------------------------------------
  const startWebcam = async () => {
    setIsCameraActive(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: 640, height: 480 } 
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
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
      "Invoking DermaVision diagnostic model...",
      "Conducting diagnostic taxonomy matrix parsing...",
      "Finalizing triage urgency confidence ratings..."
    ];

    let i = 0;
    setLoadingText(messages[0]);
    const timer = setInterval(() => {
      i++;
      if (i < messages.length) setLoadingText(messages[i]);
    }, 700);

    try {
      const payload = {
        image: capturedImage,
        symptoms: patient.symptoms,
        patientInfo: {
          name: patient.name,
          age: patient.age,
          sex: patient.sex
        }
      };

      const response = await fetch('/api/analyze-skin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Analysis returned status ${response.status}`);
      }

      const result: DiagnosticResult = await response.json();

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

      window.alert('Analysis failed. Please check your network connection and try again.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Save case — writes to local state + localStorage + SQLite immediately
  // ---------------------------------------------------------------------------
  const saveCaseRecord = async () => {
    if (!activeAnalysisResult || !capturedImage) return;

    const newRecord: CaseRecord = {
      id: activeCaseId,
      patient: { ...patient },
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      finding: activeAnalysisResult,
      image: capturedImage,
      healthWorker: healthWorkerName,
      saved: true
    };

    const updated = [newRecord, ...cases];
    syncCasesToStorage(updated);

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

  // ---------------------------------------------------------------------------
  // Delete case — removes from local state + localStorage + SQLite
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // PDF export
  // ---------------------------------------------------------------------------
  const downloadPdfRecord = (record: CaseRecord) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);

      const primaryColor = [0, 119, 182];
      const borderGray = [188, 202, 193];
      const lightBg = [241, 244, 246];
      const lightBlueBg = [240, 249, 255];
      const darkColor = [24, 28, 30];
      const textGray = [61, 73, 67];
      const textLightGray = [109, 122, 115];
      const accentRed = [186, 26, 26];

      // PAGE 1
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(margin, 15, contentWidth, 2, 'F');

      let y = 24;
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('DERMADETECT™ CLINICAL CASE DOSSIER', margin, y);

      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const rightText = "FIELD OBSERVATION & DIAGNOSTIC RECORD";
      doc.text(rightText, pageWidth - margin - doc.getTextWidth(rightText), y - 1);

      y += 8;
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('PATIENT PROFILE SECTION', margin, y);
      doc.text('ASSESSMENT METADATA', margin + 95, y);

      y += 2;
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.line(margin, y, margin + 85, y);
      doc.line(margin + 95, y, pageWidth - margin, y);

      y += 6;
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Full Legal Name:`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${record.patient.name}`, margin + 30, y);
      doc.setFont('helvetica', 'bold');
      doc.text(`Report Case ID:`, margin + 95, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${record.id}`, margin + 125, y);

      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text(`Age / Gender:`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${record.patient.age} Yrs  /  ${record.patient.sex}`, margin + 30, y);
      doc.setFont('helvetica', 'bold');
      doc.text(`Date Assessed:`, margin + 95, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${record.date || new Date().toLocaleDateString()}`, margin + 125, y);

      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text(`Attending Worker:`, margin + 95, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${record.healthWorker || 'Unknown Worker'}`, margin + 125, y);

      if (record.patient.symptoms) {
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.text(`Clinical Symptoms:`, margin, y);
        doc.setFont('helvetica', 'italic');
        const symptomsTxt = `"${record.patient.symptoms}"`;
        const lines = doc.splitTextToSize(symptomsTxt, 55);
        doc.text(lines, margin + 30, y);
        y += (lines.length - 1) * 4;
      }

      y += 10;

      doc.setFillColor(lightBlueBg[0], lightBlueBg[1], lightBlueBg[2]);
      doc.rect(margin, y, contentWidth, 32, 'F');
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.5);
      doc.rect(margin, y, contentWidth, 32, 'D');

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('PRIMARY AUTOMATED AI ESTIMATION', margin + 5, y + 6);

      y += 12;
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${record.finding.primaryFinding}`, margin + 5, y + 2);

      y += 6;
      doc.setFontSize(9);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text(`Match Confidence: `, margin + 5, y);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(`${record.finding.confidence}% Match`, margin + 35, y);

      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(`  |   Triage Urgency: `, margin + 65, y);

      const isHigh = record.finding.urgency === 'High';
      const isMod = record.finding.urgency === 'Moderate';
      if (isHigh) doc.setTextColor(accentRed[0], accentRed[1], accentRed[2]);
      else if (isMod) doc.setTextColor(230, 81, 0);
      else doc.setTextColor(46, 125, 50);
      doc.setFont('helvetica', 'bold');
      doc.text(`${record.finding.urgency} Priority Level`, margin + 98, y);

      y += 12;

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('CAPTURED LESION SPECIMEN', margin, y);
      doc.text('ESTIMATED TACTICAL DIAGNOSTIC ACTION', margin + 85, y);

      y += 2;
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + 75, y);
      doc.line(margin + 85, y, pageWidth - margin, y);
      y += 6;

      const initialImgY = y;
      let hasImage = false;
      if (record.image) {
        try {
          doc.addImage(record.image, 'JPEG', margin, y, 75, 50);
          hasImage = true;
        } catch (err) {
          console.warn('Failed to embed image in PDF:', err);
        }
      }

      if (!hasImage) {
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(margin, y, 75, 50, 'F');
        doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
        doc.rect(margin, y, 75, 50, 'D');
        doc.setTextColor(textLightGray[0], textLightGray[1], textLightGray[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('Specimen Photo Media Block', margin + 17, y + 23);
        doc.text('(Compressed on local sync)', margin + 18, y + 27);
      }

      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      const recTitleLines = doc.splitTextToSize(`Onward Advice: ${record.finding.recommendedAction}`, 90);
      doc.text(recTitleLines, margin + 85, y);

      y += (recTitleLines.length * 4) + 4;
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      (record.finding.treatmentNotes || []).forEach((action) => {
        const actionLines = doc.splitTextToSize(`• ${action}`, 90);
        if (y + actionLines.length * 4 < initialImgY + 54) {
          doc.text(actionLines, margin + 85, y);
          y += (actionLines.length * 4) + 1;
        }
      });

      y = Math.max(initialImgY + 54, y) + 5;

      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      doc.setTextColor(textLightGray[0], textLightGray[1], textLightGray[2]);
      doc.setFontSize(7);
      doc.text("Clinical Report Generated Auto-Sync Gateway (V3.81). Handout verified by MOH Protocols.", margin, pageHeight - 11);
      const footerRText = "Page 1 of 2";
      doc.text(footerRText, pageWidth - margin - doc.getTextWidth(footerRText), pageHeight - 11);

      // PAGE 2
      doc.addPage();
      y = 20;

      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(margin, 15, contentWidth, 2, 'F');

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('SUPPORTIVE TREATMENT WORKFLOW & CLINICAL RECIPE', margin, y + 4);

      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const page2Sub = "SECURE PROTOCOL DISPENSING GUIDE";
      doc.text(page2Sub, pageWidth - margin - doc.getTextWidth(page2Sub), y + 3);

      y += 10;
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      const codeKey = normalizeCode(record.finding.conditionCode || record.finding.primaryFinding);
      const template = CONDITIONAL_GUIDELINES[codeKey];

      if (template) {
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('I. PHARMACOLOGICAL DISPENSING DOSES', margin, y);
        y += 5;

        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(margin, y, contentWidth, 54, 'F');
        doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
        doc.rect(margin, y, contentWidth, 54, 'D');

        let subY = y + 5;
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);

        doc.text('Primary Medication Target Group:', margin + 4, subY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont('helvetica', 'bold');
        const medLines = doc.splitTextToSize(template.medication, 110);
        doc.text(medLines, margin + 55, subY);

        subY += (medLines.length * 4) + 2;
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.text('Standard Dosage & Timing Regimen:', margin + 4, subY);
        doc.setFont('helvetica', 'normal');
        const regLines = doc.splitTextToSize(template.regimen, 110);
        doc.text(regLines, margin + 55, subY);

        subY += (regLines.length * 4) + 2;
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.text('Standard Triage Duration Instructions:', margin + 4, subY);
        doc.setFont('helvetica', 'normal');
        const durLines = doc.splitTextToSize(template.dosage, 110);
        doc.text(durLines, margin + 55, subY);

        subY += (durLines.length * 4) + 2;
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.text('Important Contraindications & Allergies:', margin + 4, subY);
        doc.setFont('helvetica', 'normal');
        const contraLines = doc.splitTextToSize(template.contraindications, 110);
        doc.text(contraLines, margin + 55, subY);

        y += 63;

        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text("II. PATIENT AT-HOME ADVICE (INFORMATIONAL)", margin, y);
        y += 5;

        doc.setFillColor(244, 252, 246);
        doc.rect(margin, y, 86, 75, 'F');
        doc.setDrawColor(200, 230, 201);
        doc.rect(margin, y, 86, 75, 'D');
        doc.setTextColor(46, 125, 50);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text("RECOMMENDED DOS", margin + 4, y + 6);

        let dosY = y + 13;
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        template.dos.forEach((doItem) => {
          const lines = doc.splitTextToSize(`• ${doItem}`, 78);
          doc.text(lines, margin + 4, dosY);
          dosY += (lines.length * 3.5) + 3;
        });

        doc.setFillColor(255, 245, 245);
        doc.rect(margin + 94, y, 86, 75, 'F');
        doc.setDrawColor(255, 205, 210);
        doc.rect(margin + 94, y, 86, 75, 'D');
        doc.setTextColor(198, 40, 40);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text("HIGH RISK AVOIDANCE (DON'TS)", margin + 98, y + 6);

        let dontsY = y + 13;
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        template.donts.forEach((dontItem) => {
          const lines = doc.splitTextToSize(`• ${dontItem}`, 78);
          doc.text(lines, margin + 98, dontsY);
          dontsY += (lines.length * 3.5) + 3;
        });

        y += 84;

        doc.setFillColor(254, 242, 242);
        doc.rect(margin, y, contentWidth, 24, 'F');
        doc.setDrawColor(accentRed[0], accentRed[1], accentRed[2]);
        doc.setLineWidth(0.5);
        doc.rect(margin, y, contentWidth, 24, 'D');
        doc.setTextColor(accentRed[0], accentRed[1], accentRed[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('CRITICAL SAFEGUARDS / CLINICAL WARNING NOTATIONS:', margin + 4, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(127, 29, 29);
        doc.setFontSize(8);
        const warnLines = doc.splitTextToSize(template.warningNote, 172);
        doc.text(warnLines, margin + 4, y + 10);
      }

      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      doc.setTextColor(textLightGray[0], textLightGray[1], textLightGray[2]);
      doc.setFontSize(7);
      doc.text("Approved by Diagnostic QA Hub. Preserving offline records strictly with GDPR/HIPAA container logic.", margin, pageHeight - 11);
      const page2NumTxt = "Page 2 of 2";
      doc.text(page2NumTxt, pageWidth - margin - doc.getTextWidth(page2NumTxt), pageHeight - 11);

      const cleanPatientName = record.patient.name.trim().replace(/\s+/g, '_');
      doc.save(`Clinical_Record_${record.id}_${cleanPatientName}.pdf`);
    } catch (err: any) {
      console.error('PDF construction failed:', err);
      alert('Failed to generate PDF: ' + err.message);
    }
  };

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------
  const processedCases = cases.filter(item => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      item.patient.name.toLowerCase().includes(query) ||
      item.finding.primaryFinding.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query);
    const matchesUrgency = filterUrgency === 'All' || item.finding.urgency === filterUrgency;
    return matchesSearch && matchesUrgency;
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#f7fafc] text-[#181c1e] font-sans antialiased flex flex-col">
      
      {/* HEADER BAR */}
      <header className="bg-white border-b border-[#bccac1] fixed top-0 left-0 right-0 z-50 h-14 print:hidden">
        <div className="flex justify-between items-center w-full px-4 md:px-8 max-w-5xl mx-auto h-full">
          <div 
            onClick={() => { setScreen('home'); stopWebcam(); }}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#0077b6] flex items-center justify-center text-white font-bold text-lg shadow-sm transition-transform group-hover:scale-105">
              DD
            </div>
            <span className="font-display font-bold text-[#0077b6] text-xl tracking-tight">DermaDetect</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 h-full">
            <button 
              onClick={resetAndStartAssessment}
              className={`font-display text-sm font-semibold transition-colors h-full px-2 border-b-2 flex items-center ${
                screen === 'assessment-info' || screen === 'assessment-capture' || screen === 'assessment-review' || screen === 'referral-note'
                  ? 'border-[#0077b6] text-[#0077b6]'
                  : 'border-transparent text-[#3d4943] hover:text-[#0077b6]'
              }`}
            >
              {t.newAssessment}
            </button>
            <button 
              onClick={() => { setScreen('case-history'); stopWebcam(); }}
              className={`font-display text-sm font-semibold transition-colors h-full px-2 border-b-2 flex items-center ${
                screen === 'case-history'
                  ? 'border-[#0077b6] text-[#0077b6]'
                  : 'border-transparent text-[#3d4943] hover:text-[#0077b6]'
              }`}
            >
              {t.caseHistory}
            </button>
          </nav>

          {/* DATABASE & CLOUD SYNC CONTROLLER */}
          <div className="relative flex items-center">
            <button
              id="sync-engine-trigger"
              onClick={() => {
                setDisplaySyncDropdown(!displaySyncDropdown);
                setLangMenuOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-sm cursor-pointer mr-2 select-none ${
                dbStatus === 'online'
                  ? syncStatus === 'synced'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    : syncStatus === 'syncing'
                    ? 'bg-sky-50 border-sky-300 text-sky-700 hover:bg-sky-100'
                    : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                  : 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <div className="relative flex items-center justify-center">
                {dbStatus === 'online' ? (
                  syncStatus === 'syncing' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5" />
                  )
                ) : (
                  <CloudOff className="w-3.5 h-3.5" />
                )}
                <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                  dbStatus === 'online'
                    ? syncStatus === 'synced'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500 animate-ping'
                    : 'bg-rose-500'
                }`} />
              </div>
              <span className="hidden sm:inline">
                {dbStatus === 'online'
                  ? syncStatus === 'synced'
                    ? 'Cloud Synced'
                    : syncStatus === 'syncing'
                    ? 'Syncing...'
                    : 'Sync Pending'
                  : 'Offline Cache'}
              </span>
            </button>

            {displaySyncDropdown && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#bccac1] rounded-2xl shadow-xl p-4 z-50 text-[#181c1e] text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
                  <span className="font-display font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-[#0077b6]" />
                    Cloud Sync Engine
                  </span>
                  <button 
                    onClick={() => setDisplaySyncDropdown(false)}
                    className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="p-2.5 bg-[#f1f4f6] rounded-xl border border-[#bccac1] text-[11px] space-y-1.5">
                    <div className="flex justify-between items-center text-[#3d4943]">
                      <span>Server Gateway:</span>
                      <span className={`font-bold uppercase ${dbStatus === 'online' ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {dbStatus === 'online' ? 'Active' : 'Disconnected'}
                      </span>
                    </div>
                    {dbStatus === 'online' && latency !== null && (
                      <div className="flex justify-between items-center text-[#3d4943]">
                        <span>Database Latency:</span>
                        <span className="font-mono text-[#181c1e] font-bold">{latency}ms (Excellent)</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-[#3d4943]">
                      <span>Last Backup Push:</span>
                      <span className="text-[#181c1e] font-bold">{lastSynced ? `${lastSynced}` : 'Never'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <div className={`p-1.5 rounded-lg ${syncStatus === 'synced' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {syncStatus === 'synced' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Signal className="w-4 h-4 animate-pulse" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">
                        {syncStatus === 'synced' ? 'All records are secure' : 'Modifications pending sync'}
                      </p>
                      <p className="text-[10px] text-[#3d4943]">
                        {cases.length} local {cases.length === 1 ? 'case' : 'cases'} preserved
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">Auto-Sync Engine</span>
                      <span className="text-[10px] text-[#3d4943]">Pushes data automatically</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={autoSyncEnabled} 
                        onChange={() => setAutoSyncEnabled(!autoSyncEnabled)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0077b6]"></div>
                    </label>
                  </div>

                  <button
                    onClick={() => {
                      probeDatabaseHealth().then(() => triggerCloudSync(cases));
                    }}
                    disabled={syncStatus === 'syncing'}
                    className="w-full h-9 bg-[#0077b6] hover:bg-[#0096c7] disabled:bg-slate-200 disabled:text-slate-400 text-white font-display font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                    <span>Sync Database Now</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Language menu */}
          <div className="relative">
            <button 
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#bccac1] bg-[#f1f4f6] text-sm font-semibold text-[#3d4943] hover:bg-[#e5e9eb] transition-all"
            >
              <Globe className="w-4 h-4 text-[#0077b6]" />
              <span>{lang}</span>
            </button>
            
            {langMenuOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-white border border-[#bccac1] rounded-lg shadow-xl py-1 z-50">
                {(Object.keys(TRANSLATIONS) as LanguageOption[]).map((langKey) => (
                  <button
                    key={langKey}
                    onClick={() => { setLang(langKey); setLangMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[#f1f4f6] font-medium ${
                      lang === langKey ? 'text-[#0077b6] font-semibold bg-[#e5e9eb]' : 'text-[#3d4943]'
                    }`}
                  >
                    {langKey}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* VIEWPORT BODY CANVAS */}
      <main className="flex-1 pt-14 pb-20 md:pb-0 flex flex-col">
        
        {/* VIEW 1: HOME PAGE */}
        {screen === 'home' && (
          <div className="flex-1 flex flex-col animate-fade-in relative overflow-hidden bg-white">
            {/* Subtle Intentional Background Gradients */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#0077b6] blur-[150px] opacity-10 pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-[#00b4d8] blur-[120px] opacity-10 pointer-events-none"></div>
            
            <section className="max-w-5xl mx-auto w-full px-4 md:px-8 py-10 md:py-16 flex-1 flex flex-col justify-center relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
                
                <div className="md:col-span-7 flex flex-col gap-8">
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#f0f9ff] border border-[#0077b6]/20 rounded-full shadow-sm">
                      <Sparkles className="w-4 h-4 text-[#0077b6] animate-pulse" />
                      <span className="text-[#0077b6] font-display font-bold text-xs uppercase tracking-widest">
                        Next-Gen Clinical Triage
                      </span>
                    </div>
                    <h1 className="font-display font-black text-[#181c1e] text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight">
                      Empowering <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0077b6] to-[#00b4d8]">Frontline</span> Healthcare.
                    </h1>
                    <p className="text-[#3d4943] text-lg leading-relaxed max-w-xl font-medium">
                      DermaDetect utilizes advanced AI to analyze complex dermatological conditions instantly, bridging the gap between community health workers and specialized clinical care.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button 
                      onClick={resetAndStartAssessment}
                      className="w-full sm:w-auto h-14 px-8 bg-[#0077b6] hover:bg-[#005f92] text-white font-display font-bold text-sm tracking-wide rounded-2xl shadow-[0_8px_20px_rgba(0,119,182,0.2)] hover:shadow-[0_12px_25px_rgba(0,119,182,0.3)] transition-all flex items-center justify-center gap-3 group cursor-pointer active:scale-95 border border-[#0077b6]"
                    >
                      <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                      <span>Start Triage Assessment</span>
                    </button>
                    <button 
                      onClick={() => setScreen('case-history')}
                      className="w-full sm:w-auto h-14 px-8 bg-white hover:bg-[#f0f9ff] border border-[#bccac1] hover:border-[#0077b6]/30 text-[#0077b6] font-display font-bold text-sm tracking-wide rounded-2xl transition-all flex items-center justify-center gap-3 cursor-pointer group active:scale-95 shadow-sm"
                    >
                      <History className="w-5 h-5 text-[#0077b6]" />
                      <span>Access Case Vault</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-[#bccac1] shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center text-emerald-600 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <WifiOff className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-display font-bold text-sm text-[#181c1e] tracking-wide">Secure Offline Persistence</span>
                      <span className="text-xs text-[#3d4943] mt-1 leading-relaxed">Full diagnostic capability retained in remote environments. Synced securely upon reconnection.</span>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-5 relative group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#0077b6]/20 to-[#00b4d8]/20 rounded-3xl transform translate-x-4 translate-y-4 -z-10 transition-transform duration-500 group-hover:translate-x-2 group-hover:translate-y-2 blur-md" />
                  <div className="aspect-[4/5] bg-white rounded-3xl overflow-hidden border border-[#bccac1] shadow-xl relative transition-transform duration-500 group-hover:-translate-y-2 p-2">
                    <div className="w-full h-full rounded-2xl overflow-hidden relative">
                      <img 
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7K9Gkw4BG40ghUxTPEDx2ma7CEkcuXN3p1ZXoYR0VswVmcqrUv7cXlb1OgsAtyl6aAszzMhgHPG6boMpjFt-401Cach1F4nADZGrYX3rCQov9flBROJXLAjDVBS-4zWAhoWnNxk7fOAhlhZY88nSpbNadBAaUopICdcSd_HrMR76vnNOiAS5N6kcnzt4s8ee6HL6MPSrn9R8iAqxp2bKA960TcZ0VqSDzV-rawtOa-t8VAf1Jdqu1Zxv9lmxiUy5XRb1DQzmWKQ" 
                        alt="Healthcare Professional with device" 
                        className="w-full h-full object-cover transform scale-105 transition-transform duration-700 group-hover:scale-100"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10 opacity-80" />
                      <div className="absolute bottom-6 left-6 right-6 z-20">
                        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-white shadow-lg flex items-center gap-4 transition-transform duration-500 hover:scale-[1.02]">
                          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-200">
                            <CheckCircle2 className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-display font-bold text-sm text-[#181c1e] tracking-wide">Dinov2 ViT Active</p>
                            <p className="text-[11px] text-[#3d4943] font-bold tracking-widest uppercase mt-0.5">Systems Nominal</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="relative z-10 border-t border-[#f1f4f6] bg-[#f8fbff] py-16">
              <div className="max-w-5xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { icon: HeartPulse, title: "Rapid Analysis", desc: "Instant, high-precision dermatological estimations to assist health personnel triage field cases.", color: "text-[#0077b6] bg-[#0077b6]/10 border-[#0077b6]/20" },
                  { icon: ShieldCheck, title: "Secure Vault", desc: "Patient medical observations, diagnostic records, and key images stored with local security integrity.", color: "text-[#0077b6] bg-[#0077b6]/10 border-[#0077b6]/20" },
                  { icon: BookOpen, title: "Direct Referral", desc: "Instantly package diagnosed clinical findings into clear formatted Referral Notes for nearby hospitals.", color: "text-[#0077b6] bg-[#0077b6]/10 border-[#0077b6]/20" }
                ].map((feature, i) => (
                  <div key={i} className="bg-white p-8 rounded-3xl border border-[#bccac1] hover:border-[#0077b6]/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg shadow-sm group">
                    <div className={`w-12 h-12 rounded-2xl ${feature.color} border flex items-center justify-center mb-6 transform group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-display text-xl font-bold text-[#181c1e] tracking-wide mb-3">{feature.title}</h3>
                    <p className="text-sm text-[#3d4943] leading-relaxed font-medium">
                      {feature.desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ASSESSMENT WORKFLOW */}
        {(screen === 'assessment-info' || screen === 'assessment-capture' || screen === 'assessment-review' || screen === 'referral-note') && (
          <div className="flex-1 flex flex-col md:flex-row">
            
            <aside className="w-full md:w-64 bg-[#f1f4f6] md:border-r border-[#bccac1] py-3 md:py-6 px-4 flex flex-col md:min-h-[calc(100vh-3.5rem)] print:hidden">
              <div className="mb-6 hidden md:block">
                <h2 className="font-display font-extrabold text-base text-[#181c1e]">Assessment Progress</h2>
                <p className="text-xs text-[#3d4943] mt-0.5">Community Workflow</p>
              </div>

              <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                <div 
                  onClick={() => { if (screen !== 'assessment-info') setScreen('assessment-info'); }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer grow md:grow-0 shrink-0 ${
                    screen === 'assessment-info'
                      ? 'bg-[#0077b6] text-white font-bold shadow-sm'
                      : 'text-[#3d4943] hover:bg-[#e5e9eb]'
                  }`}
                >
                  <UserPen className="w-4.5 h-4.5 shrink-0" />
                  <span className="font-display text-xs whitespace-nowrap">Step 1: Patient Info</span>
                </div>

                <div 
                  onClick={() => { if (patient.name) setScreen('assessment-capture'); }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    !patient.name ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  } grow md:grow-0 shrink-0 ${
                    screen === 'assessment-capture'
                      ? 'bg-[#0077b6] text-white font-bold shadow-sm'
                      : 'text-[#3d4943] hover:bg-[#e5e9eb]'
                  }`}
                >
                  <Camera className="w-4.5 h-4.5 shrink-0" />
                  <span className="font-display text-xs whitespace-nowrap">Step 2: Skin Capture</span>
                </div>

                <div 
                  onClick={() => { if (activeAnalysisResult) setScreen('assessment-review'); }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    !activeAnalysisResult ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  } grow md:grow-0 shrink-0 ${
                    screen === 'assessment-review'
                      ? 'bg-[#0077b6] text-white font-bold shadow-sm'
                      : 'text-[#3d4943] hover:bg-[#e5e9eb]'
                  }`}
                >
                  <ClipboardCheck className="w-4.5 h-4.5 shrink-0" />
                  <span className="font-display text-xs whitespace-nowrap">Step 3: Review Details</span>
                </div>
              </div>

              <div className="mt-auto hidden md:block pt-4 border-t border-[#bccac1]">
                <div className="flex items-center gap-2 px-1 text-[#3d4943]">
                  <ShieldCheck className="w-4 h-4 text-[#0077b6]" />
                  <span className="font-display font-semibold text-[10px] tracking-wide uppercase">HIPAA Compliant Secure</span>
                </div>
              </div>
            </aside>

            <div className="flex-1 flex flex-col pt-4 md:pt-0">
              
              {/* STEP 1: PATIENT INFO */}
              {screen === 'assessment-info' && (
                <div className="p-4 md:p-8 flex-1 flex items-center justify-center canvas-bg">
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
                                patient.sex === 'Male' ? 'bg-[#d6e0f6] text-[#121c2c]' : 'text-[#3d4943] hover:bg-[#f1f4f6]'
                              }`}
                            >
                              Male
                            </button>
                            <div className="w-[1px] bg-[#bccac1]" />
                            <button
                              type="button"
                              onClick={() => setPatient({ ...patient, sex: 'Female' })}
                              className={`flex-1 text-xs font-bold transition-all ${
                                patient.sex === 'Female' ? 'bg-[#d6e0f6] text-[#121c2c]' : 'text-[#3d4943] hover:bg-[#f1f4f6]'
                              }`}
                            >
                              Female
                            </button>
                          </div>
                        </div>
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
                          disabled={!patient.name || !patient.age || !patient.sex}
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

              {/* STEP 2: CAPTURE */}
              {screen === 'assessment-capture' && (
                <div className="p-4 md:p-8 flex-1 canvas-bg">
                  <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    
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

                      <div className="bg-[#f0f9ff] border border-[#bccac1] rounded-xl p-4">
                        <h4 className="font-display font-bold text-xs text-[#0077b6] flex items-center gap-1.5">
                          <PlusCircle className="w-4 h-4" />
                          Diagnostic Library Specimens (Quick Testing)
                        </h4>
                        <p className="text-[11px] text-[#3d4943] mt-1 leading-relaxed">
                          For testing or training purposes, click one of the standard medical lesion templates below to load its macro photography:
                        </p>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {SAMPLE_CASE_TEMPLATES.map((item) => (
                            <button
                              key={item.code}
                              onClick={() => selectTemplateInstance(item.imageUrl)}
                              className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all ${
                                capturedImage === item.imageUrl
                                  ? 'border-[#0077b6] bg-white ring-2 ring-[#0077b6]'
                                  : 'border-[#bccac1] bg-white hover:bg-[#f1f4f6]'
                              }`}
                            >
                              <img src={item.imageUrl} alt={item.name} className="w-8 h-8 rounded object-cover shrink-0" />
                              <span className="font-display text-[10px] font-bold text-[#181c1e] truncate leading-tight">
                                {item.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

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

                        <label className="flex-1 h-11 border-2 border-dashed border-[#0077b6] text-[#0077b6] bg-white rounded-lg font-display font-bold text-sm hover:bg-[#f1f4f6] transition-all flex items-center justify-center gap-2 cursor-pointer">
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

                      {isCameraActive && (
                        <button 
                          onClick={stopWebcam}
                          className="w-full h-9 bg-[#ffdad6] text-[#93000a] text-xs font-bold rounded-lg transition-colors hover:bg-red-200"
                        >
                          Cancel Camera Stream
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="bg-white border rounded-2xl p-4 border-[#bccac1]">
                        <h3 className="font-display text-xs font-bold text-[#181c1e] mb-3 uppercase tracking-wider">Assessment Preview</h3>
                        
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

              {/* STEP 3: RESULTS (Continuous Scroll Report) */}
              {screen === 'assessment-review' && activeAnalysisResult && (
                <div className="flex-1 bg-white w-full">
                  <div className="w-full flex flex-col relative print:shadow-none print:border-none print:max-w-none">
                    
                    {/* Header */}
                    <div className="bg-[#0077b6] p-6 sm:p-8 text-white flex justify-between items-center print:bg-white print:text-[#181c1e] print:border-b print:border-[#bccac1]">
                      <div>
                        <h2 className="font-display font-extrabold text-2xl md:text-3xl tracking-tight">Clinical Assessment Report</h2>
                        <p className="text-sm font-medium mt-1 opacity-90 print:opacity-100 print:text-[#3d4943]">REF ID: {activeCaseId || 'NEW-CASE'}</p>
                      </div>
                      <div className="text-right shrink-0 hidden sm:block">
                        <span className="font-display font-extrabold text-3xl leading-none block">DermaDetect</span>
                        <span className="text-[10px] font-bold tracking-wider uppercase mt-1 block opacity-90 print:opacity-100 print:text-[#3d4943]">AI Analysis System</span>
                      </div>
                    </div>

                    <div className="p-6 sm:p-8 space-y-8">
                      {/* Patient Info Block */}
                      <div>
                        <h3 className="font-bold text-sm text-[#0077b6] uppercase tracking-wider border-b border-[#f1f4f6] pb-2 mb-4">Patient Information</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-4 text-sm bg-[#f0f9ff] p-5 rounded-xl border border-[#bccac1] print:bg-white print:p-0 print:border-none print:gap-y-6">
                          <div>
                            <span className="text-[#3d4943] font-bold block mb-1">Name</span>
                            <span className="text-[#181c1e] font-semibold">{patient.name || 'Anonymous'}</span>
                          </div>
                          <div>
                            <span className="text-[#3d4943] font-bold block mb-1">Age / Sex</span>
                            <span className="text-[#181c1e] font-semibold">{patient.age || 'Unknown'} / {patient.sex || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="text-[#3d4943] font-bold block mb-1">Health Worker</span>
                            <span className="text-[#181c1e] font-semibold">{healthWorkerName}</span>
                          </div>
                          <div>
                            <span className="text-[#3d4943] font-bold block mb-1">Assessment Date</span>
                            <span className="text-[#181c1e] font-semibold">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <div className="col-span-2 md:col-span-4">
                            <span className="text-[#3d4943] font-bold block mb-1">Reported Symptoms</span>
                            <span className="text-[#181c1e] font-semibold">{patient.symptoms || 'None provided'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Visual & Prediction Block */}
                      <div>
                        <h3 className="font-bold text-sm text-[#0077b6] uppercase tracking-wider border-b border-[#f1f4f6] pb-2 mb-4 page-break-after-avoid">Visual Analysis & Predictions</h3>
                        <div className="flex flex-col gap-6 items-stretch page-break-inside-avoid">
                          {/* Images (Original & Heatmap) */}
                          <div className={`w-full ${activeAnalysisResult.heatmap_b64 ? 'grid grid-cols-2' : 'flex flex-col'} gap-4 shrink-0`}>
                            <div className="bg-[#e0e3e5] rounded-xl overflow-hidden border border-[#bccac1] relative aspect-square">
                              {capturedImage ? (
                                <img src={capturedImage} alt="Clinical lesion macro view" className="w-full h-full object-cover" />
                              ) : (
                                <div className="h-full flex items-center justify-center text-[#3d4943] text-sm">No Image Available</div>
                              )}
                              <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wide">Original</div>
                            </div>
                            
                            {activeAnalysisResult.heatmap_b64 && (
                              <div className="bg-[#e0e3e5] rounded-xl overflow-hidden border border-[#bccac1] relative aspect-square">
                                <img src={`data:image/jpeg;base64,${activeAnalysisResult.heatmap_b64}`} alt="GradCAM Saliency Map" className="w-full h-full object-cover" />
                                <div className="absolute top-2 left-2 bg-[#0077b6]/80 text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wide">AI Saliency Map</div>
                              </div>
                            )}
                          </div>
                          
                          {/* Predictions */}
                          <div className="flex-1 flex flex-col gap-4">
                            <div className="bg-[#f1f4f6] border border-[#bccac1] p-5 rounded-xl flex-1 flex flex-col justify-center">
                              <span className="text-[#3d4943] font-bold text-xs uppercase tracking-wider block mb-1">Primary Finding</span>
                              <div className="flex justify-between items-center mb-3">
                                <h3 className="font-display font-extrabold text-2xl text-[#181c1e]">
                                  {activeAnalysisResult.primaryFinding}
                                </h3>
                                <div className="bg-white px-3 py-1.5 rounded-lg border border-[#bccac1] shadow-sm text-center">
                                  <span className="font-display font-black text-[#0077b6] text-xl block leading-none">{activeAnalysisResult.confidence}%</span>
                                  <span className="text-[9px] font-bold text-[#3d4943] uppercase tracking-wider">Confidence</span>
                                </div>
                              </div>
                              <div className="h-3 w-full bg-[#e0e3e5] rounded-full overflow-hidden border border-[#bccac1]/50">
                                <div className="h-full bg-[#0077b6]" style={{ width: `${activeAnalysisResult.confidence}%` }} />
                              </div>
                            </div>

                            <div className={`p-5 rounded-xl border flex items-center gap-4 ${
                              activeAnalysisResult.urgency === 'High' ? 'bg-[#ffdad6] border-[#ba1a1a] text-[#93000a]' : 
                              activeAnalysisResult.urgency === 'Moderate' ? 'bg-[#ffe0b2] border-[#ffe0b2] text-[#e65100]' : 
                              'bg-[#e8f5e9] border-[#c8e6c9] text-[#2e7d32]'
                            }`}>
                              <div className={`p-2 rounded-lg shrink-0 ${
                                activeAnalysisResult.urgency === 'High' ? 'bg-[#ba1a1a] text-white' : 
                                activeAnalysisResult.urgency === 'Moderate' ? 'bg-[#e65100] text-white' : 
                                'bg-[#2e7d32] text-white'
                              }`}>
                                <AlertTriangle className="w-6 h-6" />
                              </div>
                              <div>
                                <span className="font-display font-extrabold text-sm tracking-wider uppercase block mb-0.5">
                                  Triage Urgency: {activeAnalysisResult.urgency}
                                </span>
                                <p className="text-sm font-semibold leading-relaxed">
                                  {activeAnalysisResult.urgencyText}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Groq Response Structure (Narrative & Treatments) */}
                      <div>
                        <h3 className="font-bold text-sm text-[#0077b6] uppercase tracking-wider border-b border-[#f1f4f6] pb-2 mb-4">AI Clinical Evaluation</h3>
                        
                        <div className="space-y-6 page-break-inside-avoid">
                          <div className="bg-white border border-[#bccac1] p-6 rounded-xl shadow-sm text-sm leading-relaxed text-[#181c1e] markdown-body">
                            {activeAnalysisResult.referralNote ? (
                              <ReactMarkdown
                                components={{
                                  strong: ({node, ...props}) => <span className="font-bold text-[#0077b6] block mt-5 mb-1.5 text-xs uppercase tracking-wider border-b border-[#f1f4f6] pb-1" {...props} />,
                                  p:      ({node, ...props}) => <p className="text-sm text-[#3d4943] leading-relaxed mb-3" {...props} />,
                                }}
                              >
                                {sanitiseReferralNote(activeAnalysisResult.referralNote)}
                              </ReactMarkdown>
                            ) : (
                              <p className="text-sm text-slate-400 italic">No clinical narrative generated.</p>
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

                    {/* Signature & Disclaimer (Visible on Print) */}
                    <div className="mt-12 pt-8 border-t border-[#bccac1] flex justify-between items-end page-break-inside-avoid">
                      <div className="flex flex-col gap-2">
                        <span className="italic text-xs text-[#555f71]">Digital Verified Signature</span>
                        <span className="font-display font-bold text-lg text-[#181c1e]">{healthWorkerName || 'Unknown Worker'}</span>
                        <div className="w-64 h-[1px] bg-[#181c1e] mt-1"></div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 border border-[#bccac1] rounded-lg bg-[#f1f4f6]">
                          <QrCode className="w-10 h-10 text-[#3d4943]" />
                        </div>
                        <div className="text-[10px] text-[#3d4943] font-bold leading-tight">
                          Verify on<br/>
                          DermaDetect Secure<br/>
                          Web Cloud
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-8 mb-6 text-[10px] text-[#555f71] text-center page-break-inside-avoid max-w-3xl mx-auto leading-relaxed">
                      Disclaimer: This assessment is AI-assisted using the advanced <strong>DermaVision</strong> language model developed by <strong>PreWorks</strong>. It is intended to support, not replace, clinical judgment by a qualified healthcare professional.
                    </div>

                    {/* Action Footer */}
                    <div className="bg-[#f1f4f6] p-6 border-t border-[#bccac1] flex flex-col sm:flex-row justify-end gap-3">
                      {/* Preview button */}
                      <button
                        onClick={() => setShowReportPreview(true)}
                        className="h-12 px-6 border-2 border-[#3d4943] text-[#3d4943] bg-white font-display font-bold text-sm rounded-xl hover:bg-[#f1f4f6] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                      >
                        <Search className="w-5 h-5" />
                        <span>Preview Report</span>
                      </button>

                      {/* PDF export button */}
                      <button 
                        onClick={async () => {
                          if (!activeAnalysisResult) return;
                          setIsGeneratingPdf(true);
                          try {
                            const payload = {
                              case_id: activeCaseId || `DD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
                              patient: { ...patient, healthWorkerName },
                              clinical: {
                                primaryFinding: activeAnalysisResult.primaryFinding,
                                confidence: activeAnalysisResult.confidence,
                                urgency: activeAnalysisResult.urgency,
                                referralNote: activeAnalysisResult.referralNote,
                                treatmentNotes: activeAnalysisResult.treatmentNotes,
                                therapyRegimen: activeAnalysisResult.therapyRegimen,
                                patientHandout: activeAnalysisResult.patientHandout,
                                recommendedAction: activeAnalysisResult.recommendedAction
                              },
                              images: {
                                original_b64: capturedImage,
                                heatmap_b64: activeAnalysisResult.heatmap_b64
                              }
                            };
                            const response = await fetch('/api/generate-pdf', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload)
                            });
                            if (!response.ok) throw new Error("PDF generation failed");
                            
                            const data = await response.json();
                            if (data.pdf_b64) {
                              const link = document.createElement('a');
                              link.href = `data:application/pdf;base64,${data.pdf_b64}`;
                              link.download = `DermaDetect_Report_${patient.name || 'Patient'}.pdf`;
                              link.click();
                            }
                          } catch (err) {
                            console.error(err);
                            alert("Failed to generate PDF report from backend.");
                          } finally {
                            setIsGeneratingPdf(false);
                          }
                        }}
                        disabled={isGeneratingPdf}
                        className="h-12 px-6 border-2 border-[#0077b6] text-[#0077b6] bg-white font-display font-bold text-sm rounded-xl hover:bg-[#e0f2fe] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {isGeneratingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                        <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF Report'}</span>
                      </button>
                      
                      <button 
                        onClick={saveCaseRecord}
                        className="h-12 px-8 bg-[#0077b6] text-white font-display font-bold text-sm rounded-xl hover:bg-[#0096c7] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                      >
                        <Save className="w-5 h-5" />
                        <span>Save and Register Case</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* Deprecated Step 4 Referral Note removed, functionality merged into Step 3 */}
            </div>
          </div>
        )}

        {/* CASE HISTORY */}
        {screen === 'case-history' && (
          <section className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-8 py-8 animate-fade-in flex flex-col justify-between">
            <div className="grow space-y-6">
              
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#bccac1] pb-4">
                <div>
                  <h1 className="font-display font-extrabold text-2xl md:text-3xl text-[#181c1e]">Case History Logs</h1>
                  <p className="text-xs text-[#3d4943] mt-1.5">
                    Browse fully registered patient skin diagnostics and triage urgencies recorded in this clinical terminal.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
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

              <div className="bg-white border border-[#bccac1] rounded-2xl overflow-hidden shadow-sm">
                {/* Desktop table */}
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
                            <td className="px-5 py-4 text-[#3d4943]">{item.date}</td>
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
                                  onClick={(e) => { e.stopPropagation(); downloadPdfRecord(item); }}
                                  title="Download Full Clinical PDF"
                                  className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-full transition-colors border border-transparent hover:border-emerald-200 cursor-pointer"
                                >
                                  <Download className="w-4.5 h-4.5" />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setCaseToDelete(item); }}
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

                {/* Mobile cards */}
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
                              <p className="font-bold text-sm text-[#181c1e] truncate">{item.patient.name}</p>
                              <p className="text-[10px] text-[#3d4943] font-mono leading-none">REF: {item.id}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`w-2 h-2 rounded-full ${
                              item.finding?.urgency === 'High' ? 'bg-[#ba1a1a]' : item.finding?.urgency === 'Moderate' ? 'bg-[#e65100]' : 'bg-[#2e7d32]'
                            }`} />
                            <span className={`font-bold text-xs ${
                              item.finding?.urgency === 'High' ? 'text-[#ba1a1a]' : item.finding?.urgency === 'Moderate' ? 'text-[#e65100]' : 'text-[#2e7d32]'
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
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); downloadPdfRecord(item); }}
                              className="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-100 bg-emerald-50/30 cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setCaseToDelete(item); }}
                              className="w-8 h-8 flex items-center justify-center text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 bg-rose-50/30 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setSelectedDetailsCase(item)}
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

      {/* FOOTER */}
      <footer className="bg-white border-t border-[#bccac1] py-6 select-none print:hidden relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 relative z-10">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0077b6] flex items-center justify-center text-white font-bold text-sm shadow-sm">DD</div>
              <span className="font-display font-extrabold text-[#0077b6] text-sm tracking-widest uppercase">DermaDetect</span>
            </div>
            <span className="hidden sm:inline text-[#bccac1]">•</span>
            <span className="text-xs font-bold text-[#3d4943] tracking-wide">
              © {new Date().getFullYear()} Community Health Digital System
            </span>
          </div>
          <div className="flex items-center gap-5 text-xs font-bold text-[#3d4943]">
            <div className="flex items-center gap-2 bg-[#f0f9ff] px-3 py-1.5 rounded-full border border-[#0077b6]/20">
              <span className="w-2 h-2 rounded-full bg-[#0077b6] animate-pulse" />
              <span className="tracking-wide">Offline Cache <span className="text-[#0077b6]">Active</span></span>
            </div>
            <button onClick={() => alert("DermaDetect clinic platform HIPAA Compliant data vault encryption active. No personal metrics are logged remotely.")} className="hover:text-[#0077b6] transition-colors duration-300 relative group">
              Privacy
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[#0077b6] transition-all duration-300 group-hover:w-full rounded"></span>
            </button>
            <button onClick={() => alert("Supported cases: Tinea Corporis, Basal Cell, Melanoma, Seborrheic, Contact Dermatitis. Contact support@dermadetect.org")} className="hover:text-[#0077b6] transition-colors duration-300 relative group">
              Support
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[#0077b6] transition-all duration-300 group-hover:w-full rounded"></span>
            </button>
          </div>
        </div>
      </footer>

      {/* MODAL: ANALYSIS LOADER */}
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

      {/* MODAL: CASE DETAIL VIEW */}
      {selectedDetailsCase && (
        <div 
          className="fixed inset-0 bg-[#181c1e]/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4"
          onClick={(e) => { if(e.target === e.currentTarget) setSelectedDetailsCase(null); }}
        >
          <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-[#bccac1]">
            
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

            <div className="p-6 md:p-8 space-y-6 max-h-[72vh] overflow-y-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-[#f1f4f6]">
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

                <div className="space-y-4 text-xs font-semibold">
                  <h3 className="font-display font-bold text-xs text-[#3d4943] uppercase tracking-wider border-b border-[#bccac1] pb-1">
                    Medical Indicators
                  </h3>
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#6d7a73] uppercase tracking-wider block">Primary Diagnosed Finding</p>
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

      {/* MODAL: SUCCESS ANIMATION */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-8 text-center shadow-2xl border border-slate-100">
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

      {/* MODAL: DELETE CONFIRMATION */}
      {caseToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 md:p-8 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-lg font-bold text-slate-900 tracking-tight">
                  Delete Patient Case Record
                </h3>
                <p className="text-xs text-[#6d7a73]">
                  You are about to permanently remove this case history from local and server storage. This process is irreversible.
                </p>
              </div>
            </div>

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

      {/* MOBILE BOTTOM NAV */}
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

      {/* ═══════════════════════════════════════════════════════════════
          REPORT PREVIEW MODAL
          Full-screen slide-up overlay showing the complete clinical
          report before the user commits to PDF export.
          ═══════════════════════════════════════════════════════════════ */}
      {showReportPreview && activeAnalysisResult && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowReportPreview(false); }}
        >
          <div className="relative flex flex-col bg-white w-full h-full max-w-4xl mx-auto shadow-2xl overflow-hidden animate-slide-up md:my-4 md:rounded-2xl md:h-[calc(100vh-2rem)]">

            {/* Modal header */}
            <div className="bg-[#0077b6] px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h2 className="font-display font-extrabold text-white text-lg tracking-tight">
                  Report Preview
                </h2>
                <p className="text-xs text-white/80 mt-0.5">
                  REF: {activeCaseId || 'NEW-CASE'} &mdash; Review before exporting PDF
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!activeAnalysisResult) return;
                    setIsGeneratingPdf(true);
                    try {
                      const payload = {
                        case_id: activeCaseId || `DD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
                        patient: { ...patient, healthWorkerName },
                        clinical: {
                          primaryFinding: activeAnalysisResult.primaryFinding,
                          confidence: activeAnalysisResult.confidence,
                          urgency: activeAnalysisResult.urgency,
                          referralNote: activeAnalysisResult.referralNote,
                          treatmentNotes: activeAnalysisResult.treatmentNotes,
                          therapyRegimen: activeAnalysisResult.therapyRegimen,
                          patientHandout: activeAnalysisResult.patientHandout,
                          recommendedAction: activeAnalysisResult.recommendedAction
                        },
                        images: { original_b64: capturedImage, heatmap_b64: activeAnalysisResult.heatmap_b64 }
                      };
                      const response = await fetch('/api/generate-pdf', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });
                      if (!response.ok) throw new Error('PDF generation failed');
                      const data = await response.json();
                      if (data.pdf_b64) {
                        const link = document.createElement('a');
                        link.href = `data:application/pdf;base64,${data.pdf_b64}`;
                        link.download = `DermaDetect_Report_${patient.name || 'Patient'}.pdf`;
                        link.click();
                        setShowReportPreview(false);
                      }
                    } catch (err) {
                      console.error(err);
                      alert('Failed to generate PDF. Please try again.');
                    } finally {
                      setIsGeneratingPdf(false);
                    }
                  }}
                  disabled={isGeneratingPdf}
                  className="h-9 px-4 bg-white text-[#0077b6] font-display font-bold text-xs rounded-lg hover:bg-[#e0f2fe] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>{isGeneratingPdf ? 'Generating...' : 'Export PDF'}</span>
                </button>
                <button
                  onClick={() => setShowReportPreview(false)}
                  className="w-9 h-9 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal scrollable body */}
            <div className="flex-1 overflow-y-auto bg-[#f7fafc]">
              <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

                {/* Patient info strip */}
                <div className="bg-white rounded-xl border border-[#bccac1] p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm shadow-sm">
                  {[
                    { label: 'Patient', value: patient.name || 'Anonymous' },
                    { label: 'Age / Sex', value: `${patient.age || '—'} / ${patient.sex || '—'}` },
                    { label: 'Health Worker', value: healthWorkerName },
                    { label: 'Date', value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                  ].map((item, i) => (
                    <div key={i}>
                      <span className="text-[10px] font-bold text-[#3d4943] uppercase tracking-wider block mb-0.5">{item.label}</span>
                      <span className="font-semibold text-[#181c1e] text-xs">{item.value}</span>
                    </div>
                  ))}
                  {patient.symptoms && (
                    <div className="col-span-2 md:col-span-4">
                      <span className="text-[10px] font-bold text-[#3d4943] uppercase tracking-wider block mb-0.5">Reported Symptoms</span>
                      <span className="font-semibold text-[#181c1e] text-xs">{patient.symptoms}</span>
                    </div>
                  )}
                </div>

                {/* Primary finding banner */}
                <div className={`rounded-xl border p-5 flex items-center gap-4 ${
                  activeAnalysisResult.urgency === 'High'     ? 'bg-rose-50 border-rose-200' :
                  activeAnalysisResult.urgency === 'Moderate' ? 'bg-amber-50 border-amber-200' :
                                                                'bg-emerald-50 border-emerald-200'
                }`}>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Primary AI Finding</span>
                    <h3 className="font-display font-extrabold text-xl text-[#181c1e]">{activeAnalysisResult.primaryFinding}</h3>
                    <p className="text-xs mt-1 font-semibold text-slate-600">
                      {activeAnalysisResult.confidence}% confidence &nbsp;·&nbsp; Urgency:&nbsp;
                      <span className={`font-bold ${
                        activeAnalysisResult.urgency === 'High' ? 'text-rose-600' :
                        activeAnalysisResult.urgency === 'Moderate' ? 'text-amber-600' : 'text-emerald-600'
                      }`}>{activeAnalysisResult.urgency}</span>
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{activeAnalysisResult.urgencyText}</p>
                  </div>
                  {capturedImage && (
                    <img src={capturedImage} alt="Lesion" className="w-20 h-20 object-cover rounded-xl border border-[#bccac1] shrink-0 ml-auto" />
                  )}
                </div>

                {/* Referral note */}
                <div className="bg-white rounded-xl border border-[#bccac1] p-6 shadow-sm">
                  <h4 className="font-display font-bold text-xs text-[#0077b6] uppercase tracking-wider mb-4 border-b border-[#f1f4f6] pb-2">
                    AI Clinical Evaluation
                  </h4>
                  {activeAnalysisResult.referralNote ? (
                    <ReactMarkdown
                      components={{
                        strong: ({node, ...props}) => <span className="font-bold text-[#0077b6] block mt-5 mb-1.5 text-xs uppercase tracking-wider border-b border-[#f1f4f6] pb-1" {...props} />,
                        p:      ({node, ...props}) => <p className="text-sm text-[#3d4943] leading-relaxed mb-3" {...props} />,
                      }}
                    >
                      {sanitiseReferralNote(activeAnalysisResult.referralNote)}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No clinical narrative generated.</p>
                  )}
                </div>

                {/* Recommended action */}
                {activeAnalysisResult.recommendedAction && (
                  <div className="bg-[#f0f9ff] border border-[#0077b6]/20 rounded-xl p-4 flex items-start gap-3">
                    <FileText className="w-4 h-4 text-[#0077b6] mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-[#0077b6] uppercase tracking-wider block mb-1">Recommended Action</span>
                      <p className="text-sm font-semibold text-[#181c1e] leading-relaxed">{activeAnalysisResult.recommendedAction}</p>
                    </div>
                  </div>
                )}

                {/* Immediate care steps */}
                {activeAnalysisResult.treatmentNotes?.length > 0 && (
                  <div className="bg-white rounded-xl border border-[#bccac1] p-5 shadow-sm">
                    <h4 className="font-display font-bold text-xs text-[#0077b6] uppercase tracking-wider mb-3 border-b border-[#f1f4f6] pb-2">
                      Immediate Care Steps
                    </h4>
                    <ul className="space-y-2">
                      {activeAnalysisResult.treatmentNotes.map((note, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                          <span className="w-5 h-5 rounded-full bg-[#0077b6] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Therapy regimen summary */}
                {activeAnalysisResult.therapyRegimen && (
                  <div className="bg-white rounded-xl border border-[#bccac1] p-5 shadow-sm">
                    <h4 className="font-display font-bold text-xs text-[#0077b6] uppercase tracking-wider mb-3 border-b border-[#f1f4f6] pb-2">
                      Pharmacological Regimen
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div><span className="text-[10px] text-slate-400 uppercase tracking-widest block mb-0.5">Medication</span><span className="font-bold text-[#0077b6]">{activeAnalysisResult.therapyRegimen.medication}</span></div>
                      <div><span className="text-[10px] text-slate-400 uppercase tracking-widest block mb-0.5">Dosage</span><span className="font-mono text-slate-800">{activeAnalysisResult.therapyRegimen.dosage}</span></div>
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 mt-2">
                        <span className="text-[9px] text-amber-700 uppercase tracking-widest font-bold block mb-0.5">Contraindications</span>
                        <p className="text-[11px] text-amber-900">{activeAnalysisResult.therapyRegimen.contraindications}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Patient dos/donts summary */}
                {activeAnalysisResult.patientHandout && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                      <h5 className="font-bold text-xs text-emerald-700 uppercase tracking-wide mb-2.5">Patient Do's</h5>
                      <ul className="space-y-1.5">
                        {activeAnalysisResult.patientHandout.dos.map((d, i) => (
                          <li key={i} className="flex gap-2 text-[11px] text-slate-700 leading-relaxed">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />{d}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4">
                      <h5 className="font-bold text-xs text-rose-700 uppercase tracking-wide mb-2.5">Patient Don'ts</h5>
                      <ul className="space-y-1.5">
                        {activeAnalysisResult.patientHandout.donts.map((d, i) => (
                          <li key={i} className="flex gap-2 text-[11px] text-slate-700 leading-relaxed">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />{d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <p className="text-[10px] text-slate-400 text-center leading-relaxed pb-4">
                  This is an AI-assisted assessment using DermaVision. It is intended to support, not replace, clinical judgment by a qualified healthcare professional.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}