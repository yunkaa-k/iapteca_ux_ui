import { config } from 'dotenv';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

config({ path: '.env.local', quiet: true });
const marker = randomUUID();
const emails = [`auth-${marker}@example.test`, `auth-second-${marker}@example.test`];
const password = randomBytes(24).toString('base64url');
let step = 'configuration';
let connected = false;
const assert = (condition) => { if (!condition) throw new Error('CheckFailed'); };
const call = async (path, body, cookie) => {
  const response = await fetch(`http://localhost:3000/api/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(60000),
  });
  return { response, data: await response.json() };
};

try {
  const uri = process.env.MONGODB_URI;
  const target = new URL(uri);
  if (target.protocol !== 'mongodb:' || !['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/iapteca') throw new Error('LocalIaptecaOnly');
  await mongoose.connect(uri, { autoIndex: false });
  connected = true;
  step = 'two email-only registrations';
  for (const email of emails) {
    const { response, data } = await call('register', { email, password, consent: true, role: 'ADMIN' });
    assert(response.status === 201 && data.user._id && data.user.role === 'CUSTOMER' && !data.user.password);
  }
  step = 'duplicate email';
  assert((await call('register', { email: emails[0].toUpperCase(), password, consent: true })).response.status === 409);
  step = 'invalid password and missing consent';
  assert((await call('register', { email: 'unused@example.test', password: 'short', consent: false })).response.status === 400);
  assert((await call('login', { email: emails[0], password: 'incorrect-password' })).response.status === 401);
  step = 'email login and session';
  const signedIn = await call('login', { email: emails[0].toUpperCase(), password });
  const setCookie = signedIn.response.headers.get('set-cookie') || '';
  assert(signedIn.response.ok && /httponly/i.test(setCookie));
  const cookie = setCookie.split(';')[0];
  assert((await call('me', undefined, cookie)).data.user?.email === emails[0]);
  step = 'user ID cookie forgery is rejected';
  assert((await call('me', undefined, `auth_id=${signedIn.data.user._id}`)).data.user === null);
  step = 'logout revokes session and replay fails';
  assert((await call('logout', {}, cookie)).response.ok);
  assert((await call('me', undefined, cookie)).data.user === null);
  step = 'phone-only login and registration are disabled';
  assert((await call('register', { phone: '+999123456789', password, consent: true })).response.status === 400);
  assert((await call('login', { phone: '+999123456789', password })).response.status === 400);
  step = 'password reset cannot overwrite passwords without proof';
  assert((await call('reset-password', { email: emails[0], pass: 'attacker-password' })).response.status === 503);
  console.log('Verified: email-only signup/login, validation, duplicates, sessions, logout, forged-cookie rejection and phone-only request rejection.');
} catch (error) {
  console.error('Local auth smoke failed at:', step, `(${error?.name || 'UnknownError'})`);
  process.exitCode = 1;
} finally {
  if (connected) {
    const users = mongoose.connection.db.collection('users');
    const fixtures = await users.find({ email: { $in: emails } }, { projection: { _id: 1 } }).toArray();
    const ids = fixtures.map((user) => user._id);
    await mongoose.connection.db.collection('usersessions').deleteMany({ user: { $in: ids.map(String) } });
    await users.deleteMany({ _id: { $in: ids } });
    console.log('Removed only the disposable accounts and sessions created by this run.');
  }
  await mongoose.disconnect();
}
