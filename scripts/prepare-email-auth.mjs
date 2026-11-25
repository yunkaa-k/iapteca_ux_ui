import { config } from 'dotenv';
import mongoose from 'mongoose';

config({ path: '.env.local', quiet: true });

try {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('LocalConfigurationMissing');
  const target = new URL(uri);
  if (target.protocol !== 'mongodb:' || !['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/iapteca') throw new Error('LocalIaptecaOnly');
  await mongoose.connect(uri, { autoIndex: false });
  const users = mongoose.connection.db.collection('users');
  // Establish the replacement uniqueness constraint BEFORE removing the legacy
  // non-sparse index. No users, passwords or orders are modified.
  await users.createIndex({ phone: 1 }, { name: 'phone_unique_present', unique: true, partialFilterExpression: { phone: { $type: 'string' } } });
  await users.createIndex({ email: 1 }, { name: 'email_unique_present', unique: true, partialFilterExpression: { email: { $type: 'string' } } });
  const indexes = await users.listIndexes().toArray();
  for (const index of indexes) {
    if (index.name !== 'phone_unique_present' && index.unique && index.key.phone === 1 && Object.keys(index.key).length === 1 && !index.partialFilterExpression && !index.sparse) {
      await users.dropIndex(index.name);
    }
  }
  console.log('Verified: local email and phone identity indexes are ready. User documents were not changed.');
} catch (error) {
  console.error('Email auth preparation failed:', error?.codeName || error?.name || 'UnknownError');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
