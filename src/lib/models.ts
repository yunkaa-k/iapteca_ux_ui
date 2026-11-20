import { model, models, Schema } from 'mongoose';
import { User, Medication, Order, OrderItem, Category } from './types';

const userSchema = new Schema<User>({
  phone: { type: String },
  email: { type: String, trim: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String },
  role: { type: String, enum: ['CUSTOMER', 'ADMIN'], default: 'CUSTOMER' },
  isBanned: { type: Boolean, default: false },
  privacyAcceptedAt: { type: Date },
}, { timestamps: true });

userSchema.index({ phone: 1 }, { name: 'phone_unique_present', unique: true, partialFilterExpression: { phone: { $type: 'string' } } });
userSchema.index({ email: 1 }, { name: 'email_unique_present', unique: true, partialFilterExpression: { email: { $type: 'string' } } });

const sessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  user: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});

const categorySchema = new Schema<Category>({
  name: { type: String, required: true, unique: true },
}, { timestamps: true });

const medicationSchema = new Schema<Medication>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  category: { type: String, required: true },
  manufacturer: { type: String, required: true },
  image: { type: String },
  isDeleted: { type: Boolean, default: false },
  dosageForm: { type: String, enum: ['tablets', 'capsules', 'suspensions', 'powders', 'ointments', 'dragees'] },
  dosage: { type: String },
  packSize: { type: Number, min: 1 },
  requiresPrescription: { type: Boolean },
  activeIngredient: { type: String },
  country: { type: String },
  atcCode: { type: String },
  brand: { type: String },
  ageGroup: { type: String },
  packageType: { type: String },
  onSale: { type: Boolean },
}, { timestamps: true });

const orderItemSchema = new Schema<OrderItem>({
  medication: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
});

const orderSchema = new Schema<Order>({
  user: { type: String, required: true },
  items: { type: [orderItemSchema], required: true },
  total: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'], default: 'PENDING' },
}, { timestamps: true });

export const UserModel = models.User || model<User>('User', userSchema);
export const UserSessionModel = models.UserSession || model('UserSession', sessionSchema);
export const CategoryModel = models.Category || model<Category>('Category', categorySchema);
export const MedicationModel = models.Medication || model<Medication>('Medication', medicationSchema);
export const OrderModel = models.Order || model<Order>('Order', orderSchema);

