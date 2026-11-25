import { NextResponse } from 'next/server';
import { connectDB, CategoryModel } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET() {

  await connectDB();
  const categories = await CategoryModel.find().sort({ name: 1 });
  
  logger.debug('categories.fetched', { count: categories.length });
  
  return NextResponse.json(categories);
}

export async function POST(req: Request) {

  const user = await getAuthUser();
  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  await connectDB();
  const data = await req.json();
  const category = await CategoryModel.create(data);
  
  logger.info('category.created', { admin_id: user._id.toString(), category_id: category._id.toString(), name: category.name });
  
  return NextResponse.json(category);
}
