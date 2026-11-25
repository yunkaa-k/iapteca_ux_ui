import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

config({ path: '.env.local', quiet: true });
const marker = `catalog-check-${randomUUID()}`;
let ids = [];
let connected = false;
let step = 'configuration';
const assert = (condition) => { if (!condition) throw new Error('CheckFailed'); };
async function page(params, count, message) {
  const response = await fetch(`http://localhost:3000/catalog?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(60000) });
  const html = await response.text();
  assert(response.ok && html.includes(`Знайдено ${count} товарів`) && (!message || html.includes(message)));
}

try {
  const target = new URL(process.env.MONGODB_URI);
  if (target.protocol !== 'mongodb:' || !['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/iapteca') throw new Error('LocalIaptecaOnly');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  connected = true;
  const collection = mongoose.connection.db.collection('medications');
  const base = { category: marker, manufacturer: 'Test fixture', description: 'Disposable software test fixture', isDeleted: false };
  const result = await collection.insertMany([
    { ...base, name: `${marker} [A]+`, price: 10, stock: 0, dosageForm: 'tablets', dosage: 'test-dose-a', packSize: 10, requiresPrescription: false, onSale: true },
    { ...base, name: `${marker} B`, price: 20, stock: 3, dosageForm: 'capsules', dosage: 'test-dose-b', packSize: 20, requiresPrescription: true, activeIngredient: 'catalogspellingfixtureword' },
    { ...base, name: `${marker} C`, price: 30, stock: 2, activeIngredient: marker },
    { ...base, name: `${marker} Deleted`, price: 1, stock: 9, isDeleted: true },
  ]);
  ids = Object.values(result.insertedIds);
  step = 'category and soft-deletion';
  await page({ category: marker }, 3);
  step = 'stock';
  await page({ category: marker, inStock: 'true' }, 2);
  step = 'inclusive price bounds';
  await page({ category: marker, minPrice: '20', maxPrice: '30' }, 2);
  step = 'dosage form, dose and pack size';
  await page({ category: marker, form: 'tablets', dosage: 'test-dose-a', packSize: '10' }, 1);
  step = 'prescription metadata';
  await page({ category: marker, prescription: 'not-required' }, 1);
  step = 'manufacturer and offers';
  await page({ category: marker, manufacturer: 'Test fixture', onSale: 'true' }, 1);
  step = 'literal regular-expression characters';
  await page({ search: `${marker} [A]+` }, 1);
  step = 'empty search';
  await page({ search: `${marker}-absent` }, 0, 'За запитом нічого не знайдено');
  step = 'empty filters';
  await page({ category: marker, minPrice: '500' }, 0, 'За вибраними фільтрами товарів не знайдено');
  step = 'invalid page and price are handled safely';
  await page({ category: marker, page: '-1', minPrice: 'not-a-number' }, 3);
  step = 'live product suggestions';
  const suggestions = await fetch(`http://localhost:3000/api/search/suggestions?q=${encodeURIComponent(marker)}`, { signal: AbortSignal.timeout(60000) });
  const data = await suggestions.json();
  assert(suggestions.ok && data.products.length === 3 && !data.products.some((product) => product.name.endsWith('Deleted')));
  step = 'active-ingredient suggestions';
  const ingredientResponse = await fetch('http://localhost:3000/api/search/suggestions?q=catalogspellingfixtureword', { signal: AbortSignal.timeout(60000) });
  const ingredientData = await ingredientResponse.json();
  assert(ingredientResponse.ok && ingredientData.ingredients.includes('catalogspellingfixtureword'));
  step = 'database-backed spelling correction';
  const spelling = await fetch('http://localhost:3000/api/search/suggestions?q=catalogspellngfixtureword', { signal: AbortSignal.timeout(60000) });
  const spellingData = await spelling.json();
  assert(spelling.ok && spellingData.products.length === 0 && spellingData.correction === 'catalogspellingfixtureword');
  console.log('Verified: catalog filters, empty states, live suggestions and dictionary-backed spelling correction through the running Next.js app.');
} catch (error) {
  console.error('Catalog smoke failed at:', step, `(${error?.name || 'UnknownError'})`);
  process.exitCode = 1;
} finally {
  if (connected && ids.length) {
    await mongoose.connection.db.collection('medications').deleteMany({ _id: { $in: ids }, category: marker });
    console.log('Removed only disposable catalog fixtures created by this run.');
  }
  await mongoose.disconnect();
}
