import { NextResponse } from 'next/server';
import { connectDB, OrderModel, MedicationModel, BundleModel } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import mongoose from 'mongoose';
import { logger } from '@/lib/logger';
import type { Order, OrderItem } from '@/lib/types';
import { isDemoPickupUnavailable, parseCheckout } from '@/lib/checkout';
import { createHash, randomBytes } from 'node:crypto';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function orderResponse(order: Order & { toObject?: () => Order }, guestPaymentToken?: string) {
  const publicOrder = typeof order.toObject === 'function' ? order.toObject() : { ...order };
  delete publicOrder.guestPaymentTokenHash;
  delete publicOrder.submissionHash;
  return NextResponse.json({ ...publicOrder, ...(guestPaymentToken ? { guestPaymentToken } : {}) });
}

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
  const submissionKey = req.headers.get('Idempotency-Key');
  if (submissionKey !== null && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(submissionKey)) {
    return NextResponse.json({ error: 'Некоректний ключ оформлення замовлення.' }, { status: 400 });
  }
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
  const orderedQuantities = [...quantities].sort(([a], [b]) => a.localeCompare(b));
  // Reuse MongoDB's unique _id index so simultaneous attempts cannot both commit.
  const orderId = submissionKey ? sha256('order:' + submissionKey).slice(0, 24) : undefined;
  const submissionHash = submissionKey ? sha256(JSON.stringify([submissionKey, orderedQuantities, parsed.details])) : undefined;
  await connectDB();
  const guestPaymentToken = !user && parsed.details?.payment === 'online'
    ? submissionKey ? sha256('guest-payment:' + submissionKey) : randomBytes(32).toString('hex')
    : undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    const session = await mongoose.startSession();
    session.startTransaction();
    let committing = false;
    try {
      if (orderId) {
        const existing = await OrderModel.findById(orderId).select('+submissionHash').session(session);
        if (existing) {
          await session.abortTransaction();
          if ((existing.user || undefined) !== user?._id.toString() || existing.submissionHash !== submissionHash) {
            return NextResponse.json({ error: 'Цю спробу оформлення вже використано.' }, { status: 409 });
          }
          return orderResponse(existing, guestPaymentToken);
        }
      }
      const items: OrderItem[] = [];
      const pickupItems: Pick<OrderItem, 'kind' | 'slug' | 'name'>[] = [];
      let subtotal = 0;
      for (const [key, quantity] of orderedQuantities) {
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
          pickupItems.push({ kind: 'bundle', slug: bundle.slug });
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
        pickupItems.push({ name: med.name });
        subtotal += Math.round(med.price * 100) * quantity;
      }
      if (parsed.details?.delivery.method === 'pickup' && isDemoPickupUnavailable(pickupItems)) {
        await session.abortTransaction();
        return NextResponse.json({ error: 'Немає аптеки з усіма товарами. Оберіть доставку або змініть склад кошика.' }, { status: 400 });
      }
      subtotal /= 100;
      const total = subtotal + (parsed.details?.delivery.fee || 0);
      const [order] = await OrderModel.create([{ ...(orderId ? { _id: orderId, submissionHash } : {}), ...(user ? { user: user._id } : {}), ...(guestPaymentToken ? { guestPaymentTokenHash: sha256(guestPaymentToken) } : {}), items, subtotal, total, ...(parsed.details ? { checkout: parsed.details } : {}), status: 'PENDING' }], { session });
      committing = true;
      await session.commitTransaction();
      logger.info('order.created', { order_id: order._id.toString(), total });
      return orderResponse(order, guestPaymentToken);
    } catch (error: unknown) {
      if (!committing) await session.abortTransaction();
      const err = error as Error & { code?: number; hasErrorLabel?: (label: string) => boolean };
      const concurrentSubmission = Boolean(orderId) && (err.code === 11000 || err.hasErrorLabel?.('UnknownTransactionCommitResult'));
      if ((concurrentSubmission || err.code === 112 || err.hasErrorLabel?.('TransientTransactionError')) && attempt < 4) {
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
