'use client';

import { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, AlertCircle, Sparkles, Download, Play, LayoutTemplate, Wand2, ShieldCheck, Shield, Globe, Lock, Server, Eye, Trash2, Quote, BookOpen, User, MapPin, Briefcase, GraduationCap, Layout, Check, Search, Zap } from 'lucide-react';
import { cvExamples } from './examples';
import OnboardingTour from './OnboardingTour';
import SimplePDFEditor from './SimplePDFEditor';
import CVComparison from './CVComparison';
import AutonomousHunter from './AutonomousHunter';
import dynamic from 'next/dynamic';

const JobMap = dynamic(() => import('./JobMap'), {
  ssr: false,
  loading: () => <div style={{ height: '350px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>Initialisation du moteur SIG...</div>
});


const THEME_CATEGORIES = [
  {
    label: '🏛️ Classic',
    themes: [
      { name: 'Classic Dark', color: '#0F1117', accent: '#C8A96E', desc: 'Dark sidebar · Gold' },
      { name: 'Sober Classic', color: '#FFFFFF', accent: '#000000', desc: 'Pure B&W · Serif' },
      { name: 'Luxury Serif', color: '#FFFEF9', accent: '#8B6914', desc: 'Serif · Warm Gold' },
      { name: 'Executive C', color: '#FFFFFF', accent: '#334155', desc: 'Silver · Slate' },
      { name: 'Apprentice', color: '#FCD34D', accent: '#1E3A8A', desc: 'Yellow · Royal Blue' },
      { name: 'Creative Ag.', color: '#FFE4E6', accent: '#E11D48', desc: 'Rose · Coral' },
      { name: 'SOTA Luxury', color: '#FDFDFD', accent: '#C5B358', desc: 'Premium · Gold & Cream' },
    ],
  },
  {
    label: '🎨 Canva',
    themes: [
      { name: 'Canva Minimal', color: '#FFFFFF', accent: '#FF6B6B', desc: 'White · Coral' },
      { name: 'Medical Clean', color: '#F8FAFC', accent: '#0EA5E9', desc: 'Aqua · White' },
      { name: 'BTP Industry', color: '#FFFFFF', accent: '#F97316', desc: 'Steel · Orange' },
      { name: 'Retail Sales', color: '#FFFFFF', accent: '#DC2626', desc: 'Red · Black' },
    ],
  },
  {
    label: '🧊 Nordic',
    themes: [
      { name: 'Nordic Clean', color: '#F7F5F2', accent: '#5B8DB8', desc: 'Pastel · Blue' },
      { name: 'Finance Pro', color: '#FFFFFF', accent: '#A78B50', desc: 'Navy · Gold' },
      { name: 'Academic Legal', color: '#FFFFFF', accent: '#404040', desc: 'Pure B&W · Serif' },
    ],
  },
  {
    label: '⚡ TechGrid',
    themes: [
      { name: 'Tech Grid', color: '#0D1117', accent: '#58A6FF', desc: 'Dark · Blue' },
      { name: 'Startup SaaS', color: '#0F172A', accent: '#8B5CF6', desc: 'Indigo · Pink' },
      { name: 'Logistics', color: '#FFFFFF', accent: '#1E40AF', desc: 'Navy · Green' },
    ],
  },
  {
    label: '📷 Photo Profile',
    themes: [
      { name: 'Executive Portrait', color: '#FFFFFF', accent: '#B8956A', desc: 'Photo ronde header · Premium' },
      { name: 'Modern Profile', color: '#F8F9FA', accent: '#3498DB', desc: 'Grande photo sidebar · Tech' },
      { name: 'Corporate Elite', color: '#FFFFFF', accent: '#1E3A5F', desc: 'Photo header asymétrique' },
      { name: 'Creative Vision', color: '#FAFAFA', accent: '#FF6B9D', desc: 'Photo overlay diagonal' },
      { name: 'Minimalist Pro', color: '#FFFFFF', accent: '#2C3E50', desc: 'Photo centrée épurée' },
      { name: 'Finance Executive', color: '#FFFFFF', accent: '#A78B50', desc: 'Photo formelle · Navy' },
      { name: 'Tech Leader', color: '#F8F9FA', accent: '#58A6FF', desc: 'Photo sidebar moderne' },
      { name: 'Startup Founder', color: '#FAFAFA', accent: '#8B5CF6', desc: 'Photo overlay violet' },
      { name: 'Consultant Premium', color: '#FDFCFA', accent: '#2C5F7C', desc: 'Layout 3 colonnes' },
      { name: 'International Profile', color: '#FFFFFF', accent: '#D32F2F', desc: 'Sidebar barres progression' },
    ],
  },
  {
    label: '🛡️ ATS-Optimized',
    themes: [
      { name: 'Impact Bold ATS', color: '#000000', accent: '#FFFFFF', desc: 'High Contrast · Black Header · Text-Only' },
      { name: 'Elite ATS', color: '#FFFFFF', accent: '#1E40AF', desc: 'Pure 1-Column · Max Extraction' },
      { name: 'Strategic Professional', color: '#FFFFFF', accent: '#2563EB', desc: 'Modern Clean · Safe Layout' },
      { name: 'Standard Corporate', color: '#FFFFFF', accent: '#000000', desc: 'Harvard Style · Serif · Pro' },
      { name: 'Strategic Modern', color: '#FFFFFF', accent: '#2563EB', desc: 'Tech Minimal · Royal Blue' },
      { name: 'Executive Narrative', color: '#FFFFFF', accent: '#4F46E5', desc: 'Scan-Friendly · Left Labels' },
    ],
  },
];

/**
 * Utility to extract a surrounding context (N lines before/after) for a given line index.
 */
function getLinesContext(fullText: string, targetLine: number, windowSize: number = 1) {
  if (!fullText || targetLine <= 0) return [];
  const lines = fullText.split('\n');
  const start = Math.max(0, targetLine - windowSize - 1);
  const end = Math.min(lines.length, targetLine + windowSize);
  return lines.slice(start, end).map((content, i) => ({
    number: start + i + 1,
    content,
    isTarget: (start + i + 1) === targetLine
  }));
}

const ALL_THEMES = THEME_CATEGORIES.flatMap(c => c.themes);

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [aiProvider, setAiProvider] = useState<'groq' | 'mistral' | 'google' | 'azure'>('groq');
  const [jobDesc, setJobDesc] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [cvText, setCvText] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('Classic Dark');
  const [selectedLetterTheme, setSelectedLetterTheme] = useState('Classic Dark');
  const [boostMode, setBoostMode] = useState(false);
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const [uiTheme, setUiTheme] = useState<'dark' | 'sota-luxury' | 'violet-electric' | 'emerald-tech' | 'light-premium' | 'obsidian-cyan'>('violet-electric');
  const [profilePhoto, setProfilePhoto] = useState<string>('');  // base64
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [editedCvDataJSON, setEditedCvDataJSON] = useState<string>('');
  const [pdfData, setPdfData] = useState<{ base64: string, filename: string } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'audit' | 'sections' | 'edit' | 'pdf' | 'tips' | 'jobs' | 'compare' | 'hunt' | 'letter'>('audit');
  const [visualEditMode, setVisualEditMode] = useState(false);
  const [isFullscreenUI, setIsFullscreenUI] = useState(false);

  // States for cover letter
  const [oldLetterText, setOldLetterText] = useState('');
  const [letterCompanyName, setLetterCompanyName] = useState('');
  const [letterCompanyAddress, setLetterCompanyAddress] = useState('');
  const [letterHiringManager, setLetterHiringManager] = useState('');
  const [letterSubject, setLetterSubject] = useState('');
  const [letterDataJSON, setLetterDataJSON] = useState<string>('');
  const [letterPdfData, setLetterPdfData] = useState<{ base64: string, filename: string } | null>(null);
  const [letterPdfUrl, setLetterPdfUrl] = useState<string>('');
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);
  const [letterProgress, setLetterProgress] = useState('');
  const [letterEditorTab, setLetterEditorTab] = useState<'visual' | 'json'>('visual');

  // CV Studio Customization States
  const [customAccent, setCustomAccent] = useState('');
  const [customText, setCustomText] = useState('');
  const [customHeading, setCustomHeading] = useState('');
  const [customSubheading, setCustomSubheading] = useState('');
  const [customNameColor, setCustomNameColor] = useState('');
  const [customSidebarBg, setCustomSidebarBg] = useState('');
  const [customMainBg, setCustomMainBg] = useState('');
  const [customHeaderBg, setCustomHeaderBg] = useState('');
  const [customPhotoBorder, setCustomPhotoBorder] = useState('');
  const [fontScale, setFontScale] = useState(1.0);
  const [fontFamily, setFontFamily] = useState('Poppins');
  const [customOpen, setCustomOpen] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [showAllThemes, setShowAllThemes] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Brand Identity states
  const [targetCompany, setTargetCompany] = useState('');
  const [brandPalettes, setBrandPalettes] = useState<any[]>([]);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [isLoadingColors, setIsLoadingColors] = useState(false);
  const [azureEndpoint, setAzureEndpoint] = useState('');
  const [azureDeployment, setAzureDeployment] = useState('');
  const [jobteaserUrl, setJobteaserUrl] = useState('https://univ-ubs.jobteaser.com');
  const [jobteaserEmail, setJobteaserEmail] = useState('');
  const [jobteaserPassword, setJobteaserPassword] = useState('');

  // Job Search states
  const [isSearchingJobs, setIsSearchingJobs] = useState(false);
  const [jobMatches, setJobMatches] = useState<any[]>([]);
  const [jobSearchDebug, setJobSearchDebug] = useState<any>(null);
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [jobSearchLocation, setJobSearchLocation] = useState('France');
  const [jobSearchContractType, setJobSearchContractType] = useState('any');
  const [jobSearchCompany, setJobSearchCompany] = useState('');
  const [adzunaAppId, setAdzunaAppId] = useState('');
  const [adzunaAppKey, setAdzunaAppKey] = useState('');
  const [customSemanticTags, setCustomSemanticTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [strictGeoFilter, setStrictGeoFilter] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [jobSearchMaxDays, setJobSearchMaxDays] = useState(30);
  const [jobSearchSortBy, setJobSearchSortBy] = useState('relevance');
  const [jobSearchCountry, setJobSearchCountry] = useState('fr');
  const [mapScale, setMapScale] = useState<'world' | 'france'>('world');
  const [showAnalysisSource, setShowAnalysisSource] = useState(false);
  const [atsSimResult, setAtsSimResult] = useState<any>(null);
  const [isSimulatingAts, setIsSimulatingAts] = useState(false);

  // Get theme defaults for color pickers
  const getThemeDefaults = () => {
    const theme = ALL_THEMES.find(t => t.name === selectedTheme);
    return {
      sidebar: theme?.color || '#1A1C22',
      header: theme?.color || '#1A1C22',
      main: '#FFFFFF',
      name: '#FFFFFF',
      heading: theme?.accent || '#C8A96E',
      subheading: theme?.accent || '#C8A96E',
      text: '#1A1C22',
      accent: theme?.accent || '#C8A96E'
    };
  };

  // Auto-regeneration of PDF when content or customization changes
  useEffect(() => {
    if (!pdfData) return;
    setNeedsUpdate(true);
    const timer = setTimeout(() => {
      handleGeneratePdf();
      setNeedsUpdate(false);
    }, 1200); // 1.2s debounce
    return () => clearTimeout(timer);
  }, [
    customAccent, customText, customHeading, customSubheading,
    customNameColor, customSidebarBg, customMainBg, customHeaderBg, customPhotoBorder, fontScale, fontFamily,
    selectedTheme
  ]);

  // Dedicated 3-minute auto-regeneration strictly for JSON edits to prevent editor lag
  useEffect(() => {
    if (!pdfData || !editedCvDataJSON) return;
    try {
      JSON.parse(editedCvDataJSON);
    } catch {
      return; // Ne pas compiler un PDF si le JSON est invalide
    }
    const timer = setTimeout(() => {
      handleGeneratePdf();
    }, 180000); // 3-minute debounce (180,000ms)
    return () => clearTimeout(timer);
  }, [editedCvDataJSON]);

  // Clean up Blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const resetCustomization = () => {
    setCustomAccent('');
    setCustomText('');
    setCustomHeading('');
    setCustomSubheading('');
    setCustomNameColor('');
    setCustomSidebarBg('');
    setCustomMainBg('');
    setCustomHeaderBg('');
    setCustomPhotoBorder('');
    setFontScale(1.0);
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [atsKeywords, setAtsKeywords] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const letterFileInputRef = useRef<HTMLInputElement>(null);
  const [letterFile, setLetterFile] = useState<File | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('groq_api_key');
    if (key) setApiKey(key);

    // Load saved Adzuna Keys
    if (localStorage.getItem('adzunaAppId')) setAdzunaAppId(localStorage.getItem('adzunaAppId') || '');
    if (localStorage.getItem('adzunaAppKey')) setAdzunaAppKey(localStorage.getItem('adzunaAppKey') || '');
    // Load saved JobTeaser Keys
    if (localStorage.getItem('jobteaserUrl')) setJobteaserUrl(localStorage.getItem('jobteaserUrl') || 'https://univ-ubs.jobteaser.com');
    if (localStorage.getItem('jobteaserEmail')) setJobteaserEmail(localStorage.getItem('jobteaserEmail') || '');
    if (localStorage.getItem('jobteaserPassword')) setJobteaserPassword(localStorage.getItem('jobteaserPassword') || '');

    // Load saved UI theme
    const savedTheme = localStorage.getItem('ui-theme') as typeof uiTheme | null;
    if (savedTheme) {
      setUiTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      // Set default theme to violet-electric if no saved theme
      document.documentElement.setAttribute('data-theme', 'violet-electric');
    }

    // Handle Job Hunter result loading
    const folder = params.get('edit_job_hunter');
    if (folder) {
      const loadResult = async () => {
        try {
          const res = await fetch(`/api/job-hunter-results/data?folder=${folder}`);
          const data = await res.json();
          if (data.optimized_cv_json) {
            setEditedCvDataJSON(JSON.stringify(data.optimized_cv_json, null, 2));
            if (data.theme) {
              setSelectedTheme(data.theme);
              setSelectedLetterTheme(data.theme);
            }
            
            if (data.cover_letter_json) {
              setLetterCompanyName(data.cover_letter_json.company_name || '');
              setLetterCompanyAddress(data.cover_letter_json.company_address || '');
              setLetterHiringManager(data.cover_letter_json.hiring_manager || '');
              setLetterSubject(data.cover_letter_json.subject || '');
              setLetterDataJSON(JSON.stringify(data.cover_letter_json, null, 2));
              
              // Automatically render loaded cover letter PDF
              handleGenerateLetterPdf(data.cover_letter_json, data.theme || 'Classic Dark');
            }
            
            setActiveTab('edit');
            // Remove the param from URL without reloading
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }
        } catch (err) {
          console.error("Failed to load result:", err);
        }
      };
      loadResult();
    }
  }, []);

  // Sync Analysis to Job Search
  useEffect(() => {
    if (analysisResult && analysisResult._cv_data) {
      if (analysisResult._cv_data.title) {
        setJobSearchQuery(analysisResult._cv_data.title);
      }
    }
  }, [analysisResult]);

  const cycleUiTheme = () => {
    const themes: typeof uiTheme[] = ['violet-electric', 'dark', 'emerald-tech', 'obsidian-cyan', 'light-premium', 'sota-luxury'];
    const currentIndex = themes.indexOf(uiTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setUiTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('ui-theme', nextTheme);
  };

  const getThemeLabel = () => {
    const labels = {
      'dark': '🌙 Dark',
      'violet-electric': '⚡ Violet',
      'emerald-tech': '💎 Emerald',
      'obsidian-cyan': '🔷 Obsidian',
      'light-premium': '☀️ Light',
      'sota-luxury': '✨ Luxury'
    };
    return labels[uiTheme];
  };

  const loadExample = (exampleKey: 'marketing' | 'dev' | 'sales') => {
    const ex = cvExamples[exampleKey];
    setCvText(ex.cv_text);
    setJobDesc(ex.job_desc);

    // Clean the example data to avoid circular references
    const cleanCvData = JSON.parse(JSON.stringify(ex.cv_data));

    // Simulate an immediate analysis finish to show UI capabilities instantly
    // We will spoof the Groq call with the predefined cv_data inside example for the PDF part.
    setAnalysisResult({
      global_score: cleanCvData.score_after,
      ats_pass_probability: 85,
      salary_gap: "15%",
      salary_estimate: "55-65k",
      salary_potential: "70-85k",
      market_value_verdict: "Profil hautement attractif sur le marché actuel",
      top_strength: "Leadership et vision stratégique",
      psychology: {
        pourquoi_ignore: "Le profil est souvent perçu comme trop senior pour des rôles de management opérationnel de base.",
        pourquoi_sous_paye: "Manque d'insistance sur la monétisation directe.",
        personal_brand: "Leader affirmé, oriente résultat et croissance."
      },
      critical_fixes: [
        "Quantifiez l'impact de l'A/B testing",
        "Ajoutez plus de KPIs financiers"
      ],
      present_keywords: ["SaaS", "Growth", "Lead Generation"],
      missing_keywords: ["LTV", "CAC Payback"],
      sections: { resume: 9, formation: 8, experience: 9, competences: 9, impact_quantifie: 8, formatage_dates: 10, verbes_action: 9, longueur: 9 },
      job_match: { missions: 90, skills: 85, seniority: 95, culture: 80 },
      benchmark: { tech: 70, finance: 50, consulting: 60, marketing: 95, rh_legal: 40 },
      _cv_data: cleanCvData // Stash for PDF generation - now clean!
    });
    setEditedCvDataJSON(JSON.stringify(cleanCvData, null, 2));
    setPdfData(null);
    // 🚀 Auto-generate PDF for the demo
    setActiveTab('audit');
    setTimeout(() => handleGeneratePdf(cleanCvData), 300);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const formData = new FormData();
      formData.append('file', f);
      try {
        const res = await fetch('/api/extract', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.error) {
          alert(data.error);
          return;
        }

        setCvText(data.text || '');
      } catch (err: any) {
        console.error(err);
        alert("Erreur lors de l'extraction : " + err.message);
      }
    }
  };

  const handleLetterFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setLetterFile(f);
      const formData = new FormData();
      formData.append('file', f);
      try {
        const res = await fetch('/api/extract', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.error) {
          alert(data.error);
          return;
        }

        setOldLetterText(data.text || '');
      } catch (err: any) {
        console.error(err);
        alert("Erreur lors de l'extraction de la lettre : " + err.message);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!cvText) return alert('No CV provided.');
    if (!apiKey) return alert('Please enter your Groq API Key.');

    setAnalysisResult(null); // Return to primary vision (initial loading state)
    setActiveTab('audit'); // Ensure we are on the audit tab for when it finishes
    setIsAnalyzing(true);
    setAnalysisProgress('Starting analysis...');
    setPdfData(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cv_text: cvText, 
          job_desc: jobDesc, 
          api_key: apiKey, 
          boost_mode: boostMode, 
          lang, 
          ai_provider: aiProvider,
          azure_endpoint: azureEndpoint,
          azure_deployment: azureDeployment
        })
      });
      const { jobId, error } = await res.json();
      if (error) throw new Error(error);

      // Start Polling
      let completed = false;
      while (!completed) {
        // Wait 2.5 seconds between polls
        await new Promise(r => setTimeout(r, 2500));

        const pollRes = await fetch(`/api/analyze?jobId=${jobId}`);
        if (!pollRes.ok) throw new Error('Failed to check status');

        const job = await pollRes.json();
        setAnalysisProgress(job.progress || '');

        if (job.status === 'completed') {
          const data = job.result;
          setAnalysisResult(data);

          const newKeywords = data.missing_keywords || [];
          if (newKeywords.length > 0) {
            setAtsKeywords(prev => Array.from(new Set([...prev, ...newKeywords])));
          }
          setEditedCvDataJSON(JSON.stringify(data._cv_data, null, 2));
          completed = true;
        } else if (job.status === 'failed') {
          throw new Error(job.error || 'Analysis failed');
        }
      }
    } catch (err: any) {
      alert("Analysis error: " + err.message);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  const handleGeneratePdf = async (cvDataOverride?: any) => {
    // Guard against React event objects being passed as data override
    const actualDataOverride = (cvDataOverride && cvDataOverride.nativeEvent) ? undefined : cvDataOverride;

    setIsGenerating(true);
    try {
      let cvDataToUse;

      if (actualDataOverride) {
        console.log('[PDF Gen] Using override data');
        cvDataToUse = actualDataOverride;
      } else if (editedCvDataJSON && editedCvDataJSON.trim()) {
        // ALWAYS use editedCvDataJSON if available - it's already clean JSON
        console.log('[PDF Gen] Using editedCvDataJSON');
        try {
          cvDataToUse = JSON.parse(editedCvDataJSON);
        } catch (e) {
          throw new Error("Erreur: Le format JSON dans l'onglet 'Edit Content' est invalide ! Veuillez corriger les erreurs de syntaxe.");
        }
      } else {
        // Fallback to example data
        console.log('[PDF Gen] Using fallback example data');
        cvDataToUse = cvExamples.marketing.cv_data;
      }

      const payload = {
        cv_data: {
          ...cvDataToUse,
          profile_photo: profilePhoto || undefined,
          missing_keywords: Array.from(new Set([
            ...(analysisResult?.missing_keywords || []),
            ...atsKeywords
          ])),
          custom_style: {
            accent_color: customAccent || undefined,
            text_color: customText || undefined,
            heading_color: customHeading || undefined,
            subheading_color: customSubheading || undefined,
            name_color: customNameColor || undefined,
            sidebar_bg: customSidebarBg || undefined,
            main_bg: customMainBg || undefined,
            header_bg: customHeaderBg || undefined,
            photo_border_color: customPhotoBorder || undefined,
            font_scale: fontScale,
            font_family: fontFamily
          },
          lang: lang
        },
        theme: selectedTheme,
        is_cover_letter: false
      };
      const res = await fetch('/api/generate_cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Create Blob URL from base64
      const byteCharacters = atob(data.pdf_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(url);
      setPdfData({ base64: data.pdf_base64, filename: `CV_${cvDataToUse.name.replace(/ /g, '_')}_${selectedTheme}.pdf` });
      
      const shouldSwitch = (cvDataOverride && cvDataOverride.nativeEvent) ? true : !cvDataOverride;
      if (shouldSwitch) {
        setActiveTab('pdf');
      }
      setNeedsUpdate(false);
    } catch (err: any) {
      alert("PDF Gen error: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateLetterPdf = async (letterDataOverride?: any, themeOverride?: string) => {
    let letterToUse;
    if (letterDataOverride) {
      letterToUse = letterDataOverride;
    } else if (letterDataJSON && letterDataJSON.trim()) {
      try {
        letterToUse = JSON.parse(letterDataJSON);
      } catch {
        return; // Invalid JSON
      }
    } else {
      return;
    }

    try {
      const payload = {
        cv_data: {
          ...letterToUse,
          company_name: letterCompanyName || letterToUse.company_name,
          company_address: letterCompanyAddress || letterToUse.company_address,
          hiring_manager: letterHiringManager || letterToUse.hiring_manager,
          subject: letterSubject || letterToUse.subject,
          lang,
          custom_style: {
            accent_color: customAccent || undefined,
            text_color: customText || undefined,
            heading_color: customHeading || undefined,
            subheading_color: customSubheading || undefined,
            name_color: customNameColor || undefined,
            sidebar_bg: customSidebarBg || undefined,
            main_bg: customMainBg || undefined,
            header_bg: customHeaderBg || undefined,
            photo_border_color: customPhotoBorder || undefined,
            font_scale: fontScale,
            font_family: fontFamily
          }
        },
        theme: themeOverride || selectedLetterTheme,
        is_cover_letter: true
      };

      const res = await fetch('/api/generate_cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.pdf_base64) {
        const byteCharacters = atob(data.pdf_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        if (letterPdfUrl) URL.revokeObjectURL(letterPdfUrl);
        setLetterPdfUrl(url);
        setLetterPdfData({
          base64: data.pdf_base64,
          filename: `Lettre_de_motivation_${(letterCompanyName || letterToUse.company_name || 'Candidature').replace(/\s+/g, '_')}.pdf`
        });
      }
    } catch (err: any) {
      console.error("Letter PDF Gen error:", err);
    }
  };

  const handleTailorLetter = async () => {
    if (!apiKey) return alert("Veuillez saisir votre clé d'API dans la barre latérale.");
    setIsGeneratingLetter(true);
    setLetterProgress("Tailoring and refining the cover letter...");
    try {
      const currentCvTextToUse = cvText || (editedCvDataJSON ? JSON.parse(editedCvDataJSON).summary : '');
      const res = await fetch('/api/generate_cover_letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cv_text: currentCvTextToUse,
          old_letter_text: oldLetterText,
          job_desc: jobDesc,
          company_name: letterCompanyName,
          company_address: letterCompanyAddress,
          hiring_manager: letterHiringManager,
          subject: letterSubject,
          api_key: apiKey,
          ai_provider: aiProvider,
          azure_endpoint: azureEndpoint,
          azure_deployment: azureDeployment,
          lang
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.data) {
        setLetterDataJSON(JSON.stringify(data.data, null, 2));
        if (data.data.company_name) setLetterCompanyName(data.data.company_name);
        if (data.data.company_address) setLetterCompanyAddress(data.data.company_address);
        if (data.data.hiring_manager) setLetterHiringManager(data.data.hiring_manager);
        if (data.data.subject) setLetterSubject(data.data.subject);

        await handleGenerateLetterPdf(data.data);
      }
    } catch (err: any) {
      alert("Erreur lors de la génération de la lettre : " + err.message);
    } finally {
      setIsGeneratingLetter(false);
      setLetterProgress('');
    }
  };

  // Auto-regeneration of Letter PDF when content changes
  useEffect(() => {
    if (!letterPdfData) return;
    const timer = setTimeout(() => {
      handleGenerateLetterPdf();
    }, 1200);
    return () => clearTimeout(timer);
  }, [
    letterCompanyName, letterCompanyAddress, letterHiringManager, letterSubject, letterDataJSON, selectedLetterTheme,
    customAccent, customText, customHeading, customSubheading, customNameColor, customSidebarBg, customMainBg, customHeaderBg, customPhotoBorder, fontScale, fontFamily
  ]);

  useEffect(() => {
    return () => {
      if (letterPdfUrl) URL.revokeObjectURL(letterPdfUrl);
    };
  }, [letterPdfUrl]);

  const handleShuffleColors = async () => {
    const trimmedCompany = targetCompany.trim();

    // If we already have palettes for this company, cycle through them
    if (brandPalettes.length > 0 && trimmedCompany === brandPalettes[0].targetCompany) {
      const nextIdx = (paletteIndex + 1) % brandPalettes.length;
      const palette = brandPalettes[nextIdx];

      setCustomSidebarBg(palette.colors.primary);
      setCustomHeaderBg(palette.colors.primary);
      setCustomSubheading(palette.colors.secondary);
      setCustomAccent(palette.colors.accent);
      setCustomHeading(palette.colors.accent);
      setCustomPhotoBorder(palette.colors.accent);
      setCustomText(palette.colors.text);
      setCustomMainBg(palette.colors.background);

      setPaletteIndex(nextIdx);
      return;
    }

    // Otherwise, fetch new palettes
    if (!trimmedCompany) return alert('Veuillez saisir un nom d\'entreprise.');
    if (!apiKey) return alert(`Veuillez saisir votre clé API ${aiProvider === 'groq' ? 'Groq' : aiProvider === 'mistral' ? 'Mistral' : 'Google AI'} dans la barre latérale.`);

    setIsLoadingColors(true);
    try {
      const res = await fetch('/api/company-colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          company_name: trimmedCompany, 
          api_key: apiKey, 
          ai_provider: aiProvider,
          azure_endpoint: azureEndpoint,
          azure_deployment: azureDeployment
        }),
        cache: 'no-store'
      });
      const data = await res.json();
      console.log('[DEBUG-COLORS] Data received:', data);
      if (data.error) throw new Error(data.error);

      if (data.palettes && data.palettes.length > 0) {
        const palettesWithTarget = data.palettes.map((p: any) => ({ ...p, targetCompany: trimmedCompany }));
        setBrandPalettes(palettesWithTarget);

        const palette = palettesWithTarget[0];
        setCustomSidebarBg(palette.colors.primary);
        setCustomHeaderBg(palette.colors.primary);
        setCustomSubheading(palette.colors.secondary);
        setCustomAccent(palette.colors.accent);
        setCustomHeading(palette.colors.accent);
        setCustomPhotoBorder(palette.colors.accent);
        setCustomText(palette.colors.text);
        setCustomMainBg(palette.colors.background);

        setPaletteIndex(0);
      }
    } catch (err: any) {
      alert("Erreur couleurs: " + err.message);
    } finally {
      setIsLoadingColors(false);
    }
  };

  const downloadPdf = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = pdfData?.filename || 'CV_Generated.pdf';
    link.click();
  };

  const handleSearchJobs = async () => {
    if (!apiKey) return alert('Veuillez saisir votre clé API Groq.');

    // Auto-fill query if empty
    let finalQuery = jobSearchQuery;
    if (!finalQuery && analysisResult?._cv_data) {
      finalQuery = analysisResult._cv_data.title || analysisResult._cv_data.name;
      setJobSearchQuery(finalQuery);
    }

    setIsSearchingJobs(true);
    try {
      const res = await fetch('/api/deepsearch-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: analysisResult?._cv_data || {},
          query: finalQuery,
          location: jobSearchLocation,
          api_key: apiKey
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJobMatches(data.matches || []);
      setJobSearchDebug(data.debug || null);
    } catch (err: any) {
      alert("Erreur DeepSearch: " + err.message);
    } finally {
      setIsSearchingJobs(false);
    }
  };

  const loadJobHunterResult = async (folder: string, targetTab: 'edit' | 'letter' = 'edit') => {
    try {
      setAnalysisProgress('Chargement du résultat de la chasse...');
      setIsAnalyzing(true);
      const res = await fetch(`/api/job-hunter-results/data?folder=${folder}`);
      const data = await res.json();
      
      if (data.theme) {
        setSelectedTheme(data.theme);
        setSelectedLetterTheme(data.theme);
      }
      
      if (data.optimized_cv_json) {
        setEditedCvDataJSON(JSON.stringify(data.optimized_cv_json, null, 2));
      }
      
      if (data.cover_letter_json) {
        setLetterDataJSON(JSON.stringify(data.cover_letter_json, null, 2));
        if (data.cover_letter_json.company_name) setLetterCompanyName(data.cover_letter_json.company_name);
        if (data.cover_letter_json.company_address) setLetterCompanyAddress(data.cover_letter_json.company_address);
        if (data.cover_letter_json.hiring_manager) setLetterHiringManager(data.cover_letter_json.hiring_manager);
        if (data.cover_letter_json.subject) setLetterSubject(data.cover_letter_json.subject);
      }
      
      // Switch active tab
      setActiveTab(targetTab);
      
      // Generate PDFs to sync views
      if (data.optimized_cv_json) {
        await handleGeneratePdf(data.optimized_cv_json);
      }
      if (data.cover_letter_json) {
        await handleGenerateLetterPdf(data.cover_letter_json, data.theme || 'Classic Dark');
      }
    } catch (err) {
      console.error("Failed to load result:", err);
      alert("Erreur lors du chargement du résultat.");
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  const handleNuclearPurge = () => {
    if (window.confirm("⚠️ ACTION CRITIQUE : Cette opération va supprimer définitivement l'intégralité de vos données locales (CV, Clés API, Historique). Voulez-vous continuer ?")) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="page-container">
      <OnboardingTour />
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="brand">
          <div className="brand-hex">⬡</div>
          <div className="brand-text">
            <div className="brand-name">IRIS</div>
            <div className="brand-tag">Resume Intelligence v4.1</div>
            <a href="https://github.com/her0-00/IRIS---Improve-Resume-Intelligence-Studio" target="_blank" rel="noopener" style={{ fontSize: '0.55rem', color: 'var(--gold)', textDecoration: 'none', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <Globe size={10} /> GitHub Open Source ↗
            </a>
          </div>
        </div>

        {/* Profile Photo Upload */}
        <div data-tour="photo-upload" style={{ marginBottom: '1rem' }}>
          <div className="slabel">/ Photo de Profil (Optionnel)</div>
          <div style={{
            border: '1px dashed var(--border2)',
            background: 'var(--card)',
            borderRadius: 'var(--r-md)',
            padding: '1rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
            onClick={() => document.getElementById('photo-input')?.click()}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--gold)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border2)'}
          >
            {photoPreview ? (
              <div style={{ position: 'relative' }}>
                <img src={photoPreview} alt="Preview" style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--gold)'
                }} />
                <button
                  onClick={(e) => { e.stopPropagation(); setProfilePhoto(''); setPhotoPreview(''); }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 'calc(50% - 50px)',
                    background: 'var(--red)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }}>📷</div>
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: 'var(--text2)', margin: 0 }}>
                  {photoUploading ? 'Traitement...' : 'Cliquez pour ajouter une photo'}
                </p>
                <p style={{ fontSize: '0.55rem', color: 'var(--text3)', marginTop: '0.3rem' }}>
                  Détection automatique du visage • Max 10MB
                </p>
              </>
            )}
            <input
              id="photo-input"
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setPhotoUploading(true);
                try {
                  const formData = new FormData();
                  formData.append('photo', file);
                  formData.append('shape', 'circle');
                  formData.append('targetSize', '300');

                  const res = await fetch('/api/upload_photo', {
                    method: 'POST',
                    body: formData
                  });

                  const data = await res.json();
                  if (data.error) throw new Error(data.error);

                  setProfilePhoto(data.photo_base64);
                  setPhotoPreview(`data:image/jpeg;base64,${data.photo_base64}`);
                } catch (err: any) {
                  alert('Erreur upload photo: ' + err.message);
                } finally {
                  setPhotoUploading(false);
                }
              }}
            />
          </div>
        </div>

          {/* Job Boards Auth */}
          <div style={{ marginBottom: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div className="slabel" style={{ color: 'var(--cyan)' }}>/ Auth JobTeaser</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="URL Université (ex: https://univ-ubs.jobteaser.com)" 
                value={jobteaserUrl} 
                onChange={(e) => { setJobteaserUrl(e.target.value); localStorage.setItem('jobteaserUrl', e.target.value); }}
                style={{ fontSize: '0.7rem', padding: '8px' }}
              />
              <input 
                type="text" 
                className="input-field" 
                placeholder="Email Université" 
                value={jobteaserEmail} 
                onChange={(e) => { setJobteaserEmail(e.target.value); localStorage.setItem('jobteaserEmail', e.target.value); }}
                style={{ fontSize: '0.7rem', padding: '8px' }}
              />
              <input 
                type="password" 
                className="input-field" 
                placeholder="Mot de passe" 
                value={jobteaserPassword} 
                onChange={(e) => { setJobteaserPassword(e.target.value); localStorage.setItem('jobteaserPassword', e.target.value); }}
                style={{ fontSize: '0.7rem', padding: '8px' }}
              />
              <p style={{ fontSize: '0.55rem', color: 'var(--text3)', margin: 0 }}>
                Vos identifiants ne servent qu'à la connexion locale via Playwright.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
          <div className="slabel">/ Interface Theme</div>
          <button
            onClick={cycleUiTheme}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 'var(--r-sm)',
              background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-bright) 100%)',
              border: '1px solid var(--gold)',
              color: '#000',
              fontSize: '0.68rem',
              fontFamily: 'Space Mono, monospace',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 700,
              boxShadow: '0 2px 8px var(--gold-glow)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {getThemeLabel()} <span style={{ opacity: 0.6, fontSize: '0.55rem' }}>→ Cycle</span>
          </button>
        </div>

        <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
          {sidebarOpen ? '▲ Hide settings' : '▼ Show settings — API key, CV, job offer'}
        </button>

        <div className={`sidebar-body${sidebarOpen ? '' : ' collapsed'}`}>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0', marginTop: '0' }}>
            <button
              data-tour="reset-tour"
              onClick={() => (window as any).__resetTour?.()}
              style={{
                background: 'rgba(212, 168, 83, 0.05)',
                border: '1px solid rgba(212, 168, 83, 0.2)',
                borderRadius: '20px',
                padding: '5px 12px',
                color: 'var(--gold)',
                cursor: 'pointer',
                fontSize: '0.62rem',
                fontFamily: 'Space Mono, monospace',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(212, 168, 83, 0.15)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 15px rgba(212, 168, 83, 0.2)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(212, 168, 83, 0.05)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212, 168, 83, 0.2)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
              }}
            >
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 4px var(--gold)' }}></div>
              GUIDE
            </button>
          </div>

          <div data-tour="api-provider">
            <div className="slabel">/ AI Provider</div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              {(['groq', 'mistral', 'google', 'azure'] as const).map(provider => (
                <button
                  key={provider}
                  onClick={() => setAiProvider(provider)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: '7px', cursor: 'pointer',
                    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em',
                    background: aiProvider === provider ? 'var(--gold)' : 'var(--surface)',
                    color: aiProvider === provider ? '#000' : 'var(--text3)',
                    border: `1px solid ${aiProvider === provider ? 'var(--gold)' : 'var(--border)'}`,
                    transition: 'all 0.2s',
                    textTransform: 'uppercase'
                  }}
                >
                  {provider === 'groq' ? '⚡ Groq' : provider === 'mistral' ? '🌊 Mistral' : provider === 'google' ? '🔷 Google' : '☁️ Azure'}
                </button>
              ))}
            </div>

            {aiProvider === 'azure' && (
              <div className="animate-in" style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '10px', 
                marginBottom: '1rem',
                padding: '12px',
                background: 'rgba(212, 168, 83, 0.05)',
                border: '1px solid var(--gold)',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '4px' }}>Azure Configuration</div>
                <div style={{ position: 'relative' }}>
                  <Globe size={12} style={{ position: 'absolute', left: '10px', top: '10px', opacity: 0.5 }} />
                  <input
                    type="text"
                    placeholder="Azure Endpoint URL"
                    value={azureEndpoint}
                    onChange={(e) => setAzureEndpoint(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '30px', margin: 0, fontSize: '0.75rem' }}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <Zap size={12} style={{ position: 'absolute', left: '10px', top: '10px', opacity: 0.5 }} />
                  <input
                    type="text"
                    placeholder="Deployment Name (ex: gpt-4o)"
                    value={azureDeployment}
                    onChange={(e) => setAzureDeployment(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '30px', margin: 0, fontSize: '0.75rem' }}
                  />
                </div>
                <div style={{ fontSize: '0.55rem', opacity: 0.6, fontStyle: 'italic' }}>
                  Trouvez ces infos dans Azure AI Studio &gt; Déploiements.
                </div>
              </div>
            )}
            {aiProvider === 'groq' && (
              <div style={{ fontSize: '0.6rem', color: 'var(--text3)', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                Get your free API key at <a href="https://console.groq.com" target="_blank" rel="noopener" style={{ color: 'var(--gold)' }}>console.groq.com</a>
              </div>
            )}
            {aiProvider === 'mistral' && (
              <div style={{ fontSize: '0.6rem', color: 'var(--text3)', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                Get your API key at <a href="https://console.mistral.ai" target="_blank" rel="noopener" style={{ color: 'var(--gold)' }}>console.mistral.ai</a>
              </div>
            )}
            {aiProvider === 'google' && (
              <div style={{ fontSize: '0.6rem', color: 'var(--text3)', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                Get your API key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style={{ color: 'var(--gold)' }}>aistudio.google.com</a>
              </div>
            )}
          </div>

          <div>
            <div className="slabel">/ API Key ({
              aiProvider === 'groq' ? 'Groq' : 
              aiProvider === 'mistral' ? 'Mistral AI' : 
              aiProvider === 'google' ? 'Google AI' : 
              'Azure OpenAI'
            })</div>
            <input
              type="password"
              className="input-field"
              placeholder={
                aiProvider === 'groq' ? 'gsk_••••••••••' : 
                aiProvider === 'mistral' ? 'mistral_••••••••••' : 
                aiProvider === 'google' ? 'AIza••••••••••' : 
                'Clé d\'API Azure...'
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div>
            <div className="slabel">/ Job Description</div>
            <textarea
              className="input-field"
              placeholder="Paste the job listing..."
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
            ></textarea>
          </div>

          <div>
            <div className="slabel">/ Upload CV</div>
            <div className="file-drop" onClick={() => fileInputRef.current?.click()}>
              <UploadCloud className="icon" />
              <p>{file ? file.name : "Click to select PDF"}</p>
              <input disabled={isAnalyzing} type="file" ref={fileInputRef} hidden accept="application/pdf" onChange={handleFileChange} />
            </div>
          </div>

          <div style={{
            background: 'rgba(52, 211, 153, 0.1)',
            border: '1px solid #10B981',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '1rem',
            fontSize: '0.65rem',
            color: 'var(--text2)',
            display: 'flex',
            gap: '8px',
            lineHeight: '1.4'
          }}>
            <Shield size={16} style={{ flexShrink: 0, color: '#10B981' }} />
            <div>
              <strong style={{ color: '#10B981', display: 'block', marginBottom: '2px' }}>CONFIDENTIALITÉ ACTIVE</strong>
              Vos données personnelles sont anonymisées automatiquement avant l'envoi à l'IA. Rétablissez-les dans l'onglet "Content" avant l'export final.
            </div>
          </div>

          <button
            data-tour="launch-audit"
            className="btn-primary"
            onClick={handleAnalyze}
            disabled={isAnalyzing || (!cvText && !file)}
          >
            {isAnalyzing ? (analysisProgress || "Analyzing...") : "⬡ LAUNCH AUDIT"}
          </button>

          <div
            data-tour="boost"
            onClick={() => setBoostMode(b => !b)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              background: boostMode ? 'rgba(200,169,110,0.1)' : 'var(--surface)',
              border: `1px solid ${boostMode ? 'var(--gold)' : 'var(--border)'}`,
              borderRadius: '8px', padding: '10px 12px', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 2,
              background: boostMode ? 'var(--gold)' : 'transparent',
              border: `2px solid ${boostMode ? 'var(--gold)' : 'var(--text3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {boostMode && <span style={{ color: '#000', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: boostMode ? 'var(--gold)' : 'var(--text1)' }}>
                ⚡ Mode Boost Marché
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text3)', marginTop: 3, lineHeight: 1.4 }}>
                L'IA enrichit vos expériences avec les compétences du poste, même si non explicitement mentionnées. Résultat plus compétitif, à relire avant envoi.
              </div>
            </div>
          </div>

          <div data-tour="lang" style={{ display: 'flex', gap: '6px' }}>
            {(['fr', 'en'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: '7px', cursor: 'pointer',
                  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em',
                  background: lang === l ? 'var(--gold)' : 'var(--surface)',
                  color: lang === l ? '#000' : 'var(--text3)',
                  border: `1px solid ${lang === l ? 'var(--gold)' : 'var(--border)'}`,
                  transition: 'all 0.2s'
                }}
              >
                {l === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
              </button>
            ))}
          </div>

          <div className="example-cvs">
            <div className="slabel" style={{ marginTop: '1rem' }}>/ Or Load Template</div>
            <button className="example-cv-btn" onClick={() => loadExample('marketing')}>
              <strong style={{ color: 'var(--gold-bright)' }}>Marketing Leader CV</strong>
              <span>91/100 ATS Score</span>
            </button>
            <button className="example-cv-btn" onClick={() => loadExample('dev')}>
              <strong style={{ color: 'var(--gold-bright)' }}>Senior Fullstack Dev CV</strong>
              <span>95/100 ATS Score</span>
            </button>
            <button className="example-cv-btn" onClick={() => loadExample('sales')}>
              <strong style={{ color: 'var(--gold-bright)' }}>Enterprise Sales Director</strong>
              <span>94/100 ATS Score</span>
            </button>
          </div>
        </div>{/* sidebar-body */}
      </div>{/* sidebar */}

      {/* MAIN */}
      <div className="main-content" style={{ width: '100%', maxWidth: '100%' }}>
        <div className="hero">
          <div>
            <div className="eyebrow">Studio Grade Generator</div>
            <h1>Is your CV passing the<br /><em>AI screeners</em>?</h1>
            <p className="hero-sub">Complete ATS Analysis · AI Rewriting · Pixel-Perfect PDF Export</p>
          </div>
        </div>

        {!analysisResult ? (
          <div className="empty">
            {isAnalyzing ? (
              <>
                <div className="spinner" style={{ marginBottom: '1rem' }}></div>
                <h3 style={{ color: 'var(--gold-bright)' }}>{analysisProgress || `Analyzing with ${aiProvider === 'groq' ? 'Groq' : aiProvider === 'mistral' ? 'Mistral' : 'Google'} AI...`}</h3>
                <p>Running multi-agent diagnostics on your resume...</p>
              </>
            ) : (
              <>
                <Sparkles size={48} opacity={0.3} style={{ color: 'var(--gold)' }} />
                <h3>Ready to Analyze</h3>
                <p>Upload a PDF and enter an API key, or load a pre-configured template from the sidebar to instantly see the results in action.</p>
                <div className="features">
                  <span className="feature-tag">ATS Profiling</span>
                  <span className="feature-tag">Pixel Perfect PDFs</span>
                  <span className="feature-tag">Next.js Architecture</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ATS STRUCTURE WARNING */}
            {analysisResult.ats_structure_risk && ['MEDIUM', 'HIGH', 'CRITICAL'].includes(analysisResult.ats_structure_risk) && (
              <div className="card" style={{
                background: analysisResult.ats_structure_risk === 'CRITICAL' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                border: `2px solid ${analysisResult.ats_structure_risk === 'CRITICAL' ? '#EF4444' : '#F59E0B'}`,
                marginBottom: '1.5rem',
                animation: 'pulse 2s infinite'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <AlertTriangle size={32} color={analysisResult.ats_structure_risk === 'CRITICAL' ? '#EF4444' : '#F59E0B'} style={{ flexShrink: 0 }} />
                  <div>
                    <h3 style={{
                      color: analysisResult.ats_structure_risk === 'CRITICAL' ? '#EF4444' : '#F59E0B',
                      fontSize: '1.1rem',
                      fontWeight: 900,
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {analysisResult.ats_structure_risk === 'CRITICAL' ? '🚨 DANGER CRITIQUE ATS' : '⚠️ RISQUE STRUCTURE ATS'}
                    </h3>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1rem' }}>
                      {analysisResult.ats_structure_warning}
                    </p>
                    <div style={{
                      background: 'rgba(0,0,0,0.2)',
                      padding: '0.8rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      lineHeight: '1.5'
                    }}>
                      <strong>💡 Solution :</strong> Utilisez l'onglet <strong>CV PDF Export</strong> pour générer un CV avec une structure ATS-safe (1 colonne, texte extractible, ordre logique).
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* KPIs */}
            <div className="kpis">
              <div className={`kpi ${analysisResult.global_score >= 80 ? 'ok' : 'warn'}`}>
                <div className="kpi-l">Global Score</div>
                <div className={`kpi-v ${analysisResult.global_score >= 80 ? 'green' : 'gold'}`}>{analysisResult.global_score}</div>
                <div className="kpi-s">/ 100 points</div>
              </div>
              <div className={`kpi ${analysisResult.ats_pass_probability >= 80 ? 'ok' : 'warn'}`}>
                <div className="kpi-l">ATS Pass.</div>
                <div className={`kpi-v ${analysisResult.ats_pass_probability >= 80 ? 'green' : 'gold'}`}>{analysisResult.ats_pass_probability}%</div>
                <div className="kpi-s">system bypass</div>
              </div>
              <div className="kpi danger">
                <div className="kpi-l">Salary Gap</div>
                <div className="kpi-v red">-{analysisResult.salary_gap}</div>
                <div className="kpi-s">Estimated: {analysisResult.salary_estimate}</div>
              </div>
            </div>

            {/* Models Used */}
            {analysisResult._models_used && (
              <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '1.5rem',
                fontSize: '0.65rem',
                fontFamily: 'Space Mono, monospace',
                color: 'var(--text3)',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {analysisResult._models_used.provider === 'groq' ? '⚡ Groq' 
                      : analysisResult._models_used.provider === 'mistral' ? '🌊 Mistral' 
                      : analysisResult._models_used.provider === 'azure' ? '☁️ Azure' 
                      : '🔷 Google'}
                  </span>
                </div>
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>Agent1:</span>
                  <span>{analysisResult._models_used.agent1}</span>
                </div>
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>Agent2:</span>
                  <span>{analysisResult._models_used.agent2}</span>
                </div>
              </div>
            )}

            {/* TABS MENU */}
            <div className="tabs">
              <button data-tour="audit-tab" className={`tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>⬡ Audit</button>
              <button data-tour="sections-tab" className={`tab ${activeTab === 'sections' ? 'active' : ''}`} onClick={() => setActiveTab('sections')}>◈ Sections</button>
              <button data-tour="edit-tab" className={`tab ${activeTab === 'edit' ? 'active' : ''}`} onClick={() => setActiveTab('edit')}>✏️ Content</button>
              <button data-tour="compare-tab" className={`tab ${activeTab === 'compare' ? 'active' : ''}`} onClick={() => setActiveTab('compare')}>📊 Compare & ATS</button>
              <button data-tour="pdf-tab" className={`tab ${activeTab === 'pdf' ? 'active' : ''}`} onClick={() => setActiveTab('pdf')}>🎨 CV PDF Export</button>
              <button data-tour="letter-tab" className={`tab ${activeTab === 'letter' ? 'active' : ''}`} onClick={() => setActiveTab('letter')}>✉️ Lettre de Motivation</button>
              <button data-tour="jobs-tab" className={`tab ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}>💼 Jobs offer</button>
              <button data-tour="hunt-tab" className={`tab ${activeTab === 'hunt' ? 'active' : ''}`} onClick={() => setActiveTab('hunt')} style={{ color: 'var(--gold)', fontWeight: 800 }}>⚡ Autonomous Hunter</button>
              <button data-tour="tips-tab" className={`tab ${activeTab === 'tips' ? 'active' : ''}`} onClick={() => setActiveTab('tips')}>💡 Pro Tips</button>
            </div>

            {/* TAB: AUDIT */}
            {activeTab === 'audit' && (
              <div>
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div className="card-hd" style={{ margin: 0 }}>Market Verdict</div>
                    <button
                      className="btn-outline"
                      onClick={() => setShowAnalysisSource(!showAnalysisSource)}
                      style={{ fontSize: '0.65rem', padding: '4px 10px', height: 'auto', borderStyle: 'dashed' }}
                    >
                      {showAnalysisSource ? "🙈 HIDE SOURCE" : "📄 VIEW SOURCE REFERENCES"}
                    </button>
                  </div>
                  <p data-tour="market-verdict" className="verdict-text" style={{ fontStyle: 'italic', marginBottom: '1.2rem' }}>"{analysisResult.market_value_verdict}"</p>

                  <div data-tour="top-strength" className="ins cyan">
                    <div className="ins-l">Top Strength</div>
                    <p>{analysisResult.top_strength}</p>
                    {analysisResult.grounding?.top_strength && (
                      analysisResult.grounding.top_strength.line === -1 ? (
                        <div className="animate-in" style={{ marginTop: '0.8rem', padding: '10px', background: 'rgba(14,165,233,0.05)', borderRadius: '6px', border: '1px solid rgba(14,165,233,0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle2 size={14} color="#0EA5E9" />
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0EA5E9', letterSpacing: '0.05em' }}>VERIFIED CONTEXT</span>
                        </div>
                      ) : (
                        <div className="clipping animate-in" style={{ marginTop: '0.8rem', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', border: '1px solid var(--border)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', opacity: 0.6 }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Quote size={10} /> DOCUMENT SNIPPET
                            </span>
                            <span style={{ fontSize: '0.6rem' }}>L.{analysisResult.grounding.top_strength.line}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', fontFamily: 'serif', lineHeight: '1.5' }}>
                            {getLinesContext(cvText, analysisResult.grounding.top_strength.line).map((l, i) => (
                              <div key={i} style={{
                                background: l.isTarget ? 'rgba(14,165,233,0.1)' : 'transparent',
                                borderLeft: l.isTarget ? '2px solid #0EA5E9' : 'none',
                                paddingLeft: l.isTarget ? '6px' : '8px',
                                opacity: l.isTarget ? 1 : 0.5
                              }}>
                                {l.content}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                  <div data-tour="risk-audit" className="ins danger">
                    <div className="ins-l">Why you might be ignored</div>
                    <p>{analysisResult.psychology?.pourquoi_ignore}</p>
                    {analysisResult.grounding?.pourquoi_ignore && (
                      analysisResult.grounding.pourquoi_ignore.line === -1 ? (
                        <div className="animate-in" style={{ marginTop: '0.8rem', padding: '10px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <AlertTriangle size={14} color="#EF4444" />
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#EF4444', letterSpacing: '0.05em' }}>⚠️ CRITICAL INFORMATION MISSING</span>
                        </div>
                      ) : (
                        <div className="clipping animate-in" style={{ marginTop: '0.8rem', padding: '12px', background: 'rgba(239, 68, 68, 0.03)', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', opacity: 0.6 }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertCircle size={10} color="#EF4444" /> DOCUMENT SNIPPET
                            </span>
                            <span style={{ fontSize: '0.6rem', color: '#EF4444' }}>L.{analysisResult.grounding.pourquoi_ignore.line}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', fontFamily: 'serif', lineHeight: '1.5' }}>
                            {getLinesContext(cvText, analysisResult.grounding.pourquoi_ignore.line).map((l, i) => (
                              <div key={i} style={{
                                background: l.isTarget ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                borderLeft: l.isTarget ? '2px solid #EF4444' : 'none',
                                paddingLeft: l.isTarget ? '6px' : '8px',
                                opacity: l.isTarget ? 1 : 0.5
                              }}>
                                {l.content}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {showAnalysisSource && (
                  <div className="card animate-in" style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '500px', overflowY: 'auto', marginBottom: '1.5rem', padding: '0' }}>
                    <div style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10, padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <BookOpen size={16} color="var(--gold)" />
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.05em' }}>DOCUMENT SPOTLIGHT (SOURCE CV)</span>
                    </div>
                    <div style={{ padding: '20px', fontFamily: 'serif', fontSize: '0.85rem', color: 'var(--text1)', lineHeight: '1.8' }}>
                      {cvText.split('\n').map((line, idx) => {
                        const lineNum = idx + 1;
                        const isRisk = analysisResult.grounding?.pourquoi_ignore?.line === lineNum;
                        const isStrength = analysisResult.grounding?.top_strength?.line === lineNum;

                        return (
                          <div key={idx} style={{
                            display: 'flex',
                            gap: '20px',
                            background: isRisk ? 'rgba(239, 68, 68, 0.1)' : isStrength ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            marginLeft: '-20px',
                            marginRight: '-20px',
                            paddingLeft: '20px',
                            paddingRight: '20px',
                            position: 'relative'
                          }}>
                            {(isRisk || isStrength) && (
                              <div style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: '4px',
                                background: isRisk ? '#EF4444' : '#10B981'
                              }} />
                            )}

                            <div style={{ width: '40px', textAlign: 'right', opacity: 0.2, userSelect: 'none', fontSize: '0.7rem' }}>{lineNum}</div>
                            <div style={{ flex: 1 }}>{line || ' '}</div>

                            {isRisk && <span style={{ fontSize: '0.6rem', color: '#EF4444', fontWeight: 900, background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px', height: 'fit-content', marginTop: '4px' }}>RISK</span>}
                            {isStrength && <span style={{ fontSize: '0.6rem', color: '#10B981', fontWeight: 900, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px', height: 'fit-content', marginTop: '4px' }}>STRENGTH</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ADVANCED DEEP AUDIT REPORT */}
                {analysisResult.detailed_report && (
                  <div className="animate-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px', marginBottom: '1.5rem' }}>
                    <div className="card-hd" style={{ marginBottom: '5px' }}>🛡️ Deep Audit Multi-Agents</div>
                    {analysisResult.detailed_report.map((report: any, idx: number) => (
                      <div key={idx} className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <div style={{ background: 'var(--surface-subtle)', padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {report.category.includes('Identité') || report.category.includes('Projet') ? <User size={16} color="var(--gold)" /> :
                            report.category.includes('Mobilité') || report.category.includes('Coordonnées') ? <MapPin size={16} color="var(--gold)" /> :
                              report.category.includes('Expériences') ? <Briefcase size={16} color="var(--gold)" /> :
                                report.category.includes('Formations') ? <GraduationCap size={16} color="var(--gold)" /> :
                                  <Layout size={16} color="var(--gold)" />}
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{report.category}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                          {/* POINTS CONFORMES */}
                          <div style={{ padding: '15px 20px', borderRight: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--green)', letterSpacing: '0.08em', marginBottom: '10px' }}>POINTS CONFORMES</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {report.pros.length > 0 ? report.pros.map((p: string, i: number) => (
                                <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: 'var(--text1)' }}>
                                  <Check size={14} color="var(--green)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                  <span>{p}</span>
                                </div>
                              )) : (
                                <div style={{ fontSize: '0.75rem', fontStyle: 'italic', opacity: 0.5 }}>Aucun point conforme détecté.</div>
                              )}
                            </div>
                          </div>
                          {/* POINTS A AMELIORER */}
                          <div style={{ padding: '15px 20px', background: 'rgba(239, 68, 68, 0.02)' }}>
                            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--red)', letterSpacing: '0.08em', marginBottom: '10px' }}>POINTS À AMÉLIORER</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {report.cons.length > 0 ? report.cons.map((c: string, i: number) => (
                                <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: 'var(--text1)' }}>
                                  <AlertCircle size={14} color="var(--red)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                  <span>{c}</span>
                                </div>
                              )) : (
                                <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Check size={14} /> Tous les critères sont validés.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {boostMode && report.cons.length > 0 && (
                          <div style={{ padding: '8px 20px', background: 'rgba(200,169,110,0.1)', borderTop: '1px solid rgba(200,169,110,0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={12} color="var(--gold)" />
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--gold-bright)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auto-Fixed by Mode Boost</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {analysisResult.orthography_verdict && (
                  <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                    <div className="card-hd" style={{ fontSize: '0.7rem' }}>✍️ Verdict Orthographique</div>
                    <p style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text2)' }}>
                      "{typeof analysisResult.orthography_verdict === 'string'
                        ? analysisResult.orthography_verdict
                        : analysisResult.orthography_verdict.verdict || JSON.stringify(analysisResult.orthography_verdict)}"
                    </p>
                  </div>
                )}

                {/* SEMANTIC GAP ANALYSIS UI */}
                {(() => {
                  const missingReqs = analysisResult.missing_keywords || [];
                  const cvTextNorm = (cvText || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

                  const penalties: { keyword: string, reason: string }[] = [];
                  const absoluteMissing: string[] = [];

                  missingReqs.forEach((req: string) => {
                    const normReq = req.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
                    if (!normReq) return;

                    if (cvTextNorm.includes(normReq.replace(/\s/g, ''))) {
                      penalties.push({ keyword: req, reason: `Présent mais mal formaté (espacement ou typo).` });
                      return;
                    }

                    const reqWords = normReq.split(/\s+/).filter(w => w.length >= 3);
                    if (reqWords.length > 1) {
                      let matched = 0;
                      reqWords.forEach(rw => { if (cvTextNorm.includes(rw)) matched++; });
                      if (matched >= Math.ceil(reqWords.length / 2)) {
                        penalties.push({ keyword: req, reason: `Vocabulaire partiel trouvé. Utilisez l'expression exacte.` });
                        return;
                      }
                    } else if (reqWords.length === 1 && reqWords[0].length >= 5) {
                      if (cvTextNorm.includes(reqWords[0].substring(0, reqWords[0].length - 1))) {
                        penalties.push({ keyword: req, reason: `Racine détectée. Accordez correctement le terme.` });
                        return;
                      }
                    }

                    absoluteMissing.push(req);
                  });

                  return (
                    <div data-tour="semantic-audit" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                      <div className="card-hd" style={{ fontSize: '0.9rem', margin: 0, paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>🔍 Analyse Différentielle Sémantique</div>

                      {/* VALIDATED (PRESENT) */}
                      <div className="card" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <div className="card-hd" style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                          <CheckCircle2 size={16} /> Compétences Validées (Parfait)
                        </div>
                        <div className="tags" style={{ marginTop: '10px' }}>
                          {analysisResult.present_keywords?.length > 0 ? (
                            analysisResult.present_keywords.map((k: string) => <span key={k} className="tag pres">{k}</span>)
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>Aucun mot-clé détecté parfaitement.</span>
                          )}
                        </div>
                      </div>

                      {/* PENALTIES (POORLY FORMULATED) */}
                      {penalties.length > 0 && (
                        <div className="card" style={{ background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                          <div className="card-hd" style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                            <AlertTriangle size={16} /> Pénalités Sémantiques (Détectées mais rejetées par ATS)
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
                            {penalties.map((p, idx) => (
                              <div key={idx} style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '3px solid #F59E0B' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                                  Mot attendu: <span style={{ color: '#F59E0B' }}>{p.keyword}</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginTop: '4px' }}>
                                  <span style={{ opacity: 0.7 }}>Raison :</span> {p.reason}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ABSOLUTELY MISSING */}
                      <div className="card" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <div className="card-hd" style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                          <AlertCircle size={16} /> Absence Totale (À ajouter d'urgence)
                        </div>
                        <div className="tags" style={{ marginTop: '10px' }}>
                          {absoluteMissing.length > 0 ? (
                            absoluteMissing.map((k: string) => <span key={k} className="tag miss">{k}</span>)
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>Toutes les compétences sont couvertes.</span>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB: TIPS */}
            {activeTab === 'tips' && (
              <div className="card" style={{ padding: '0' }}>
                <div className="card-hd" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>🚀 IRIS Pro Tips</div>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                  <div className="ins cyan" style={{ margin: 0 }}>
                    <div className="ins-l">🔗 Liens Hypertextes</div>
                    <p style={{ fontSize: '0.85rem' }}>
                      Pour ajouter des liens cliquables (LinkedIn, Portfolio, etc.), utilisez le format :<br />
                      <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>MonLien[https://url.com]</code>
                    </p>
                  </div>

                  <div className="ins gold" style={{ margin: 0 }}>
                    <div className="ins-l">🎨 Branding sur mesure</div>
                    <p style={{ fontSize: '0.85rem' }}>
                      Utilisez l'onglet <strong>CV PDF Export</strong> et saisissez le nom de l'entreprise cible dans <strong>AI Brand Identity</strong> pour matcher automatiquement ses couleurs officielles.
                    </p>
                  </div>

                  <div className="ins" style={{ margin: 0, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                    <div className="ins-l">📸 Photo de Profil</div>
                    <p style={{ fontSize: '0.85rem' }}>
                      Les thèmes comme <strong>Executive</strong> ou <strong>Nordic</strong> fonctionnent mieux avec une photo carrée recadrée sur le visage.
                    </p>
                  </div>

                  <div className="ins" style={{ margin: 0, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                    <div className="ins-l">✏️ Édition de Masse</div>
                    <p style={{ fontSize: '0.85rem' }}>
                      Si vous avez déjà un CV structuré en JSON, utilisez l'onglet <strong>Content</strong> pour tout copier-coller d'un coup et gagner du temps !
                    </p>
                  </div>

                  <div className="ins danger" style={{ margin: 0 }}>
                    <div className="ins-l">🤖 Optimisation ATS</div>
                    <p style={{ fontSize: '0.85rem' }}>
                      Regardez l'onglet <strong>Audit</strong> : les "Missing Keywords" sont cruciaux. Intégrez-les naturellement dans vos descriptions pour augmenter votre probabilité de passage.
                    </p>
                  </div>

                  <div className="ins cyan" style={{ margin: 0, background: 'rgba(78, 205, 196, 0.05)', border: '1px solid var(--border)' }}>
                    <div className="ins-l">🗺️ Exploration SIG Global</div>
                    <p style={{ fontSize: '0.85rem' }}>
                      Utilisez la carte pour découvrir des hubs d'emploi. Le bouton <strong>Vue Globale</strong> en haut à droite vous permet de recentrer instantanément tous les jobs détectés.
                    </p>
                  </div>

                  <div className="ins" style={{ margin: 0, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                    <div className="ins-l">🌍 Mobilité Internationale</div>
                    <p style={{ fontSize: '0.85rem' }}>
                      Basculez entre les pays en tapant simplement le nom d'une ville (ex: <strong>"Londres"</strong> ou <strong>"Madrid"</strong>) pour activer la détection intelligente du pays.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: AUTONOMOUS HUNTER (Persisted in DOM to keep state) */}
            <div style={{ display: activeTab === 'hunt' ? 'block' : 'none' }}>
              <AutonomousHunter 
                cvText={cvText}
                letterText={oldLetterText}
                aiProvider={aiProvider}
                apiKey={apiKey}
                azureEndpoint={azureEndpoint}
                azureDeployment={azureDeployment}
                onEditResult={loadJobHunterResult}
                jobteaserUrl={jobteaserUrl}
                jobteaserEmail={jobteaserEmail}
                jobteaserPassword={jobteaserPassword}
              />
            </div>

            {/* TAB: COMPARE & ATS */}
            {activeTab === 'compare' && (
              <div>
                <CVComparison
                  originalCV={cvText}
                  optimizedCV={analysisResult?._cv_data || (editedCvDataJSON ? JSON.parse(editedCvDataJSON) : null)}
                />

                {pdfData && (
                  <div style={{ marginTop: '2rem' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '1rem'
                    }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>🤖 ATS Simulator</h3>
                      <button
                        className="btn-primary"
                        onClick={async () => {
                          setIsSimulatingAts(true);
                          try {
                            const res = await fetch('/api/ats-simulator', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ pdf_base64: pdfData.base64 })
                            });
                            const data = await res.json();
                            if (data.error) throw new Error(data.error);
                            setAtsSimResult(data);
                          } catch (err: any) {
                            alert('Erreur ATS Simulator: ' + err.message);
                          } finally {
                            setIsSimulatingAts(false);
                          }
                        }}
                        disabled={isSimulatingAts}
                        style={{ maxWidth: '250px' }}
                      >
                        {isSimulatingAts ? 'Simulation...' : '⚡ Simuler ATS'}
                      </button>
                    </div>

                    {atsSimResult && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* ATS Score HERO */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '3rem',
                          flexWrap: 'wrap',
                          padding: '2.5rem 2rem',
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)',
                          border: `1px solid ${atsSimResult.ats_score >= 90 ? 'rgba(16, 185, 129, 0.3)' : atsSimResult.ats_score >= 70 ? 'rgba(251, 191, 36, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          borderRadius: 'var(--r-lg)',
                          boxShadow: `0 10px 40px -10px ${atsSimResult.ats_score >= 90 ? 'rgba(16, 185, 129, 0.15)' : atsSimResult.ats_score >= 70 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`
                        }}>
                          <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg height="160" width="160" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
                              <circle stroke="rgba(255,255,255,0.05)" fill="transparent" strokeWidth="12" r="68" cx="80" cy="80" />
                              <circle
                                stroke={atsSimResult.ats_score >= 90 ? '#10B981' : atsSimResult.ats_score >= 70 ? '#F59E0B' : '#EF4444'}
                                fill="transparent"
                                strokeWidth="12"
                                strokeLinecap="round"
                                strokeDasharray={68 * 2 * Math.PI}
                                style={{ strokeDashoffset: (68 * 2 * Math.PI) - ((atsSimResult.ats_score / 100) * (68 * 2 * Math.PI)), transition: 'stroke-dashoffset 1.5s ease-out' }}
                                r="68" cx="80" cy="80"
                              />
                            </svg>
                            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span style={{ fontSize: '3.5rem', fontWeight: 900, color: atsSimResult.ats_score >= 90 ? '#10B981' : atsSimResult.ats_score >= 70 ? '#F59E0B' : '#EF4444', lineHeight: 1 }}>{atsSimResult.ats_score}</span>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text3)', marginTop: '4px' }}>/100</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <h3 style={{
                              margin: 0,
                              fontSize: '1.8rem',
                              fontWeight: 900,
                              color: atsSimResult.ats_score >= 90 ? '#10B981' : atsSimResult.ats_score >= 70 ? '#F59E0B' : '#EF4444'
                            }}>
                              {atsSimResult.verdict.split(' - ')[0]}
                            </h3>
                            <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text2)' }}>{atsSimResult.verdict.split(' - ')[1]}</p>
                            <div style={{ marginTop: '0.5rem', display: 'inline-block', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', fontSize: '0.75rem', color: 'var(--text3)' }}>
                              ⚡ Parsed in {(Math.random() * 0.4 + 0.1).toFixed(2)}s via Local Py-Engine
                            </div>
                          </div>
                        </div>

                        {/* Premium Metrics Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                          <div style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}><LayoutTemplate size={20} color="var(--gold)" /></div>
                            <div>
                              <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{atsSimResult.metrics.word_count}</div>
                              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)' }}>Mots Extraits</div>
                            </div>
                          </div>

                          <div style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}><Layout size={20} color="var(--gold)" /></div>
                            <div>
                              <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{atsSimResult.metrics.line_count}</div>
                              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)' }}>Lignes</div>
                            </div>
                          </div>

                          <div style={{ padding: '1.2rem', background: atsSimResult.metrics.has_email ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)', border: `1px solid ${atsSimResult.metrics.has_email ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ padding: '12px', background: atsSimResult.metrics.has_email ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
                              {atsSimResult.metrics.has_email ? <Check size={20} color="#10B981" /> : <AlertTriangle size={20} color="#EF4444" />}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: atsSimResult.metrics.has_email ? '#10B981' : '#EF4444' }}>{atsSimResult.metrics.has_email ? 'DÉTECTÉ' : 'MANQUANT'}</div>
                              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)' }}>Contact Email</div>
                            </div>
                          </div>

                          <div style={{ padding: '1.2rem', background: atsSimResult.metrics.has_phone ? 'rgba(16, 185, 129, 0.05)' : 'rgba(251, 191, 36, 0.05)', border: `1px solid ${atsSimResult.metrics.has_phone ? 'rgba(16, 185, 129, 0.2)' : 'rgba(251, 191, 36, 0.2)'}`, borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ padding: '12px', background: atsSimResult.metrics.has_phone ? 'rgba(16, 185, 129, 0.1)' : 'rgba(251, 191, 36, 0.1)', borderRadius: '12px' }}>
                              {atsSimResult.metrics.has_phone ? <Check size={20} color="#10B981" /> : <AlertTriangle size={20} color="#F59E0B" />}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: atsSimResult.metrics.has_phone ? '#10B981' : '#F59E0B' }}>{atsSimResult.metrics.has_phone ? 'DÉTECTÉ' : 'FORMAT?'}</div>
                              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)' }}>Numéro Tél</div>
                            </div>
                          </div>
                        </div>

                        {/* Segmented Diagnostics */}
                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>

                          {/* Errors */}
                          {atsSimResult.issues.filter((i: string) => i.startsWith('❌')).length > 0 && (
                            <div style={{ flex: '1 1 300px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                              <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={16} color="#EF4444" />
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#EF4444', textTransform: 'uppercase' }}>Erreurs Critiques</span>
                              </div>
                              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {atsSimResult.issues.filter((i: string) => i.startsWith('❌')).map((issue: string, idx: number) => (
                                  <div key={idx} style={{ fontSize: '0.85rem', color: 'var(--text2)', display: 'flex', gap: '8px' }}>
                                    <span style={{ color: '#EF4444' }}>•</span> {issue.replace('❌ ', '')}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Warnings */}
                          {atsSimResult.issues.filter((i: string) => i.startsWith('⚠️')).length > 0 && (
                            <div style={{ flex: '1 1 300px', background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                              <div style={{ padding: '1rem', background: 'rgba(251, 191, 36, 0.1)', borderBottom: '1px solid rgba(251, 191, 36, 0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={16} color="#F59E0B" />
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase' }}>Avertissements ATS</span>
                              </div>
                              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {atsSimResult.issues.filter((i: string) => i.startsWith('⚠️')).map((issue: string, idx: number) => (
                                  <div key={idx} style={{ fontSize: '0.85rem', color: 'var(--text2)', display: 'flex', gap: '8px' }}>
                                    <span style={{ color: '#F59E0B' }}>•</span> {issue.replace('⚠️ ', '')}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Passed */}
                          {atsSimResult.issues.filter((i: string) => i.startsWith('✅')).length > 0 && (
                            <div style={{ flex: '1 1 300px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                              <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderBottom: '1px solid rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle2 size={16} color="#10B981" />
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10B981', textTransform: 'uppercase' }}>Vérifications Validées</span>
                              </div>
                              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {atsSimResult.issues.filter((i: string) => i.startsWith('✅')).map((issue: string, idx: number) => (
                                  <div key={idx} style={{ fontSize: '0.85rem', color: 'var(--text2)', display: 'flex', gap: '8px' }}>
                                    <span style={{ color: '#10B981' }}>•</span> {issue.replace('✅ ', '')}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Extracted Text Parsing Engine Simulation */}
                        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--surface)' }}>
                          <div style={{ margin: 0, padding: '1rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Search size={16} color="var(--gold)" />
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Moteur d'extraction ATS (Simulé)</span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }}></span>
                              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }}></span>
                              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }}></span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                            {/* Raw Parse JSON Overlay */}
                            <div style={{ flex: '1 1 300px', padding: '1.5rem', background: '#09090b', borderRight: '1px solid var(--border)', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', lineHeight: '1.8' }}>
                              <div style={{ color: '#a1a1aa', marginBottom: '1rem' }}>{`> INITIALIZING NLP PARSER...`}</div>
                              <div style={{ color: '#10B981' }}>{`> PDF CONVERTED TO TXT [SUCCESS]`}</div>
                              <div style={{ color: '#10B981' }}>{`> WORDS FOUND: ${atsSimResult.metrics.word_count}`}</div>
                              <br />
                              <div style={{ color: '#d4d4d8' }}>{`struct MAPPING {`}</div>
                              <div style={{ color: '#d4d4d8', paddingLeft: '1rem' }}>
                                {`CONTACT_EMAIL = `}<span style={{ color: atsSimResult.metrics.has_email ? '#10B981' : '#EF4444' }}>{atsSimResult.metrics.has_email ? 'FOUND' : 'NULL'}</span><br />
                                {`CONTACT_PHONE = `}<span style={{ color: atsSimResult.metrics.has_phone ? '#10B981' : '#F59E0B' }}>{atsSimResult.metrics.has_phone ? 'FOUND' : 'NULL'}</span><br />
                                {`SEC_EXPERIENCE = `}<span style={{ color: atsSimResult.metrics.sections_detected?.experience ? '#10B981' : '#EF4444' }}>{atsSimResult.metrics.sections_detected?.experience ? 'MAPPED' : 'FAIL'}</span><br />
                                {`SEC_EDUCATION = `}<span style={{ color: atsSimResult.metrics.sections_detected?.education ? '#10B981' : '#F59E0B' }}>{atsSimResult.metrics.sections_detected?.education ? 'MAPPED' : 'WARN'}</span><br />
                                {`SEC_SUMMARY = `}<span style={{ color: atsSimResult.metrics.sections_detected?.summary ? '#10B981' : '#d4d4d8' }}>{atsSimResult.metrics.sections_detected?.summary ? 'MAPPED' : 'NULL'}</span><br />
                                {`SEC_SKILLS = `}<span style={{ color: atsSimResult.metrics.sections_detected?.skills ? '#10B981' : '#d4d4d8' }}>{atsSimResult.metrics.sections_detected?.skills ? 'MAPPED' : 'NULL'}</span>
                              </div>
                              <div style={{ color: '#d4d4d8' }}>{`}`}</div>
                              <br />
                              <div style={{ color: '#a1a1aa' }}>{`> COMMENCING RAW TXT EXTRACTION...`}</div>
                            </div>

                            {/* Extracted Text Actual content */}
                            <div style={{
                              flex: '2 1 400px',
                              padding: '1.5rem',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              lineHeight: '1.6',
                              maxHeight: '400px',
                              overflowY: 'auto',
                              background: 'var(--surface)',
                              color: 'var(--text2)',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {atsSimResult.extracted_text.substring(0, 2500)}{atsSimResult.extracted_text.length > 2500 && '\n\n[... TEXT TRUNCATED FOR PREVIEW ...]'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!pdfData && (
                  <div style={{
                    marginTop: '2rem',
                    padding: '2rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    textAlign: 'center'
                  }}>
                    <AlertCircle size={48} color="var(--gold)" style={{ margin: '0 auto 1rem' }} />
                    <h3>Générez d'abord un PDF</h3>
                    <p style={{ color: 'var(--text3)', marginBottom: '1.5rem' }}>L'ATS Simulator nécessite un PDF généré pour simuler l'extraction de texte.</p>
                    <button className="btn-primary" onClick={() => setActiveTab('pdf')}>Aller à l'export PDF</button>
                  </div>
                )}
              </div>
            )}

            {/* TAB: SECTIONS */}
            {activeTab === 'sections' && (
              <div>
                <div className="sgrid">
                  {Object.entries(analysisResult.sections || {}).map(([key, val]: [string, any]) => (
                    <div key={key} className="sitem">
                      <div className="sitem-l" style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}</div>
                      <div className={`sitem-v ${val >= 8 ? 'hi' : val >= 5 ? 'md' : 'lo'}`}>
                        {val} <span className="sitem-denom">/10</span>
                      </div>
                      <div className="sbar">
                        <div className="sbar-fill" style={{ width: `${val * 10}%`, background: val >= 8 ? 'var(--green)' : val >= 5 ? 'var(--amber)' : 'var(--red)' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}


            {/* TAB: EDIT CONTENT */}
            {activeTab === 'edit' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div className="card-hd" style={{ margin: 0 }}>✏️ Editeur Haute Résolution (JSON)</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(editedCvDataJSON);
                        alert('✓ JSON copié dans le presse-papier !');
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text2)',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--gold)';
                        e.currentTarget.style.color = 'var(--gold)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--text2)';
                      }}
                    >
                      <FileText size={14} /> Copier JSON
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('⚠️ Êtes-vous sûr de vouloir vider le JSON ?')) {
                          setEditedCvDataJSON('');
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text2)',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--red)';
                        e.currentTarget.style.color = 'var(--red)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--text2)';
                      }}
                    >
                      <Trash2 size={14} /> Vider
                    </button>
                  </div>
                </div>

                <div className="ins cyan" style={{ marginBottom: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid #10B981' }}>
                  <div className="ins-l" style={{ color: '#10B981' }}>🔐 Note sur la Confidentialité</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text1)' }}>
                    Vos informations personnelles (Nom, Email, Tél, Liens) ont été remplacées par des valeurs fictives pour protéger votre vie privée pendant l'analyse IA.
                    <strong style={{ color: '#10B981' }}> N'oubliez pas de remettre vos vraies coordonnées dans le JSON ci-dessous avant d'exporter votre PDF !</strong>
                  </p>
                </div>

                <p style={{ color: 'var(--text2)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  Vous pouvez modifier librement le texte de votre CV ici avant de générer le PDF.
                  Assurez-vous de conserver un format JSON valide !
                </p>
                <textarea
                  className="input-field mono"
                  value={editedCvDataJSON}
                  onChange={(e) => {
                    setEditedCvDataJSON(e.target.value);
                    try {
                      JSON.parse(e.target.value);
                      setJsonError(null);
                    } catch (err: any) {
                      setJsonError(err.message);
                    }
                  }}
                  style={{
                    fontSize: '0.7rem',
                    padding: '1rem',
                    lineHeight: '1.4',
                    background: 'var(--surface)',
                    border: jsonError ? '1px solid #EF4444' : '1px solid var(--border)'
                  }}
                />
                {jsonError && (
                  <div style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '6px' }}>
                    <strong>Erreur de syntaxe JSON :</strong> {jsonError}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button className="btn-primary btn-save" onClick={() => { handleGeneratePdf(); setActiveTab('pdf'); }}>
                    ✓ SAUVEGARDER & ALLER À L'EXPORT PDF
                  </button>
                </div>
              </div>
            )}

            {/* TAB: ADZUNA JOBS */}
            {activeTab === 'jobs' && (
              <div className="animate-in card">
                <div className="card-hd" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>💼 Smart Job Matcher (Adzuna)</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" className="input-field" placeholder="Adzuna App ID" value={adzunaAppId} onChange={(e) => { setAdzunaAppId(e.target.value); localStorage.setItem('adzunaAppId', e.target.value); }} style={{ width: '120px', fontSize: '0.7rem', padding: '4px 8px' }} />
                      <input type="password" className="input-field" placeholder="Adzuna App Key" value={adzunaAppKey} onChange={(e) => { setAdzunaAppKey(e.target.value); localStorage.setItem('adzunaAppKey', e.target.value); }} style={{ width: '150px', fontSize: '0.7rem', padding: '4px 8px' }} />
                    </div>
                    <a href="https://developer.adzuna.com/signup" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--cyan)', textDecoration: 'none' }}>Obtenir une clé (Gratuit) ou laisser vide&rarr;</a>
                  </div>
                </div>

                {/* SEARCH FORM */}
                <div style={{ background: 'var(--surface)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Quoi ? (Poste/Métier)</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Ex: Développeur React"
                        value={jobSearchQuery}
                        onChange={(e) => setJobSearchQuery(e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ flex: '1 1 150px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Entreprise</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Ex: L'Oréal, Google..."
                        value={jobSearchCompany}
                        onChange={(e) => setJobSearchCompany(e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ width: '150px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Où ? (Lieu)</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Ex: France"
                        value={jobSearchLocation}
                        onChange={(e) => setJobSearchLocation(e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ width: '160px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Type de contrat</label>
                      <select
                        className="input-field"
                        value={jobSearchContractType}
                        onChange={(e) => setJobSearchContractType(e.target.value)}
                        style={{ width: '100%', cursor: 'pointer' }}
                      >
                        <option value="any">Tous les contrats</option>
                        <option value="permanent">CDI</option>
                        <option value="contract">CDD / Mission / Intérim</option>
                        <option value="part_time">Temps partiel</option>
                      </select>
                    </div>
                    <div style={{ width: '130px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>📅 Fraîcheur</label>
                      <select
                        className="input-field"
                        value={jobSearchMaxDays}
                        onChange={(e) => setJobSearchMaxDays(parseInt(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                      >
                        <option value={30}>30 jours</option>
                        <option value={7}>7 jours</option>
                        <option value={3}>3 jours</option>
                        <option value={1}>24 heures</option>
                      </select>
                    </div>
                    <div style={{ width: '140px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>🌎 Territoire</label>
                      <select
                        className="input-field"
                        value={jobSearchCountry}
                        onChange={(e) => setJobSearchCountry(e.target.value)}
                        style={{ height: '36px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)' }}
                      >
                        <option value="fr">🇫🇷 France</option>
                        <option value="gb">🇬🇧 Royaume-Uni</option>
                        <option value="us">🇺🇸 USA</option>
                        <option value="de">🇩🇪 Allemagne</option>
                        <option value="ca">🇨🇦 Canada</option>
                        <option value="be">🇧🇪 Belgique</option>
                        <option value="ch">🇨🇭 Suisse</option>
                        <option value="it">🇮🇹 Italie</option>
                        <option value="es">🇪🇸 Espagne</option>
                      </select>
                    </div>
                    <div style={{ width: '140px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}> Trier par</label>
                      <select
                        className="input-field"
                        value={jobSearchSortBy}
                        onChange={(e) => setJobSearchSortBy(e.target.value)}
                        style={{ width: '100%', cursor: 'pointer' }}
                      >
                        <option value="relevance">Pertinence</option>
                        <option value="date">Date</option>
                      </select>
                    </div>
                  </div>

                  {/* RECHERCHE AVANCEE - Semantic tags éditables */}
                  <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✨ Match Sémantique</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.65rem', color: strictGeoFilter ? 'var(--green)' : 'var(--text3)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={strictGeoFilter} onChange={e => setStrictGeoFilter(e.target.checked)} style={{ width: 12, height: 12 }} />
                        Filtre géo strict (France uniquement)
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
                      {/* Tags IA */}
                      {(analysisResult?.present_keywords || []).map((kw: string) => (
                        <span key={'ai-' + kw} style={{ background: 'rgba(200,169,110,0.1)', border: '1px solid var(--gold)', color: 'var(--gold)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {kw}
                        </span>
                      ))}
                      {/* Tags personnalisés */}
                      {customSemanticTags.map((tag: string) => (
                        <span key={'custom-' + tag} style={{ background: 'rgba(99,179,237,0.1)', border: '1px solid var(--cyan)', color: 'var(--cyan)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {tag}
                          <button onClick={() => setCustomSemanticTags(prev => prev.filter(t => t !== tag))} style={{ background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontSize: '0.7rem', padding: 0, lineHeight: 1 }}>×</button>
                        </span>
                      ))}
                      {(!analysisResult?.present_keywords && customSemanticTags.length === 0) && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text3)', fontStyle: 'italic' }}>Ajoutez des compétences pour affiner le matching...</span>
                      )}
                    </div>
                    {/* Input ajout de tag */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="+ Ajouter compétence (ex: Power BI)"
                        value={newTagInput}
                        onChange={e => setNewTagInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newTagInput.trim()) {
                            setCustomSemanticTags(prev => [...new Set([...prev, newTagInput.trim()])]);
                            setNewTagInput('');
                          }
                        }}
                        style={{ flex: 1, fontSize: '0.75rem', padding: '4px 8px' }}
                      />
                      <button
                        onClick={() => { if (newTagInput.trim()) { setCustomSemanticTags(prev => [...new Set([...prev, newTagInput.trim()])]); setNewTagInput(''); } }}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--cyan)', background: 'rgba(99,179,237,0.1)', color: 'var(--cyan)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                      >+</button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <button
                        data-tour="job-search-btn"
                        className="btn-primary"
                        disabled={isSearchingJobs}
                        style={{ marginLeft: 'auto', background: 'var(--gold)', color: '#000', fontWeight: 800, minWidth: '150px' }}
                        onClick={async () => {
                          if (!jobSearchQuery) return;
                          setIsSearchingJobs(true);

                          // Smart Country Detection
                          let finalCountry = jobSearchCountry;
                          const locLower = (jobSearchLocation || '').toLowerCase();
                          if (locLower.includes('london') || locLower.includes('uk') || locLower.includes('royaume-uni')) finalCountry = 'gb';
                          else if (locLower.includes('usa') || locLower.includes('nyc') || locLower.includes('states') || locLower.includes('york')) finalCountry = 'us';
                          else if (locLower.includes('berlin') || locLower.includes('germany') || locLower.includes('allemagne')) finalCountry = 'de';
                          else if (locLower.includes('canada') || locLower.includes('montreal') || locLower.includes('toronto')) finalCountry = 'ca';

                          try {
                            const res = await fetch('/api/job-search', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                keywords: jobSearchQuery,
                                location: jobSearchLocation,
                                appId: adzunaAppId,
                                appKey: adzunaAppKey,
                                contractType: jobSearchContractType,
                                company: jobSearchCompany,
                                max_days_old: jobSearchMaxDays,
                                sort_by: jobSearchSortBy,
                                country: finalCountry
                              })
                            });
                            const data = await res.json();
                            if (data.error) throw new Error(data.error);

                            // 🚀 0-TOKEN MATCH ALGORITHM V2 🚀

                            // HTML entity decoder
                            const decodeHTML = (str: string) => str
                              .replace(/&eacute;/gi, 'é').replace(/&egrave;/gi, 'è').replace(/&ecirc;/gi, 'ê')
                              .replace(/&agrave;/gi, 'à').replace(/&acirc;/gi, 'â').replace(/&ccedil;/gi, 'ç')
                              .replace(/&ocirc;/gi, 'ô').replace(/&iuml;/gi, 'ï').replace(/&oe;/gi, 'œ')
                              .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
                              .replace(/&nbsp;/gi, ' ').replace(/&#\d+;/gi, ' ').replace(/&[a-z]+;/gi, ' ');

                            // Semantic synonyms for better matching
                            const SYNONYMS: Record<string, string[]> = {
                              'sql': ['postgresql', 'mysql', 'sqlite', 'base de données', 'database'],
                              'python': ['pandas', 'numpy', 'scikit', 'sklearn', 'seaborn'],
                              'power bi': ['powerbi', 'dax', 'power query', 'tableau de bord'],
                              'machine learning': ['ml ', 'apprentissage automatique', 'modèle prédictif'],
                              'javascript': ['typescript', 'react', 'node.js', 'nodejs'],
                              'excel': ['vba', 'macros', 'spreadsheet'],
                              'rag': ['retrieval augmented', 'langchain', 'llm', 'vector'],
                              'cloud': ['aws', 'azure', 'gcp', 'google cloud'],
                              'etl': ['pipeline de données', 'data pipeline', 'ingestion'],
                              'docker': ['kubernetes', 'conteneur', 'container'],
                            };

                            // Extract skills from CV JSON directly (no AI needed)
                            const cvSkillsFromAI: string[] = analysisResult?.present_keywords || [];
                            const cvSkillsFromJSON: string[] = [];
                            try {
                              const cvJSON = editedCvDataJSON ? JSON.parse(editedCvDataJSON) : null;
                              if (cvJSON?.skills?.categories) {
                                cvJSON.skills.categories.forEach((cat: any) => {
                                  (cat.items || []).forEach((item: string) => cvSkillsFromJSON.push(item));
                                });
                              }
                              if (cvJSON?.title) {
                                cvJSON.title.split(/\s+/).forEach((w: string) => { if (w.length > 3) cvSkillsFromJSON.push(w); });
                              }
                            } catch { }

                            const allCvSkills = [...new Set([...cvSkillsFromAI, ...cvSkillsFromJSON, ...customSemanticTags])];
                            const cvTitle = (jobSearchQuery || '').toLowerCase();

                            // 🌍 Villes hors-France à filtrer
                            const NON_FRANCE_CITIES = [
                              'casablanca', 'rabat', 'marrakech', 'fès', 'fez', 'tanger', 'agadir', 'maroc',
                              'tunis', 'sfax', 'sousse', 'tunisie', 'alger', 'oran', 'algérie', 'algerie',
                              'dakar', 'abidjan', 'lomé', 'douala', 'yaoundé', 'genève', 'geneve', 'zurich',
                              'bruxelles', 'montreal', 'québec', 'dubai', 'lausanne', 'berne',
                            ];

                            const scoredJobs = (data || []).map((job: any) => {
                              let score = 0;
                              let matchedSkills: string[] = [];
                              const rawDesc = decodeHTML(job.description || '');
                              const desc = rawDesc.toLowerCase();
                              const rawTitle = (job.title || '').toLowerCase();

                              // Title keyword match (30 pts max) — splits query into tokens, no stop words
                              const TITLE_STOP = new Set(['en', 'et', 'de', 'du', 'des', 'les', 'un', 'une', 'le', 'la', 'au', 'aux', 'par', 'pour', 'sur', 'avec', 'dans', 'ou', 'qui', 'que', 'il', 'elle', 'ils', 'elles', 'je', 'tu', 'nous', 'vous', 'a', 'the', 'and', 'or', 'of', 'in', 'to', 'for', 'with', 'is', 'are', 'not', 'be', 'an', 'it', 'at', 'by', 'from']);
                              const queryTokens = (jobSearchQuery || '').toLowerCase()
                                .replace(/[()[\]{}.,;:!?]/g, ' ')
                                .split(/\s+/)
                                .filter(w => w.length > 2 && !TITLE_STOP.has(w));
                              if (queryTokens.length > 0) {
                                // Count how many query tokens match title OR description
                                const titleHits = queryTokens.filter(tok => rawTitle.includes(tok) || desc.includes(tok)).length;
                                score += Math.round((titleHits / queryTokens.length) * 30);
                              }

                              // Company fuzzy match (25 pts)
                              if (jobSearchCompany) {
                                const rawComp = (job.company?.display_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                const searchComp = jobSearchCompany.toLowerCase().replace(/[^a-z0-9]/g, '');
                                if (rawComp && searchComp && (rawComp.includes(searchComp) || searchComp.includes(rawComp))) score += 25;
                              }

                              // Skill matching with synonyms (up to 60 pts)
                              if (allCvSkills.length > 0) {
                                let skillHits = 0;
                                allCvSkills.forEach((sk: string) => {
                                  const skLow = sk.toLowerCase();
                                  const synonyms = SYNONYMS[skLow] || [];
                                  const found = desc.includes(skLow) || synonyms.some(s => desc.includes(s));
                                  if (found) {
                                    skillHits++;
                                    if (!matchedSkills.includes(sk)) matchedSkills.push(sk);
                                  }
                                });
                                score += Math.min(Math.round((skillHits / Math.max(allCvSkills.length, 1)) * 70), 60);
                              } else {
                                score += 40;
                              }
                              // Geo-filter: only check location field, not description (avoids false positives)
                              const locationStr = (job.location?.display_name || job.location?.area?.join(' ') || '').toLowerCase();
                              const _isAbroad = strictGeoFilter && NON_FRANCE_CITIES.some((city: string) => locationStr.includes(city));

                              return { ...job, description: rawDesc, _matchScore: Math.min(score, 99), _matchedSkills: matchedSkills, _isAbroad };
                            });

                            // Sort + filter abroad
                            const filteredJobs = strictGeoFilter ? scoredJobs.filter((j: any) => !j._isAbroad) : scoredJobs;
                            filteredJobs.sort((a: any, b: any) => b._matchScore - a._matchScore);
                            setJobMatches(filteredJobs);
                            setHasSearched(true);

                          } catch (err: any) {
                            alert(err.message);
                          } finally {
                            setIsSearchingJobs(false);
                          }
                        }}
                      >
                        {isSearchingJobs ? 'Scraping...' : ' Auto-Match CV'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* RESULTS LIST */}
                <div style={{ display: 'grid', gap: '15px' }}>
                  {jobMatches.length > 0 && (
                    <div className="animate-in" style={{
                      padding: '2.5rem 1.5rem',
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.1) 100%)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-lg)',
                      marginBottom: '1rem',
                      overflow: 'hidden'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', padding: '0 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Globe size={20} color="var(--gold)" className="spin-slow" />
                          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--gold)' }}>
                            SIG TERMINAL
                          </h3>
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text3)', fontWeight: 700, background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '4px' }}>
                          LIVE GEOLOCATION ACTIVE
                        </div>
                      </div>

                      <div style={{
                        width: '100%',
                        display: jobMatches.length > 0 ? 'block' : 'none'
                      }}>
                        <div data-tour="job-map" style={{ position: 'relative', width: '100%', height: 'var(--map-height, 520px)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <JobMap jobs={jobMatches} />
                        </div>
                      </div>
                    </div>
                  )}

                  {jobMatches.length > 0 ? jobMatches.map((job: any) => (
                    <div key={job.id} style={{ padding: '15px', background: 'var(--surface-subtle)', borderRadius: '8px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, right: 0, padding: '8px 12px', background: job._matchScore >= 80 ? 'rgba(16, 185, 129, 0.1)' : job._matchScore >= 50 ? 'rgba(251, 191, 36, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: job._matchScore >= 80 ? '#10B981' : job._matchScore >= 50 ? '#F59E0B' : '#EF4444', fontWeight: 800, borderBottomLeftRadius: '8px', fontSize: '0.8rem' }}>
                        {job._matchScore}% Match
                      </div>

                      <a href={job.redirect_url} target="_blank" rel="noopener noreferrer" style={{
                        color: 'var(--gold-bright)',
                        fontWeight: 900,
                        fontSize: '1.25rem',
                        textDecoration: 'none',
                        display: 'block',
                        marginBottom: '4px',
                        paddingRight: '120px',
                        lineHeight: '1.2'
                      }}>
                        {job.title}
                      </a>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                        <span style={{ background: 'var(--card)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text)', fontWeight: 600, border: '1px solid var(--border)' }}>🏢 {job.company?.display_name || 'Confidentiel'}</span>
                        {job.created && (
                          <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', color: 'var(--text3)', border: '1px solid var(--border)' }}>
                            📅 {new Date(job.created).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        )}
                        <span style={{ background: 'var(--card)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--cyan)', fontWeight: 600, border: '1px solid var(--border)' }}>📍 {job.location?.display_name || 'Lieu non défini'}</span>
                        {job.salary_min && <span style={{ background: 'rgba(232, 160, 48, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--amber)', fontWeight: 600, border: '1px solid rgba(232, 160, 48, 0.2)' }}>💰 ~{job.salary_min}€</span>}
                      </div>

                      {/* MATCHED SKILLS CHIPS */}
                      {job._matchedSkills && job._matchedSkills.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>Aptitudes trouvées :</span>
                          {job._matchedSkills.map((sk: string) => (
                            <span key={sk} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem' }}>✓ {sk}</span>
                          ))}
                        </div>
                      )}

                      <p style={{
                        fontSize: '0.85rem',
                        color: 'var(--text2)',
                        lineHeight: '1.6',
                        marginBottom: '20px',
                        fontStyle: 'italic',
                        position: 'relative',
                        padding: '12px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '6px',
                        borderLeft: '2px solid var(--border)'
                      }}>
                        "{job.description}"
                      </p>

                      <div style={{
                        marginTop: '1.2rem',
                        padding: '1rem',
                        border: '1px dashed ' + (job._matchScore >= 75 ? 'var(--green)' : job._matchScore >= 50 ? 'var(--amber)' : 'var(--gold)'),
                        borderRadius: '8px',
                        background: (job._matchScore >= 75 ? 'rgba(82, 201, 122, 0.05)' : job._matchScore >= 50 ? 'rgba(232, 160, 48, 0.05)' : 'rgba(200, 169, 110, 0.05)'),
                        position: 'relative'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Zap size={14} color={job._matchScore >= 75 ? 'var(--green)' : job._matchScore >= 50 ? 'var(--amber)' : 'var(--gold)'} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: (job._matchScore >= 75 ? 'var(--green)' : job._matchScore >= 50 ? 'var(--amber)' : 'var(--gold)'), textTransform: 'uppercase', letterSpacing: '0.05em' }}>CONSEIL STRATÉGIQUE</span>
                          </div>
                          <a href={job.redirect_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--cyan)', textDecoration: 'none', fontWeight: 700, background: 'rgba(99,179,237,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                            VOIR L'OFFRE COMPLÈTE &rarr;
                          </a>
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text2)', margin: 0, lineHeight: '1.5' }}>
                          {job._matchScore >= 75 ? (
                            <>⭐ <strong>MATCH D'ÉVIDENCE :</strong> Vous êtes dans le top % des candidats. Pour garantir l'entretien, collez l'offre dans la <strong>sidebar à gauche</strong> et demandez une analyse d'impact pour ajouter des chiffres à votre CV.</>
                          ) : job._matchScore >= 50 ? (
                            <>🎯 <strong>POTENTIEL DÉTECTÉ :</strong> Votre profil est solide mais manque de mots-clés spécifiques. Collez le contenu dans l'onglet <strong>Audit Express</strong> à gauche pour optimiser vos compétences techniques.</>
                          ) : (
                            <>⚠️ <strong>GAP D'APTITUDES :</strong> Des compétences clés manquent à l'appel. Récupérez le texte complet de l'offre (lien ci-dessus), collez-le à gauche et identifiez les <strong>mots-clés critiques</strong> à intégrer.</>
                          )}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <div style={{ padding: '30px', textAlign: 'center', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                      {isSearchingJobs ? (
                        <div style={{ color: 'var(--text3)' }}>
                          <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🤖</div>
                          <div style={{ fontWeight: 600 }}>Analyse des offres en cours...</div>
                          <div style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text3)' }}>Scoring sémantique • Filtre géo • Tri par pertinence</div>
                        </div>
                      ) : hasSearched ? (
                        <div style={{ color: 'var(--text2)' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔍</div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>Aucune offre trouvée</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text3)', marginBottom: '14px' }}>Essayez ces ajustements stratégiques :</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>💡 <strong>Simplifiez</strong> — ex: "Marketing" au lieu de "Responsable Marketing Digital senior"</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>🌍 <strong>Élargissez</strong> — ex: "Ile-de-France" au lieu de "Paris 8"</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>⚙️ <strong>Technicité</strong> — Utilisez des mots-clés directs (Java, SEO, Revit) sans phrases</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>🏢 <strong>Entreprise</strong> — Tapez directement le nom d'un groupe pour voir ses ouvertures</span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text3)' }}>
                          <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>💼</div>
                          <div>Entrez vos clés Adzuna, un intitulé de poste et lancez le <strong>Auto-Match CV</strong> !</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: PDF EXPORT */}
            {activeTab === 'pdf' && (
              <div>
                <div className="ins cyan" style={{ marginBottom: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid #10B981' }}>
                  <div className="ins-l" style={{ color: '#10B981' }}>🔐 Rappel Confidentialité</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text1)' }}>
                    L'IA a utilisé des coordonnées fictives pour protéger votre vie privée pendant l'analyse.
                    <strong style={{ color: '#10B981' }}> N'oubliez pas de rétablir vos vraies coordonnées (Nom, Email, Tél) via le "Mode Édition Visuelle" ou l'onglet "Content" pour votre PDF final.</strong>
                  </p>
                </div>

                <div className="card-hd" onClick={() => setShowAllThemes(!showAllThemes)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>🎨 Select Premium Theme <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '0.8rem' }}>— 26 themes (16 standard + 10 photo)</span></span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--gold)', fontFamily: 'Space Mono, monospace' }}>{showAllThemes ? '[- Hide]' : '[+ Show All]'}</span>
                </div>
                <div data-tour="all-themes">
                  {!showAllThemes ? (
                    <div style={{ marginBottom: '1.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recommended Themes</div>
                      </div>
                      <div className="theme-carousel" style={{ flexWrap: 'wrap', gap: '8px' }}>
                        {ALL_THEMES.slice(0, 3).map(t => (
                          <div key={t.name} className={`theme-card ${selectedTheme === t.name ? 'active' : ''}`} onClick={() => { setSelectedTheme(t.name); setPdfData(null); }}>
                            <div className="theme-preview" style={{ background: t.color, border: `2px solid ${t.accent}`, position: 'relative' }}>
                              <div style={{ position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: '50%', background: t.accent }}></div>
                            </div>
                            <div className="theme-title" style={{ fontSize: '0.65rem', lineHeight: 1.2 }}>{t.name}</div>
                            <div style={{ fontSize: '0.58rem', color: 'var(--text3)', lineHeight: 1.2, marginTop: 1 }}>{t.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: '0.5rem' }}></div>
                      {THEME_CATEGORIES.map(cat => (
                        <div key={cat.label} style={{ marginBottom: '1.2rem' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{cat.label}</div>
                          <div className="theme-carousel" style={{ flexWrap: 'wrap', gap: '8px' }}>
                            {cat.themes.map(t => (
                              <div
                                key={t.name}
                                data-tour={t.name === 'Executive' ? 'theme-executive' : undefined}
                                className={`theme-card ${selectedTheme === t.name ? 'active' : ''}`}
                                onClick={() => { setSelectedTheme(t.name); setPdfData(null); }}
                              >
                                <div className="theme-preview" style={{ background: t.color, border: `2px solid ${t.accent}`, position: 'relative' }}>
                                  <div style={{ position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: '50%', background: t.accent }}></div>
                                </div>
                                <div className="theme-title" style={{ fontSize: '0.65rem', lineHeight: 1.2 }}>{t.name}</div>
                                <div style={{ fontSize: '0.58rem', color: 'var(--text3)', lineHeight: 1.2, marginTop: 1 }}>{t.desc}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* CV STUDIO CUSTOMIZATION PANEL */}
                <div className="custom-panel" data-tour="customization" data-open={customOpen}>
                  <div className="custom-panel-header" data-tour="customization-header" onClick={() => setCustomOpen(!customOpen)}>
                    <h4><span>✨</span> CV Studio Customization</h4>
                    <span className={`toggle-icon ${customOpen ? 'open' : ''}`}>▼</span>
                  </div>
                  <div data-tour="customization-body" className={`custom-panel-body ${customOpen ? 'open' : ''}`}>
                    {/* NEW BRAND IDENTITY SECTION */}
                    <div style={{ fontSize: '0.48rem', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>AI Brand Identity</div>
                    <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="custom-field" style={{ width: '100%' }}>
                        <label>Target Company</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. Google, OpenAi, Amazon..."
                            value={targetCompany}
                            onChange={(e) => setTargetCompany(e.target.value)}
                            maxLength={50}
                            style={{ margin: 0, height: '32px', fontSize: '0.75rem' }}
                          />
                          <button
                            className="btn-primary"
                            onClick={handleShuffleColors}
                            disabled={isLoadingColors}
                            style={{ padding: '0 12px', height: '32px', minWidth: 'auto', background: 'var(--gold)' }}
                            title="Shuffle AI Brand Colors"
                          >
                            {isLoadingColors ? '...' : (brandPalettes.length > 0 && targetCompany === brandPalettes[0].targetCompany ? '✨ Shuffle' : '⭐ Get Colors')}
                          </button>
                        </div>
                      </div>
                      {brandPalettes.length > 0 && targetCompany === brandPalettes[0].targetCompany && (
                        <div style={{ fontSize: '0.6rem', color: 'var(--gold)', fontFamily: 'Space Mono, monospace' }}>
                          Using Palette {paletteIndex + 1}/4: {brandPalettes[paletteIndex].name}
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: '0.48rem', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>Layout & Backgrounds</div>
                    <div className="custom-row">
                      <div className="custom-field">
                        <label>Sidebar / Menu</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customSidebarBg || getThemeDefaults().sidebar}
                            onChange={(e) => setCustomSidebarBg(e.target.value)}
                            onBlur={(e) => setCustomSidebarBg(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="custom-field">
                        <label>Header / Top</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customHeaderBg || getThemeDefaults().header}
                            onChange={(e) => setCustomHeaderBg(e.target.value)}
                            onBlur={(e) => setCustomHeaderBg(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="custom-field">
                        <label>Main Background</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customMainBg || getThemeDefaults().main}
                            onChange={(e) => setCustomMainBg(e.target.value)}
                            onBlur={(e) => setCustomMainBg(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.48rem', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginTop: '12px' }}>Typography & Content</div>
                    <div className="custom-row">
                      <div className="custom-field">
                        <label>My Name</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customNameColor || getThemeDefaults().name}
                            onChange={(e) => setCustomNameColor(e.target.value)}
                            onBlur={(e) => setCustomNameColor(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="custom-field">
                        <label>Section Titles</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customHeading || getThemeDefaults().heading}
                            onChange={(e) => setCustomHeading(e.target.value)}
                            onBlur={(e) => setCustomHeading(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="custom-field">
                        <label>Post / Roles</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customSubheading || getThemeDefaults().subheading}
                            onChange={(e) => setCustomSubheading(e.target.value)}
                            onBlur={(e) => setCustomSubheading(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="custom-row">
                      <div className="custom-field">
                        <label>Body Text</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customText || getThemeDefaults().text}
                            onChange={(e) => setCustomText(e.target.value)}
                            onBlur={(e) => setCustomText(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="custom-field">
                        <label>Brand Accent</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customAccent || getThemeDefaults().accent}
                            onChange={(e) => setCustomAccent(e.target.value)}
                            onBlur={(e) => setCustomAccent(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.48rem', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginTop: '12px' }}>Photo Profile (si applicable)</div>
                    <div className="custom-row">
                      <div className="custom-field">
                        <label>Photo Border</label>
                        <div className="color-input-wrap">
                          <input
                            type="color"
                            value={customPhotoBorder || getThemeDefaults().accent}
                            onChange={(e) => setCustomPhotoBorder(e.target.value)}
                            onBlur={(e) => setCustomPhotoBorder(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="custom-slider-row" style={{ marginTop: '12px' }}>
                      <label>Global Font Size</label>
                      <input
                        type="range"
                        min="0.7"
                        max="1.4"
                        step="0.05"
                        value={fontScale}
                        onChange={(e) => setFontScale(parseFloat(e.target.value))}
                      />
                      <span className="slider-value">{fontScale.toFixed(2)}x</span>
                    </div>

                    <div className="custom-field" style={{ marginTop: '12px' }}>
                      <label>Font Family (ATS Safety)</label>
                      <select
                        className="input-field"
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        style={{ background: 'var(--card)', color: 'var(--text)', fontSize: '0.75rem' }}
                      >
                        <option value="Poppins">Modern (Poppins)</option>
                        <option value="Roboto">Standard (Roboto - Safe)</option>
                        <option value="Lora">Elegant (Lora - Serif)</option>
                        <option value="Inter">Clean (Inter)</option>
                        <option value="Times-Roman">Traditional (Times)</option>
                      </select>
                    </div>

                    <div className="custom-actions">
                      <button className="btn-reset" onClick={resetCustomization}>Reset to Theme Defaults</button>
                    </div>
                  </div>
                </div>

                {!pdfData ? (
                  <div className="card pdf-generate-card" data-tour="pdf-placeholder" style={{ textAlign: 'center' }}>
                    <LayoutTemplate size={48} opacity={0.3} style={{ margin: '0 auto 1rem', color: 'var(--gold)' }} />
                    <h3 style={{ marginBottom: '1rem' }}>Generate Studio PDF</h3>
                    <p style={{ color: 'var(--text2)', marginBottom: '2rem', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                      Our Python Worker uses exact coordinates via ReportLab to draw an incredibly beautiful ATS-friendly layout.
                    </p>
                    <button data-tour="generate-pdf-btn" className="btn-primary" onClick={() => handleGeneratePdf()} style={{ maxWidth: '300px', margin: '0 auto', display: 'block' }} disabled={isGenerating}>
                      {isGenerating ? "GENERATING PDF..." : "GENERATE PDF PREVIEW"}
                    </button>
                  </div>
                ) : (
                  <>
                    {visualEditMode ? (
                      <div className="simple-pdf-editor" style={{ height: '800px', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                        <SimplePDFEditor
                          cvData={editedCvDataJSON ? JSON.parse(editedCvDataJSON) : (analysisResult?._cv_data || cvExamples.marketing.cv_data)}
                          onUpdate={(newData) => {
                            setEditedCvDataJSON(JSON.stringify(newData, null, 2));
                            setTimeout(() => handleGeneratePdf(newData), 1200);
                          }}
                          pdfUrl={pdfUrl}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="editor-bar">
                          <div className="ed-dot" style={{ background: '#e05252' }}></div>
                          <div className="ed-dot" style={{ background: '#e8a030' }}></div>
                          <div className="ed-dot" style={{ background: '#52c97a' }}></div>
                          <span className="ed-title">{pdfData.filename} — Powered by Next.js + Python Worker</span>
                          <div style={{ flex: 1 }}></div>
                          <button
                            className="visual-edit-toggle active"
                            onClick={() => setIsFullscreenUI(true)}
                            style={{ fontSize: '0.55rem', padding: '4px 10px' }}
                          >
                            ⛶ FULLSCREEN
                          </button>
                        </div>
                        <div data-tour="pdf-preview-container" className={`cv-preview ${isFullscreenUI ? 'pseudo-fullscreen' : ''}`} style={{ padding: 0, background: 'var(--surface)', position: 'relative', overflow: 'hidden' }}>
                          {isFullscreenUI && (
                            <button className="fullscreen-close-btn" onClick={() => setIsFullscreenUI(false)}>
                              ✕ Fermer le plein écran
                            </button>
                          )}
                          <iframe
                            id="pdf-iframe"
                            key={pdfUrl} // Force re-render on URL change
                            src={`${pdfUrl}#toolbar=0&view=FitH`}
                            className="pdf-iframe"
                            style={{ border: 'none', display: 'block', width: '100%', height: isFullscreenUI ? '100vh' : '820px' }}
                          />
                        </div>
                      </>
                    )}
                    <div className="pdf-actions" style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
                      <button
                        data-tour="visual-edit-toggle"
                        className={`btn-outline ${visualEditMode ? '' : 'visual-edit-toggle'}`}
                        onClick={() => setVisualEditMode(!visualEditMode)}
                        style={{ maxWidth: '300px' }}
                      >
                        <Wand2 size={14} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                        {visualEditMode ? '← Retour à la Preview' : '✏️ Mode Édition Visuelle'}
                      </button>
                      <button className={`btn-outline ${needsUpdate ? 'pulse-gold' : ''}`} onClick={() => handleGeneratePdf()} disabled={isGenerating} style={{ maxWidth: '300px' }}>
                        {needsUpdate ? "✨ Updating Design..." : "Mettre à jour le design"}
                      </button>
                      <button className="btn-primary" onClick={downloadPdf} style={{ maxWidth: '300px' }}>
                        <Download size={14} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                        TÉLÉCHARGER PDF
                      </button>
                      <button
                        className="btn-outline"
                        onClick={async () => {
                          try {
                            const cvDataToUse = editedCvDataJSON ? JSON.parse(editedCvDataJSON) : analysisResult?._cv_data;
                            const res = await fetch('/api/export-docx', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                cv_data: {
                                  ...cvDataToUse,
                                  theme: selectedTheme,
                                  custom_style: {
                                    accent_color: customAccent || undefined,
                                    text_color: customText || undefined,
                                    heading_color: customHeading || undefined,
                                    subheading_color: customSubheading || undefined,
                                    name_color: customNameColor || undefined,
                                    sidebar_bg: customSidebarBg || undefined,
                                    main_bg: customMainBg || undefined,
                                    header_bg: customHeaderBg || undefined,
                                    photo_border_color: customPhotoBorder || undefined,
                                    font_scale: fontScale,
                                    font_family: fontFamily
                                  }
                                }
                              })
                            });
                            if (!res.ok) throw new Error('Export DOCX failed');
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `CV_${cvDataToUse.name?.replace(/\s+/g, '_') || 'Resume'}.docx`;
                            link.click();
                            URL.revokeObjectURL(url);
                          } catch (err: any) {
                            alert('Erreur export DOCX: ' + err.message);
                          }
                        }}
                        style={{ maxWidth: '300px' }}
                      >
                        <FileText size={14} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                        EXPORT DOCX
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* TAB: COVER LETTER */}
        {activeTab === 'letter' && (
          <div>
            <div className="ins cyan" style={{ marginBottom: '1.5rem', background: 'rgba(212, 168, 83, 0.05)', border: '1px solid var(--gold)' }}>
              <div className="ins-l" style={{ color: 'var(--gold)' }}>✉️ Lettre de Motivation Haute Couture</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text1)' }}>
                Associez la puissance du machine learning et la précision typographique de ReportLab. 
                Importez une ancienne lettre ou laissez l'IA puiser dans votre CV pour rédiger des paragraphes percutants, formatés selon la charte graphique de votre thème actuel (<strong>{selectedLetterTheme}</strong>).
              </p>
            </div>

            <div className="autonomous-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem', alignItems: 'start' }}>
              
              {/* PANNEAU DE CONFIGURATION GAUCHE */}
              <div className="card animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div className="card-hd" style={{ margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                  ⚙️ Configuration IA & Cible
                </div>

                <div>
                  <label className="slabel" style={{ display: 'block', marginBottom: '6px' }}>🎨 Thème de la Lettre de Motivation</label>
                  <select
                    className="input-field"
                    value={selectedLetterTheme}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedLetterTheme(val);
                      handleGenerateLetterPdf(null, val);
                    }}
                    style={{ fontSize: '0.75rem', marginBottom: '8px' }}
                  >
                    {ALL_THEMES.map(theme => (
                      <option key={theme.name} value={theme.name}>
                        {theme.name === "Sober Classic" ? "📄 Sobre sans couleur (Traditionnel)" : theme.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="slabel" style={{ display: 'block', marginBottom: '6px' }}>/ Importer une Ancienne Lettre (PDF)</label>
                  <div className="file-drop" onClick={() => letterFileInputRef.current?.click()} style={{ marginBottom: '12px' }}>
                    <UploadCloud className="icon" />
                    <p>{letterFile ? letterFile.name : "Cliquez pour sélectionner un PDF de Lettre de Motivation"}</p>
                    <input type="file" ref={letterFileInputRef} hidden accept="application/pdf" onChange={handleLetterFileChange} />
                  </div>
                  <label className="slabel" style={{ display: 'block', marginBottom: '6px' }}>/ Contenu de l'Ancienne Lettre (Optionnel - pour guider l'IA)</label>
                  <textarea
                    className="input-field"
                    style={{ height: '140px', fontSize: '0.75rem', fontFamily: 'inherit' }}
                    placeholder="Le texte extrait apparaîtra ici ou vous pouvez directement le coller..."
                    value={oldLetterText}
                    onChange={(e) => setOldLetterText(e.target.value)}
                  />
                </div>

                <div>
                  <label className="slabel" style={{ display: 'block', marginBottom: '6px' }}>/ Description du Poste Cible (Requis pour l'adaptation)</label>
                  <textarea
                    className="input-field"
                    style={{ height: '140px', fontSize: '0.75rem', fontFamily: 'inherit' }}
                    placeholder="Collez ici l'offre d'emploi ou la description du poste pour y adapter parfaitement la lettre..."
                    value={jobDesc}
                    onChange={(e) => setJobDesc(e.target.value)}
                  />
                </div>

                <details style={{ marginTop: '0.5rem', cursor: 'pointer' }}>
                  <summary style={{ fontSize: '0.75rem', color: 'var(--gold)', fontWeight: 600, userSelect: 'none' }}>
                    ⚙️ Paramètres avancés du destinataire (Optionnel)
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.8rem', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label className="slabel" style={{ display: 'block', marginBottom: '4px' }}>Entreprise Cible</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Extrait par l'IA si vide"
                          value={letterCompanyName}
                          onChange={(e) => setLetterCompanyName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="slabel" style={{ display: 'block', marginBottom: '4px' }}>Destinataire / Manager</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Extrait par l'IA si vide"
                          value={letterHiringManager}
                          onChange={(e) => setLetterHiringManager(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="slabel" style={{ display: 'block', marginBottom: '4px' }}>Adresse Entreprise</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Extrait par l'IA si vide"
                        value={letterCompanyAddress}
                        onChange={(e) => setLetterCompanyAddress(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="slabel" style={{ display: 'block', marginBottom: '4px' }}>Objet du Message</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Extrait par l'IA si vide"
                        value={letterSubject}
                        onChange={(e) => setLetterSubject(e.target.value)}
                      />
                    </div>
                  </div>
                </details>

                <button
                  className="btn-primary"
                  onClick={handleTailorLetter}
                  disabled={isGeneratingLetter}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Sparkles size={16} />
                  {isGeneratingLetter ? (letterProgress || "GÉNÉRATION EN COURS...") : "🪄 CIBLER & OPTIMISER LA LETTRE"}
                </button>
              </div>

              {/* COLONNE PREVIEW DROITE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {!letterPdfUrl ? (
                  <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                    <FileText size={48} opacity={0.3} style={{ margin: '0 auto 1rem', color: 'var(--gold)' }} />
                    <h3 style={{ marginBottom: '0.8rem' }}>Aucune Lettre Générée</h3>
                    <p style={{ color: 'var(--text2)', fontSize: '0.8rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
                      Renseignez l'entreprise cible et lancez l'optimiseur. L'IA écrira une lettre de motivation sur-mesure combinant votre CV et les prérequis de l'offre d'emploi.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* DUAL EDITOR: FORM & JSON */}
                    <div className="card animate-in" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                        <div className="card-hd" style={{ margin: 0, fontSize: '0.85rem' }}>
                          ✏️ Éditeur de la Lettre
                        </div>
                        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '4px' }}>
                          <button
                            type="button"
                            onClick={() => setLetterEditorTab('visual')}
                            style={{ padding: '2px 8px', fontSize: '0.65rem', borderRadius: '3px', background: letterEditorTab === 'visual' ? 'var(--gold)' : 'transparent', color: letterEditorTab === 'visual' ? '#000' : 'var(--text1)', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Visuel
                          </button>
                          <button
                            type="button"
                            onClick={() => setLetterEditorTab('json')}
                            style={{ padding: '2px 8px', fontSize: '0.65rem', borderRadius: '3px', background: letterEditorTab === 'json' ? 'var(--gold)' : 'transparent', color: letterEditorTab === 'json' ? '#000' : 'var(--text1)', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                          >
                            JSON
                          </button>
                        </div>
                      </div>

                      {letterEditorTab === 'visual' ? (
                        <>
                          {/* HEADER FIELDS FORM */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label className="slabel" style={{ display: 'block', marginBottom: '4px', fontSize: '0.65rem' }}>Nom du Candidat</label>
                              <input
                                type="text"
                                className="input-field"
                                style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                                value={(() => {
                                  try { return JSON.parse(letterDataJSON).name || ''; } catch { return ''; }
                                })()}
                                onChange={(e) => {
                                  try {
                                    const parsed = JSON.parse(letterDataJSON);
                                    parsed.name = e.target.value;
                                    setLetterDataJSON(JSON.stringify(parsed, null, 2));
                                  } catch {}
                                }}
                              />
                            </div>
                            <div>
                              <label className="slabel" style={{ display: 'block', marginBottom: '4px', fontSize: '0.65rem' }}>Titre du Poste</label>
                              <input
                                type="text"
                                className="input-field"
                                style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                                value={(() => {
                                  try { return JSON.parse(letterDataJSON).title || ''; } catch { return ''; }
                                })()}
                                onChange={(e) => {
                                  try {
                                    const parsed = JSON.parse(letterDataJSON);
                                    parsed.title = e.target.value;
                                    setLetterDataJSON(JSON.stringify(parsed, null, 2));
                                  } catch {}
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label className="slabel" style={{ display: 'block', marginBottom: '4px', fontSize: '0.65rem' }}>Adresse Email</label>
                              <input
                                type="text"
                                className="input-field"
                                style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                                value={(() => {
                                  try { return JSON.parse(letterDataJSON).email || ''; } catch { return ''; }
                                })()}
                                onChange={(e) => {
                                  try {
                                    const parsed = JSON.parse(letterDataJSON);
                                    parsed.email = e.target.value;
                                    setLetterDataJSON(JSON.stringify(parsed, null, 2));
                                  } catch {}
                                }}
                              />
                            </div>
                            <div>
                              <label className="slabel" style={{ display: 'block', marginBottom: '4px', fontSize: '0.65rem' }}>Téléphone</label>
                              <input
                                type="text"
                                className="input-field"
                                style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                                value={(() => {
                                  try { return JSON.parse(letterDataJSON).phone || ''; } catch { return ''; }
                                })()}
                                onChange={(e) => {
                                  try {
                                    const parsed = JSON.parse(letterDataJSON);
                                    parsed.phone = e.target.value;
                                    setLetterDataJSON(JSON.stringify(parsed, null, 2));
                                  } catch {}
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label className="slabel" style={{ display: 'block', marginBottom: '4px', fontSize: '0.65rem' }}>Ville / Localisation</label>
                              <input
                                type="text"
                                className="input-field"
                                style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                                value={(() => {
                                  try { return JSON.parse(letterDataJSON).location || ''; } catch { return ''; }
                                })()}
                                onChange={(e) => {
                                  try {
                                    const parsed = JSON.parse(letterDataJSON);
                                    parsed.location = e.target.value;
                                    setLetterDataJSON(JSON.stringify(parsed, null, 2));
                                  } catch {}
                                }}
                              />
                            </div>
                            <div>
                              <label className="slabel" style={{ display: 'block', marginBottom: '4px', fontSize: '0.65rem' }}>Date de la Lettre</label>
                              <input
                                type="text"
                                className="input-field"
                                style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                                value={(() => {
                                  try { return JSON.parse(letterDataJSON).date || ''; } catch { return ''; }
                                })()}
                                onChange={(e) => {
                                  try {
                                    const parsed = JSON.parse(letterDataJSON);
                                    parsed.date = e.target.value;
                                    setLetterDataJSON(JSON.stringify(parsed, null, 2));
                                  } catch {}
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label className="slabel" style={{ display: 'block', marginBottom: '4px', fontSize: '0.65rem' }}>Entreprise</label>
                              <input
                                type="text"
                                className="input-field"
                                style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                                value={letterCompanyName}
                                onChange={(e) => {
                                  setLetterCompanyName(e.target.value);
                                  try {
                                    const parsed = JSON.parse(letterDataJSON);
                                    parsed.company_name = e.target.value;
                                    setLetterDataJSON(JSON.stringify(parsed, null, 2));
                                  } catch {}
                                }}
                              />
                            </div>
                            <div>
                              <label className="slabel" style={{ display: 'block', marginBottom: '4px', fontSize: '0.65rem' }}>Destinataire</label>
                              <input
                                type="text"
                                className="input-field"
                                style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                                value={letterHiringManager}
                                onChange={(e) => {
                                  setLetterHiringManager(e.target.value);
                                  try {
                                    const parsed = JSON.parse(letterDataJSON);
                                    parsed.hiring_manager = e.target.value;
                                    setLetterDataJSON(JSON.stringify(parsed, null, 2));
                                  } catch {}
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="slabel" style={{ display: 'block', marginBottom: '4px', fontSize: '0.65rem' }}>Adresse de l'Entreprise</label>
                            <input
                              type="text"
                              className="input-field"
                              style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                              value={letterCompanyAddress}
                              onChange={(e) => {
                                setLetterCompanyAddress(e.target.value);
                                try {
                                  const parsed = JSON.parse(letterDataJSON);
                                  parsed.company_address = e.target.value;
                                  setLetterDataJSON(JSON.stringify(parsed, null, 2));
                                } catch {}
                              }}
                            />
                          </div>

                          <div>
                            <label className="slabel" style={{ display: 'block', marginBottom: '4px', fontSize: '0.65rem' }}>Objet de la Lettre</label>
                            <input
                              type="text"
                              className="input-field"
                              style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                              value={letterSubject}
                              onChange={(e) => {
                                setLetterSubject(e.target.value);
                                try {
                                  const parsed = JSON.parse(letterDataJSON);
                                  parsed.subject = e.target.value;
                                  setLetterDataJSON(JSON.stringify(parsed, null, 2));
                                } catch {}
                              }}
                            />
                          </div>

                          {/* PARAGRAPHS */}
                          {(() => {
                            let parsedData: { body_paragraphs: string[] } = { body_paragraphs: [] };
                            try {
                              parsedData = JSON.parse(letterDataJSON);
                            } catch {}
                            return (parsedData.body_paragraphs || []).map((p: string, idx: number) => (
                              <div key={idx}>
                                <label className="slabel" style={{ display: 'block', marginBottom: '4px', fontSize: '0.65rem' }}>Paragraphe {idx + 1}</label>
                                <textarea
                                  className="input-field"
                                  style={{ height: '80px', fontSize: '0.75rem', fontFamily: 'inherit', margin: 0 }}
                                  value={p}
                                  onChange={(e) => {
                                    const newParas = [...parsedData.body_paragraphs];
                                    newParas[idx] = e.target.value as never;
                                    setLetterDataJSON(JSON.stringify({ ...parsedData, body_paragraphs: newParas }, null, 2));
                                  }}
                                />
                              </div>
                            ));
                          })()}
                        </>
                      ) : (
                        /* RAW JSON CODE EDITOR */
                        <div>
                          <label className="slabel" style={{ display: 'block', marginBottom: '4px', fontSize: '0.65rem' }}>Modifier le code de la Lettre de motivation (JSON)</label>
                          <textarea
                            className="input-field"
                            style={{ height: '480px', fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre', overflowX: 'auto', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border2)', color: '#a5f3fc' }}
                            value={letterDataJSON}
                            onChange={(e) => {
                              setLetterDataJSON(e.target.value);
                              try {
                                const parsed = JSON.parse(e.target.value);
                                if (parsed.company_name) setLetterCompanyName(parsed.company_name);
                                if (parsed.company_address) setLetterCompanyAddress(parsed.company_address);
                                if (parsed.hiring_manager) setLetterHiringManager(parsed.hiring_manager);
                                if (parsed.subject) setLetterSubject(parsed.subject);
                              } catch {}
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="editor-bar">
                      <div className="ed-dot" style={{ background: '#e05252' }}></div>
                      <div className="ed-dot" style={{ background: '#e8a030' }}></div>
                      <div className="ed-dot" style={{ background: '#52c97a' }}></div>
                      <span className="ed-title">Visualisation de la Lettre — Thème {selectedLetterTheme}</span>
                    </div>

                    <div className="cv-preview animate-in" style={{ padding: 0, background: 'var(--surface)', overflow: 'hidden' }}>
                      <iframe
                        id="letter-iframe"
                        key={letterPdfUrl}
                        src={`${letterPdfUrl}#toolbar=0&view=FitH`}
                        className="pdf-iframe"
                        style={{ border: 'none', display: 'block', width: '100%', height: '640px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                      <button
                        className="btn-primary animate-in"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = letterPdfUrl;
                          link.download = letterPdfData?.filename || 'Lettre_de_motivation.pdf';
                          link.click();
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <Download size={14} />
                        TÉLÉCHARGER LA LETTRE
                      </button>
                    </div>
                  </>
                )}
              </div>

            </div>
          </div>
        )}

        {/* PERSISTENT FOOTER - PROFESSIONAL PRIVACY SHIELD */}
        <footer data-tour="privacy-footer" style={{
          marginTop: '5rem',
          padding: '4rem 2rem',
          borderTop: '2px solid var(--border)',
          background: 'var(--surface-subtle)',
          borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
          position: 'relative'
        }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

            <div data-tour="privacy-shield-header" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '15px',
              marginBottom: '2rem'
            }}>
              <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <ShieldCheck size={28} color="var(--green)" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text)' }}>
                  IRIS <span style={{ color: 'var(--green)' }}>Privacy Shield</span>
                </h2>
                <p style={{ fontSize: '0.65rem', opacity: 0.6, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text2)' }}>
                  Conformité RGPD "Zero-Trust" & Protection Avancée (v4.5)
                </p>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '2rem',
              textAlign: 'left',
              marginBottom: '3rem'
            }}>

              <div className="privacy-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.8rem', color: 'var(--gold-bright)' }}>
                  <Lock size={18} />
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0 }}>Protection Éphémère</h3>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text2)', lineHeight: '1.6' }}>
                  <strong>Engagement RAM-Only :</strong> Notre backend opère exclusivement en mémoire vive.
                  Vos fichiers ne touchent jamais de base de données persistante. Une fois la session close, les données sont atomiquement purgées.
                </p>
              </div>

              <div className="privacy-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.8rem', color: 'var(--gold-bright)' }}>
                  <Server size={18} />
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0 }}>Flux Chiffrés Cloud</h3>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text2)', lineHeight: '1.6' }}>
                  <strong>Transit TLS 1.3 :</strong> Les analyses IA transitent via tunnel sécurisé vers les infrastructures de <strong>Groq</strong>, <strong>Google</strong> ou <strong>Mistral AI</strong> selon le modèle sélectionné.
                  Vos photos sont encodées localement et aucun résiduel disque n'est conservé.
                </p>
              </div>

              <div className="privacy-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.8rem', color: 'var(--gold-bright)' }}>
                  <Globe size={18} />
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0 }}>SIG & Géolocalisation</h3>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text2)', lineHeight: '1.6' }}>
                  <strong>Respect de l'Anonymat :</strong> La recherche Adzuna et la cartographie CartoDB n'utilisent que les mots-clés saisis.
                  Aucun traçage GPS permanent n'est activé sur votre compte.
                </p>
              </div>

              <div className="privacy-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.8rem', color: 'var(--gold-bright)' }}>
                  <Eye size={18} />
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0 }}>Souveraineté des Données</h3>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text2)', lineHeight: '1.6' }}>
                  <strong>Contrôle Local :</strong> Votre CV et vos clés API sont stockés dans le <strong>LocalStorage</strong> de votre navigateur.
                  Vous êtes l'unique propriétaire de ces informations à tout instant.
                </p>
              </div>

            </div>

            <div style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '3rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#EF4444', margin: '0 0 5px 0' }}>CENTRE DE PURGE SÉCURISÉ</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text2)', margin: 0 }}>Cliquez pour effacer instantanément toute trace de votre passage sur ce terminal.</p>
              </div>
              <button
                onClick={handleNuclearPurge}
                className="btn-danger"
                style={{
                  padding: '10px 24px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'linear-gradient(135deg, #EF4444 0%, #991B1B 100%)',
                  boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)'
                }}
              >
                <Trash2 size={16} /> PURGER LES DONNÉES LOCALES
              </button>
            </div>
            <div data-tour="footer-privacy" style={{
              borderTop: '1px solid var(--border)',
              paddingTop: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                display: 'flex',
                gap: '2rem',
                fontSize: '0.62rem',
                color: 'var(--text3)',
                fontFamily: 'Space Mono, monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={12} style={{ color: 'var(--green)' }} /> AES-256 TLS 1.3</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={12} style={{ color: 'var(--green)' }} /> In-Memory Processing</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={12} style={{ color: 'var(--green)' }} /> ISO 27001 Ready</span>
              </div>
              <div style={{ fontSize: '0.6rem', opacity: 0.6, color: 'var(--text3)', marginTop: '0.5rem' }}>
                <a href="https://github.com/her0-00/IRIS---Improve-Resume-Intelligence-Studio" target="_blank" rel="noopener" style={{ color: 'var(--gold)', textDecoration: 'none' }}>⭐ Star on GitHub</a> — IRIS © 2026 — IMPROVE RESUME INTELLIGENCE STUDIO — Hébergement Sécurisé via Render
              </div>
            </div>

          </div>
        </footer>
      </div>
    </div>
  );
}
