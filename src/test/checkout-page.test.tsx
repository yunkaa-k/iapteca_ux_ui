import { afterEach, describe, expect, it, vi } from 'vitest';
import CheckoutPage from '@/app/checkout/page';

vi.mock('@/components/CheckoutContent', () => ({ CheckoutContent: () => null }));
afterEach(() => vi.unstubAllEnvs());

describe('checkout preview routing', () => {
  it.each([
    ['development', 'unavailable', true],
    ['development', undefined, false],
    ['development', 'unknown', false],
    ['production', 'unavailable', false],
  ] as const)('only enables an explicit local preview: %s, %s', async (environment, pickup, expected) => {
    vi.stubEnv('NODE_ENV', environment);
    const page = await CheckoutPage({ searchParams: Promise.resolve({ pickup, request: 'saved-request' }) });
    expect(page.props.pickupUnavailablePreview).toBe(expected);
    expect(page.props.requestId).toBe('saved-request');
  });
});
