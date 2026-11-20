import { NextResponse } from 'next/server';
import { getBundles } from '@/lib/bundle-data';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = (await getBundles()).find(b => b._id === id || b.slug === id);
  return bundle ? NextResponse.json(bundle, { headers: { 'Cache-Control': 'no-store' } }) : NextResponse.json({ error: 'Аптечку не знайдено.' }, { status: 404 });
}
