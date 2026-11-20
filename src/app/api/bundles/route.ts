import { NextResponse } from 'next/server';
import { getBundles } from '@/lib/bundle-data';

export async function GET() {
  return NextResponse.json(await getBundles(), { headers: { 'Cache-Control': 'no-store' } });
}
