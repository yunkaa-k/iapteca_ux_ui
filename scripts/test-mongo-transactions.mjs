import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const envPath = resolve(process.cwd(), '.env.local');
if (!existsSync(envPath)) {
  console.error('Missing .env.local. Run scripts/setup-local.ps1 first.');
  process.exit(1);
}

dotenv.config({ path: envPath });
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is missing from .env.local.');
  process.exit(1);
}

let connection;
let session;
let collectionName;

try {
  connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
  const database = connection.db;
  if (!database) throw new Error('Database handle unavailable');

  const hello = await database.admin().command({ hello: 1 });
  if (hello.setName !== 'rs0' || hello.isWritablePrimary !== true) {
    throw new Error('Expected rs0 PRIMARY');
  }

  collectionName = `__iapteca_tx_probe_${randomUUID().replaceAll('-', '')}`;
  await database.createCollection(collectionName);
  const probeCollection = database.collection(collectionName);
  const marker = randomUUID();

  session = await connection.startSession();
  session.startTransaction();
  await probeCollection.insertOne({ _id: marker, purpose: 'abort-only transaction check' }, { session });
  await session.abortTransaction();

  const persistedProbe = await probeCollection.findOne({ _id: marker });
  if (persistedProbe) throw new Error('Aborted transaction data unexpectedly persisted');

  console.log('Verified: Mongoose connected to rs0 PRIMARY and the aborted transaction left no document.');
} catch (error) {
  const safeError = error instanceof Error ? error : undefined;
  const code = safeError && 'code' in safeError ? safeError.code : undefined;
  const safeCode = typeof code === 'string' || typeof code === 'number' ? ` (${code})` : '';
  console.error(`MongoDB verification failed: ${safeError?.name || 'UnknownError'}${safeCode}. Connection details were not printed.`);
  process.exitCode = 1;
} finally {
  if (session) {
    try {
      if (session.inTransaction()) await session.abortTransaction();
    } catch {}
    await session.endSession();
  }
  if (connection) {
    if (collectionName && connection.db) {
      try {
        await connection.db.dropCollection(collectionName);
      } catch {}
    }
    await connection.close();
  }
}
