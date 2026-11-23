import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { connectDB, OrderModel } from '@/lib/db';

// Local simulation only: no card details and no payment provider are involved.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: 'Недозволений запит.' }, { status: 403 });
  const user = await getAuthUser();
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  const guest = token && /^[a-f0-9]{64}$/.test(token) ? { user: { $exists: false }, guestPaymentTokenHash: createHash('sha256').update(token).digest('hex') } : undefined;
  if (!user && !guest) return NextResponse.json({ error: 'Потрібен доступ до цього замовлення.' }, { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: 'Замовлення недоступне.' }, { status: 404 });
  const access = user && guest ? { $or: [{ user: user._id }, guest] } : user ? { user: user._id } : guest!;
  let outcome: unknown;
  try { outcome = (await req.json())?.outcome; } catch { return NextResponse.json({ error: 'Підтвердьте дані повторної оплати.' }, { status: 400 }); }
  if (outcome !== 'success' && outcome !== 'failure') return NextResponse.json({ error: 'Підтвердьте дані повторної оплати.' }, { status: 400 });
  try {
    await connectDB();
    const filter = { _id: id, ...access, status: { $in: ['PENDING', 'CONFIRMED', 'READY_FOR_PICKUP'] }, 'checkout.payment': 'online', 'checkout.paymentMode': 'demo' };
    const updated = await OrderModel.findOneAndUpdate({ ...filter, 'checkout.demoPaymentStatus': 'failed' }, { $set: { 'checkout.demoPaymentStatus': outcome === 'success' ? 'paid' : 'failed' } }, { new: true });
    if (updated) return NextResponse.json({ checkout: updated.checkout });
    // Idempotent retry after a lost response. Paid orders never become unpaid.
    const paid = await OrderModel.findOne({ ...filter, 'checkout.demoPaymentStatus': 'paid' });
    if (paid) return NextResponse.json({ checkout: paid.checkout });
    return NextResponse.json({ error: 'Замовлення недоступне для повторної оплати.' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Не вдалося підтвердити оплату. Спробуйте ще раз.' }, { status: 503 });
  }
}
