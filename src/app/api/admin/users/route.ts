import { NextResponse } from 'next/server';
import { connectDB, UserModel } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET() {

  try {
    const user = await getAuthUser();
    if (user?.role !== 'ADMIN') {
      logger.warn('admin.access_denied', { user_id: user?._id.toString() || 'unknown', path: '/api/admin/users' });
      throw new Error('Unauthorized');
    }
    
    await connectDB();
    const users = await UserModel.find().sort({ createdAt: -1 });
    
    return NextResponse.json(users);
  } catch { 
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 }); 
  }
}
