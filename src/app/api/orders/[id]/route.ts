import { NextResponse } from 'next/server';
import { connectDB, OrderModel, MedicationModel } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import mongoose from 'mongoose';
import { inventoryLines } from '@/lib/bundles';
import { canCancelOrder } from '@/lib/order-display';
import type { OrderItem } from '@/lib/types';
import { logger } from '@/lib/logger';

class OrderActionError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: 'Недозволений запит.' }, { status: 403 });
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Auth' }, { status: 401 });
  let status: unknown;
  try { status = (await req.json())?.status; } catch { return NextResponse.json({ error: 'Некоректний запит.' }, { status: 400 }); }
  if (typeof status !== 'string' || !['PENDING', 'CONFIRMED', 'READY_FOR_PICKUP', 'SHIPPED', 'COMPLETED', 'CANCELLED'].includes(status)) return NextResponse.json({ error: 'Некоректний статус.' }, { status: 400 });
  const admin = user.role === 'ADMIN';
  if (!admin && status !== 'CANCELLED') return NextResponse.json({ error: 'Недозволена дія.' }, { status: 403 });
  const { id } = await params;
  await connectDB();
  for (let attempt = 0; attempt < 5; attempt++) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await OrderModel.findById(id).session(session);
      if (!order || (!admin && order.user?.toString() !== user._id.toString())) throw new OrderActionError('Замовлення недоступне.', 404);
      if (status === order.status) {
        await session.commitTransaction();
        return NextResponse.json(order);
      }
      if (!admin && !canCancelOrder(order.status)) throw new OrderActionError('Це замовлення вже не можна скасувати.', 409);
      if (status === 'READY_FOR_PICKUP' && order.checkout?.delivery.method !== 'pickup') throw new OrderActionError('Для цього замовлення не обрано самовивіз.', 400);
      if (status === 'SHIPPED' && order.checkout?.delivery.method !== 'courier') throw new OrderActionError('Для цього замовлення не обрано кур’єрську доставку.', 400);
      if (status === 'CANCELLED') {
        for (const item of order.items.flatMap((line: OrderItem) => inventoryLines(line))) {
          const restored = await MedicationModel.findByIdAndUpdate(item.medication, { $inc: { stock: item.quantity } }).session(session);
          if (!restored) throw new OrderActionError('Не вдалося повернути компонент на склад.', 409);
        }
      } else if (order.status === 'CANCELLED') {
        for (const item of order.items.flatMap((line: OrderItem) => inventoryLines(line))) {
          const med = await MedicationModel.findById(item.medication).session(session);
          if (!med || med.stock < item.quantity) throw new OrderActionError('Недостатньо товару для відновлення замовлення.', 409);
          med.stock -= item.quantity;
          await med.save({ session });
        }
      }
      const paidDemo = order.checkout?.paymentMode === 'demo' && order.checkout.demoPaymentStatus === 'paid';
      const update = { $set: { status, ...(status === 'CANCELLED' && paidDemo ? { 'checkout.demoRefundStatus': 'pending' } : {}) }, ...(order.status === 'CANCELLED' && order.checkout?.demoRefundStatus ? { $unset: { 'checkout.demoRefundStatus': 1 } } : {}) };
      const updated = await OrderModel.findByIdAndUpdate(id, update, { new: true, session });
      if (!updated) throw new OrderActionError('Замовлення недоступне.', 404);
      await session.commitTransaction();
      logger.info('order.status_changed', { order_id: id, status, actor_id: user._id.toString() });
      return NextResponse.json(updated);
    } catch (error) {
      await session.abortTransaction();
      const transient = error as { code?: number; hasErrorLabel?: (label: string) => boolean };
      if ((transient.code === 112 || transient.hasErrorLabel?.('TransientTransactionError')) && attempt < 4) continue;
      if (error instanceof OrderActionError) return NextResponse.json({ error: error.message }, { status: error.status });
      return NextResponse.json({ error: 'Не вдалося оновити замовлення. Спробуйте ще раз.' }, { status: 503 });
    } finally { await session.endSession(); }
  }
  return NextResponse.json({ error: 'Спробуйте ще раз.' }, { status: 503 });
}
