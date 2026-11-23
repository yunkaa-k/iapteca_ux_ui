export type UserRole = 'CUSTOMER' | 'ADMIN';
export interface User { _id: string; phone?: string; email?: string; password?: string; name?: string; firstName?: string; lastName?: string; role: UserRole; isBanned: boolean; privacyAcceptedAt?: Date; }
export interface Category { _id: string; name: string; }
export interface Medication { kind?: 'bundle'; slug?: string; inventoryOnly?: boolean; _id: string; name: string; description: string; price: number; stock: number; category: string; manufacturer: string; image?: string; isDeleted?: boolean; dosageForm?: string; dosage?: string; packSize?: number; requiresPrescription?: boolean; activeIngredient?: string; country?: string; atcCode?: string; brand?: string; ageGroup?: string; packageType?: string; onSale?: boolean; }
export interface BundleComponent { medication: string; quantity: number; name: string; }
export interface Bundle { _id: string; slug: string; name: string; description: string; purpose: string; price: number; image: string; components: BundleComponent[]; compositionConfirmed: boolean; isDeleted?: boolean; }
export interface BundleProduct extends Medication { kind: 'bundle'; slug: string; components: BundleComponent[]; compositionConfirmed: boolean; purpose: string; }
export interface OrderItem { medication: string; quantity: number; price: number; kind?: 'bundle'; name?: string; description?: string; image?: string; slug?: string; components?: BundleComponent[]; }
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'READY_FOR_PICKUP' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
export interface Order { _id: string; user?: string; guestPaymentTokenHash?: string; submissionHash?: string; items: OrderItem[]; total: number; subtotal?: number; checkout?: import('./checkout').CheckoutDetails; status: OrderStatus; createdAt: string | Date; }
