import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

const mapping = JSON.parse(readFileSync(new URL('../src/lib/data/catalog-facts.json', import.meta.url), 'utf8'));
const fields = ['manufacturer', 'country', 'activeIngredient', 'dosage', 'dosageFormDetails', 'packageDescription', 'ageGroup', 'atcCode'];
const stableId = name => new mongoose.Types.ObjectId(createHash('sha256').update('iapteca-ux-ui-demo-v1:medication:' + name).digest('hex').slice(0, 24));
const missing = value => value === undefined || value === null || value === '' || value === 'Не вказано';
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
  const changes = [];
  for (const record of previous) {
    assert.ok(record._id.equals(stableId(record.name)));
    assert.ok(!record.isDeleted && !record.inventoryOnly);
    const facts = mapping[record.name].facts;
    assert.deepEqual(Object.keys(facts).sort(), [...fields].sort());
    const patch = {};
    for (const [key, value] of Object.entries(facts)) {
      assert.ok(typeof value === 'string' && value.length > 0 && value.length < 500);
      // A hand-edited, nonempty value is never silently overwritten.
      assert.ok(missing(record[key]) || record[key] === value);
      if (record[key] !== value) patch[key] = value;
    }
    if (Object.keys(patch).length) changes.push({ record, patch });
  }
  console.log(`Verified ${previous.length} known catalog products; ${changes.length} need missing characteristics filled.`);
  if (apply && changes.length) {
    stage = 'metadata backup';
    const folder = new URL('../.local/backups/', import.meta.url);
    mkdirSync(folder, { recursive: true });
    writeFileSync(new URL('catalog-facts-' + Date.now() + '.json', folder), JSON.stringify(previous, null, 2), { flag: 'wx' });
    stage = 'atomic metadata fill';
    session = await connection.startSession();
    await session.withTransaction(async () => {
      for (const { record, patch } of changes) {
        assert.deepEqual(await medications.findOne({ _id: record._id }, { session }), record);
        const result = await medications.updateOne({ _id: record._id }, { $set: patch }, { session });
        assert.equal(result.modifiedCount, 1);
      }
      for (const record of previous) {
        const current = await medications.findOne({ _id: record._id }, { session });
        const patch = changes.find(change => change.record._id.equals(record._id))?.patch || {};
        assert.deepEqual(current, { ...record, ...patch });
      }
    });
    console.log(`Filled ${changes.length} products. Verified prices, stock, IDs, categories and all other fields unchanged. Backup saved in ignored .local/backups/.`);
  } else console.log(apply ? 'Already up to date; no writes.' : 'Preview only. Use --apply to fill missing metadata in the verified local database.');
} catch {
  console.error('Catalog facts fill stopped at ' + stage + '; no credentials printed. No partial transaction is committed.');
  process.exitCode = 1;
} finally {
  if (session) await session.endSession();
  if (connection) await connection.close();
}
