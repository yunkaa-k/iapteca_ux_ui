// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { OrderModel } from '@/lib/models';
import { emptyCheckout, parseCheckout } from '@/lib/checkout';

describe('checkout parser and existing Mongoose order schema', () => {
  it.each([
    { payment: 'on-receipt', demoPaymentOutcome: undefined, status: undefined },
    { payment: 'online-after-confirmation', demoPaymentOutcome: undefined, status: undefined },
    { payment: 'online', demoPaymentOutcome: 'success', status: 'paid' },
    { payment: 'online', demoPaymentOutcome: 'failure', status: 'failed' },
  ])('preserves $payment / $status without connecting to a database', async fixture => {
    const parsed = parseCheckout({ ...emptyCheckout, name: 'Тест', phone: '+380670000000', receiving: 'pickup', pharmacyId: 'center', payment: fixture.payment, demoPaymentOutcome: fixture.demoPaymentOutcome, cvv: '123', number: '4242424242424242' });
    expect(parsed.errors).toBeUndefined();
    const record = new OrderModel({ items: [{ medication: 'test-medication', quantity: 1, price: 25 }], total: 25, checkout: parsed.details });
    await expect(record.validate()).resolves.toBeUndefined();
    const saved = record.toObject();
    expect(saved.checkout.payment).toBe(fixture.payment);
    expect(saved.checkout.demoPaymentStatus).toBe(fixture.status);
    expect(saved.checkout).not.toHaveProperty('cvv');
    expect(saved.checkout).not.toHaveProperty('number');
  });
});
