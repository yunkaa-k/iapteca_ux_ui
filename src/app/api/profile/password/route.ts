import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { getAuthUser } from '@/lib/auth';
import { UserModel, UserSessionModel } from '@/lib/db';

export async function POST(req: Request) {
  try {
    if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({ error: 'Недозволений запит.' }, { status: 403 });
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Увійдіть до акаунта.' }, { status: 401 });
    const body = await req.json();
    const { currentPassword, newPassword, confirmation } = body ?? {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || Buffer.byteLength(currentPassword) > 72 || newPassword.length < 8 || Buffer.byteLength(newPassword) > 72 || confirmation !== newPassword || newPassword === currentPassword) return NextResponse.json({ error: 'Перевірте поточний пароль. Новий пароль має відрізнятися, містити щонайменше 8 символів (до 72 байтів) і збігатися з підтвердженням.' }, { status: 400 });
    const account = await UserModel.findById(user._id).select('password').lean();
    if (!account || !(await bcrypt.compare(currentPassword, account.password))) return NextResponse.json({ error: 'Поточний пароль неправильний. Спробуйте ще раз.', fields: { currentPassword: 'Поточний пароль неправильний. Спробуйте ще раз.' } }, { status: 400 });
    const password = await bcrypt.hash(newPassword, 12);
    const result = await UserModel.updateOne({ _id: user._id, password: account.password }, { $set: { password } });
    if (!result.modifiedCount) return NextResponse.json({ error: 'Дані вже змінилися. Оновіть сторінку та спробуйте знову.' }, { status: 409 });
    const token = (await cookies()).get('auth_id')?.value;
    const tokenHash = token ? createHash('sha256').update(token).digest('hex') : '';
    await UserSessionModel.deleteMany({ user: user._id, tokenHash: { $ne: tokenHash } });
    return NextResponse.json({ message: 'Пароль змінено. Інші сеанси завершено.' });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) return NextResponse.json({ error: 'Некоректний запит.' }, { status: 400 });
    return NextResponse.json({ error: 'Не вдалося змінити пароль. Спробуйте ще раз.' }, { status: 500 });
  }
}
