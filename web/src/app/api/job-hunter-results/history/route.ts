import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const outputsDir = path.join(process.cwd(), '..', 'outputs', 'job_hunter');
    if (!fs.existsSync(outputsDir)) {
      return NextResponse.json({ history: [] });
    }

    const folders = fs.readdirSync(outputsDir);
    const history = [];

    for (const folder of folders) {
      const folderPath = path.join(outputsDir, folder);
      const stat = fs.statSync(folderPath);
      if (stat.isDirectory()) {
        const infoPath = path.join(folderPath, 'offre_info.json');
        if (fs.existsSync(infoPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
            history.push({
              folderName: folder,
              job_title: data.job_title || 'Poste',
              company: data.company || 'Entreprise',
              verdict: data.verdict,
              match_score: data.match_score || 0,
              source_url: data.source_url,
              createdAt: stat.mtime.getTime()
            });
          } catch (e) {
            console.error(`Error reading ${infoPath}`, e);
          }
        }
      }
    }

    // Sort by newest first
    history.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ history });
  } catch (error: any) {
    console.error('History Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { folderName } = await req.json();
    if (!folderName) {
      return NextResponse.json({ error: 'Missing folderName' }, { status: 400 });
    }
    
    // Safety check to prevent directory traversal
    if (folderName.includes('..') || folderName.includes('/') || folderName.includes('\\')) {
      return NextResponse.json({ error: 'Invalid folderName' }, { status: 400 });
    }

    const outputsDir = path.join(process.cwd(), '..', 'outputs', 'job_hunter');
    const folderPath = path.join(outputsDir, folderName);

    if (fs.existsSync(folderPath)) {
      // Recursive delete folder
      fs.rmSync(folderPath, { recursive: true, force: true });
      return NextResponse.json({ success: true, message: `Folder ${folderName} deleted successfully` });
    } else {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('Delete History Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
