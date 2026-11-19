export type UserRole = 'CUSTOMER' | 'ADMIN';
export type DiscountType = 'PERCENTAGE' | 'FIXED';
export interface User { _id: string; phone?: string; email?: string; password?: string; name?: string; role: UserRole; isBanned: boolean; privacyAcceptedAt?: Date; }
export interface Category { _id: string; name: string; }
export interface Medication { _id: string; name: string; description: string; price: number; stock: number; category: string; manufacturer: string; image?: string; isDeleted?: boolean; dosageForm?: string; dosage?: string; packSize?: number; requiresPrescription?: boolean; activeIngredient?: string; country?: string; atcCode?: string; brand?: string; ageGroup?: string; packageType?: string; onSale?: boolean; }
export interface OrderItem { medication: string; quantity: number; price: number; }
export interface Order { _id: string; user: string; items: OrderItem[]; total: number; status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'; promoCode?: string; discount?: number; createdAt: string | Date; }
export interface PromoCode {
  _id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderTotal: number;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  expiresAt: Date | string | null;
}
