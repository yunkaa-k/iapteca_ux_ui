import { InformationCta, InformationPage, PharmacyCards } from '@/components/InformationPage';
import styles from '@/components/InformationPage.module.css';

export const metadata = { title: 'Про iApteca', description: 'Про iApteca, наші принципи та аптеки у Харкові.' };

export default function AboutPage() {
  return <InformationPage breadcrumb="Про нас" title="Про iApteca" introduction="Онлайн-аптека для Харкова: шукайте препарати та аналоги, перевіряйте наявність і забирайте замовлення поруч.">
    <section className={styles.mission} aria-labelledby="mission-title"><div className={styles.missionText}><h2 id="mission-title">Наша мета</h2><p>Ми створили iApteca, щоб купувати ліки було простіше: у каталозі легко знайти потрібний препарат за назвою чи діючою речовиною, одразу побачити наявність в аптеках і підібрати аналоги.</p><p>Для рецептурних препаратів перевірку рецепта виконує фармацевт, а замовлення можна забрати в аптеці поруч або отримати від кур’єра.</p><p>Ми показуємо ціну та наявність препарату ще до оформлення, а вартість доставки розраховується за вашою адресою, тож усе зрозуміло до моменту замовлення.</p></div><dl className={styles.facts}>{[['Аптеки', '3 у Харкові'], ['Отримання', 'Самовивіз або кур’єр'], ['Оплата', 'При отриманні або онлайн'], ['Рецепти', 'Перевіряє фармацевт']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    <section className={styles.section} aria-labelledby="values-title"><h2 id="values-title">Наші принципи</h2><div className={styles.threeColumns}>{[
      ['Безпека', 'Рецептурні препарати видаються лише після перевірки рецепта фармацевтом.'],
      ['Прозорість', 'Чітко показуємо наявність, ціну та вартість доставки ще до оформлення.'],
      ['Зручність', 'Самовивіз з аптеки, кур’єр і оплата при отриманні або онлайн.'],
    ].map(([title, text], index) => <article className={styles.card} key={title}><span className={styles.number} aria-hidden="true">{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <PharmacyCards />
    <InformationCta title="Знайдіть потрібні ліки">Скористайтеся пошуком за назвою або діючою речовиною та оберіть зручний спосіб отримання.</InformationCta>
  </InformationPage>;
}
