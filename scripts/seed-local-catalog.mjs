import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import mongoose from 'mongoose';

// Screens 164:42, the 11 current catalog cards. Prices/stock are demonstration data.
// Unknown medical fields deliberately remain absent, rather than inferred from a name.
const products = [
  { name: 'Валідол-Дарниця 60 мг №10', description: '60 мг · 10 табл.', price: 25, stock: 20, dosage: '60 мг', packSize: 10, dosageForm: 'tablets', image: '/images/catalog/validol.jpeg' },
  { name: 'Парацетамол 500 мг №10', description: '500 мг · 10 табл.', price: 45, stock: 25, dosage: '500 мг', packSize: 10, dosageForm: 'tablets', image: '/images/home/product-paracetamol-500.png' },
  { name: 'Цитрамон-Дарниця №10', description: '10 табл.', price: 52, stock: 20, packSize: 10, dosageForm: 'tablets', image: '/images/home/product-citramon-darnytsia.png' },
  { name: 'Ібупрофен-Дарниця №20', description: 'Ібупрофен · 200 мг · 20 табл.', price: 79, stock: 18, activeIngredient: 'Ібупрофен', dosage: '200 мг', packSize: 20, dosageForm: 'tablets', image: '/images/home/product-ibuprofen-darnytsia.png' },
  { name: 'Ревіт драже №100', description: 'Полівітаміни · 100 драже', price: 89, stock: 12, packSize: 100, dosageForm: 'dragees', image: '/images/catalog/revit.png' },
  { name: 'Амоксицилін 500 мг №10', description: 'Амоксицилін · 500 мг · 10 капс.', price: 120, stock: 10, activeIngredient: 'Амоксицилін', dosage: '500 мг', packSize: 10, dosageForm: 'capsules', requiresPrescription: true, image: '/images/catalog/amoxicillin.png' },
  { name: 'Бісакодил-Дарниця 5 мг №30', description: 'Бісакодил · 5 мг · 30 табл.', price: 129, stock: 16, activeIngredient: 'Бісакодил', dosage: '5 мг', packSize: 30, dosageForm: 'tablets', image: '/images/catalog/bisacodyl.jpeg' },
  { name: 'Нурофен 200 мг №24', description: '200 мг · 24 табл.', price: 145, stock: 24, activeIngredient: 'Ібупрофен', dosage: '200 мг', packSize: 24, dosageForm: 'tablets', requiresPrescription: false, image: '/images/home/product-nurofen-200.png' },
  { name: 'Нурофен Форте №12', description: 'Ібупрофен · 400 мг · 12 табл.', price: 168, stock: 14, activeIngredient: 'Ібупрофен', dosage: '400 мг', packSize: 12, dosageForm: 'tablets', image: '/images/catalog/nurofen-forte.jpeg' },
  { name: 'Метилурацил з мірамістином 30 г', description: 'Мазь · туба 30 г', price: 279, stock: 8, dosageForm: 'ointments', packageType: 'Туба', image: '/images/catalog/methyluracil.jpeg' },
  { name: 'Ібупрофен 400 мг №20', description: 'Ібупрофен · 400 мг · 20 табл.', price: 118, stock: 0, activeIngredient: 'Ібупрофен', dosage: '400 мг', packSize: 20, dosageForm: 'tablets', requiresPrescription: false, image: '/images/catalog/ibuprofen-400.jpeg' },
];
const stableId = key => new mongoose.Types.ObjectId(createHash('sha256').update(`iapteca-ux-ui-demo-v1:${key}`).digest('hex').slice(0, 24));
const categoryByName = JSON.parse(readFileSync(new URL('./catalog-categories.json', import.meta.url), 'utf8'));
const prescriptionByName = JSON.parse(readFileSync(new URL('./catalog-prescriptions.json', import.meta.url), 'utf8'));
config({ path: '.env.local', quiet: true });
let connection;
let session;
let step = 'local configuration';
try {
  const uri = process.env.MONGODB_URI;
  const target = new URL(uri);
  if (target.protocol !== 'mongodb:' || !['localhost', '127.0.0.1'].includes(target.hostname) || (target.port && target.port !== '27017') || target.pathname !== '/iapteca' || target.searchParams.get('replicaSet') !== 'rs0' || target.searchParams.get('authSource') !== 'iapteca') throw new Error('LocalIaptecaOnly');
  for (const product of products) if (!existsSync(`public${product.image}`)) throw new Error('MissingLocalImage');
  connection = await mongoose.createConnection(uri, { autoIndex: false, serverSelectionTimeoutMS: 5000 }).asPromise();
  const db = connection.db;
  step = 'replica set verification';
  const hello = await db.admin().command({ hello: 1 });
  if (hello.setName !== 'rs0' || hello.isWritablePrimary !== true) throw new Error('ExpectedLocalPrimary');
  const medications = db.collection('medications');
  const categories = db.collection('categories');
  session = await connection.startSession();
  let inserted = 0;
  let skipped = 0;
  step = 'atomic insert-only seed';
  await session.withTransaction(async () => {
    inserted = 0; skipped = 0;
    for (const categoryName of new Set(products.map(product => categoryByName[product.name]))) {
      if (!categoryName) throw new Error('MissingCategoryAssignment');
      if (await categories.findOne({ name: categoryName }, { session })) continue;
      const _id = stableId(`category:${categoryName}`);
      const previous = await categories.findOne({ _id }, { session });
      if (previous) throw new Error('CategoryIdCollision');
      await categories.insertOne({ _id, name: categoryName }, { session });
    }
    for (const product of products) {
      // Never change user-maintained data, prices, stock, or soft-deletion state.
      const existing = await medications.findOne({ name: product.name }, { session });
      if (existing) { skipped++; continue; }
      const _id = stableId(`medication:${product.name}`);
      if (await medications.findOne({ _id }, { session })) throw new Error('MedicationIdCollision');
      const now = new Date();
      await medications.insertOne({ _id, ...product, ...(prescriptionByName[product.name] ? { requiresPrescription: prescriptionByName[product.name].requiresPrescription } : {}), category: categoryByName[product.name], manufacturer: 'Не вказано', isDeleted: false, createdAt: now, updatedAt: now }, { session });
      inserted++;
    }
  });
  console.log(`Local iapteca seed complete: inserted ${inserted}, preserved ${skipped}.`);
  console.log('Demo stock only. Existing products, users, orders and credentials were not modified.');
} catch (error) {
  // Do not print driver errors: they may contain connection credentials.
  console.error(`Catalog seed stopped at ${step}: ${error?.name || 'Error'}. No credentials printed.`);
  process.exitCode = 1;
} finally {
  if (session) await session.endSession();
  if (connection) await connection.close();
}
