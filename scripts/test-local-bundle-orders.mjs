import { config } from 'dotenv';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

// Integration probe: ONLY local rs0/iapteca, ONLY uniquely marked disposable records.
// The real seeded catalog, accounts and orders are never updated by this script.
config({ path: '.env.local', quiet: true });
const marker = '__bundle_probe_' + randomUUID();
const email = marker + '@example.test';
const ids = Array.from({ length: 5 }, () => new mongoose.Types.ObjectId());
const [a, b, ordinary, kit, admin] = ids;
const token = randomBytes(32).toString('hex');
const tokenHash = createHash('sha256').update(token).digest('hex');
const checkout = { name: 'Тестова перевірка', phone: '+380670000000', email, receiving: 'pickup', pharmacyId: 'center', city: '', address: '', payment: 'on-receipt' };
let connection;
const base = 'http://localhost:3000';
async function post(items) {
  const response = await fetch(base + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ items, checkout, total: .01 }) });
  return { status: response.status, body: await response.json() };
}
async function cancel(id) {
  const response = await fetch(base + '/api/orders/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: 'auth_id=' + token, Origin: base }, body: JSON.stringify({ status: 'CANCELLED' }) });
  assert.equal(response.status, 200);
}
try {
  const uri = process.env.MONGODB_URI;
  const target = new URL(uri);
  if (target.protocol !== 'mongodb:' || !['localhost', '127.0.0.1'].includes(target.hostname) || (target.port && target.port !== '27017') || target.pathname !== '/iapteca' || target.searchParams.get('replicaSet') !== 'rs0') throw Error('LocalOnly');
  connection = await mongoose.createConnection(uri, { autoIndex: false, serverSelectionTimeoutMS: 5000 }).asPromise();
  const db = connection.db;
  const hello = await db.admin().command({ hello: 1 });
  assert.equal(hello.setName, 'rs0'); assert.equal(hello.isWritablePrimary, true);
  await db.collection('medications').insertMany([
    { _id: a, name: marker + ':a', price: 10, stock: 4, isDeleted: false, requiresPrescription: false, inventoryOnly: true },
    { _id: b, name: marker + ':b', price: 20, stock: 2, isDeleted: false, requiresPrescription: false, inventoryOnly: true },
    { _id: ordinary, name: marker + ':ordinary', price: 100, stock: 3, isDeleted: false, requiresPrescription: false },
  ]);
  await db.collection('bundles').insertOne({ _id: kit, name: marker, slug: marker, price: 249, description: 'Disposable integration fixture', compositionConfirmed: true, components: [{ medication: a.toString(), quantity: 2, name: 'Test A' }, { medication: b.toString(), quantity: 1, name: 'Test B' }], isDeleted: false });
  await db.collection('users').insertOne({ _id: admin, name: marker, email, password: randomBytes(32).toString('hex'), role: 'ADMIN', isBanned: false });
  await db.collection('usersessions').insertOne({ user: admin.toString(), tokenHash, expiresAt: new Date(Date.now() + 600000) });
  const item = (id, quantity, kind) => ({ medication: id.toString(), quantity, ...(kind ? { kind } : {}) });
  async function stock(expected) {
    const rows = await db.collection('medications').find({ _id: { $in: [a, b, ordinary] } }).toArray();
    assert.deepEqual([a, b, ordinary].map(id => rows.find(row => row._id.equals(id)).stock), expected);
  }

  const med = await post([item(ordinary, 1)]);
  assert.equal(med.status, 200); assert.equal(med.body.total, 100); await stock([4, 2, 2]);
  await cancel(med.body._id); await cancel(med.body._id); await stock([4, 2, 3]);

  const double = await post([item(kit, 2, 'bundle')]);
  assert.equal(double.status, 200); assert.equal(double.body.total, 498); await stock([0, 0, 3]);
  assert.equal(double.body.items[0].components.length, 2);
  // Changing the current bundle composition must not change cancellation restocking.
  await db.collection('bundles').updateOne({ _id: kit, name: marker }, { $set: { 'components.0.quantity': 3 } });
  await cancel(double.body._id); await cancel(double.body._id); await stock([4, 2, 3]);
  await db.collection('bundles').updateOne({ _id: kit, name: marker }, { $set: { 'components.0.quantity': 2 } });

  const mixed = await post([item(kit, 1, 'bundle'), item(ordinary, 2)]);
  assert.equal(mixed.status, 200); assert.equal(mixed.body.total, 449); await stock([2, 1, 1]);
  await cancel(mixed.body._id); await stock([4, 2, 3]);

  const count = await db.collection('orders').countDocuments({ 'checkout.contact.email': email });
  const shortage = await post([item(kit, 3, 'bundle'), item(ordinary, 1)]);
  assert.equal(shortage.status, 400); await stock([4, 2, 3]);
  assert.equal(await db.collection('orders').countDocuments({ 'checkout.contact.email': email }), count);

  const parallel = await Promise.all(Array.from({ length: 3 }, () => post([item(kit, 1, 'bundle')])));
  assert.equal(parallel.filter(result => result.status === 200).length, 2);
  assert.equal(parallel.filter(result => result.status === 400).length, 1); await stock([0, 0, 3]);
  for (const result of parallel.filter(result => result.status === 200)) await cancel(result.body._id);
  await stock([4, 2, 3]);
  const privateList = await fetch(base + '/api/orders'); assert.equal(privateList.status, 401);
  const adminList = await fetch(base + '/api/orders?admin=true', { headers: { Cookie: 'auth_id=' + token } });
  assert.equal(adminList.status, 200);
  assert.ok((await adminList.json()).some(order => order._id === mixed.body._id && !order.user));
  console.log('PASS: ordinary, two kits, mixed order, shortage rollback, repeat cancellation, order-time composition, 3 concurrent purchases for 2 kits, admin guest visibility and private orders API.');
} catch {
  console.error('Local bundle integration probe failed; no connection, session or personal values were printed.');
  process.exitCode = 1;
} finally {
  if (connection) {
    try {
      const db = connection.db;
      await db.collection('orders').deleteMany({ 'checkout.contact.email': email });
      await db.collection('usersessions').deleteMany({ user: admin.toString(), tokenHash });
      await db.collection('users').deleteOne({ _id: admin, email });
      await db.collection('bundles').deleteOne({ _id: kit, name: marker });
      await db.collection('medications').deleteMany({ _id: { $in: [a, b, ordinary] }, name: { $regex: '^' + marker + ':' } });
      console.log('Removed only disposable probe records; real catalog, stock, users and orders preserved.');
    } catch { console.error('Probe cleanup failed. Inspect uniquely marked __bundle_probe_ records before retrying.'); process.exitCode = 1; }
    await connection.close();
  }
}
