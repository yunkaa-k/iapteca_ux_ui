import type { Metadata } from 'next';
import { FaqPage } from '@/components/FaqPage';

export const metadata: Metadata = {
  title: 'Часті запитання | iApteca',
  description: 'Відповіді на запитання про замовлення, рецепти, отримання та оплату в iApteca.',
};

export default function Faq() {
  return <FaqPage />;
}
