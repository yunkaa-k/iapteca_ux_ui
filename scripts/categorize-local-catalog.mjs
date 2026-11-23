import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

// Explicit mapping, never infer categories from partial name matches.
// Only the known demo catalog in local rs0/iapteca can be changed.
const mapping = JSON.parse(readFileSync(new URL('./catalog-categories.json', import.meta.url), 'utf8'));
const stableId = key => new mongoose.Types.ObjectId(createHash('sha256').update(`iapteca-ux-ui-demo-v1:${key}`).digest('hex').slice(0, 24));
config({ path: '.env.local', quiet: true });
const apply = process.argv.includes('--apply');
let connection;
let session;
let stage = 'local configuration';
try {
  assert.ok(process.argv.slice(2).every(arg => arg === '--apply'));
  const target = new URL(process.env.MONGODB_URI);
  assert.ok(target.protocol === 'mongodb:' && ['localhost', '127.0.0.1'].includes(target.hostname) && (!target.port || target.port === '27017') && target.pathname === '/iapteca' && target.searchParams.get('replicaSet') === 'rs0' && target.searchParams.get('authSource') === 'iapteca');
  connection = await mongoose.createConnection(process.env.MONGODB_URI, { autoIndex: false, serverSelectionTimeoutMS: 5000 }).asPromise();
  const db = connection.db;
  const hello = await db.admin().command({ hello: 1 });
  assert.ok(hello.setName === 'rs0' && hello.isWritablePrimary);
  const medications = db.collection('medications');
  stage = 'known catalog verification';
  const previous = await medications.find({ name: { $in: Object.keys(mapping) } }).toArray();
  assert.equal(previous.length, Object.keys(mapping).length);
  for (const record of previous) {
    assert.ok(record._id.equals(stableId('medication:' + record.name)));
    assert.ok(!record.isDeleted && !record.inventoryOnly);
    assert.ok(record.category === 'Препарати' || record.category === mapping[record.name]);
  }
  const changes = previous.filter(record => record.category !== mapping[record.name]);
  console.log(JSON.stringify(changes.map(record => ({ name: record.name, from: record.category, to: mapping[record.name] })), null, 2));
  if (apply) {
    if (changes.length) {
      stage = 'category backup';
      const folder = new URL('../.local/backups/', import.meta.url);
      mkdirSync(folder, { recursive: true });
      const file = new URL('catalog-categories-' + Date.now() + '.json', folder);
      writeFileSync(file, JSON.stringify(changes.map(record => ({ _id: record._id.toString(), name: record.name, category: record.category, nextCategory: mapping[record.name] })), null, 2), { flag: 'wx' });
      console.log('Previous categories backed up in ignored .local/backups/.');
    }
    stage = 'atomic category update';
    session = await connection.startSession();
    await session.withTransaction(async () => {
      for (const name of new Set(Object.values(mapping))) {
        if (await db.collection('categories').findOne({ name }, { session })) continue;
        const _id = stableId('category:' + name);
        assert.equal(await db.collection('categories').findOne({ _id }, { session }), null);
        await db.collection('categories').insertOne({ _id, name }, { session });
      }
      for (const record of changes) {
        const result = await medications.updateOne({ _id: record._id, name: record.name, category: record.category }, { $set: { category: mapping[record.name] } }, { session });
        assert.equal(result.modifiedCount, 1);
      }
      // Assert every other field is byte-for-byte logically preserved before commit.
      for (const record of previous) {
        const current = await medications.findOne({ _id: record._id }, { session });
        assert.deepEqual(current, { ...record, category: mapping[record.name] });
      }
    });
    console.log(`Updated ${changes.length} categories. Verified all other product fields unchanged. No users, orders or bundles written.`);
  } else console.log(`Preview only: ${changes.length} changes. Use --apply to update local categories.`);
} catch {
  console.error('Category update stopped at ' + stage + '; no secrets printed.'); process.exitCode = 1;
} finally {
  if (session) await session.endSession();
  if (connection) await connection.close();
}
