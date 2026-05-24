import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const folder = searchParams.get('folder');

  if (!folder) return NextResponse.json({ error: 'No folder provided' }, { status: 400 });

  const resultPath = path.join(process.cwd(), '..', 'outputs', 'job_hunter', folder, 'offre_info.json');

  if (!fs.existsSync(resultPath)) {
    return NextResponse.json({ error: 'Result folder not found' }, { status: 404 });
  }

  const data = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
  return NextResponse.json(data);
}
