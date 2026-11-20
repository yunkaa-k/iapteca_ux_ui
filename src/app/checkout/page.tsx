import { CheckoutContent } from '@/components/CheckoutContent';

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const { request } = await searchParams;
  return <CheckoutContent requestId={request} />;
}
