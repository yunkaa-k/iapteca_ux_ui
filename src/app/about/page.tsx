import { InformationCta, InformationPage, PharmacyCards } from '@/components/InformationPage';
import styles from '@/components/InformationPage.module.css';

export const metadata = { title: 'Про iApteca', description: 'Про iApteca, наші принципи та аптеки у Харкові.' };

export default function AboutPage() {
  return <InformationPage breadcrumb="Про нас" title="Про iApteca" introduction="Демо онлайн-аптеки для Харкова. Тут можна знайти препарати й аналоги, перевірити наявність і спробувати оформити замовлення.">
    <section className={styles.mission} aria-labelledby="mission-title"><div className={styles.missionText}><h2 id="mission-title">Наша мета</h2><p>Ми створили iApteca, щоб спростити пошук ліків. У каталозі можна знайти препарат за назвою чи діючою речовиною, перевірити наявність і підібрати аналоги.</p><p>Для рецептурних препаратів доступна демонстраційна перевірка рецепта. У тестовому замовленні можна обрати самовивіз або кур’єрську доставку.</p><p>Ціну й наявність препарату видно до оформлення. У демо кур’єрська доставка коштує 59 грн, а самовивіз безкоштовний.</p></div><dl className={styles.facts}>{[['Аптеки', '3 демонстраційні точки у Харкові'], ['Отримання', 'Самовивіз або кур’єр'], ['Оплата', 'При отриманні або демооплата онлайн'], ['Рецепти', 'Демонстраційна перевірка']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    <section className={styles.section} aria-labelledby="values-title"><h2 id="values-title">Наші принципи</h2><div className={styles.threeColumns}>{[
      ['Безпека', 'У демо оформлення рецептурного замовлення стає доступним після перевірки файлу.'],
      ['Прозорість', 'Чітко показуємо наявність, ціну та вартість доставки ще до оформлення.'],
      ['Зручність', 'У тестовому замовленні можна обрати спосіб отримання й оплати.'],
    ].map(([title, text], index) => <article className={styles.card} key={title}><span className={styles.number} aria-hidden="true">{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <PharmacyCards />
    <InformationCta title="Знайдіть потрібні ліки">Скористайтеся пошуком за назвою або діючою речовиною та оберіть зручний спосіб отримання.</InformationCta>
  </InformationPage>;
}
