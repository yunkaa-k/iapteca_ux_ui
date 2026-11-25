import { NextResponse } from 'next/server';
import { connectDB, UserModel } from '@/lib/db';
import bcrypt from 'bcrypt';
import { setAuthCookie } from '@/lib/auth';
import { normalizeEmail, validEmail } from '@/lib/authValidation';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: 'Недозволений запит.' }, { status: 403 });
    const body = await req.json();
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!validEmail(email) || !password || Buffer.byteLength(password) > 72) {
      return NextResponse.json({ error: 'Перевірте введені дані.' }, { status: 400 });
    }
    await connectDB();
    const user = await UserModel.findOne({ email });
    if (!user || user.isBanned || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: 'Неправильна електронна пошта або пароль.' }, { status: 401 });
    }
    await setAuthCookie(user._id.toString());
    logger.info('user.login', { user_id: user._id.toString() });
    return NextResponse.json({ user: { _id: user._id.toString(), phone: user.phone, email: user.email, role: user.role, name: user.name, isBanned: false } });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) return NextResponse.json({ error: 'Некоректний запит.' }, { status: 400 });
    logger.error('user.login_error', { error_name: error instanceof Error ? error.name : 'UnknownError' });
    return NextResponse.json({ error: 'Не вдалося увійти. Спробуйте пізніше.' }, { status: 500 });
  }
}
