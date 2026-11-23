import type { Order } from './types';

export const orderStatusLabels = { PENDING: 'В обробці', CONFIRMED: 'Підтверджено', READY_FOR_PICKUP: 'Готове до видачі', SHIPPED: 'Передано кур’єру', COMPLETED: 'Отримано', CANCELLED: 'Скасовано' };
export const canCancelOrder = (status: Order['status']) => ['PENDING', 'CONFIRMED', 'READY_FOR_PICKUP'].includes(status);
export function orderDisplay(order: Pick<Order, 'status' | 'checkout'>) {
  const checkout = order.checkout;
  const paid = checkout?.paymentMode === 'demo' && checkout.demoPaymentStatus === 'paid';
  const refund = order.status === 'CANCELLED' && checkout?.demoRefundStatus === 'pending';
  const failed = canCancelOrder(order.status) && checkout?.paymentMode === 'demo' && checkout.demoPaymentStatus === 'failed';
  const received = order.status === 'COMPLETED';
  const payment = refund ? 'Повернення в обробці' : order.status === 'CANCELLED' && !paid ? 'Не оплачено' : paid ? 'Оплачено онлайн' : checkout?.payment === 'on-receipt' ? received ? 'Оплачено при отриманні' : 'При отриманні' : checkout?.payment === 'online' ? 'Онлайн — повторна спроба оплати' : checkout?.payment === 'online-after-confirmation' ? 'Онлайн після підтвердження' : 'Не вказано';
  const state = refund || order.status === 'CANCELLED' || failed ? 'error' : received || paid ? 'success' : order.status === 'SHIPPED' || order.status === 'READY_FOR_PICKUP' || order.status === 'CONFIRMED' ? 'info' : 'warning';
  const badgeState = order.status === 'CANCELLED' || failed ? 'error' : received ? 'success' : order.status === 'PENDING' ? 'warning' : 'info';
  const noticeState = ['SHIPPED', 'READY_FOR_PICKUP'].includes(order.status) && !failed ? 'info' : state;
  const [title, description] = refund ? ['Повернення коштів в обробці', 'Замовлення скасовано. Повернення коштів на картку, з якої ви оплачували, передано в обробку. Строк зарахування залежить від банку.']
    : order.status === 'CANCELLED' ? ['Замовлення скасовано', paid ? 'Замовлення залишиться в історії.' : 'Оплату не здійснено. Замовлення залишиться в історії.']
    : received ? ['Дякуємо за замовлення!', checkout?.delivery.method === 'courier' ? 'Ви отримали замовлення від кур’єра.' : 'Ви отримали замовлення в аптеці.']
    : failed ? ['Не вдалося підтвердити оплату', 'Замовлення збережено. Повторіть оплату або поверніться до нього пізніше.']
    : order.status === 'SHIPPED' ? ['Замовлення передано кур’єру', 'Очікуйте дзвінка кур’єра для уточнення часу доставки.']
    : order.status === 'READY_FOR_PICKUP' ? ['Замовлення готове до видачі', 'Заберіть товари в обраній аптеці та назвіть номер замовлення.']
    : paid ? ['Оплату підтверджено', 'Замовлення готується до отримання. Статус можна перевіряти в «Мої замовлення».']
    : order.status === 'CONFIRMED' ? ['Замовлення підтверджено', 'Статус отримання буде оновлено після підготовки замовлення.']
    : ['Замовлення прийнято', 'Замовлення прийнято. Аптека перевіряє наявність товарів і готує замовлення до видачі або доставки.'];
  return { paid, refund, failed, state: noticeState, badgeState, title, description, payment, badge: failed ? 'Помилка оплати' : orderStatusLabels[order.status], totalLabel: refund ? 'До повернення' : order.status === 'CANCELLED' ? 'Сума замовлення' : paid || (received && checkout?.payment === 'on-receipt') ? 'Сплачено' : 'До сплати' };
}
