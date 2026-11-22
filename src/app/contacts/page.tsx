import { InformationCta, InformationPage, PharmacyCards } from '@/components/InformationPage';
import styles from '@/components/InformationPage.module.css';

export const metadata = { title: 'Контакти | iApteca', description: 'Контакти iApteca та адреси аптек у Харкові.' };

export default function ContactsPage() {
  return <InformationPage breadcrumb="Контакти" title="Контакти" introduction="Зв’яжіться з нами або оберіть найближчу аптеку.">
    <section className={styles.section} aria-labelledby="channels-title"><h2 id="channels-title">Зв’язок з нами</h2><div className={styles.threeColumns}>{[
      ['Телефон', '+380 57 000 00 00. Приймаємо дзвінки щодня з 8:00 до 21:00.'],
      ['Електронна пошта', 'info@iapteca.ua. Відповідаємо протягом робочого дня.'],
      ['Графік роботи', 'Аптеки працюють щодня з 8:00 до 21:00. Замовлення онлайн приймаємо цілодобово.'],
    ].map(([title, text]) => <article className={styles.card} key={title}><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <PharmacyCards />
    <InformationCta title="Не знайшли відповідь?" href="/faq" label="Часті запитання">Перегляньте відповіді на часті запитання про замовлення, рецепти та доставку.</InformationCta>
  </InformationPage>;
}
