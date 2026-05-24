'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Play,
  Search,
  Loader2,
  CheckCircle2,
  Terminal,
  Folder,
  Globe,
  Zap,
  Sparkles,
  AlertCircle,
  XCircle,
  ExternalLink,
  Lock,
  Settings,
  Building,
  MapPin,
  Sliders,
  Copy,
  Check,
  Trash2,
  Clock,
  Filter,
  ArrowUpDown
} from 'lucide-react';

interface AutonomousHunterProps {
  cvText: string;
  letterText: string;
  aiProvider: string;
  apiKey: string;
  azureEndpoint: string;
  azureDeployment: string;
  onEditResult: (folder: string, targetTab?: 'edit' | 'letter') => void;
  jobteaserUrl?: string;
  jobteaserEmail?: string;
  jobteaserPassword?: string;
}

interface HistoryItem {
  folderName: string;
  job_title: string;
  company: string;
  verdict?: string;
  match_score: number;
  source_url?: string;
  createdAt: number;
}

export default function AutonomousHunter({
  cvText,
  letterText,
  aiProvider,
  apiKey,
  azureEndpoint,
  azureDeployment,
  onEditResult,
  jobteaserUrl = 'https://univ-ubs.jobteaser.com',
  jobteaserEmail = '',
  jobteaserPassword = ''
}: AutonomousHunterProps) {
  // Form inputs state
  const [query, setQuery] = useState('Data analyst');
  const [location, setLocation] = useState('Paris');
  const [excludeCompanies, setExcludeCompanies] = useState('');
  const [searchMode, setSearchMode] = useState<'jobteaser' | 'all'>('all');
  const [recency, setRecency] = useState<'any' | '24h' | '7d'>('any');
  
  // Sorting & Filtering of Captured Offers
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'company'>('date');
  const [freshnessFilter, setFreshnessFilter] = useState<'all' | '2h' | '24h' | '3d'>('all');
  
  // Advanced Settings
  const [theme, setTheme] = useState('StrategicModern');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Runtime state
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // History & Results
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [copiedFolder, setCopiedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupByCompany, setGroupByCompany] = useState(true);

  // References
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  // Scroll terminal to bottom
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/job-hunter-results/history');
      const data = await res.json();
      if (data.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const startMission = async () => {
    if (!cvText) {
      setError('Veuillez d\'abord importer votre CV dans la barre latérale.');
      return;
    }
    if (!apiKey) {
      setError('Veuillez configurer votre clé d\'API dans la barre latérale.');
      return;
    }

    setError(null);
    setIsRunning(true);
    setLogs(['🚀 Initialisation de la mission autonome...', '🔄 Connexion au serveur de scraping...']);

    // Create an abort controller so we can stop the request if the user clicks Stop
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/autonomous-hunt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          location,
          cv_text: cvText,
          letter_text: letterText,
          ai_provider: aiProvider,
          api_key: apiKey,
          azure_endpoint: azureEndpoint,
          azure_deployment: azureDeployment,
          theme,
          jobteaser_url: jobteaserUrl,
          jobteaser_email: jobteaserEmail,
          jobteaser_password: jobteaserPassword,
          exclude_companies: excludeCompanies,
          search_mode: searchMode,
          recency
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Erreur serveur lors de la chasse.');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Impossible de lire les logs en temps réel.');
      }

      let partialLine = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = (partialLine + chunk).split('\n');
        partialLine = lines.pop() || '';

        setLogs(prevLogs => {
          const newLogs = [...prevLogs];
          lines.forEach(line => {
            if (line.trim()) {
              newLogs.push(line);
            }
          });
          return newLogs;
        });
      }

      if (partialLine.trim()) {
        setLogs(prev => [...prev, partialLine]);
      }

      // Automatically refresh history upon completion
      loadHistory();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setLogs(prev => [...prev, '\n🔴 Mission arrêtée par l\'utilisateur.']);
      } else {
        setLogs(prev => [...prev, `\n❌ ERREUR : ${err.message}`]);
        setError(err.message);
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const stopMission = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setError(null);
  };

  const viewVerdict = async (folderName: string) => {
    try {
      const res = await fetch(`/api/job-hunter-results/data?folder=${folderName}`);
      const data = await res.json();
      setSelectedResult({ ...data, folderName });
    } catch (err) {
      alert('Impossible de charger le verdict sémantique.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFolder(text);
    setTimeout(() => setCopiedFolder(null), 2000);
  };

  const deleteHistoryItem = async (folderName: string) => {
    if (!confirm("⚠️ Voulez-vous vraiment supprimer définitivement cette opportunité et son dossier local du disque ? Cette action est irréversible.")) {
      return;
    }
    try {
      const res = await fetch('/api/job-hunter-results/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName })
      });
      const data = await res.json();
      if (data.success) {
        setHistory(prev => prev.filter(item => item.folderName !== folderName));
        if (selectedResult?.folderName === folderName) {
          setSelectedResult(null);
        }
      } else {
        alert(data.error || 'Erreur lors de la suppression.');
      }
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // Freshness badge computer based on time elapsed since capture
  const getFreshness = (createdAt: number) => {
    const diffMs = Date.now() - createdAt;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 15) {
      return { label: 'Tout chaud ! 🌟', color: 'var(--gold-bright)', bg: 'var(--gold-glow)', pulse: true };
    } else if (diffHours < 2) {
      return { label: 'Ultra Frais ⚡', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)', pulse: true };
    } else if (diffHours < 24) {
      return { label: 'Récent 🔥', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.1)', pulse: false };
    } else if (diffHours < 72) {
      return { label: 'Actuel 📅', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.1)', pulse: false };
    } else {
      return { label: 'Stable 📁', color: 'var(--text3)', bg: 'rgba(255, 255, 255, 0.03)', pulse: false };
    }
  };

  // Filter history by search query and freshness
  const filteredHistory = history.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      item.company.toLowerCase().includes(q) ||
      item.job_title.toLowerCase().includes(q) ||
      (item.verdict && item.verdict.toLowerCase().includes(q))
    );
    
    if (!matchesSearch) return false;
    
    if (freshnessFilter === 'all') return true;
    
    const diffHours = (Date.now() - item.createdAt) / 3600000;
    if (freshnessFilter === '2h') return diffHours < 2;
    if (freshnessFilter === '24h') return diffHours < 24;
    if (freshnessFilter === '3d') return diffHours < 72;
    
    return true;
  });

  // Sort history dynamically
  const sortedHistory = [...filteredHistory].sort((a, b) => {
    if (sortBy === 'date') {
      return b.createdAt - a.createdAt; // newest first
    } else if (sortBy === 'score') {
      return b.match_score - a.match_score; // highest score first
    } else {
      return a.company.localeCompare(b.company); // alphabetical A-Z
    }
  });

  // Group by company using the sorted & filtered array
  const groupedByCompany = sortedHistory.reduce((acc, item) => {
    const key = item.company || 'Autre Entreprise';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, HistoryItem[]>);

  // Sorted companies alphabetically or by their custom sorting criteria
  const sortedCompanies = Object.keys(groupedByCompany).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* HEADER CARD */}
      <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '300px',
          height: '100%',
          background: 'radial-gradient(circle at top right, var(--gold-glow), transparent 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.75rem' }}>
          <div style={{
            background: 'var(--gold-glow)',
            border: '1px solid var(--gold)',
            borderRadius: '50%',
            padding: '8px',
            color: 'var(--gold-bright)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Zap size={22} style={{ animation: isRunning ? 'pulse 1.5s infinite' : 'none' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Chasseur d'Emploi Autonome</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text2)', margin: 0 }} className="mono">
              / PILOTE AUTOMATIQUE D'OPTIMISATION DE CANDIDATURES
            </p>
          </div>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text)', maxWidth: '800px', lineHeight: '1.5', margin: 0 }}>
          Lancez un agent autonome pour parcourir vos sites d'emploi cibles, analyser les offres en temps réel par rapport à votre CV,
          bannir les entreprises indésirables, optimiser sémantiquement vos compétences et générer des CVs PDF haut de gamme prêts à l'envoi.
        </p>
      </div>

      {error && (
        <div className="ins danger" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          <AlertCircle size={18} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: '0.82rem' }}>{error}</p>
        </div>
      )}

      {/* DASHBOARD CONFIG & CONSOLE PANEL */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* CONFIG SECTION */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', margin: 0 }}>
          <div className="card-hd">Paramètres de Mission</div>

          {/* Core Fields */}
          <div>
            <label className="slabel" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Search size={12} /> Poste recherché
            </label>
            <input
              type="text"
              className="input-field"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ex: Apprenti Data analyst"
              disabled={isRunning}
            />
          </div>

          <div>
            <label className="slabel" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} /> Localisation
            </label>
            <input
              type="text"
              className="input-field"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ex: Paris, France"
              disabled={isRunning}
            />
          </div>

          <div>
            <label className="slabel" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Building size={12} style={{ color: 'var(--red)' }} /> Entreprises à exclure
            </label>
            <input
              type="text"
              className="input-field"
              style={{ borderColor: excludeCompanies ? 'var(--red-dim)' : 'var(--border)' }}
              value={excludeCompanies}
              onChange={(e) => setExcludeCompanies(e.target.value)}
              placeholder="ex: Alten, Altran, Sopra Steria"
              disabled={isRunning}
            />
            <div style={{ fontSize: '0.62rem', color: 'var(--text3)', marginTop: '4px', fontStyle: 'italic' }}>
              Exclut ces entreprises case-insensitives (séparées par des virgules).
            </div>
          </div>

          <div>
            <label className="slabel" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Globe size={12} /> Source de recherche
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn-outline"
                style={{
                  padding: '8px 10px',
                  fontSize: '0.68rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: searchMode === 'jobteaser' ? 'var(--gold-glow)' : 'transparent',
                  borderColor: searchMode === 'jobteaser' ? 'var(--gold)' : 'var(--border)',
                  color: searchMode === 'jobteaser' ? 'var(--gold-bright)' : 'var(--text)',
                  fontWeight: searchMode === 'jobteaser' ? 600 : 400,
                  transition: 'all 0.2s'
                }}
                onClick={() => setSearchMode('jobteaser')}
                disabled={isRunning}
              >
                <Lock size={11} style={{ opacity: searchMode === 'jobteaser' ? 1 : 0.6 }} />
                JobTeaser Uniquement
              </button>
              <button
                type="button"
                className="btn-outline"
                style={{
                  padding: '8px 10px',
                  fontSize: '0.68rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: searchMode === 'all' ? 'var(--gold-glow)' : 'transparent',
                  borderColor: searchMode === 'all' ? 'var(--gold)' : 'var(--border)',
                  color: searchMode === 'all' ? 'var(--gold-bright)' : 'var(--text)',
                  fontWeight: searchMode === 'all' ? 600 : 400,
                  transition: 'all 0.2s'
                }}
                onClick={() => setSearchMode('all')}
                disabled={isRunning}
              >
                <Globe size={11} style={{ opacity: searchMode === 'all' ? 1 : 0.6 }} />
                Multi-sources (Complet)
              </button>
            </div>
          </div>

          <div>
            <label className="slabel" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> Période de publication (Fraîcheur)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn-outline"
                style={{
                  padding: '6px 4px',
                  fontSize: '0.62rem',
                  background: recency === 'any' ? 'var(--gold-glow)' : 'transparent',
                  borderColor: recency === 'any' ? 'var(--gold)' : 'var(--border)',
                  color: recency === 'any' ? 'var(--gold-bright)' : 'var(--text)',
                  fontWeight: recency === 'any' ? 600 : 400,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
                onClick={() => setRecency('any')}
                disabled={isRunning}
              >
                Toutes
              </button>
              <button
                type="button"
                className="btn-outline"
                style={{
                  padding: '6px 4px',
                  fontSize: '0.62rem',
                  background: recency === '24h' ? 'var(--gold-glow)' : 'transparent',
                  borderColor: recency === '24h' ? 'var(--gold)' : 'var(--border)',
                  color: recency === '24h' ? 'var(--gold-bright)' : 'var(--text)',
                  fontWeight: recency === '24h' ? 600 : 400,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
                onClick={() => setRecency('24h')}
                disabled={isRunning}
              >
                <span>🌟</span> 24h
              </button>
              <button
                type="button"
                className="btn-outline"
                style={{
                  padding: '6px 4px',
                  fontSize: '0.62rem',
                  background: recency === '7d' ? 'var(--gold-glow)' : 'transparent',
                  borderColor: recency === '7d' ? 'var(--gold)' : 'var(--border)',
                  color: recency === '7d' ? 'var(--gold-bright)' : 'var(--text)',
                  fontWeight: recency === '7d' ? 600 : 400,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
                onClick={() => setRecency('7d')}
                disabled={isRunning}
              >
                <span>⚡</span> 7 jours
              </button>
            </div>
          </div>



          {/* Advanced Collapsible */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button
              type="button"
              className="btn-outline"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                textAlign: 'left',
                fontSize: '0.65rem',
                padding: '0.5rem 0.75rem',
                background: showAdvanced ? 'var(--card2)' : 'transparent',
                borderColor: showAdvanced ? 'var(--gold)' : 'var(--border)'
              }}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sliders size={12} />
                Thème & Options Avancées
              </span>
              <span>{showAdvanced ? '▼' : '►'}</span>
            </button>
            
            {showAdvanced && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.8rem', padding: '0.75rem', background: 'var(--card2)', borderRadius: 'var(--r-sm)' }}>
                <div>
                  <label className="slabel">Thème PDF cible</label>
                  <select
                    className="input-field"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    disabled={isRunning}
                  >
                    <option value="StrategicModern">StrategicModern (Premium)</option>
                    <option value="ExecutiveNarrative">ExecutiveNarrative (Sleek)</option>
                    <option value="CreativeMinimalist">CreativeMinimalist (Clean)</option>
                    <option value="ClassicAcademic">ClassicAcademic (Traditional)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Launch Buttons */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.2rem', display: 'flex', gap: '10px' }}>
            {isRunning ? (
              <button
                type="button"
                className="btn-primary"
                style={{
                  background: 'linear-gradient(135deg, var(--red) 0%, var(--red-dim) 100%)',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onClick={stopMission}
              >
                <Loader2 className="animate-spin" size={14} />
                Arrêter
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={startMission}
                disabled={!cvText || !apiKey}
              >
                <Play size={14} fill="currentColor" />
                Lancer la Mission
              </button>
            )}

            <button
              type="button"
              className="btn-outline"
              style={{ width: 'auto', flexShrink: 0 }}
              onClick={clearLogs}
              disabled={isRunning || logs.length === 0}
            >
              Vider
            </button>
          </div>
          
          {!cvText && (
            <div style={{ fontSize: '0.65rem', color: 'var(--text3)', textAlign: 'center', fontStyle: 'italic' }}>
              Importez un CV (PDF) pour activer la mission.
            </div>
          )}
        </div>

        {/* LOGS PANEL */}
        <div className="card" style={{
          display: 'flex',
          flexDirection: 'column',
          height: '520px',
          background: '#040508',
          border: '1px solid var(--border)',
          padding: 0,
          margin: 0,
          overflow: 'hidden',
          boxShadow: isRunning ? '0 0 25px rgba(212, 168, 83, 0.05)' : 'none',
          transition: 'all 0.3s'
        }}>
          {/* Console Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            background: 'var(--card)',
            borderBottom: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={14} style={{ color: isRunning ? 'var(--gold)' : 'var(--text3)' }} />
              <span className="mono" style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: isRunning ? 'var(--text)' : 'var(--text3)' }}>
                CONSOLE DE PILOTAGE AUTOMATIQUE {isRunning && '● STREAMING LIVE'}
              </span>
            </div>
            {isRunning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulse 1s infinite' }} />
                <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--gold-bright)' }}>RECHERCHE ACTIVE</span>
              </div>
            )}
          </div>

          {/* Console Output */}
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            {logs.length === 0 ? (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text3)',
                gap: '10px'
              }}>
                <Terminal size={32} style={{ opacity: 0.2 }} />
                <div className="mono" style={{ fontSize: '0.7rem', opacity: 0.4 }}>
                  Prêt à recevoir les instructions de mission.
                </div>
              </div>
            ) : (
              logs.map((log, idx) => {
                let color = '#7a8099'; // Default log text color
                let isBold = false;
                let bg = 'transparent';
                
                if (log.startsWith('[ERROR]') || log.startsWith('[FATAL ERROR]')) {
                  color = '#e05252'; // Red for errors
                } else if (log.startsWith('🚀') || log.includes('✅') || log.startsWith('🔴')) {
                  color = '#d4a853'; // Gold for boundaries / completions
                  isBold = true;
                } else if (log.includes('Optimum found') || log.includes('optimisé') || log.includes('Match score')) {
                  color = '#52c97a'; // Green for high performance items
                  bg = 'var(--green-dim)';
                } else if (log.includes('Connecting') || log.includes('crawling') || log.includes('Playwright')) {
                  color = '#4ecdc4'; // Cyan for networking
                }

                return (
                  <div
                    key={idx}
                    className="mono log-line"
                    style={{
                      fontSize: '0.72rem',
                      lineHeight: '1.4',
                      color,
                      fontWeight: isBold ? 600 : 400,
                      background: bg,
                      padding: bg !== 'transparent' ? '4px 8px' : '0',
                      borderRadius: bg !== 'transparent' ? '4px' : '0',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {log}
                  </div>
                );
              })
            )}
            <div ref={consoleEndRef} />
          </div>
        </div>
      </div>

      {/* MATCH HISTORY & AUDIT GRID */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div className="card-hd" style={{ margin: 0 }}>📁 Bibliothèque des Chasses & Opportunités</div>
            <p style={{ fontSize: '0.62rem', color: 'var(--text3)', margin: '4px 0 0' }} className="mono">
              / ARCHIVES DES MISSIONS ET DOSSIERS OPTIMISÉS
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn-outline"
              style={{
                width: 'auto',
                fontSize: '0.65rem',
                padding: '6px 12px',
                background: groupByCompany ? 'var(--gold-glow)' : 'transparent',
                borderColor: groupByCompany ? 'var(--gold)' : 'var(--border)',
                color: groupByCompany ? 'var(--gold-bright)' : 'var(--text)',
                fontWeight: groupByCompany ? 600 : 400
              }}
              onClick={() => setGroupByCompany(!groupByCompany)}
            >
              🏢 {groupByCompany ? 'Vue Liste à plat' : 'Grouper par Entreprise'}
            </button>
            
            <button
              type="button"
              className="btn-outline"
              style={{ width: 'auto', fontSize: '0.65rem', padding: '6px 12px' }}
              onClick={loadHistory}
              disabled={isLoadingHistory || isRunning}
            >
              {isLoadingHistory ? 'Chargement...' : '🔄 Actualiser'}
            </button>
          </div>
        </div>

        {/* UPGRADED SEARCH & FILTER TOOLBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          <div style={{ display: 'flex', gap: '10px', width: '100%', flexWrap: 'wrap' }}>
            
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
                <Search size={14} />
              </span>
              <input
                type="text"
                className="input-field"
                style={{ paddingLeft: '36px', height: '38px', fontSize: '0.78rem' }}
                placeholder="Rechercher par entreprise, poste, mots-clés de l'offre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '0.8rem' }}
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Freshness Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Filter size={11} /> Filtre :
              </span>
              <div style={{ display: 'flex', background: 'var(--void)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '2px' }}>
                <button
                  type="button"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.65rem',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: freshnessFilter === 'all' ? 'var(--gold-glow)' : 'transparent',
                    color: freshnessFilter === 'all' ? 'var(--gold-bright)' : 'var(--text2)',
                    fontWeight: freshnessFilter === 'all' ? 600 : 400,
                    transition: 'all 0.15s'
                  }}
                  onClick={() => setFreshnessFilter('all')}
                >
                  Tout
                </button>
                <button
                  type="button"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.65rem',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: freshnessFilter === '2h' ? 'var(--gold-glow)' : 'transparent',
                    color: freshnessFilter === '2h' ? 'var(--gold-bright)' : 'var(--text2)',
                    fontWeight: freshnessFilter === '2h' ? 600 : 400,
                    transition: 'all 0.15s'
                  }}
                  onClick={() => setFreshnessFilter('2h')}
                >
                  ⚡ &lt; 2h
                </button>
                <button
                  type="button"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.65rem',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: freshnessFilter === '24h' ? 'var(--gold-glow)' : 'transparent',
                    color: freshnessFilter === '24h' ? 'var(--gold-bright)' : 'var(--text2)',
                    fontWeight: freshnessFilter === '24h' ? 600 : 400,
                    transition: 'all 0.15s'
                  }}
                  onClick={() => setFreshnessFilter('24h')}
                >
                  🔥 &lt; 24h
                </button>
                <button
                  type="button"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.65rem',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: freshnessFilter === '3d' ? 'var(--gold-glow)' : 'transparent',
                    color: freshnessFilter === '3d' ? 'var(--gold-bright)' : 'var(--text2)',
                    fontWeight: freshnessFilter === '3d' ? 600 : 400,
                    transition: 'all 0.15s'
                  }}
                  onClick={() => setFreshnessFilter('3d')}
                >
                  📅 &lt; 3j
                </button>
              </div>
            </div>

            {/* Sorting Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <ArrowUpDown size={11} /> Tri :
              </span>
              <select
                className="input-field"
                style={{
                  height: '34px',
                  padding: '0 10px',
                  fontSize: '0.68rem',
                  width: '160px',
                  background: 'var(--void)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                  cursor: 'pointer'
                }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="date">Capture (Récent)</option>
                <option value="score">Score ATS (Élevé)</option>
                <option value="company">Entreprise (A-Z)</option>
              </select>
            </div>

          </div>
        </div>

        {isLoadingHistory && history.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text2)' }}>
            <Loader2 className="animate-spin" style={{ margin: '0 auto 10px' }} />
            <div className="mono" style={{ fontSize: '0.7rem' }}>Extraction de la bibliothèque...</div>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="empty" style={{ minHeight: '220px', padding: '2rem' }}>
            <Folder size={32} style={{ opacity: 0.3, color: 'var(--gold)' }} />
            <h3 style={{ fontSize: '1rem', margin: '10px 0 5px' }}>Aucune opportunité trouvée</h3>
            <p style={{ fontSize: '0.75rem', margin: 0, color: 'var(--text3)', maxWidth: '350px' }}>
              {history.length === 0 
                ? "Lancez une mission de chasse autonome pour remplir votre bibliothèque d'opportunités."
                : "Ajustez vos filtres de recherche pour afficher les opportunités correspondantes."}
            </p>
          </div>
        ) : (
          <div className="hunter-grid">
            
            {/* GRID OF OFFERS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {groupByCompany ? (
                // --- COMPANY GROUPED SHELVES ---
                sortedCompanies.map(company => {
                  const items = groupedByCompany[company];
                  return (
                    <div
                      key={company}
                      style={{
                        background: 'var(--void)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-md)',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Company Shelf Header */}
                      <div
                        style={{
                          background: 'var(--card)',
                          padding: '10px 16px',
                          borderBottom: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            background: 'var(--gold-glow)',
                            borderRadius: '4px',
                            padding: '4px',
                            color: 'var(--gold-bright)',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <Building size={14} />
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.02em', color: 'var(--text)' }}>
                            {company}
                          </span>
                        </div>
                        <span className="mono" style={{ fontSize: '0.62rem', background: 'var(--border)', color: 'var(--text2)', padding: '2px 8px', borderRadius: '10px' }}>
                          {items.length} {items.length > 1 ? 'opportunités' : 'opportunité'}
                        </span>
                      </div>

                      {/* Items in Company Shelf */}
                      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {items.map(item => {
                          const scoreColor = item.match_score >= 75 ? 'var(--green)' : item.match_score >= 50 ? 'var(--amber)' : 'var(--red)';
                          const isSelected = selectedResult?.folderName === item.folderName;

                          return (
                            <div
                              key={item.folderName}
                              style={{
                                background: isSelected ? 'var(--card2)' : 'var(--surface)',
                                border: isSelected ? '1px solid var(--gold)' : '1px solid var(--border)',
                                borderRadius: 'var(--r-sm)',
                                padding: '12px 14px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: isSelected ? '0 0 10px var(--gold-glow)' : 'none'
                              }}
                              onClick={() => viewVerdict(item.folderName)}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                <div style={{ flex: 1 }}>
                                  <h4 style={{ fontSize: '0.82rem', margin: '0 0 4px', fontWeight: 600, color: 'var(--text)' }}>
                                    {item.job_title}
                                  </h4>
                                  <div style={{ fontSize: '0.62rem', color: 'var(--text3)', wordBreak: 'break-all' }} className="mono">
                                    Dossier : {item.folderName}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {(() => {
                                    const fresh = getFreshness(item.createdAt);
                                    return (
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        background: fresh.bg,
                                        border: `1px solid ${fresh.color}33`,
                                        color: fresh.color,
                                        borderRadius: '4px',
                                        padding: '2px 6px',
                                        fontSize: '0.62rem',
                                        fontWeight: 600,
                                        boxShadow: fresh.pulse ? `0 0 8px ${fresh.color}33` : 'none'
                                      }} className="mono">
                                        {fresh.pulse && (
                                          <span style={{
                                            width: '5px',
                                            height: '5px',
                                            borderRadius: '50%',
                                            background: fresh.color,
                                            display: 'inline-block',
                                            animation: 'pulse 1.5s infinite'
                                          }} />
                                        )}
                                        {fresh.label}
                                      </div>
                                    );
                                  })()}

                                  <div style={{
                                    background: `${scoreColor}14`,
                                    border: `1px solid ${scoreColor}`,
                                    color: scoreColor,
                                    borderRadius: '4px',
                                    padding: '2px 6px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700
                                  }} className="mono">
                                    {item.match_score}% MATCH
                                  </div>

                                  <button
                                    type="button"
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'var(--text3)',
                                      cursor: 'pointer',
                                      padding: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'color 0.2s'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteHistoryItem(item.folderName);
                                    }}
                                    title="Supprimer définitivement"
                                  >
                                    <Trash2 size={13} style={{ color: 'var(--red)' }} />
                                  </button>
                                </div>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                                <div style={{ fontSize: '0.58rem', color: 'var(--text3)' }} className="mono">
                                  {new Date(item.createdAt).toLocaleString('fr-FR', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>

                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {item.source_url && (
                                    <a
                                      href={item.source_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn-outline"
                                      style={{
                                        padding: '2px 6px',
                                        width: 'auto',
                                        fontSize: '0.55rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px'
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ExternalLink size={8} /> Offre
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    className="btn-primary"
                                    style={{ padding: '2px 6px', width: 'auto', fontSize: '0.55rem' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditResult(item.folderName, 'edit');
                                    }}
                                  >
                                    ✏️ CV
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-outline"
                                    style={{ padding: '2px 6px', width: 'auto', fontSize: '0.55rem', border: '1px solid var(--gold)', color: 'var(--gold)' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditResult(item.folderName, 'letter');
                                    }}
                                  >
                                    ✉️ Lettre
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                // --- FLAT LIST VIEW ---
                sortedHistory.map((item) => {
                  const scoreColor = item.match_score >= 75 ? 'var(--green)' : item.match_score >= 50 ? 'var(--amber)' : 'var(--red)';
                  const isSelected = selectedResult?.folderName === item.folderName;

                  return (
                    <div
                      key={item.folderName}
                      style={{
                        background: isSelected ? 'var(--card2)' : 'var(--surface)',
                        border: isSelected ? '1px solid var(--gold)' : '1px solid var(--border)',
                        borderRadius: 'var(--r-md)',
                        padding: '1.1rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: isSelected ? '0 0 15px var(--gold-glow)' : 'none'
                      }}
                      onClick={() => viewVerdict(item.folderName)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <h4 style={{ fontSize: '0.92rem', margin: '0 0 4px', fontWeight: 700 }}>{item.job_title}</h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text2)' }}>
                            <Building size={12} />
                            <span>{item.company}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {(() => {
                            const fresh = getFreshness(item.createdAt);
                            return (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: fresh.bg,
                                border: `1px solid ${fresh.color}33`,
                                color: fresh.color,
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '0.62rem',
                                fontWeight: 600,
                                boxShadow: fresh.pulse ? `0 0 8px ${fresh.color}33` : 'none'
                              }} className="mono">
                                {fresh.pulse && (
                                  <span style={{
                                    width: '5px',
                                    height: '5px',
                                    borderRadius: '50%',
                                    background: fresh.color,
                                    display: 'inline-block',
                                    animation: 'pulse 1.5s infinite'
                                  }} />
                                )}
                                {fresh.label}
                              </div>
                            );
                          })()}

                          <div style={{
                            background: `${scoreColor}18`,
                            border: `1px solid ${scoreColor}`,
                            color: scoreColor,
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '0.74rem',
                            fontWeight: 700
                          }} className="mono">
                            {item.match_score}% MATCH
                          </div>

                          <button
                            type="button"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text3)',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.2s'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHistoryItem(item.folderName);
                            }}
                            title="Supprimer définitivement"
                          >
                            <Trash2 size={14} style={{ color: 'var(--red)' }} />
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text3)' }} className="mono">
                          {new Date(item.createdAt).toLocaleString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {item.source_url && (
                            <a
                              href={item.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-outline"
                              style={{
                                padding: '4px 8px',
                                width: 'auto',
                                fontSize: '0.58rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={10} /> Offre
                            </a>
                          )}
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ padding: '4px 8px', width: 'auto', fontSize: '0.58rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditResult(item.folderName, 'edit');
                            }}
                          >
                            ✏️ CV
                          </button>
                          <button
                            type="button"
                            className="btn-outline"
                            style={{ padding: '4px 8px', width: 'auto', fontSize: '0.58rem', border: '1px solid var(--gold)', color: 'var(--gold)' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditResult(item.folderName, 'letter');
                            }}
                          >
                            ✉️ Lettre
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* AUDIT / DETAIL SIDEBAR */}
            <div style={{ position: 'sticky', top: '1.5rem' }}>
              {selectedResult ? (
                <div className="card" style={{ margin: 0, padding: '1.2rem', background: 'var(--card2)', border: '1px solid var(--border2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', margin: '0 0 2px' }}>Analyse Sémantique AI</h4>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text3)', margin: 0 }} className="mono">
                        / DOSSIER OPTIMISÉ
                      </p>
                    </div>
                    <button
                      type="button"
                      style={{ background: 'transparent', color: 'var(--text3)', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                      onClick={() => setSelectedResult(null)}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Folder Location Copy */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--void)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)',
                    padding: '8px 12px',
                    marginBottom: '1rem'
                  }}>
                    <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                      outputs/job_hunter/{selectedResult.folderName}
                    </span>
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 'none', padding: '2px', cursor: 'pointer', color: copiedFolder ? 'var(--green)' : 'var(--text3)' }}
                      onClick={() => copyToClipboard(`outputs/job_hunter/${selectedResult.folderName}`)}
                      title="Copier le chemin relatif"
                    >
                      {copiedFolder ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>

                  {/* Match score bar */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--gold-bright)' }}>CONFORMITÉ ATS :</span>
                      <span className="mono" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{selectedResult.match_score || 0}%</span>
                    </div>
                    <div className="sbar" style={{ height: '6px' }}>
                      <div
                        className="sbar-fill"
                        style={{
                          width: `${selectedResult.match_score || 0}%`,
                          background: (selectedResult.match_score || 0) >= 75 ? 'var(--green)' : (selectedResult.match_score || 0) >= 50 ? 'var(--amber)' : 'var(--red)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Verdict audit box */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {selectedResult.verdict && (
                      <div className="ins cyan" style={{ margin: 0, padding: '10px 12px' }}>
                        <div className="ins-l">VERDICT DE L'AUDITEUR</div>
                        <p style={{ fontSize: '0.78rem', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                          {selectedResult.verdict}
                        </p>
                      </div>
                    )}

                    {selectedResult.optimized_changes && selectedResult.optimized_changes.length > 0 && (
                      <div className="ins ok" style={{ margin: 0, padding: '10px 12px' }}>
                        <div className="ins-l">PRINCIPAUX AJUSTEMENTS APPLIQUÉS</div>
                        <ul style={{ margin: 0, paddingLeft: '14px', color: 'var(--text)', fontSize: '0.74rem', lineHeight: '1.4' }}>
                          {selectedResult.optimized_changes.slice(0, 5).map((change: string, idx: number) => (
                            <li key={idx} style={{ marginBottom: '4px' }}>{change}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{
                  border: '1px dashed var(--border)',
                  borderRadius: 'var(--r-md)',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  color: 'var(--text3)'
                }}>
                  <Sparkles size={24} style={{ opacity: 0.15, marginBottom: '8px', margin: '0 auto' }} />
                  <p style={{ fontSize: '0.78rem', margin: 0 }}>
                    Cliquez sur une opportunité à gauche pour afficher son verdict sémantique complet et ses recommandations ATS.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        
        .log-line:hover {
          text-shadow: 0 0 6px var(--gold);
        }

        .hunter-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 1.5rem;
          align-items: start;
        }

        @media (max-width: 1200px) {
          .hunter-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

    </div>
  );
}