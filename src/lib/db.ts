import mongoose from 'mongoose';
import { logger } from './logger';
import { metrics } from './metrics';

type MongooseCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // Reuse one connection promise across Next.js development hot reloads.
  var iaptecaMongooseCache: MongooseCache | undefined;
}

const cache = globalThis.iaptecaMongooseCache ?? (globalThis.iaptecaMongooseCache = {
  connection: null,
  promise: null,
});

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    metrics.setGauge('db_connection_status', 0);
    throw new Error('MONGODB_URI is not configured. Create .env.local from the local setup instructions.');
  }

  if (cache.connection) return cache.connection;

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      maxPoolSize: 100,
    }).then(() => mongoose).catch((error: unknown) => {
      cache.promise = null;
      metrics.setGauge('db_connection_status', 0);

      const safeError = error instanceof Error ? error : undefined;
      const errorCode = safeError && 'code' in safeError ? safeError.code : undefined;
      logger.error('db.connection_failed', {
        error_name: safeError?.name || 'UnknownError',
        error_code: typeof errorCode === 'string' || typeof errorCode === 'number' ? errorCode : undefined,
      });

      throw new Error('Could not connect to MongoDB. Check .env.local and the local MongoDB service.');
    });
  }

  try {
    cache.connection = await cache.promise;
    metrics.setGauge('db_connection_status', 1);
    return cache.connection;
  } catch (error: unknown) {
    metrics.setGauge('db_connection_status', 0);
    throw error;
  }
};

export * from './models';
