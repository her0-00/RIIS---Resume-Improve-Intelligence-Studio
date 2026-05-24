import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { query, location, cv_text, letter_text, ai_provider, api_key, azure_endpoint, azure_deployment, theme, jobteaser_url, jobteaser_email, jobteaser_password, exclude_companies, search_mode, recency } = await req.json();

    if (!query || !cv_text || !api_key) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400 });
    }

    // Save CV and optional Letter to temporary files for the Python script to read
    const fs = require('fs');
    const tempDir = path.join(process.cwd(), 'public', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const cvPath = path.join(tempDir, `cv_${Date.now()}.txt`);
    fs.writeFileSync(cvPath, cv_text);

    let letterPath = '';
    if (letter_text) {
      letterPath = path.join(tempDir, `letter_${Date.now()}.txt`);
      fs.writeFileSync(letterPath, letter_text);
    }

    const stream = new ReadableStream({
      start(controller) {
        const pythonScript = path.resolve(process.cwd(), '..', 'backend', 'job_hunter_agent.py');
        
        const args = [
          pythonScript,
          '--query', query,
          '--cv', cvPath,
          '--provider', ai_provider,
          '--key', api_key
        ];

        if (letterPath) {
          args.push('--letter', letterPath);
        }

        if (location) {
          args.push('--location', location);
        }

        if (ai_provider === 'azure') {
          if (azure_endpoint) args.push('--endpoint', azure_endpoint);
          if (azure_deployment) args.push('--deployment', azure_deployment);
        }
        if (theme) args.push('--theme', theme);
        if (jobteaser_url) args.push('--jobteaser-url', jobteaser_url);
        if (jobteaser_email) args.push('--jobteaser-email', jobteaser_email);
        if (jobteaser_password) args.push('--jobteaser-password', jobteaser_password);
        if (exclude_companies) args.push('--exclude-companies', exclude_companies);
        if (search_mode) args.push('--search-mode', search_mode);
        if (recency) args.push('--recency', recency);

        const pyProcess = spawn('python', args);

        // Kill python process if user stops the mission
        req.signal.addEventListener('abort', () => {
          pyProcess.kill();
          controller.close();
        });

        pyProcess.stdout.on('data', (data) => {
          controller.enqueue(new TextEncoder().encode(data.toString()));
        });

        pyProcess.stderr.on('data', (data) => {
          controller.enqueue(new TextEncoder().encode(`\n[ERROR] ${data.toString()}`));
        });

        pyProcess.on('close', (code) => {
          if (!req.signal.aborted) {
            controller.enqueue(new TextEncoder().encode(`\n\n✅ Mission terminée (Code: ${code})\n`));
            controller.close();
          }
          // Cleanup temp files
          try { fs.unlinkSync(cvPath); } catch (e) {}
          try { if (letterPath) fs.unlinkSync(letterPath); } catch (e) {}
        });

        pyProcess.on('error', (err) => {
          if (!req.signal.aborted) {
            controller.enqueue(new TextEncoder().encode(`\n[FATAL ERROR] ${err.message}\n`));
            controller.close();
          }
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
