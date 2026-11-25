import { PrescriptionVerification } from '@/components/PrescriptionVerification';

export const metadata = { title: 'Перевірка рецепта — iApteca' };
export default async function PrescriptionVerificationPage({ searchParams }: { searchParams: Promise<{ request?: string; from?: string }> }) {
  const { request, from } = await searchParams;
  return <PrescriptionVerification requestId={request} returnToDetails={from === 'details'} />;
}
