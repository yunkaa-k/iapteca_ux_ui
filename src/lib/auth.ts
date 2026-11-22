import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { connectDB, UserModel, UserSessionModel } from './db';

const lifetime = 60 * 60 * 24;
const tokenPattern = /^[a-f0-9]{64}$/;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function getAuthUser() {
  const store = await cookies();
  const token = store.get('auth_id')?.value;
  if (!token || !tokenPattern.test(token)) return null;
  await connectDB();
  const session = await UserSessionModel.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;
  const user = await UserModel.findById(session.user).lean();
  if (!user || user.isBanned) return null;
  return { _id: user._id.toString(), phone: user.phone, email: user.email, role: user.role, name: user.name, firstName: user.firstName, lastName: user.lastName, isBanned: false };
}

export async function setAuthCookie(userId: string) {
  await connectDB();
  const store = await cookies();
  const previous = store.get('auth_id')?.value;
  const token = randomBytes(32).toString('hex');
  await UserSessionModel.create({ tokenHash: hashToken(token), user: userId, expiresAt: new Date(Date.now() + lifetime * 1000) });
  if (previous && tokenPattern.test(previous)) await UserSessionModel.deleteOne({ tokenHash: hashToken(previous) });
  store.set('auth_id', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: lifetime, path: '/' });
}

export async function deleteAuthCookie() {
  const store = await cookies();
  const token = store.get('auth_id')?.value;
  if (token && tokenPattern.test(token)) {
    await connectDB();
    await UserSessionModel.deleteOne({ tokenHash: hashToken(token) });
  }
  store.delete('auth_id');
}
