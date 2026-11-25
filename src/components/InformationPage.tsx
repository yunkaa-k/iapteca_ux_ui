import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './InformationPage.module.css';

export function InformationPage({ breadcrumb, title, introduction, children }: { breadcrumb: string; title: string; introduction: string; children: ReactNode }) {
  return <div className={styles.page}>
    <header className={styles.heading}>
      <nav className={styles.breadcrumbs} aria-label="Навігаційний шлях"><Link href="/">Головна</Link><span aria-hidden="true">/</span><span aria-current="page">{breadcrumb}</span></nav>
      <h1>{title}</h1><p>{introduction}</p>
    </header>
    {children}
  </div>;
}

export function InformationCta({ title, children, href = '/catalog', label = 'Перейти до каталогу' }: { title: string; children: ReactNode; href?: string; label?: string }) {
  return <aside className={styles.cta}><div><h2>{title}</h2><p>{children}</p></div><Link className={styles.primary} href={href}>{label}</Link></aside>;
}

export function PharmacyCards() {
  return <section className={styles.section} aria-labelledby="pharmacies-title">
    <h2 id="pharmacies-title">Наші аптеки</h2>
    <div className={styles.threeColumns}>
      {[
        ['iApteca · Центр', 'вул. Центральна, 12, Харків'],
        ['iApteca · Вокзал', 'вул. Вокзальна, 5, Харків'],
        ['iApteca · Салтівка', 'просп. Героїв Харкова, 30, Харків'],
      ].map(([name, address]) => <article className={styles.card + ' ' + styles.pharmacy} key={name}><h3>{name}</h3><p>{address}</p></article>)}
    </div>
    <p className={styles.note}>Повний список аптек з наявністю товарів доступний під час вибору самовивозу при оформленні замовлення.</p>
  </section>;
}
