import { InformationCta, InformationPage } from '@/components/InformationPage';
import styles from '@/components/InformationPage.module.css';
import Image from 'next/image';

export const metadata = { title: 'Доставка та оплата | iApteca', description: 'Способи отримання та оплати замовлення в iApteca.' };

export default function DeliveryPage() {
  return <InformationPage breadcrumb="Доставка" title="Доставка та оплата" introduction="У демо iApteca можна обрати спосіб отримання й оплати тестового замовлення.">
    <section className={styles.section} aria-labelledby="receiving-title"><h2 id="receiving-title">Способи отримання</h2><div className={styles.twoColumns}>
      <article className={styles.card + ' ' + styles.receiving}><div className={styles.titleRow}><Image className={styles.receivingIcon} src="/images/delivery/store.svg" width={24} height={24} alt="" /><h3>Самовивіз з аптеки</h3><span className={styles.badge}>Безкоштовно</span></div><div className={styles.paragraphs}><p>Оберіть аптеку на демонстраційній мапі під час оформлення.</p><p>Обрана адреса з’явиться в підтвердженні замовлення.</p></div></article>
      <article className={styles.card + ' ' + styles.receiving}><div className={styles.titleRow}><Image className={styles.receivingIcon} src="/images/delivery/truck.svg" width={24} height={24} alt="" /><h3>Кур’єрська доставка</h3><span className={styles.badge}>59 грн</span></div><div className={styles.paragraphs}><p>Для тестової доставки вкажіть місто й адресу під час оформлення.</p><p>У демо до суми замовлення додається фіксована вартість доставки.</p></div></article>
    </div></section>
    <section className={styles.section} aria-labelledby="payment-title"><h2 id="payment-title">Способи оплати</h2><div className={styles.twoColumns}><article className={styles.card}><h3>При отриманні</h3><p>Для цього способу достатньо підтвердити тестове замовлення.</p></article><article className={styles.card}><h3>Онлайн</h3><p>Демонстраційна оплата тестовою карткою. Кошти не списуються.</p></article></div></section>
    <section className={styles.section} aria-labelledby="steps-title"><h2 id="steps-title">Як це працює</h2><ol className={styles.steps}>{[
      ['Оберіть товари', 'Додайте препарати або готові аптечки до кошика.'],
      ['Перевірка рецепта', 'Для рецептурних препаратів додайте тестовий файл і дочекайтеся результату демонстраційної перевірки.'],
      ['Оформіть замовлення', 'Вкажіть контакти, спосіб отримання та оплати.'],
      ['Перегляньте підтвердження', 'Перевірте підсумок і обраний спосіб отримання.'],
    ].map(([title, text], index) => <li className={styles.card} key={title}><span className={styles.number} aria-hidden="true">{index + 1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol></section>
    <InformationCta title="Рецептурні препарати">Демонстраційна перевірка файлу відкриває оформлення й демооплату рецептурного замовлення.</InformationCta>
  </InformationPage>;
}
