import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { Mistral } from '@mistralai/mistralai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AIProvider = 'groq' | 'mistral' | 'google' | 'azure';

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

const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
const MISTRAL_MODELS = ['mistral-large-latest', 'mistral-small-latest'];
const GOOGLE_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

async function callGoogle(apiKey: string, system: string, userMsg: string): Promise<{ data: any }> {
  const genAI = new GoogleGenerativeAI(apiKey.trim());
  let lastError;
  for (const modelName of GOOGLE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      });
      const result = await model.generateContent(`${system}\n\n${userMsg}`);
      const raw = result.response.text();
      if (!raw) continue;
      return { data: extractJson(raw) };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function callMistral(mistral: Mistral, system: string, userMsg: string): Promise<{ data: any }> {
  let lastError;
  for (const model of MISTRAL_MODELS) {
    try {
      const response = await mistral.chat.complete({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
        temperature: 0.2,
        responseFormat: { type: 'json_object' }
      });
      const raw = response.choices?.[0]?.message?.content || '';
      return { data: extractJson(typeof raw === 'string' ? raw : JSON.stringify(raw)) };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function callGroq(groq: Groq, system: string, userMsg: string): Promise<{ data: any }> {
  let lastError;
  for (const model of GROQ_MODELS) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });
      const raw = completion.choices[0]?.message?.content || '';
      return { data: extractJson(raw) };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function callAzure(apiKey: string, endpoint: string, deployment: string, system: string, userMsg: string): Promise<{ data: any }> {
  const client = new OpenAI({
    apiKey,
    baseURL: `${endpoint}/openai/deployments/${deployment}`,
    defaultQuery: { 'api-version': '2024-02-15-preview' },
    defaultHeaders: { 'api-key': apiKey },
  });
  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMsg },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });
  const raw = response.choices?.[0]?.message?.content || '';
  return { data: extractJson(raw) };
}

export async function POST(req: Request) {
  try {
    const params = await req.json();
    const {
      cv_text,
      old_letter_text,
      job_desc,
      company_name,
      company_address,
      hiring_manager,
      subject,
      api_key,
      ai_provider,
      azure_endpoint,
      azure_deployment,
      lang
    } = params;

    const provider: AIProvider = ai_provider || 'groq';
    const outputLang = lang === 'en' ? 'English' : 'French';

    const apiKeyRaw = api_key || (provider === 'groq' ? process.env.GROQ_API_KEY : provider === 'mistral' ? process.env.MISTRAL_API_KEY : provider === 'google' ? process.env.GOOGLE_API_KEY : process.env.AZURE_OPENAI_API_KEY);
    if (!apiKeyRaw) {
      return NextResponse.json({ error: `Missing ${provider} API Key` }, { status: 400 });
    }
    const apiKeyToUse = apiKeyRaw.replace(/[^\x20-\x7E]/g, '').trim();

    const systemPrompt = `You are an elite career strategist, copywriter, and ATS expert.
Your goal is to output a single raw JSON object representing a highly compelling, beautifully structured, and persuasive Cover Letter ("Lettre de Motivation") tailored to the target job description.

Write EVERYTHING in the target language: ${outputLang.toUpperCase()}.

If 'old_letter_text' is provided, preserve the authentic background and core achievements but aggressively elevate the grammar, formatting, sota-vocabulary, and ATS keyword matching.
If no 'old_letter_text' is provided, extract the candidate's core strengths, metrics, and professional details from the 'cv_text' and write a stellar letter.

CRITICAL CONTENT RULES:
1. Recipient & Date:
   - Use the current date formatted nicely (e.g. "Le 18 mai 2026" for French, "May 18, 2026" for English).
   - Inferred company address if not provided. Inferred hiring manager name as "Madame, Monsieur" or custom if provided.
2. Subject line:
   - Provide a clear, neat subject line (e.g., "Objet : Candidature pour le poste de [Job Title] en alternance/CDI").
3. Narrative Structure (3-4 paragraphs max):
   - Paragraph 1: Hooks the reader immediately, referencing the target position, showing active industry knowledge, and articulating high interest in the company.
   - Paragraph 2 ("Moi"): Showcases the candidate's exact technical competencies, quantified accomplishments (e.g., % improvement, tools managed), and academic alignment from the CV. Stay truthful to CV details.
   - Paragraph 3 ("Vous"): Connects candidate's skills with the company's core challenges, project needs, or vision.
   - Paragraph 4 ("Nous"): Active CTA suggesting an interview, written in a confident but respectful tone, ending with a professional salutation.

Your JSON output MUST have exactly these fields:
- name: string (candidate full name)
- title: string (candidate job title/target title)
- email: string
- phone: string
- location: string
- linkedin: string (optional/null if none)
- github: string (optional/null if none)
- portfolio: string (optional/null if none)
- date: string (formatted current date)
- company_name: string (target company name)
- company_address: string (target address)
- hiring_manager: string (hiring manager name or null)
- subject: string
- body_paragraphs: array of 4 strings (one string per paragraph)

Do NOT add any markdown, text blocks, or explanations outside the JSON object.`;

    const userPrompt = `
CANDIDATE CV / DATA:
${cv_text ? cv_text.substring(0, 6000) : 'Jean Doe, Ingénieur IA'}

OLD COVER LETTER (TO EXPOSE & IMPROVE):
${old_letter_text || 'Aucune lettre fournie. Générer une nouvelle lettre basée sur le CV.'}

TARGET JOB DESCRIPTION:
${job_desc ? job_desc.substring(0, 3000) : 'Ingénieur Intelligence Artificielle / Data Scientist'}

TARGET DETAILS OVERRIDES:
- Company Name: ${company_name || 'Inferred'}
- Company Address: ${company_address || 'Inferred'}
- Hiring Manager: ${hiring_manager || 'Inferred'}
- Custom Subject: ${subject || 'Inferred'}
`;

    let result;
    if (provider === 'groq') {
      result = await callGroq(new Groq({ apiKey: apiKeyToUse }), systemPrompt, userPrompt);
    } else if (provider === 'mistral') {
      result = await callMistral(new Mistral({ apiKey: apiKeyToUse }), systemPrompt, userPrompt);
    } else if (provider === 'google') {
      result = await callGoogle(apiKeyToUse, systemPrompt, userPrompt);
    } else {
      result = await callAzure(apiKeyToUse, azure_endpoint || '', azure_deployment || '', systemPrompt, userPrompt);
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('Error generating cover letter:', error);
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}
