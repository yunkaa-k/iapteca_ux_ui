'use client';
import { useCartStore } from '@/lib/store/cartStore';
import { useAuthStore } from '@/lib/store/authStore';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useHydrated } from '@/lib/useHydrated';
import { prescriptionsApproved, usePrescriptionStore } from '@/lib/store/prescriptionStore';

export default function CheckoutPage() {
  const { items, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const hydrated = useHydrated();
  const prescriptions = usePrescriptionStore(state => state.entries);
  const subtotal = items.reduce((a, i) => a + i.price * i.quantity, 0);

  const total = subtotal;

  const handleOrder = async () => {
    if (!prescriptionsApproved(items, usePrescriptionStore.getState().entries)) return router.push('/cart/prescription');
    if (!user) return router.push('/login');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ medication: i._id, quantity: i.quantity, price: i.price })),
          total: subtotal,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Замовлення успішно створено');
        clearCart();
        usePrescriptionStore.getState().clear();
        router.push('/profile');
      } else {
        toast.error(data.error || 'Помилка при створенні замовлення');
      }
    } catch {
      toast.error('Сталася мережева помилка');
    }
  };

  if (!hydrated) return <div className="p-20 text-center" role="status">Завантажуємо замовлення…</div>;
  if (items.length === 0) return <div className="p-20 text-center opacity-50 font-sans">Кошик порожній</div>;
  if (!prescriptionsApproved(items, prescriptions)) return <div className="container mx-auto py-12 px-4 max-w-lg space-y-6"><h1 className="text-2xl font-bold">Потрібна перевірка рецепта</h1><p>Перед оформленням додайте рецепт для кожного рецептурного препарату.</p><Button asChild><Link href="/cart/prescription">Перейти до перевірки рецепта</Link></Button></div>;

  return (
    <div className="container mx-auto py-8 px-4 max-w-lg space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="w-6 h-6" /> Оформлення замовлення</h1>
      <div className="border rounded-xl p-6 space-y-4 shadow-sm bg-card">
        <div className="space-y-2">
          {items.map(i => (
            <div key={i._id} className="flex justify-between text-sm">
              <span className="opacity-80">{i.name} x{i.quantity}</span>
              <span className="font-medium">{i.price * i.quantity} ₴</span>
            </div>
          ))}
        </div>

        <div className="border-t pt-4 font-bold flex justify-between text-lg">
          <span>Разом:</span>
          <span className="text-primary">{total} ₴</span>
        </div>
      </div>
      <Button className="w-full h-12 text-lg font-bold shadow-lg" onClick={handleOrder}>
        <CheckCircle2 className="w-5 h-5 mr-2" /> Підтвердити замовлення
      </Button>
    </div>
  );
}

