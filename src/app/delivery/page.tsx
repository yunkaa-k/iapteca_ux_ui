import { InformationCta, InformationPage } from '@/components/InformationPage';
import styles from '@/components/InformationPage.module.css';

export const metadata = { title: 'Доставка та оплата | iApteca', description: 'Способи отримання та оплати замовлення в iApteca.' };

export default function DeliveryPage() {
  return <InformationPage breadcrumb="Доставка" title="Доставка та оплата" introduction="Оберіть зручний спосіб отримання та оплати замовлення в iApteca.">
    <section className={styles.section} aria-labelledby="receiving-title"><h2 id="receiving-title">Способи отримання</h2><div className={styles.twoColumns}>
      <article className={styles.card + ' ' + styles.receiving}><div className={styles.titleRow}><h3>Самовивіз з аптеки</h3><span className={styles.badge}>Безкоштовно</span></div><div className={styles.paragraphs}><p>Заберіть замовлення в обраній аптеці Харкова.</p><p>Готовність — від 1 години, повідомимо вас.</p><p>Зберігаємо замовлення 3 дні.</p></div></article>
      <article className={styles.card + ' ' + styles.receiving}><div className={styles.titleRow}><h3>Кур’єрська доставка</h3><span className={styles.badge}>Залежно від адреси</span></div><div className={styles.paragraphs}><p>Доставка за вказаною адресою по Харкову.</p><p>Строк доставки — 1–2 дні після підтвердження.</p><p>Кур’єр зв’яжеться з вами перед доставкою.</p></div></article>
    </div></section>
    <section className={styles.section} aria-labelledby="payment-title"><h2 id="payment-title">Способи оплати</h2><div className={styles.twoColumns}><article className={styles.card}><h3>При отриманні</h3><p>Оплата готівкою або карткою під час отримання замовлення.</p></article><article className={styles.card}><h3>Онлайн</h3><p>Оплата банківською карткою на сайті під час оформлення замовлення.</p></article></div></section>
    <section className={styles.section} aria-labelledby="steps-title"><h2 id="steps-title">Як це працює</h2><ol className={styles.steps}>{[
      ['Оберіть товари', 'Додайте препарати або готові аптечки до кошика.'],
      ['Перевірка рецепта', 'Тільки для рецептурних препаратів: додайте рецепт і дочекайтеся перевірки.'],
      ['Оформіть замовлення', 'Вкажіть контакти, спосіб отримання та оплати.'],
      ['Отримайте замовлення', 'Заберіть в аптеці або дочекайтеся кур’єра.'],
    ].map(([title, text], index) => <li className={styles.card} key={title}><span className={styles.number} aria-hidden="true">{index + 1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol></section>
    <InformationCta title="Рецептурні препарати">Замовлення з рецептурними препаратами передається в роботу після перевірки рецепта фармацевтом. Оплата онлайн стає доступною після підтвердження рецепта.</InformationCta>
  </InformationPage>;
}
