import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const folder = searchParams.get('folder');

  if (!folder) return NextResponse.json({ error: 'No folder provided' }, { status: 400 });

  // Redirect to the main page with the folder name to trigger loading
  return NextResponse.redirect(new URL(`/?edit_job_hunter=${folder}`, req.url).origin + `/?edit_job_hunter=${folder}`);
}
