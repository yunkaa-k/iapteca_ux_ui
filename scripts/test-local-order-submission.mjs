import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

// Run against an isolated loopback replica set and a local app connected to it.
const uri = process.env.IAPTECA_TEST_MONGODB_URI;
const appUrl = process.env.IAPTECA_TEST_APP_URL || 'http://localhost:3000';
const loopbackHosts = ['localhost', '127.0.0.1', '[::1]'];
const marker = '__order_submission_probe_' + randomUUID();
const email = marker + '@example.test';
const [medicine, component, kit] = Array.from({ length: 3 }, () => new mongoose.Types.ObjectId());
const orderFilter = { 'checkout.contact.email': email };
const checkout = {
  name: 'Тестова перевірка',
  phone: '+380670000000',
  email,
  receiving: 'pickup',
  pharmacyId: 'center',
  payment: 'online',
  demoPaymentOutcome: 'failure',
};
const item = (id, quantity) => ({ medication: id.toString(), quantity });
const basket = [item(medicine, 1), { ...item(kit, 1), kind: 'bundle' }];
let connection;
let fixturesStarted = false;
let stage = 'local connection';

async function post(key, items = basket) {
  const response = await fetch(appUrl + '/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
      Origin: appUrl,
    },
    body: JSON.stringify({ items, checkout }),
    redirect: 'error',
    signal: AbortSignal.timeout(90_000),
  });
  return { status: response.status, order: await response.json() };
}

try {
  const target = new URL(uri);
  const app = new URL(appUrl);
  const replicaSet = target.searchParams.get('replicaSet');
  assert.ok(
    target.protocol === 'mongodb:' && loopbackHosts.includes(target.hostname)
    && target.port && target.port !== '27017' && target.pathname.length > 1 && replicaSet,
  );
  assert.ok(app.protocol === 'http:' && loopbackHosts.includes(app.hostname) && appUrl === app.origin);
  connection = await mongoose.createConnection(uri, {
    autoIndex: false,
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  }).asPromise();
  const db = connection.db;
  const hello = await db.admin().command({ hello: 1 });
  assert.equal(hello.setName, replicaSet);
  assert.equal(hello.isWritablePrimary, true);
  const medications = db.collection('medications');
  const orders = db.collection('orders');

  async function checkState(expectedStock, expectedOrders) {
    const rows = await medications.find({ _id: { $in: [medicine, component] } }).toArray();
    const stock = [medicine, component].map(id => rows.find(row => row._id.equals(id))?.stock);
    assert.deepEqual(stock, expectedStock);
    assert.equal(await orders.countDocuments(orderFilter), expectedOrders);
    console.log(`${stage}: medication stock ${stock[0]}, kit component stock ${stock[1]}, orders ${expectedOrders}.`);
  }

  stage = 'initial fixture';
  fixturesStarted = true;
  await medications.insertMany([
    { _id: medicine, name: marker + ':medication', price: 100, stock: 3, requiresPrescription: false },
    { _id: component, name: marker + ':component', price: 10, stock: 6, inventoryOnly: true, requiresPrescription: false },
  ]);
  await db.collection('bundles').insertOne({
    _id: kit,
    name: marker,
    slug: marker,
    price: 249,
    description: 'Disposable mixed checkout fixture',
    compositionConfirmed: true,
    components: [{ medication: component.toString(), quantity: 2, name: 'Тестовий компонент' }],
  });
  await checkState([3, 6], 0);

  stage = 'committed order and replay';
  const firstKey = randomUUID();
  // Discard the first response body, as a client would after losing the reply.
  assert.equal((await post(firstKey)).status, 200);
  const replay = await post(firstKey);
  assert.equal(replay.status, 200);
  assert.equal(replay.order.total, 349);
  assert.match(replay.order.guestPaymentToken, /^[a-f0-9]{64}$/);
  assert.equal(replay.order.checkout.demoPaymentStatus, 'failed');
  const persistedOrder = await orders.findOne({ ...orderFilter, _id: new mongoose.Types.ObjectId(replay.order._id) });
  assert.ok(persistedOrder);
  assert.equal(persistedOrder.guestPaymentTokenHash, createHash('sha256').update(replay.order.guestPaymentToken).digest('hex'));
  assert.equal(replay.order.submissionHash, undefined);
  await checkState([2, 4], 1);

  stage = 'changed basket with a reused key';
  assert.equal((await post(firstKey, [item(medicine, 2), basket[1]])).status, 409);
  await checkState([2, 4], 1);

  stage = 'three concurrent submissions of the same basket and key';
  const concurrentKey = randomUUID();
  const responses = await Promise.allSettled([post(concurrentKey), post(concurrentKey), post(concurrentKey)]);
  const completed = responses.filter(response => response.status === 'fulfilled').map(response => response.value);
  assert.equal(completed.length, 3);
  assert.deepEqual(completed.map(response => response.status), [200, 200, 200]);
  assert.equal(new Set(completed.map(response => response.order._id)).size, 1);
  assert.equal(new Set(completed.map(response => response.order.guestPaymentToken)).size, 1);
  assert.notEqual(completed[0].order._id, replay.order._id);
  await checkState([1, 2], 2);

  stage = 'mixed basket shortage rollback';
  const unavailable = await post(randomUUID(), [item(medicine, 1), { ...item(kit, 2), kind: 'bundle' }]);
  assert.equal(unavailable.status, 400);
  assert.match(unavailable.order.error, /Недостатньо компонентів аптечки/);
  await checkState([1, 2], 2);
} catch {
  console.error('Order submission probe failed at ' + stage + '. Connection and receipt values were not printed.');
  process.exitCode = 1;
} finally {
  if (connection) {
    try {
      if (fixturesStarted) {
        const db = connection.db;
        await db.collection('orders').deleteMany(orderFilter);
        await db.collection('bundles').deleteOne({ _id: kit, name: marker });
        await db.collection('medications').deleteMany({
          _id: { $in: [medicine, component] },
          name: { $in: [marker + ':medication', marker + ':component'] },
        });
        console.log('Removed the disposable order submission fixtures.');
      }
    } catch {
      console.error('Fixture cleanup failed. Inspect local __order_submission_probe_ records.');
      process.exitCode = 1;
    }
    await connection.close();
  }
}
