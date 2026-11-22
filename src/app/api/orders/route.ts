import { NextResponse } from 'next/server';
import { connectDB, OrderModel, MedicationModel, BundleModel } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import mongoose from 'mongoose';
import { logger } from '@/lib/logger';
import type { OrderItem } from '@/lib/types';
import { parseCheckout } from '@/lib/checkout';
import { createHash, randomBytes } from 'node:crypto';

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
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Невірний формат замовлення.' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Невірний формат замовлення.' }, { status: 400 });
  if (!user && !body.checkout) return NextResponse.json({ error: 'Auth' }, { status: 401 });
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: 'Недозволений запит.' }, { status: 403 });
  const parsed = body.checkout === undefined ? {} : parseCheckout(body.checkout);
  if (parsed.errors) return NextResponse.json({ error: 'Перевірте обов’язкові поля та спосіб отримання.', fields: parsed.errors }, { status: 400 });
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) return NextResponse.json({ error: 'Кошик порожній або містить забагато позицій.' }, { status: 400 });
  const quantities = new Map<string, number>();
  for (const item of body.items) {
    if (!item || (item.kind !== undefined && item.kind !== 'bundle') || typeof item.medication !== 'string' || !item.medication || item.medication.length > 128 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) return NextResponse.json({ error: 'Некоректна кількість товару.' }, { status: 400 });
    const key = item.kind === 'bundle' ? 'bundle:' + item.medication : item.medication;
    const quantity = (quantities.get(key) || 0) + item.quantity;
    if (quantity > 1000) return NextResponse.json({ error: 'Некоректна кількість товару.' }, { status: 400 });
    quantities.set(key, quantity);
  }
  await connectDB();
  const guestPaymentToken = !user && parsed.details?.payment === 'online' ? randomBytes(32).toString('hex') : undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const items: OrderItem[] = [];
      let subtotal = 0;
      for (const [key, quantity] of [...quantities].sort(([a], [b]) => a.localeCompare(b))) {
        if (key.startsWith('bundle:')) {
          const medication = key.slice(7);
          const bundle = await BundleModel.findOne({ _id: medication, isDeleted: { $ne: true }, compositionConfirmed: true }).session(session);
          if (!bundle || !bundle.components.length || !Number.isFinite(bundle.price) || bundle.price < 0) throw new Error('Аптечка недоступна. Оновіть кошик.');
          const required = new Map<string, number>();
          for (const component of bundle.components) {
            if (!Number.isSafeInteger(component.quantity) || component.quantity < 1) throw new Error('Аптечка недоступна. Оновіть кошик.');
            const id = component.medication.toString();
            required.set(id, (required.get(id) || 0) + component.quantity * quantity);
          }
          for (const [id, count] of [...required].sort(([a], [b]) => a.localeCompare(b))) {
            if (!Number.isSafeInteger(count)) throw new Error('Аптечка недоступна. Оновіть кошик.');
            const component = await MedicationModel.findOneAndUpdate({ _id: id, isDeleted: { $ne: true }, stock: { $gte: count } }, { $inc: { stock: -count } }, { session, new: true });
            if (!component) throw new Error('Недостатньо компонентів аптечки. Оновіть кошик.');
            if (component.requiresPrescription === true) throw new Error('Склад аптечки потребує окремого погодження.');
          }
          items.push({ medication, kind: 'bundle', quantity, price: bundle.price, name: bundle.name, description: bundle.description, image: bundle.image, slug: bundle.slug, components: bundle.components.map((c: { medication: string; quantity: number; name: string }) => ({ medication: c.medication.toString(), quantity: c.quantity, name: c.name })) });
          subtotal += Math.round(bundle.price * 100) * quantity;
          continue;
        }
        const medication = key;
        const med = await MedicationModel.findOneAndUpdate(
          { _id: medication, isDeleted: { $ne: true }, inventoryOnly: { $ne: true }, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } }, { session, new: true }
        );
        if (!med) throw new Error('Недостатньо товару. Оновіть кошик і спробуйте ще раз.');
        if (!user && med.requiresPrescription === true) throw new Error('Для рецептурних препаратів увійдіть і збережіть заявку на перевірку рецепта.');
        if (!Number.isFinite(med.price) || med.price < 0) throw new Error('Не вдалося перевірити ціну товару.');
        items.push({ medication, quantity, price: med.price });
        subtotal += Math.round(med.price * 100) * quantity;
      }
      subtotal /= 100;
      const total = subtotal + (parsed.details?.delivery.fee || 0);
      const [order] = await OrderModel.create([{ ...(user ? { user: user._id } : {}), ...(guestPaymentToken ? { guestPaymentTokenHash: createHash('sha256').update(guestPaymentToken).digest('hex') } : {}), items, subtotal, total, ...(parsed.details ? { checkout: parsed.details } : {}), status: 'PENDING' }], { session });
      await session.commitTransaction();
      logger.info('order.created', { order_id: order._id.toString(), total });
      const publicOrder = typeof order.toObject === 'function' ? order.toObject() : { ...order };
      delete publicOrder.guestPaymentTokenHash;
      return NextResponse.json({ ...publicOrder, ...(guestPaymentToken ? { guestPaymentToken } : {}) });
    } catch (error: unknown) {
      await session.abortTransaction();
      const err = error as Error & { code?: number; hasErrorLabel?: (label: string) => boolean };
      if ((err.code === 112 || err.hasErrorLabel?.('TransientTransactionError')) && attempt < 4) {
        await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)));
        continue;
      }
      logger.error('order.creation_failed', { error_name: err.name });
      const publicMessages = [
        'Недостатньо товару. Оновіть кошик і спробуйте ще раз.',
        'Для рецептурних препаратів увійдіть і збережіть заявку на перевірку рецепта.',
        'Не вдалося перевірити ціну товару.',
        'Аптечка недоступна. Оновіть кошик.',
        'Недостатньо компонентів аптечки. Оновіть кошик.',
        'Склад аптечки потребує окремого погодження.',
      ];
      return NextResponse.json({ error: publicMessages.includes(err.message) ? err.message : 'Не вдалося створити замовлення. Спробуйте ще раз.' }, { status: 400 });
    } finally { await session.endSession(); }
  }
  return NextResponse.json({ error: 'Спробуйте оформити замовлення ще раз.' }, { status: 429 });
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
