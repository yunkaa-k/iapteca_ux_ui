import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBundles } from '@/lib/bundle-data';
import { KitDetails } from '@/components/KitDetails';
import styles from '@/components/Kits.module.css';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const kit = (await getBundles()).find(k => k.slug === slug);
  return { title: kit ? kit.name + ' | iApteca' : 'Аптечку не знайдено | iApteca' };
}
export default async function KitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const kits = await getBundles();
  const kit = kits.find(k => k.slug === slug);
  if (!kit) notFound();
  return <div className={styles.page}><header className={styles.heading + ' ' + styles.detailHeading}><nav className={styles.breadcrumbs} aria-label="Навігаційний шлях"><Link href="/">Головна</Link><span aria-hidden="true">/</span><Link href="/catalog">Каталог</Link><span aria-hidden="true">/</span><Link href="/kits">Готові аптечки</Link></nav><h1>{kit.name}</h1></header><KitDetails key={kit._id} kit={kit} recommendations={kits.filter(k => k._id !== kit._id)} /></div>;
}
