import { NextResponse } from 'next/server';
import { connectDB, UserModel } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function PUT(req: Request) {
  try {
    if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({ error: 'Недозволений запит.' }, { status: 403 });
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Auth' }, { status: 401 });
    await connectDB();
    const body = await req.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.replace(/[\s()-]/g, '') : '';
    if (!name || name.length > 100 || (phone && !/^\+380\d{9}$/.test(phone))) return NextResponse.json({ error: 'Укажіть ім’я (до 100 символів) та коректний номер +380XXXXXXXXX.' }, { status: 400 });
    const updated = await UserModel.findByIdAndUpdate(user._id, { $set: { name, ...(phone ? { phone } : {}) }, ...(!phone ? { $unset: { phone: 1 } } : {}) }, { new: true, runValidators: true }).select('_id name phone email role isBanned').lean();
    if (!updated) return NextResponse.json({ error: 'Користувача не знайдено.' }, { status: 404 });
    return NextResponse.json({ user: { ...updated, _id: updated._id.toString() } });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) return NextResponse.json({ error: 'Некоректний запит.' }, { status: 400 });
    if (typeof error === 'object' && error && 'code' in error && error.code === 11000) return NextResponse.json({ error: 'Цей номер телефону вже використовується.' }, { status: 409 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Auth' }, { status: 401 });
    await connectDB();
    await UserModel.findByIdAndDelete(user._id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
