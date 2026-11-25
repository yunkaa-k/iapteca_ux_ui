import { CheckoutContent } from '@/components/CheckoutContent';

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ request?: string; pickup?: string }> }) {
  const { request, pickup } = await searchParams;
  const pickupUnavailablePreview = process.env.NODE_ENV === 'development' && pickup === 'unavailable';
  return <CheckoutContent requestId={request} pickupUnavailablePreview={pickupUnavailablePreview} />;
}
