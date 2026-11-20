import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { existsSync } from 'node:fs';

// Fixed educational fixtures. Travel is from Screens 1690:8542; other compositions
// are user-authorized demo supplies, not certified/expert medical or vehicle kits.
const components = {
  plasters: 'Набір пластирів', bandage: 'Стерильний бинт', wipes: 'Антисептичні серветки',
  gauze: 'Стерильні марлеві серветки', gloves: 'Нітрилові рукавички, пара',
  tape: 'Фіксувальний пластир у рулоні', blanket: 'Термопокривало',
  scissors: 'Ножиці для перев’язувальних матеріалів', triangular: 'Косинкова пов’язка',
  cold: 'Холодовий пакет', elastic: 'Еластичний бинт',
};
const kits = [
  { slug: 'travel', name: 'Аптечка «Для подорожі»', description: 'Компактний набір у дорогу', purpose: 'Для подорожей', price: 249, contents: { plasters: 1, bandage: 1, wipes: 1 } },
  { slug: 'home', name: 'Домашня аптечка', description: 'Перша допомога вдома', purpose: 'Для дому', price: 349, contents: { plasters: 1, bandage: 2, wipes: 1, gauze: 1, gloves: 2, tape: 1, scissors: 1 } },
  { slug: 'car', name: 'Аптечка для авто', description: 'Набір для поїздок', purpose: 'Для поїздок', price: 449, contents: { bandage: 2, gauze: 2, gloves: 2, tape: 1, blanket: 1, scissors: 1, triangular: 1 } },
  { slug: 'hiking', name: 'Аптечка для походів', description: 'Набір для активного відпочинку', purpose: 'Для походів', price: 329, contents: { plasters: 1, bandage: 1, wipes: 1, gloves: 1, blanket: 1, triangular: 1 } },
  { slug: 'sport', name: 'Спортивна аптечка', description: 'Набір для тренувань', purpose: 'Для тренувань', price: 379, contents: { plasters: 1, bandage: 1, gauze: 1, gloves: 1, cold: 1, elastic: 1 } },
];
const stableId = key => new mongoose.Types.ObjectId(createHash('sha256').update('iapteca-bundles-v1:' + key).digest('hex').slice(0, 24));
config({ path: '.env.local', quiet: true });
let connection, session;
try {
  const uri = process.env.MONGODB_URI;
  const target = new URL(uri);
  if (target.protocol !== 'mongodb:' || !['localhost', '127.0.0.1'].includes(target.hostname) || (target.port && target.port !== '27017') || target.pathname !== '/iapteca' || target.searchParams.get('replicaSet') !== 'rs0' || target.searchParams.get('authSource') !== 'iapteca') throw Error('LocalOnly');
  for (const kit of kits) if (!existsSync('public/images/kits/' + kit.slug + '.png')) throw Error('MissingImage');
  connection = await mongoose.createConnection(uri, { autoIndex: false, serverSelectionTimeoutMS: 5000 }).asPromise();
  const db = connection.db;
  const hello = await db.admin().command({ hello: 1 });
  if (hello.setName !== 'rs0' || !hello.isWritablePrimary) throw Error('ExpectedLocalPrimary');
  // Create only our new empty collection if absent, before starting the transaction.
  if (!(await db.listCollections({ name: 'bundles' }).toArray()).length) await db.createCollection('bundles');
  const bundles = db.collection('bundles'), medications = db.collection('medications');
  let inserted = 0;
  session = await connection.startSession();
  await session.withTransaction(async () => {
    inserted = 0;
    for (const [key, name] of Object.entries(components)) {
      const _id = stableId('component:' + key);
      const existing = await medications.findOne({ _id }, { session });
      if (existing && (!existing.inventoryOnly || existing.name !== name)) throw Error('IdCollision');
      if (!existing) await medications.insertOne({ _id, name, description: name, price: 0, stock: 30, category: 'Матеріали для аптечок', manufacturer: 'Не вказано', inventoryOnly: true, requiresPrescription: false, isDeleted: false, createdAt: new Date(), updatedAt: new Date() }, { session });
    }
    for (const { contents, ...kit } of kits) {
      const _id = stableId('bundle:' + kit.slug);
      const existing = await bundles.findOne({ $or: [{ _id }, { slug: kit.slug }] }, { session });
      if (existing) { if (existing._id.toString() !== _id.toString()) throw Error('IdCollision'); continue; }
      await bundles.insertOne({ _id, ...kit, image: '/images/kits/' + kit.slug + '.png', components: Object.entries(contents).map(([key, quantity]) => ({ medication: stableId('component:' + key).toString(), name: components[key], quantity })), compositionConfirmed: true, isDeleted: false, createdAt: new Date(), updatedAt: new Date() }, { session });
      inserted++;
    }
  });
  console.log('Local bundles seed: inserted ' + inserted + ' kits. Existing products, stock, users and orders preserved.');
} catch { console.error('Local bundles seed failed; connection details were not printed.'); process.exitCode = 1; }
finally { if (session) await session.endSession(); if (connection) await connection.close(); }
