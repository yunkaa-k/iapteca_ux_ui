import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

// Persistent local fixtures for the explicitly selected existing account.
// Own inventory-only item: cancellation/payment tests never alter real catalog stock.
const ownerId = process.argv[2];
const apply = process.argv[3] === '--apply';
const prefix = 'iapteca-local-order-states-v1';
const cases = [
  { key: 'processing', label: 'В обробці', status: 'PENDING' },
  { key: 'confirmed', label: 'Підтверджено', status: 'CONFIRMED' },
  { key: 'pickup', label: 'Готове до видачі', status: 'READY_FOR_PICKUP' },
  { key: 'courier', label: 'Передано кур’єру', status: 'SHIPPED', courier: true },
  { key: 'completed', label: 'Отримано', status: 'COMPLETED' },
  { key: 'cancelled', label: 'Скасовано без оплати', status: 'CANCELLED' },
  { key: 'paid', label: 'Оплачено онлайн', status: 'PENDING', payment: 'paid' },
  { key: 'failed', label: 'Помилка оплати', status: 'PENDING', payment: 'failed' },
  { key: 'refund', label: 'Повернення в обробці', status: 'CANCELLED', payment: 'paid', refund: true },
];
const id = key => new mongoose.Types.ObjectId(createHash('sha256').update(prefix + ':' + ownerId + ':' + key).digest('hex').slice(0, 24));
config({ path: '.env.local', quiet: true });
let connection;
let session;
let stage = 'local configuration';
try {
  assert.ok(/^[a-f0-9]{24}$/.test(ownerId || '') && process.argv.length <= 4 && (!process.argv[3] || apply));
  const uri = process.env.MONGODB_URI;
  const target = new URL(uri);
  assert.ok(target.protocol === 'mongodb:' && ['localhost', '127.0.0.1'].includes(target.hostname) && (!target.port || target.port === '27017') && target.pathname === '/iapteca' && target.searchParams.get('replicaSet') === 'rs0' && target.searchParams.get('authSource') === 'iapteca');
  connection = await mongoose.createConnection(uri, { autoIndex: false, serverSelectionTimeoutMS: 5000 }).asPromise();
  const db = connection.db;
  const hello = await db.admin().command({ hello: 1 }); assert.ok(hello.setName === 'rs0' && hello.isWritablePrimary);
  const user = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(ownerId), isBanned: { $ne: true } }, { projection: { _id: 1 } }); assert.ok(user);
  const medication = id('inventory');
  const name = '[ДЕМО] Товар для перевірки замовлень';
  stage = 'fixture collision verification';
  const existingItem = await db.collection('medications').findOne({ _id: medication });
  assert.ok(!existingItem || (existingItem.name === name && existingItem.inventoryOnly === true));
  for (const scenario of cases) {
    const previous = await db.collection('orders').findOne({ _id: id(scenario.key) });
    assert.ok(!previous || (previous.user === ownerId && previous.items.length === 1 && previous.items[0].medication === medication.toString() && previous.items[0].name.startsWith('[ДЕМО]')));
  }
  console.log('Local demo scenarios: ' + cases.map(scenario => scenario.label).join('; '));
  if (apply) {
    stage = 'atomic fixture creation'; session = await connection.startSession();
    let created = 0;
    await session.withTransaction(async () => {
      created = 0;
      await db.collection('medications').updateOne({ _id: medication }, { $setOnInsert: { name, description: 'Лише демонстрація статусів, не реальний товар.', image: '/images/kits/travel.png', category: 'Демонстраційні товари', manufacturer: 'Демонстрація', price: 25, stock: 1000, requiresPrescription: false, inventoryOnly: true, isDeleted: false } }, { upsert: true, session });
      for (const [index, scenario] of cases.entries()) {
        if (await db.collection('orders').findOne({ _id: id(scenario.key) }, { session })) continue;
        const fee = scenario.courier ? 59 : 0;
        const date = new Date(Date.now() - index * 60000);
        await db.collection('orders').insertOne({ _id: id(scenario.key), user: ownerId, status: scenario.status, subtotal: 25, total: 25 + fee, createdAt: date, updatedAt: date,
          items: [{ medication: medication.toString(), name: '[ДЕМО] ' + scenario.label, description: 'Тестовий сценарій. Реальні кошти не списуються.', image: '/images/kits/travel.png', quantity: 1, price: 25 }],
          checkout: { contact: { name: 'Тестовий покупець', phone: '+380670000000', email: 'orders-demo@example.test' }, delivery: scenario.courier ? { method: 'courier', city: 'Харків', address: 'Тестова адреса, 1', fee } : { method: 'pickup', pharmacyId: 'center', pharmacyName: 'iApteca · Центр', address: 'вул. Центральна, 12', fee }, payment: scenario.payment ? 'online' : 'on-receipt', ...(scenario.payment ? { paymentMode: 'demo', demoPaymentStatus: scenario.payment } : {}), ...(scenario.refund ? { demoRefundStatus: 'pending' } : {}) },
        }, { session });
        if (scenario.status !== 'CANCELLED') {
          const reserved = await db.collection('medications').updateOne({ _id: medication, inventoryOnly: true, stock: { $gte: 1 } }, { $inc: { stock: -1 } }, { session }); assert.equal(reserved.modifiedCount, 1);
        }
        created++;
      }
    });
    console.log(`Created ${created} demo orders; existing scenarios unchanged. Only isolated demo inventory reserved.`);
  } else console.log('Preview only. Pass the existing user ID and --apply to create these scenarios.');
} catch { console.error('Local order-state seed stopped at ' + stage + '; no secrets printed.'); process.exitCode = 1; }
finally { if (session) await session.endSession(); if (connection) await connection.close(); }
