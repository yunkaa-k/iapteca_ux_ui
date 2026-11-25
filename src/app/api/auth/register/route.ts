import { NextResponse } from 'next/server';
import { connectDB, UserModel } from '@/lib/db';
import bcrypt from 'bcrypt';
import { setAuthCookie } from '@/lib/auth';
import { normalizeEmail, validateEmailAuth } from '@/lib/authValidation';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: 'Недозволений запит.' }, { status: 403 });
    const body = await req.json();
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : undefined;
    const fields = validateEmailAuth(email, password, true, body.consent === true);
    if (Object.keys(fields).length) return NextResponse.json({ error: 'Перевірте введені дані.', fields }, { status: 400 });
    await connectDB();
    if (await UserModel.findOne({ email })) return NextResponse.json({ error: 'Акаунт із такими даними вже існує. Спробуйте увійти.' }, { status: 409 });
    const user = await UserModel.create({ email, password: await bcrypt.hash(password, 10), name, privacyAcceptedAt: new Date() });
    await setAuthCookie(user._id.toString());
    logger.info('user.register', { user_id: user._id.toString() });
    return NextResponse.json({ user: { _id: user._id.toString(), phone: user.phone, email: user.email, role: user.role, name: user.name, isBanned: false } }, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return NextResponse.json({ error: 'Акаунт із такими даними вже існує. Спробуйте увійти.' }, { status: 409 });
    if (error instanceof SyntaxError || error instanceof TypeError) return NextResponse.json({ error: 'Некоректний запит.' }, { status: 400 });
    logger.error('user.register_error', { error_name: error instanceof Error ? error.name : 'UnknownError' });
    return NextResponse.json({ error: 'Не вдалося створити акаунт. Спробуйте пізніше.' }, { status: 500 });
  }
}
