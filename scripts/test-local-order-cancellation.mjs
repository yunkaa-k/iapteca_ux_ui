import { config } from 'dotenv';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

// Disposable fixtures only. Refuse remote databases before opening a connection.
config({ path: '.env.local', quiet: true });
const marker = '__cancel_probe_' + randomUUID();
const email = marker + '@example.test';
const [component, ordinary, kit, owner, outsider] = Array.from({ length: 5 }, () => new mongoose.Types.ObjectId());
const tokens = [randomBytes(32).toString('hex'), randomBytes(32).toString('hex')];
const hashes = tokens.map(token => createHash('sha256').update(token).digest('hex'));
const base = 'http://localhost:3000';
const checkout = { name: 'Тестовий покупець', phone: '+380670000000', email, receiving: 'pickup', pharmacyId: 'center', city: '', address: '', payment: 'on-receipt' };
let connection;
let fixturesStarted = false;
let stage = 'local connection';
async function request(path, method, body, token = tokens[0]) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Origin: base, ...(token ? { Cookie: 'auth_id=' + token } : {}) }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const cancel = (id, token) => request('/api/orders/' + id, 'PATCH', { status: 'CANCELLED' }, token);
const purchase = (payment = 'on-receipt', demoPaymentOutcome) => request('/api/orders', 'POST', { items: [{ medication: ordinary.toString(), quantity: 1 }, { medication: kit.toString(), kind: 'bundle', quantity: 2 }], checkout: { ...checkout, payment, ...(demoPaymentOutcome ? { demoPaymentOutcome } : {}) } });
try {
  const uri = process.env.MONGODB_URI;
  const target = new URL(uri);
  assert.ok(target.protocol === 'mongodb:' && ['localhost', '127.0.0.1'].includes(target.hostname) && (!target.port || target.port === '27017') && target.pathname === '/iapteca' && target.searchParams.get('replicaSet') === 'rs0');
  connection = await mongoose.createConnection(uri, { autoIndex: false, serverSelectionTimeoutMS: 5000 }).asPromise();
  const db = connection.db;
  const hello = await db.admin().command({ hello: 1 });
  assert.equal(hello.setName, 'rs0'); assert.equal(hello.isWritablePrimary, true);
  fixturesStarted = true;
  stage = 'fixture creation';
  await db.collection('medications').insertMany([
    { _id: component, name: marker + ':component', price: 10, stock: 12, isDeleted: false, requiresPrescription: false, inventoryOnly: true },
    { _id: ordinary, name: marker + ':ordinary', price: 100, stock: 4, isDeleted: false, requiresPrescription: false },
  ]);
  await db.collection('bundles').insertOne({ _id: kit, name: marker, slug: marker, price: 249, description: 'Disposable fixture', compositionConfirmed: true, components: [{ medication: component.toString(), quantity: 3, name: 'Тестовий компонент' }], isDeleted: false });
  await db.collection('users').insertMany([owner, outsider].map((id, index) => ({ _id: id, name: marker, email: index ? marker + ':other@example.test' : email, password: randomBytes(32).toString('hex'), role: 'CUSTOMER', isBanned: false })));
  await db.collection('usersessions').insertMany([owner, outsider].map((id, index) => ({ user: id.toString(), tokenHash: hashes[index], expiresAt: new Date(Date.now() + 600000) })));
  async function stock(expected) {
    const rows = await db.collection('medications').find({ _id: { $in: [component, ordinary] } }).toArray();
    assert.deepEqual([component, ordinary].map(id => rows.find(row => row._id.equals(id)).stock), expected);
  }
  stage = 'mixed purchase';
  const mixed = await purchase(); assert.equal(mixed.status, 200); await stock([6, 3]);
  stage = 'owner authorization';
  assert.equal((await cancel(mixed.body._id, tokens[1])).status, 404);
  assert.equal((await cancel(mixed.body._id, '')).status, 401);
  assert.equal((await request('/api/orders/' + mixed.body._id, 'PATCH', { status: 'COMPLETED' })).status, 403); await stock([6, 3]);
  // Restock from the immutable order snapshot, not the edited current kit.
  await db.collection('bundles').updateOne({ _id: kit, name: marker }, { $set: { 'components.0.quantity': 1 } });
  stage = 'parallel cancellation';
  const cancellations = await Promise.all(Array.from({ length: 3 }, () => cancel(mixed.body._id)));
  assert.deepEqual(cancellations.map(result => result.status), [200, 200, 200]); await stock([12, 4]);
  assert.equal((await cancel(mixed.body._id)).status, 200); await stock([12, 4]);
  await db.collection('bundles').updateOne({ _id: kit, name: marker }, { $set: { 'components.0.quantity': 3 } });
  stage = 'paid refund';
  const paid = await purchase('online', 'success'); assert.equal(paid.status, 200);
  const refunded = await cancel(paid.body._id); assert.equal(refunded.status, 200); assert.equal(refunded.body.checkout.demoRefundStatus, 'pending');
  assert.equal((await request('/api/orders/' + paid.body._id + '/demo-payment', 'POST', { outcome: 'success' })).status, 404); await stock([12, 4]);
  stage = 'payment cancellation race';
  const failed = await purchase('online', 'failure'); assert.equal(failed.status, 200);
  const [payment, cancellation] = await Promise.all([request('/api/orders/' + failed.body._id + '/demo-payment', 'POST', { outcome: 'success' }), cancel(failed.body._id)]);
  assert.ok([200, 404].includes(payment.status)); assert.equal(cancellation.status, 200);
  const final = await db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(failed.body._id), user: owner.toString() });
  assert.equal(final.status, 'CANCELLED');
  assert.equal(final.checkout.demoRefundStatus, final.checkout.demoPaymentStatus === 'paid' ? 'pending' : undefined); await stock([12, 4]);
  assert.equal(await db.collection('orders').countDocuments({ user: owner.toString(), 'checkout.contact.email': email }), 3);
  console.log('PASS: owner access, private IDs, 3 parallel cancellations, repeat cancellation, immutable kit snapshot, paid demo refund and payment/cancellation race. Stock returned exactly once.');
} catch {
  console.error('Local cancellation probe failed at ' + stage + '; no secrets or connection details printed.'); process.exitCode = 1;
} finally {
  if (connection) {
    try {
      if (fixturesStarted) {
        const db = connection.db;
        await db.collection('orders').deleteMany({ user: owner.toString(), 'checkout.contact.email': email });
        await db.collection('usersessions').deleteMany({ user: { $in: [owner.toString(), outsider.toString()] }, tokenHash: { $in: hashes } });
        await db.collection('users').deleteMany({ _id: { $in: [owner, outsider] }, name: marker });
        await db.collection('bundles').deleteOne({ _id: kit, name: marker });
        await db.collection('medications').deleteMany({ _id: { $in: [component, ordinary] }, name: { $in: [marker + ':component', marker + ':ordinary'] } });
        console.log('Removed only disposable cancellation fixtures. Existing records preserved.');
      }
    } catch { console.error('Cleanup failed; inspect __cancel_probe_ fixtures before retrying.'); process.exitCode = 1; }
    await connection.close();
  }
}
