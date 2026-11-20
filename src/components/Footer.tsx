import Image from 'next/image';
import Link from 'next/link';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer} id="about-iapteca">
      <div className={styles.inner}>
        <div className={styles.mainRow}>
          <div className={styles.brandBlock}>
            <Link className={styles.brand} href="/" aria-label="iApteca — на головну">
              <Image src="/images/home/brand-emblem.svg" alt="" width={30} height={30} aria-hidden="true" />
              <span>iApteca</span>
            </Link>
            <p>Ліки поруч, коли вони потрібні.<br />Пошук препаратів та аналогів.</p>
          </div>

          <nav className={styles.column} aria-label="Розділи сайту">
            <h2>Розділи</h2>
            <Link href="/catalog">Каталог препаратів</Link>
            <Link href="/catalog">Аналоги препаратів</Link>
          </nav>

          <nav className={styles.column} aria-label="Інформація покупцям">
            <h2>Покупцям</h2>
            <Link href="/#delivery-info">Доставка та оплата</Link>
            <Link href="/prescription">Електронний рецепт</Link>
          </nav>

          <nav className={styles.column} id="support" aria-label="Підтримка">
            <h2>Підтримка</h2>
            <Link href="/#support">Часті запитання</Link>
            <Link href="/#contacts">Контакти</Link>
          </nav>
        </div>

        <div className={styles.legalRow} id="contacts">
          <span>© 2026 iApteca. Усі права захищено.</span>
          <span>Здоров’я починається з турботи.</span>
        </div>
      </div>
    </footer>
  );
}
