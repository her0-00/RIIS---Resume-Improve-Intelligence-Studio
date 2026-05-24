import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { Mistral } from '@mistralai/mistralai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AIProvider = 'groq' | 'mistral' | 'google' | 'azure';

/**
 * PRIVACY PROTECTION (Free Tier):
 * If true, sensitive data (name, email, phone, links, location) in the CV 
 * will be replaced by fictitious values before being sent to the AI.
 */
const ANONYMIZE_FOR_PRIVACY = true;

// --- IN-MEMORY JOB STORE FOR POLLING ---
interface AnalysisJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: string;
  result?: any;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, AnalysisJob>();

function cleanupJobs() {
  const now = Date.now();
  const maxAge = 1000 * 60 * 60; // 1 hour
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > maxAge) {
      jobs.delete(id);
    }
  }
}

/**
 * Sanitize extracted PDF text.
 */
function sanitizeCvText(text: string): string {
  return text
    .replace(/(?<!\w)[{}\[\]](?!\w)/g, '')
    .replace(/\/\//g, '')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map(l => l.trim()).join('\n')
    .trim();
}

/**
 * Anonymize sensitive info in CV text (Free Tier Privacy).
 */
function anonymizeCvText(text: string): string {
  let lines = text.split('\n');
  
  // 1. Attempt to anonymize Name (often the first non-empty line)
  let nameReplaced = false;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (lines[i].trim().length > 3 && !nameReplaced) {
      lines[i] = "JEAN DOE (Candidat Anonyme)";
      nameReplaced = true;
    }
  }

  let result = lines.join('\n');

  // 2. Email addresses
  result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'contact@candidat-anonyme.fr');

  // 3. Phone numbers (Standard FR/Intl patterns)
  result = result.replace(/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g, '06 00 00 00 00');

  // 4. Social/Professional Links
  result = result.replace(/https?:\/\/[^\s]+/g, (match) => {
    const lower = match.toLowerCase();
    if (lower.includes('linkedin.com')) return 'https://www.linkedin.com/in/candidat-anonyme';
    if (lower.includes('github.com')) return 'https://github.com/candidat-anonyme';
    if (lower.includes('portfolio') || lower.includes('behance') || lower.includes('dribbble')) return 'https://mon-portfolio-anonyme.com';
    return 'https://lien-anonymise.com';
  });

  // 5. Location (Detecting common City + Zip patterns like "Paris 75000" or "75000 Paris")
  result = result.replace(/\b\d{5}\b\s+[A-Z][a-z]+/g, '75000 Paris');
  result = result.replace(/[A-Z][a-z]+\s+\b\d{5}\b/g, 'Paris 75000');

  return result;
}

/**
 * Extract JSON from model response.
 */
function extractJson(text: string): any {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in model response');

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const jsonStr = text.slice(start, i + 1);
        return JSON.parse(jsonStr);
      }
    }
  }
  throw new Error('Incomplete JSON object in model response');
}

/**
 * Format AI technical errors into user-friendly messages.
 */
function formatAiError(err: any, provider: string): string {
  const msg = (err.message || String(err)).toLowerCase();
  
  // Specific check for the 'undici' / fetch failed bug on invalid keys
  if (msg.includes('fetch failed') || msg.includes('expected non-null body source') || msg.includes('unable to make request')) {
    return `La clé API ${provider} semble invalide ou un problème de connexion est survenu. Veuillez vérifier votre clé et votre connexion internet.`;
  }
  
  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid api key') || msg.includes('authentication')) {
    return `La clé API ${provider} est invalide ou expirée.`;
  }
  
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
    return `Limite de requêtes atteinte pour ${provider}. Veuillez patienter quelques instants ou vérifier vos quotas.`;
  }

  if (msg.includes('timeout')) {
    return `Le service ${provider} est trop lent à répondre (timeout). Veuillez réessayer.`;
  }

  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
    return `Le service ${provider} rencontre actuellement des difficultés techniques.`;
  }

  return `Erreur ${provider} : ${err.message || 'Problème inconnu'}`;
}

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b'
];

const MISTRAL_MODELS = [
  'mistral-large-latest',
  'ministral-8b-latest',
  'mistral-small-latest'
];

const GOOGLE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest'
];

// --- AI CALLERS ---

