import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { Mistral } from '@mistralai/mistralai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

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
        return JSON.parse(text.slice(start, i + 1));
      }
    }
  }
  throw new Error('Incomplete JSON object');
}

export async function POST(req: Request) {
  try {
    const { company_name, api_key, ai_provider, azure_endpoint, azure_deployment } = await req.json();
    const provider: AIProvider = ai_provider || 'groq';

    const cleanName = (typeof company_name === 'string' ? company_name : '').trim().slice(0, 50);
    const cleanKey = (typeof api_key === 'string' ? api_key : '').trim();

    if (!cleanName) {
      return NextResponse.json({ error: 'Missing company name' }, { status: 400 });
    }

    const apiKeyToUse = cleanKey || (provider === 'groq' ? process.env.GROQ_API_KEY : provider === 'mistral' ? process.env.MISTRAL_API_KEY : process.env.GOOGLE_API_KEY) || '';
    if (!apiKeyToUse && provider !== 'azure') {
      return NextResponse.json({ error: `Missing ${provider === 'groq' ? 'Groq' : provider === 'mistral' ? 'Mistral' : 'Google'} API Key` }, { status: 400 });
    }
    if (provider === 'azure' && (!cleanKey || !azure_endpoint || !azure_deployment)) {
      return NextResponse.json({ error: 'Missing Azure credentials (Key, Endpoint, or Deployment)' }, { status: 400 });
    }

    console.log(`[BRAND-COLORS] Provider: ${provider} | Input: "${cleanName}" | Key length: ${apiKeyToUse.length}`);

    // --- Web Search & Deep Extraction ---
    console.log(`[BRAND-COLORS] Searching ground truth for: ${cleanName}...`);
    let groundTruth = "";
    try {
      const slug = cleanName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-t0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const directUrl = `https://www.brandcolorcode.com/${slug}`;
      console.log(`[BRAND-COLORS] Trying direct source: ${directUrl}`);
      
      let targetUrl = null;
      const directResp = await fetch(directUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      
      if (directResp.ok) {
        targetUrl = directUrl;
      } else {
        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(cleanName)}+brand+identity+hex+color+guidelines`;
        const searchResp = await fetch(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36' }
        });
        if (searchResp.ok) {
          const html = await searchResp.text();
          const linkMatch = html.match(/href="(https:\/\/[^"]*brand[^"]*)"/i) || html.match(/href="(https:\/\/[^"]*color[^"]*)"/i);
          targetUrl = linkMatch ? linkMatch[1] : null;
        }
      }

      if (targetUrl) {
        console.log(`[BRAND-COLORS] Deep Dive Target: ${targetUrl}`);
        const deepResp = await fetch(targetUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 3600 } 
        });
        if (deepResp.ok) {
          const deepHtml = await deepResp.text();
          groundTruth = deepHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').slice(0, 3000);
          console.log(`[BRAND-COLORS] Deep extraction successful.`);
        }
      }
    } catch (e) {
      console.warn("[BRAND-COLORS] Tech error during deep dive:", e);
    }

    const combinedPrompt = `Senior Brand Designer Task:
Extract official colours for "${cleanName}" and adapt for professional CV.

WEB DATA SOURCE:
${groundTruth || "No direct web data found. LEAN ON YOUR ICONIC BRAND KNOWLEDGE."}

CRITICAL VALIDATION RULES:
1. MANDATORY: The "WEB DATA SOURCE" above contains the ground truth. You MUST prioritize it over your internal memory.
2. DISCOVERY: If you see "Red", "#E1000F", or "Black" in the WEB DATA, those ARE the primary colors. Use them as "primary" and "secondary".
3. NO GENERIC THEMES: Do NOT use blue just because it's a bank. If the brand is iconic (SOCIETE GENERALE), use the Red/Black identity.
4. If WEB DATA is present, your goal is to EXTRACT, not to invent.

Return ONLY this JSON:
{
  "palettes": [
    {
      "name": "Variation Name",
      "colors": {"primary": "Hex", "secondary": "Hex", "accent": "Hex", "text": "Hex", "background": "Hex"}
    }
  ]
}
Generate 4 variations style: Institutional, Modern, Minimalist, Bold. 
No preamble. No markdown code blocks. Just raw JSON.`;

    let content = '';
    let lastError;

    const timeoutMs = 120000;
    if (provider === 'groq') {
      const groq = new Groq({ apiKey: apiKeyToUse });
      const fallbackModels = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b'
      ];

      for (const model of fallbackModels) {
        const modelStartTime = performance.now();
        try {
          console.log(`[BRAND-COLORS] Attempting Groq model: ${model}`);
          const chatCompletion = await Promise.race([
            groq.chat.completions.create({
              messages: [{ role: 'user', content: combinedPrompt }],
              model: model,
              temperature: 0.1,
              max_tokens: 1000,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), timeoutMs)
            )
          ]);
          const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
          console.log(`[BRAND-COLORS][${model}] Success in ${duration}s`);
          content = ((chatCompletion as any).choices[0]?.message?.content || '').trim();
          break;
        } catch (err: any) {
          const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
          console.error(`[BRAND-COLORS][${model}] Error after ${duration}s:`, err?.message || err);
          lastError = err;
          if (err.status === 429 || err.message === 'timeout' || err.message.includes('aborted') || err.message.includes('high demand') || (err.status >= 500 && err.status <= 504)) {
            console.warn(`[BRAND-COLORS] Groq ${model} failed (${err.message}), trying next...`);
            continue;
          }
          throw err;
        }
      }
    } else if (provider === 'mistral') {
      const mistral = new Mistral({ apiKey: apiKeyToUse, timeoutMs: 120000 });
      const fallbackModels = [
        'ministral-8b-latest',
        'mistral-small-latest',
        'mistral-large-latest'
      ];

      for (const model of fallbackModels) {
        const modelStartTime = performance.now();
        try {
          console.log(`[BRAND-COLORS] Attempting Mistral model: ${model}`);
          const response = await Promise.race([
            mistral.chat.complete({
              model,
              messages: [{ role: 'user', content: combinedPrompt }],
              temperature: 0.1,
              maxTokens: 1000,
              responseFormat: { type: 'json_object' },
              safePrompt: false
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), timeoutMs)
            )
          ]);
          const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
          console.log(`[BRAND-COLORS][${model}] Success in ${duration}s`);
          const raw = (response as any)?.choices?.[0]?.message?.content || '';
          content = typeof raw === 'string' ? raw : JSON.stringify(raw);
          break;
        } catch (err: any) {
          const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
          console.error(`[BRAND-COLORS][${model}] Error after ${duration}s:`, err?.message || err);
          lastError = err;
          const msg = err?.message || '';
          if (err?.statusCode === 429 || msg.includes('rate_limit') || msg === 'timeout' || msg.includes('aborted') || msg.includes('high demand') || (err?.statusCode >= 500 && err?.statusCode <= 504)) {
            console.warn(`[BRAND-COLORS] Mistral ${model} failed (${msg}), trying next...`);
            continue;
          }
          if (msg.includes('fetch failed') || msg.includes('ConnectionError')) {
            console.warn(`[BRAND-COLORS] Mistral ${model} connection failed, trying next...`);
            continue;
          }
          throw err;
        }
      }
    } else if (provider === 'azure') {
      const modelStartTime = performance.now();
      try {
        console.log(`[BRAND-COLORS] Attempting Azure OpenAI: ${azure_deployment}`);
        const url = `${azure_endpoint.replace(/\/$/, '')}/openai/deployments/${azure_deployment}/chat/completions?api-version=2024-02-15-preview`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKeyToUse
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: combinedPrompt }],
            temperature: 0.1,
            max_completion_tokens: 1000,
            response_format: { type: 'json_object' }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Azure API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
        console.log(`[BRAND-COLORS][Azure] Success in ${duration}s`);
        content = data.choices[0]?.message?.content || '';
      } catch (err: any) {
        console.error(`[BRAND-COLORS][Azure] Error:`, err?.message || err);
        lastError = err;
        throw err;
      }
    } else {
      // Google AI
      const genAI = new GoogleGenerativeAI(apiKeyToUse);
      const fallbackModels = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-flash-latest'
      ];

      for (const modelName of fallbackModels) {
        const modelStartTime = performance.now();
        try {
          console.log(`[BRAND-COLORS] Attempting Google model: ${modelName}`);
          const model = genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          });
          const result = await Promise.race([
            model.generateContent(combinedPrompt),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), timeoutMs)
            )
          ]);
          const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
          console.log(`[BRAND-COLORS][${modelName}] Success in ${duration}s`);
          content = (result as any).response.text();
          if (typeof content !== 'string') {
            content = JSON.stringify(content);
          }
          break;
        } catch (err: any) {
          const duration = ((performance.now() - modelStartTime) / 1000).toFixed(1);
          console.error(`[BRAND-COLORS][${modelName}] Error after ${duration}s:`, err?.message || err);
          lastError = err;
          const msg = err?.message || '';
          if (msg.includes('quota') || msg.includes('429') || msg === 'timeout' || msg.includes('aborted') || msg.includes('high demand') || msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
            console.warn(`[BRAND-COLORS] Google ${modelName} failed (${msg}), trying next...`);
            continue;
          }
          if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED') || msg.includes('404')) {
            console.warn(`[BRAND-COLORS] Google ${modelName} not available, trying next...`);
            continue;
          }
          throw err;
        }
      }
    }

    if (!content) throw lastError || new Error('All models failed');

    console.log('[DEBUG-API] Final model output:', content);

    const cleanedContent = content
      .replace(/",\s*\{/g, ', {')
      .replace(/\}\s*,"/g, '}, ')
      .replace(/\[\s*"/g, '[')
      .replace(/"\s*\]/g, ']');

    try {
      const data = extractJson(cleanedContent);
      return NextResponse.json(data);
    } catch (e: any) {
      console.error('[CompanyColors] JSON Parse Error:', content);
      return NextResponse.json({ error: 'Failed to generate valid palettes', raw: content }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Company Colors Error:', error);
    return NextResponse.json({ error: error.message || 'API Failed' }, { status: 500 });
  }
}
