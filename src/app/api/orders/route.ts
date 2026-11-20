import { NextResponse } from 'next/server';
import { connectDB, OrderModel, MedicationModel } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import mongoose from 'mongoose';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Auth' }, { status: 401 });
  }
  await connectDB();
  const { searchParams } = new URL(req.url);
  const filter = user.role === 'ADMIN' && searchParams.get('admin') ? {} : { user: user._id };
  const orders = await OrderModel.find(filter).sort({ createdAt: -1 });

  return NextResponse.json(orders);
}

export async function POST(req: Request) {

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Auth' }, { status: 401 });
  }

  await connectDB();

  const { items, total } = await req.json();
  const MAX_RETRIES = 50;
  let retryCount = 0;

  if (items && items.length === 1) {
    while (retryCount < MAX_RETRIES) {
      try {
        const item = items[0];
        const med = await MedicationModel.findOneAndUpdate(
          { _id: item.medication, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true }
        );

        if (!med) throw new Error('Недостатньо товару');

        const orderData: Record<string, unknown> = {
          user: user._id,
          items,
          total,
          status: 'PENDING',
        };

        const order = await OrderModel.create(orderData);

        logger.info('order.created', { user_id: user._id.toString(), order_id: order._id.toString(), total: orderData.total as number });
        return NextResponse.json(order);
      } catch (error: unknown) {
        let isRetryable = false;
        if (error && typeof error === 'object') {
          const errCode = (error as Record<string, unknown>).code;
          const errMsg = (error as Error).message;
          isRetryable = errCode === 112 || errMsg?.includes('Write conflict') || errCode === 11000;
        }

        if (isRetryable && retryCount < MAX_RETRIES - 1) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100 * retryCount));
          continue;
        }
        const message = error instanceof Error ? error.message : 'Failed';
        logger.error('order.creation_failed', { user_id: user._id.toString(), error_message: message });
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }
  }

  while (retryCount < MAX_RETRIES) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!items || items.length === 0) {
        throw new Error('Кошик порожній');
      }

      for (const item of items) {
        const med = await MedicationModel.findOneAndUpdate(
          { _id: item.medication, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session, new: true }
        );

        if (!med) throw new Error('Недостатньо товару');
      }

      const orderData: Record<string, unknown> = {
        user: user._id,
        items,
        total,
        status: 'PENDING',
      };

      const order = await OrderModel.create([orderData], { session });

      await session.commitTransaction();
      session.endSession();

      logger.info('order.created', { user_id: user._id.toString(), order_id: order[0]._id.toString(), total: orderData.total as number });
      return NextResponse.json(order[0]);
    } catch (error: unknown) {
      await session.abortTransaction();
      session.endSession();

      let isWriteConflict = false;
      if (error && typeof error === 'object') {
        const errCode = (error as Record<string, unknown>).code;
        const errMsg = (error as Error).message;

        interface MongoError extends Error {
          hasErrorLabel?: (label: string) => boolean;
        }
        const mongoErr = error as MongoError;
        const isTransient = typeof mongoErr.hasErrorLabel === 'function' ? mongoErr.hasErrorLabel('TransientTransactionError') : false;

        isWriteConflict = errCode === 112 || errMsg?.includes('Write conflict') || isTransient;
      }

      if (isWriteConflict && retryCount < MAX_RETRIES - 1) {
        retryCount++;
        const delay = Math.min(1000, Math.pow(1.5, retryCount) * 20 + Math.random() * 100);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      const message = error instanceof Error ? error.message : 'Failed';
      logger.error('order.creation_failed', { user_id: user._id.toString(), error_message: message });
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
  return NextResponse.json({ error: 'System busy' }, { status: 429 });
}

export async function DELETE() {

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Auth' }, { status: 401 });
  }

  await connectDB();
  await OrderModel.deleteMany({ user: user._id });

  return new NextResponse(null, { status: 204 });
}