async function callGoogle(
  apiKey: string,
  system: string,
  userMsg: string,
  label: string,
  timeoutMs: number = 120000
): Promise<{ data: any; model: string }> {
  const cleanApiKey = apiKey.replace(/[^\x20-\x7E]/g, '').trim();
  const genAI = new GoogleGenerativeAI(cleanApiKey);
  let lastError: any;

  for (const modelName of GOOGLE_MODELS) {
    const modelStartTime = performance.now();
    try {
      console.log(`[${label}] Trying Google model: ${modelName}`);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      });
      const result = await Promise.race([
        model.generateContent(`${system}\n\n${userMsg}`),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
      ]);
      const raw = (result as any).response.text();
      const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
      if (!raw) continue;
      const data = extractJson(raw);
      console.log(`[${label}][${modelName}] Success in ${duration}s`);
      return { data, model: modelName };
    } catch (err: any) {
      const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
      console.error(`[${label}][${modelName}] Error after ${duration}s:`, err.message);
      lastError = err;
      // Continue to next model if timeout, rate limit (429), or server error (500, 502, 503, 504)
      if (err.message === 'timeout' || err.message.includes('429') || err.message.includes('500') || err.message.includes('502') || err.message.includes('503') || err.message.includes('504')) continue;
      throw err;
    }
  }
  throw lastError;
}

