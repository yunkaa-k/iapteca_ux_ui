import { NextResponse } from 'next/server';
import { deleteAuthCookie } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {

  try {
    await deleteAuthCookie();
    logger.info('user.logout', { ip: req.headers.get('x-forwarded-for') || 'unknown' });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('user.logout_error', { error_message: errorMessage });
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
