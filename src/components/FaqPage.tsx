'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './FaqPage.module.css';

const questions = [
  { question: 'Як оформити замовлення?', answer: 'Знайдіть потрібні товари й додайте їх до кошика. Перейдіть до оформлення, заповніть контактні дані, оберіть спосіб отримання та оплати й підтвердьте замовлення.' },
  { question: 'Як придбати рецептурний препарат?', answer: 'Додайте препарат до кошика та завантажте фото рецепта. Після перевірки й підтвердження рецепта можна продовжити оформлення замовлення.' },
  { question: 'Де перевірити статус рецепта?', answer: 'Увійдіть до акаунта й відкрийте «Мої замовлення». У блоці заявок відображається статус перевірки. Якщо потрібне нове фото, відкрийте заявку та замініть його.' },
  { question: 'Як обрати аптеку для самовивозу?', answer: 'Під час оформлення оберіть «Самовивіз з аптеки» та аптеку на мапі. Показуємо аптеки з усіма товарами з вашого кошика. Якщо таких аптек немає, оберіть доставку або змініть кошик.' },
  { question: 'Як оплатити замовлення онлайн?', answer: 'Під час оформлення оберіть «Онлайн після підтвердження». Посилання для оплати надійде після підтвердження замовлення. До цього оплачувати замовлення не потрібно.' },
  { question: 'Що робити, якщо препарату немає в наявності?', answer: 'У картці препарату натисніть «Переглянути аналоги» та порівняйте доступні варіанти. Звертайте увагу на діючу речовину, дозування й форму випуску. Інше дозування не є автоматичною заміною препарату.' },
];

function FaqItem({ question, answer, initiallyOpen }: { question: string; answer: string; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const id = useId();
  return <section className={styles.item}>
    <h2><button className={styles.toggle} type="button" id={id + '-toggle'} aria-expanded={open} aria-controls={id + '-answer'} onClick={() => setOpen(value => !value)}>
      <span className={styles.question}>{question}</span>
      <span className={styles.action} aria-hidden="true">{open ? 'Згорнути' : 'Розгорнути'}<Image src={'/images/faq/chevron-' + (open ? 'up' : 'down') + '.svg'} alt="" width={16} height={16} /></span>
    </button></h2>
    <div id={id + '-answer'} role="region" aria-labelledby={id + '-toggle'} hidden={!open} className={styles.answer}><p>{answer}</p></div>
  </section>;
}

export function FaqPage() {
  return <div className={styles.page}>
    <nav className={styles.breadcrumbs} aria-label="Навігаційний шлях"><Link href="/">Головна</Link><span aria-hidden="true">/</span><span aria-current="page">Часті запитання</span></nav>
    <header className={styles.heading}><h1>Часті запитання</h1><p>Відповіді на запитання про замовлення, рецепти, отримання та оплату.</p></header>
    <div className={styles.questions}>{questions.map((item, index) => <FaqItem key={item.question} {...item} initiallyOpen={index === 0} />)}</div>
  </div>;
}
