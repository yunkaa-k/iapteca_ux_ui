import { getAuthUser } from '@/lib/auth';
import { connectDB, MedicationModel, OrderModel } from '@/lib/db';
import { redirect } from 'next/navigation';
import { ProfileAccount } from '@/components/ProfileAccount';
import { AccountOrders, type AccountOrder } from '@/components/AccountOrders';
import type { Medication, Order } from '@/lib/types';

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string; request?: string }> }) {
  const { tab, request } = await searchParams;
  const user = await getAuthUser();
  if (!user) redirect('/login');
  await connectDB();
  const records = (await OrderModel.find({ user: user._id }).sort({ createdAt: -1 }).lean()) as unknown as Order[];
  const ids = [...new Set(records.flatMap(order => order.items.map(item => item.medication)))];
  const products = (ids.length ? await MedicationModel.find({ _id: { $in: ids } }).lean() : []) as unknown as Medication[];
  const byId = new Map(products.map(product => [product._id.toString(), product]));
  const orders: AccountOrder[] = records.map(order => ({
    _id: order._id.toString(), user: user._id, total: order.total, status: order.status, checkout: order.checkout,
    createdAt: new Date(order.createdAt).toISOString(),
    items: order.items.map(item => {
      const medication = byId.get(item.medication.toString());
      return { _id: item.medication.toString(), kind: item.kind, slug: item.slug, name: item.name || medication?.name || 'Препарат', description: item.description || medication?.description || '', manufacturer: medication?.manufacturer || '', category: medication?.category || '', stock: medication?.stock || 0, image: item.image || medication?.image, price: item.price, quantity: item.quantity };
    }),
  }));
  return <ProfileAccount key={request || tab || 'profile'} user={user} initialOrders={tab === 'orders' || !!request} requestDetails={!!request}>
    <AccountOrders ownerId={user._id} orders={orders} requestId={request} />
  </ProfileAccount>;
}
