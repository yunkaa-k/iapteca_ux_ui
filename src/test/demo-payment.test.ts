import { describe, expect, it } from 'vitest';
import { demoPaymentOutcome, validateDemoCard } from '@/lib/demo-payment';
import { emptyCheckout, parseCheckout } from '@/lib/checkout';

const date = new Date('2026-11-22T12:00:00Z');
const card = { number: '4242 4242 4242 4242', expiry: '12 / 30', cvv: '123' };
describe('deterministic payment demo', () => {
  it('accepts only two explicit test fixtures and produces both results', () => {
    expect(demoPaymentOutcome(card.number)).toBe('success');
    expect(demoPaymentOutcome('4000000000000002')).toBe('failure');
    expect(demoPaymentOutcome('4111111111111111')).toBeUndefined();
    expect(validateDemoCard(card, date)).toEqual({});
    expect(validateDemoCard({ ...card, expiry: '11/26' }, date)).toEqual({});
    expect(validateDemoCard({ ...card, expiry: '10/26', cvv: '12' }, date)).toHaveProperty('expiry');
    expect(validateDemoCard({ ...card, expiry: '00/30' }, date)).toHaveProperty('expiry');
    expect(validateDemoCard({ ...card, expiry: 'wrong' }, date)).toHaveProperty('expiry');
    expect(validateDemoCard({ ...card, cvv: 'abc' }, date)).toHaveProperty('cvv');
  });
  it('creates payment metadata on the server while discarding card fields and forged paid status', () => {
    const form = { ...emptyCheckout, name: 'Тест', phone: '+380670000000', receiving: 'pickup', pharmacyId: 'center', payment: 'online', demoPaymentOutcome: 'failure', ...card, demoPaymentStatus: 'paid' };
    const { details } = parseCheckout(form);
    expect(details).toMatchObject({ payment: 'online', paymentMode: 'demo', demoPaymentStatus: 'failed' });
    expect(JSON.stringify(details)).not.toContain('4242');
    expect(details).not.toHaveProperty('cvv');
    expect(details).not.toHaveProperty('expiry');
    expect(parseCheckout({ ...form, demoPaymentOutcome: 'invented' }).errors?.payment).toBeTruthy();
    expect(parseCheckout({ ...form, demoPaymentOutcome: undefined }).errors?.payment).toBeTruthy();
  });
});
