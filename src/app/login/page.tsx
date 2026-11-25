import { AuthForm } from '@/components/AuthForm';

export const metadata = { title: 'Вхід | iApteca' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  return <AuthForm mode="login" returnTo={returnTo} />;
}
