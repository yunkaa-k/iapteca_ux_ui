import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getBundles } from '@/lib/bundle-data';
import { KitCard } from '@/components/KitCard';
import styles from '@/components/Kits.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Готові аптечки | iApteca' };

export default async function KitsPage({ searchParams }: { searchParams: Promise<{ kit?: string }> }) {
  const { kit } = await searchParams;
  const kits = await getBundles();
  if (kit && kits.some(k => k.slug === kit)) redirect('/kits/' + encodeURIComponent(kit));
  return <div className={styles.page}><header className={styles.heading}><nav className={styles.breadcrumbs} aria-label="Навігаційний шлях"><Link href="/">Головна</Link><span aria-hidden="true">/</span><Link href="/catalog">Каталог</Link><span aria-hidden="true">/</span><span aria-current="page">Готові аптечки</span></nav><h1>Готові аптечки</h1><p>Набори першої допомоги для різних ситуацій.</p></header>{kits.length ? <div className={styles.grid}>{kits.map(k => <KitCard key={k._id} kit={k} />)}</div> : <p>Наразі немає доступних аптечок.</p>}</div>;
}
