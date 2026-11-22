import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileAccount } from '@/components/ProfileAccount';
import { useAuthStore } from '@/lib/store/authStore';
import { useCartStore } from '@/lib/store/cartStore';
import { useFavoritesStore } from '@/lib/store/favoritesStore';

const navigation = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
const user = { _id: 'test-owner', name: 'Тест', role: 'CUSTOMER' as const, isBanned: false };
const medication = { _id: 'test-item', name: 'Тест', description: '', category: '', manufacturer: '', stock: 2, price: 10 };

beforeEach(() => {
  useAuthStore.getState().setUser(user);
  useCartStore.setState({ items: [{ ...medication, quantity: 1 }] });
  useFavoritesStore.setState({ items: [{ medication }] });
});
afterEach(() => { cleanup(); useAuthStore.getState().setUser(null); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function openDialog() {
  render(<ProfileAccount user={user}><p>Замовлення</p></ProfileAccount>);
  const trigger = screen.getByRole('button', { name: 'Вийти з акаунта' });
  fireEvent.click(trigger);
  return { dialog: screen.getByRole('dialog', { name: 'Вийти з акаунта?' }), trigger };
}

describe('account logout confirmation', () => {
  it('does not send a request when staying and restores focus to the trigger', async () => {
    const request = vi.fn(); vi.stubGlobal('fetch', request);
    const { dialog, trigger } = openDialog();
    const stay = within(dialog).getByRole('button', { name: 'Залишитися' });
    expect(stay).toHaveFocus();
    fireEvent.click(stay);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(request).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(user);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('allows dismissing with Escape without logging out', async () => {
    const request = vi.fn(); vi.stubGlobal('fetch', request);
    const { trigger } = openDialog();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(request).not.toHaveBeenCalled();
  });

  it('sends one logout request and preserves cart and favorites after success', async () => {
    let complete!: (value: { ok: boolean }) => void;
    const request = vi.fn(() => new Promise(resolve => { complete = resolve; }));
    vi.stubGlobal('fetch', request);
    const { dialog } = openDialog();
    const confirm = within(dialog).getByRole('button', { name: 'Вийти' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Залишитися' })).toBeDisabled();
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/auth/logout', { method: 'POST' });
    complete({ ok: true });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
    expect(navigation.refresh).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useFavoritesStore.getState().items).toHaveLength(1);
  });

  it.each(['server', 'network'])('keeps the session and supports retry after a %s failure', async failure => {
    const request = vi.fn();
    if (failure === 'server') request.mockResolvedValueOnce({ ok: false });
    else request.mockRejectedValueOnce(new Error('offline'));
    request.mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', request);
    const { dialog } = openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Вийти' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не вдалося вийти. Спробуйте ще раз.');
    expect(useAuthStore.getState().user).toEqual(user);
    expect(navigation.replace).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Вийти' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
    expect(request).toHaveBeenCalledTimes(2);
  });
});