async function callMistral(
  mistral: Mistral,
  system: string,
  userMsg: string,
  label: string,
  timeoutMs: number = 120000,
  maxTokens: number = 4096
): Promise<{ data: any; model: string }> {
  let lastError: any;
  for (const model of MISTRAL_MODELS) {
    const modelStartTime = performance.now();
    try {
      console.log(`[${label}] Trying Mistral model: ${model}`);
      const response = await Promise.race([
        mistral.chat.complete({
          model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
          temperature: 0.1,
          maxTokens,
          responseFormat: { type: 'json_object' }
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
      ]);
      const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
      const raw = (response as any).choices?.[0]?.message?.content || '';
      const data = extractJson(typeof raw === 'string' ? raw : JSON.stringify(raw));
      console.log(`[${label}][${model}] Success in ${duration}s`);
      return { data, model };
    } catch (err: any) {
      const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
      console.error(`[${label}][${model}] Error after ${duration}s:`, err.message);
      lastError = err;
      // Continue to next model if timeout, rate limit, or server error
      if (err.message === 'timeout' || err.statusCode === 429 || (err.statusCode >= 500 && err.statusCode <= 504)) continue;
      throw err;
    }
  }
  throw lastError;
}

async function callGroq(
  groq: Groq,
  system: string,
  userMsg: string,
  label: string,
  timeoutMs: number = 120000,
  maxTokens: number = 4096
): Promise<{ data: any; model: string }> {
  let lastError: any;
  for (const model of GROQ_MODELS) {
    const modelStartTime = performance.now();
    try {
      console.log(`[${label}] Trying Groq model: ${model}`);
      const completion = await Promise.race([
        groq.chat.completions.create({
          messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
          model,
          temperature: 0.1,
          max_tokens: maxTokens,
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
      ]);
      const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
      const raw = (completion as any).choices[0]?.message?.content || '';
      const data = extractJson(raw);
      console.log(`[${label}][${model}] Success in ${duration}s`);
      return { data, model };
    } catch (err: any) {
      const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
      console.error(`[${label}][${model}] Error after ${duration}s:`, err.message);
      lastError = err;
      // Continue to next model if timeout, rate limit, or server error
      if (err.message === 'timeout' || err.status === 429 || (err.status >= 500 && err.status <= 504)) continue;
      throw err;
    }
  }
  throw lastError;
}

async function callAzure(
  apiKey: string,
  endpoint: string,
  primaryDeployment: string,
  system: string,
  userMsg: string,
  label: string,
  timeoutMs: number = 120000
): Promise<{ data: any; model: string }> {
  // Smart fallback list
  const fallbackDeployments = [
    primaryDeployment,
    'gpt-5.4-pro',
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5',
    'gpt-5-mini',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-35-turbo'
  ].filter(d => d && d.length > 0);
  
  // Remove duplicates while preserving order
  const deployments = Array.from(new Set(fallbackDeployments));
  
  let lastError: any = null;

  for (const deployment of deployments) {
    const client = new OpenAI({
      apiKey,
      baseURL: `${endpoint}/openai/deployments/${deployment}`,
      defaultQuery: { 'api-version': '2024-02-15-preview' },
      defaultHeaders: { 'api-key': apiKey },
    });

    const modelStartTime = performance.now();
    try {
      console.log(`[${label}] Trying Azure OpenAI deployment: ${deployment}`);
      const response = await Promise.race([
        client.chat.completions.create({
          model: deployment,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userMsg },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
      ]);

      const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
      const raw = (response as any).choices?.[0]?.message?.content || '';
      const data = extractJson(raw);
      console.log(`[${label}][${deployment}] Success in ${duration}s`);
      return { data, model: deployment };
    } catch (err: any) {
      const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
      console.error(`[${label}][${deployment}] Error after ${duration}s:`, err.message);
      lastError = err;
      // Continue to next fallback
    }
  }

  throw lastError || new Error(`All Azure deployments failed for ${label}`);
}

// --- HANDLERS ---

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  const job = jobs.get(jobId);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  return NextResponse.json(job);
}

async function performAnalysis(jobId: string, params: any) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'processing';
    job.progress = 'Starting Analysis...';
    
    const { cv_text, job_desc, api_key, boost_mode, lang, ai_provider, azure_endpoint, azure_deployment } = params;
    const provider: AIProvider = ai_provider || 'groq';
    const outputLang = lang === 'en' ? 'English' : 'French';

    const apiKeyRaw = api_key || (provider === 'groq' ? process.env.GROQ_API_KEY : provider === 'mistral' ? process.env.MISTRAL_API_KEY : provider === 'google' ? process.env.GOOGLE_API_KEY : process.env.AZURE_OPENAI_API_KEY);
    if (!apiKeyRaw && provider !== 'azure') throw new Error(`Missing ${provider} API Key`);
    if (provider === 'azure' && !apiKeyRaw) throw new Error('Missing Azure API Key');
    const apiKeyToUse = apiKeyRaw ? apiKeyRaw.replace(/[^\x20-\x7E]/g, '').trim() : '';

    let cleanCvText = sanitizeCvText(cv_text);
    
    // Privacy protection for Free Tier
    if (ANONYMIZE_FOR_PRIVACY) {
      console.log(`[${jobId}] Privacy Mode Active: Anonymizing CV text before AI processing.`);
      cleanCvText = anonymizeCvText(cleanCvText);
    }

    // --- AGENT 1: STRATEGIC AUDIT ---
    job.progress = 'Step 1: Strategic Audit...';
    
    const system1 = `You are a senior HR expert, work psychologist and ATS specialist.
Analyze the CV and job offer provided, then output a single JSON object.
CRITICAL: Base ALL analysis strictly on the actual CV content. For present_keywords, only list keywords that genuinely appear in the CV. For missing_keywords, only list keywords from the job offer that are truly absent from the CV.

PRO EXPERT RULES TO ENFORCE (CareerOps-inspired):
1. APPRENTICESHIP/ALTERNANCE: If the candidate mentions "alternance" or "apprentissage", check if they specified their "rythme" (e.g., 1 week / 3 weeks). If missing, flag as a CON in Formations.
2. IDENTITY: Check for full name, a professional title matching the target job, and a location (City + Zip).
3. MOBILITY: Check for mentions of "Permis B" / Driver's license if relevant.
4. QUANTIFIABLE IMPACT: Every experience MUST have at least one figure (number, %, $, €, time saved, users impacted). If no numbers are found in an experience, flag lack of impact. Examples: "Reduced costs by 30%", "Managed team of 5", "Processed 1000+ applications".
5. ONLINE BRAND: Check for a LinkedIn profile link. If missing, flag as a critical CON in Identité.
6. ORTHOGRAPHY: Specifically scan for typos, double spaces, and syntax errors. Provide a verdict.
7. ATS STRUCTURE RISK: Detect multi-column layouts (Canva-style, sidebar designs). These ALWAYS fail ATS parsing. If detected, set ats_structure_risk to CRITICAL and warn explicitly.
8. DATE FORMAT CONSISTENCY: Check if dates follow consistent format (MM/YYYY or MM/AAAA). Flag inconsistencies.
9. KEYWORD DENSITY: Check if top 5 job offer keywords appear in the first 3 lines of the CV (summary/title). If not, flag as missing optimization.

Required fields:
- global_score: integer 0-100
- ats_pass_probability: integer 0-100
- ats_structure_risk: string "LOW"|"MEDIUM"|"HIGH"|"CRITICAL"
- ats_structure_warning: string (2-3 sentences, null if LOW)
- salary_gap, salary_estimate, salary_potential: strings
- market_value_verdict: short striking phrase
- sections: object {resume, formation, experience, competences, impact_quantifie, formatage_dates, verbes_action, longueur} (0-10)
- job_match: object {missions, skills, seniority, culture} (0-100)
- psychology: object {pourquoi_ignore, pourquoi_sous_paye, personal_brand} (strings)
- ia_detector_score, international_compatibility: integers
- top_strength: string
- critical_fixes: array of 6 strings
- missing_keywords: array of 6 strings
- present_keywords: array of 5 strings
- detailed_report: array of exactly 5 objects: {
    "category": string (MUST be: "Identité & Projet Professionnel", "Mobilité & Coordonnées", "Expériences Professionnelles", "Formations & Études", "Audit Technique (Compétences & Layout)"),
    "pros": array of strings (the conform points),
    "cons": array of strings (the points to improve)
  }
- orthography_verdict: string (detailed qualitative feedback)
- benchmark: object {tech, finance, consulting, marketing, rh_legal} (0-100)
- grounding: object {top_strength, pourquoi_ignore, market_value} using {"text", "line"}

ATS STRUCTURE DETECTION:
- Canva/Design CVs with columns ALWAYS fail ATS parsing - warn the user explicitly
Output ONLY the raw JSON object. Do not add any explanation, markdown, or text outside the JSON.`;

    const cvTextLines = cleanCvText.split('\n');
    const cvWithHeaderMarks = cvTextLines.map((line, idx) => 
      idx < 10 ? `[HEADER: CONTACT INFO - DO NOT CITE FOR STRENGTHS] ${line}` : line
    ).join('\n');

    const prompt1 = `CV TEXT (Indexed):\n${cvWithHeaderMarks.substring(0, 6000)}\n\nJOB OFFER:\n${job_desc ? job_desc.substring(0, 3000) : 'Senior management — general analysis'}`;
    
    const agent1Result = provider === 'groq'
      ? await callGroq(new Groq({ apiKey: apiKeyToUse }), system1, prompt1, 'Agent1-Audit', 120000, 4096)
      : provider === 'mistral'
      ? await callMistral(new Mistral({ apiKey: apiKeyToUse, timeoutMs: 120000 }), system1, prompt1, 'Agent1-Audit', 120000, 4096)
      : provider === 'google'
      ? await callGoogle(apiKeyToUse, system1, prompt1, 'Agent1-Audit', 120000)
      : await callAzure(apiKeyToUse, azure_endpoint || process.env.AZURE_OPENAI_ENDPOINT || '', azure_deployment || process.env.AZURE_OPENAI_DEPLOYMENT || '', system1, prompt1, 'Agent1-Audit');
    
    const analysisData = agent1Result.data;
    const currentScore = analysisData.global_score || 0;
    const missingKws = (analysisData.missing_keywords || []).slice(0, 8).join(', ');

    // --- AGENT 2: DEEP REWRITE ---
    job.progress = 'Step 2: Deep Rewriting...';

    const system2 = boost_mode
      ? `You are an aggressive CV optimizer and career coach. Your goal: make this CV the strongest possible candidate for the target job.
WRITE EVERYTHING IN ${outputLang.toUpperCase()} — including role titles, bullets, summary, skill category names, and education details. Translate any French content to ${outputLang}.

CRITICAL FIXES TO APPLY:
${(analysisData.critical_fixes || []).slice(0, 4).map((fix: string, i: number) => `${i + 1}. ${fix}`).join('\n')}

MISSING KEYWORDS TO INJECT: ${missingKws}

KEYWORD INJECTION STRATEGY (CareerOps ethical approach):
- ONLY reformulate existing experience with job offer vocabulary
- NEVER invent skills or accomplishments
- Examples of legitimate reformulation:
  * JD: "RAG pipelines" + CV: "LLM workflows with retrieval" → "RAG pipeline design and LLM orchestration workflows"
  * JD: "MLOps" + CV: "observability, evals" → "MLOps and observability: evals, error handling, cost monitoring"
  * JD: "stakeholder management" + CV: "collaborated with team" → "stakeholder management across engineering and business"

Rules:
- name: full name only (no title, no pipe, no year).
- title: rewrite to perfectly match the target role. In ${outputLang}. If candidate is seeking "alternance/apprentissage", ADD the rhythm (e.g., "1 semaine / 3 semaines") in title if present in CV.
- email, phone, location, linkedin, github, portfolio: copy VERBATIM from CV. null if absent.
- summary: 3 powerful sentences in ${outputLang} positioning the candidate as the ideal hire. INJECT top 5 missing keywords naturally in first 2 sentences. If candidate is a founder/entrepreneur, include exit narrative bridge (e.g., "Built and sold a business. Now applying systems thinking to [job domain]."). If seeking alternance/apprentissage and rhythm is mentioned in CV, include it here.
- experiences: company and location VERBATIM. Translate role to ${outputLang}. STAY TRUTHFUL - do not invent accomplishments or exaggerate.
- period: FORCED DATE FORMAT. If FR: 'MM/AAAA' (03/2021). If EN: 'MM/YYYY' (03/2021). For current roles, use 'Depuis MM/AAAA' (FR) or 'MM/YYYY - Present' (EN).
- bullets: rewrite aggressively in ${outputLang}. INJECT missing keywords naturally. QUANTIFY IMPACT: every bullet should have at least one number (%, $, €, time, users, team size). If original bullet lacks numbers, try to infer reasonable metrics from context (e.g., "Led team" → "Led team of 3-5 engineers"). DO NOT hallucinate - stay faithful to original content.
- education: degree/school VERBATIM. 
- year: FORCED DATE FORMAT. If FR: 'MM/AAAA' (or just AAAA if month absent). If EN: 'MM/YYYY' (or just YYYY).
- detail = specialization if present, else null.
- skills: EXACTLY {"categories": [{"name": "...", "items": ["..."]}]}. Max 3 categories. Category names in ${outputLang}. INJECT all missing keywords in relevant categories.
- languages: EXACTLY [{"lang": "...", "level": "...", "level_num": 1-5}]. ONLY languages from CV. level label in ${outputLang}.
- certifications: array of strings. [] if none. ADD "Permis B" if driving relevant and missing.
- interests: array of strings (hobbies, etc.). [] if none.
- formatting: STRICTLY NO MARKDOWN. Do not use bold (**) or any other markdown characters in the values.


CRITICAL: experiences must be objects with bullets array, NOT strings. STAY TRUTHFUL - optimize wording but do not fabricate content.
Output a single raw JSON with ONLY: name, title, email, phone, location, linkedin, github, portfolio, website, summary, experiences, education, skills, languages, certifications, interests.`
      : `You are an expert CV rewriter and career coach.
Goal: rewrite the candidate's CV to maximize match with the target job, while staying truthful.
WRITE EVERYTHING IN ${outputLang.toUpperCase()} — including role titles, bullets, summary, skill category names, and education details. Translate any French content to ${outputLang}.

KEYWORD INJECTION STRATEGY (CareerOps ethical approach):
- ONLY reformulate existing experience with job offer vocabulary
- NEVER invent skills or accomplishments
- Examples: "LLM workflows" → "RAG pipeline design", "team collaboration" → "stakeholder management"

Rules:
- name: full name only (no title, no pipe, no year).
- title: optimize to match the target role in ${outputLang}. Short, no sentences.
- email, phone, location, linkedin, github, portfolio, website: copy VERBATIM from CV. null if absent.
- summary: 3 punchy sentences in ${outputLang}. If candidate is a founder/entrepreneur, include exit narrative (e.g., "Built and sold a business. Now applying systems thinking to [domain].").
- experiences: company and location VERBATIM. Translate role to ${outputLang}. 
- period: FORCED DATE FORMAT. If FR: 'MM/AAAA' (03/2021). If EN: 'MM/YYYY' (03/2021). For current roles, use 'Depuis MM/AAAA' (FR) or 'MM/YYYY - Present' (EN).
- bullets: rewrite in ${outputLang}, stronger. QUANTIFY IMPACT: add numbers (%, $, time, users) when possible without inventing.
- education: degree/school VERBATIM. 
- year: FORCED DATE FORMAT. If FR: 'MM/AAAA' (or just AAAA if month absent). If EN: 'MM/YYYY' (or just YYYY).
- detail = specialization if present, else null.
- skills: EXACTLY {"categories": [{"name": "...", "items": ["..."]}]}. Max 3 categories. Category names in ${outputLang}.
- languages: EXACTLY [{"lang": "...", "level": "...", "level_num": 1-5}]. ONLY languages from CV. level label in ${outputLang}.
- certifications: array of strings. [] if none.
- interests: array of strings (hobbies, etc.). [] if none.
- formatting: STRICTLY NO MARKDOWN. Do not use bold (**) or any other markdown characters in the values.

CRITICAL: experiences must be objects with bullets array, NOT strings.
Output a single raw JSON with ONLY: name, title, email, phone, location, linkedin, github, portfolio, website, summary, experiences, education, skills, languages, certifications, interests.`;

    const prompt2 = `CV HEADER (first lines):
${cleanCvText.split('\n').filter(l => l.trim()).slice(0, 6).join('\n')}

FULL CV TEXT:
${cleanCvText.substring(0, 6000)}

TARGET JOB OFFER:
${job_desc ? job_desc.substring(0, 2000) : 'General optimization for senior tech/data roles'}

IMPORTANT: The output language is ${outputLang.toUpperCase()}. Translate ALL role titles, bullets, summary, and skill category names into ${outputLang}. Do NOT keep any French words in role titles or bullets.`;

    const agent2Result = provider === 'groq'
      ? await callGroq(new Groq({ apiKey: apiKeyToUse }), system2, prompt2, 'Agent2-Rewrite', 120000, 6000)
      : provider === 'mistral'
      ? await callMistral(new Mistral({ apiKey: apiKeyToUse, timeoutMs: 120000 }), system2, prompt2, 'Agent2-Rewrite', 120000, 6000)
      : provider === 'google'
      ? await callGoogle(apiKeyToUse, system2, prompt2, 'Agent2-Rewrite', 120000)
      : await callAzure(apiKeyToUse, azure_endpoint || process.env.AZURE_OPENAI_ENDPOINT || '', azure_deployment || process.env.AZURE_OPENAI_DEPLOYMENT || '', system2, prompt2, 'Agent2-Rewrite');
    
    const llmFields = agent2Result.data;

    // --- NORMALIZATION (RESTORING ORIGINAL LOGIC) ---

    // Normalize skills: [{category, skills}] or [{name, skills}] -> {categories:[{name,items}]}
    let skills = llmFields.skills;
    if (Array.isArray(skills)) {
      skills = {
        categories: skills.map((s: any) => ({
          name: s?.name ?? s?.category ?? '',
          items: s?.items ?? s?.skills ?? []
        }))
      };
    } else if (!skills?.categories) {
      skills = { categories: [] };
    }
    // Ensure each category has name:string and items:string[]
    skills.categories = (skills.categories as any[]).map((cat: any) => ({
      name: typeof cat.name === 'string' ? cat.name.replace(/\*\*/g, '').replace(/\*/g, '') : (cat.category ?? ''),
      items: Array.isArray(cat.items) 
        ? cat.items.filter((i: any) => typeof i === 'string').map((i: string) => i.replace(/\*\*/g, '').replace(/\*/g, ''))
        : Array.isArray(cat.skills) 
        ? cat.skills.filter((i: any) => typeof i === 'string').map((i: string) => i.replace(/\*\*/g, '').replace(/\*/g, '')) 
        : []
    }));

    // Normalize languages: "French" -> {lang,level,level_num}
    let languages: any[] = llmFields.languages ?? [];
    if (languages.length > 0 && typeof languages[0] === 'string') {
      languages = languages.map((l: string) => ({ lang: l, level: '', level_num: 3 }));
    }
    const levelLabel = (n: number, isEn: boolean) => {
      const fr = ['', 'Notions', 'Élémentaire', 'Intermédiaire', 'Professionnel', 'Natif'];
      const en = ['', 'Beginner', 'Elementary', 'Intermediate', 'Professional', 'Native'];
      return (isEn ? en : fr)[Math.min(Math.max(n, 1), 5)] ?? '';
    };
    languages = languages.map((l: any) => {
      const num = typeof l?.level_num === 'number' ? l.level_num : 3;
      const isEn = outputLang === 'English';
      const level = (typeof l?.level === 'string' && l.level.trim()) ? l.level.replace(/\*\*/g, '').replace(/\*/g, '') : levelLabel(num, isEn);
      return { 
        lang: typeof l?.lang === 'string' ? l.lang.replace(/\*\*/g, '').replace(/\*/g, '') : '', 
        level, 
        level_num: num 
      };
    });

    // Normalize experiences: strings -> {role, company, period, location, bullets}
    const rawExp = Array.isArray(llmFields.experiences) ? llmFields.experiences : [];
    const experiences = rawExp.map((e: any) => {
      if (typeof e === 'string') {
        return { role: e, company: '', period: '', location: '', bullets: [] };
      }
      const cleanBullets = Array.isArray(e?.bullets) 
        ? e.bullets
            .filter((b: any) => typeof b === 'string')
            .map((b: string) => b.replace(/\*\*/g, '').replace(/\*/g, ''))
        : [];
      
      return {
        role: typeof e?.role === 'string' ? e.role.replace(/\*\*/g, '').replace(/\*/g, '') : '',
        company: typeof e?.company === 'string' ? e.company : '',
        period: typeof e?.period === 'string' ? e.period : (e?.period ?? ''),
        location: typeof e?.location === 'string' ? e.location : '',
        bullets: cleanBullets,
      };
    });

    // Normalize education: strings -> {degree, school, year, detail}
    const rawEdu = Array.isArray(llmFields.education) ? llmFields.education : [];
    const education = rawEdu.map((e: any) => {
      if (typeof e === 'string') {
        return { degree: e, school: '', year: '', detail: null };
      }
      return {
        degree: typeof e?.degree === 'string' ? e.degree.replace(/\*\*/g, '').replace(/\*/g, '') : '',
        school: typeof e?.school === 'string' ? e.school : '',
        year: typeof e?.year === 'string' ? e.year : (e?.year ?? ''),
        detail: typeof e?.detail === 'string' ? e.detail.replace(/\*\*/g, '').replace(/\*/g, '') : null,
      };
    });

    const interests = llmFields.interests || llmFields["centres d'intérêt"] || llmFields["centre d'intérêt"] || llmFields.hobbies || llmFields.loisirs || [];

    const cvDataStructured = {
      name:           String(llmFields.name || llmFields.nom || ''),
      title:          String(llmFields.title || llmFields.titre || '').replace(/\*\*/g, '').replace(/\*/g, ''),
      email:          typeof llmFields.email    === 'string' ? llmFields.email    : null,
      phone:          typeof llmFields.phone    === 'string' ? llmFields.phone    : null,
      location:       typeof llmFields.location === 'string' ? llmFields.location : null,
      linkedin:       typeof llmFields.linkedin === 'string' ? llmFields.linkedin : null,
      github:         typeof llmFields.github   === 'string' ? llmFields.github   : null,
      portfolio:      typeof llmFields.portfolio === 'string' ? llmFields.portfolio : null,
      summary:        String(llmFields.summary || llmFields.résumé || llmFields.profil || '').replace(/\*\*/g, '').replace(/\*/g, ''),
      experiences,
      education,
      certifications: Array.isArray(llmFields.certifications) ? llmFields.certifications.filter((c: any) => typeof c === 'string').map((c: string) => c.replace(/\*\*/g, '').replace(/\*/g, '')) : [],
      skills,
      languages,
      interests: Array.isArray(interests) ? interests.filter((i: any) => typeof i === 'string').map((i: string) => i.replace(/\*\*/g, '').replace(/\*/g, '')) : [],
      score_before: currentScore,
      score_after:  Math.min(currentScore + 15, 100),
    };

    job.status = 'completed';
    job.progress = 'Finished';
    job.result = {
      ...analysisData,
      _cv_data: cvDataStructured,
      _models_used: {
        provider,
        agent1: agent1Result.model,
        agent2: agent2Result.model
      }
    };

  } catch (err: any) {
    console.error(`[JOB-FAILED][${jobId}]`, err);
    job.status = 'failed';
    // Provide a user-friendly error message based on the provider
    const provider = params.ai_provider || 'groq';
    job.error = formatAiError(err, provider.charAt(0).toUpperCase() + provider.slice(1));
  }
}

export async function POST(req: Request) {
  try {
    cleanupJobs();
    const params = await req.json();
    const jobId = Math.random().toString(36).substring(2, 15);
    jobs.set(jobId, { id: jobId, status: 'pending', progress: 'In Queue', createdAt: Date.now() });
    
    performAnalysis(jobId, params).catch(console.error);
    
    return NextResponse.json({ jobId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
