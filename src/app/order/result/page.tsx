import { OrderResult } from '@/components/OrderResult';
export const metadata = { title: 'Підтвердження замовлення — iApteca' };
export default async function OrderResultPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return <OrderResult orderId={order} />;
}
