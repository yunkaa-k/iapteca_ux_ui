import { model, models, Schema } from 'mongoose';
import { User, Medication, Order, OrderItem, Category, Bundle } from './types';

const userSchema = new Schema<User>({
  phone: { type: String },
  email: { type: String, trim: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String },
  firstName: { type: String },
  lastName: { type: String },
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
  inventoryOnly: { type: Boolean, default: false },
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  category: { type: String, required: true },
  manufacturer: { type: String, required: true },
  image: { type: String },
  isDeleted: { type: Boolean, default: false },
  dosageForm: { type: String, enum: ['tablets', 'capsules', 'suspensions', 'powders', 'ointments', 'dragees'] },
  dosageFormDetails: { type: String },
  packageDescription: { type: String },
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
  kind: { type: String, enum: ['bundle'] },
  name: String, description: String, image: String, slug: String,
  components: { type: [new Schema({ medication: { type: String, required: true }, quantity: { type: Number, required: true, min: 1 }, name: String }, { _id: false })], default: undefined },
});

const bundleSchema = new Schema<Bundle>({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true }, description: { type: String, required: true }, purpose: String,
  price: { type: Number, required: true, min: 0 }, image: String,
  components: { type: [new Schema({ medication: { type: String, required: true }, quantity: { type: Number, required: true, min: 1 }, name: { type: String, required: true } }, { _id: false })], default: [] },
  compositionConfirmed: { type: Boolean, default: false }, isDeleted: { type: Boolean, default: false },
}, { timestamps: true });
export const BundleModel = models.Bundle || model<Bundle>('Bundle', bundleSchema);

const orderSchema = new Schema<Order>({
  user: { type: String },
  guestPaymentTokenHash: { type: String, select: false },
  submissionHash: { type: String, select: false },
  items: { type: [orderItemSchema], required: true },
  total: { type: Number, required: true, min: 0 },
  subtotal: { type: Number, min: 0 },
  checkout: {
    type: new Schema({
      contact: { name: String, phone: String, email: String },
      delivery: { method: { type: String, enum: ['pickup', 'courier'] }, pharmacyId: String, pharmacyName: String, city: String, address: String, fee: { type: Number, min: 0 } },
      payment: { type: String, enum: ['on-receipt', 'online-after-confirmation', 'online'] },
      paymentMode: { type: String, enum: ['demo'] },
      demoPaymentStatus: { type: String, enum: ['paid', 'failed'] },
      demoRefundStatus: { type: String, enum: ['pending'] },
    }, { _id: false }),
    required: false,
  },
  status: { type: String, enum: ['PENDING', 'CONFIRMED', 'READY_FOR_PICKUP', 'SHIPPED', 'COMPLETED', 'CANCELLED'], default: 'PENDING' },
}, { timestamps: true });

export const UserModel = models.User || model<User>('User', userSchema);
export const UserSessionModel = models.UserSession || model('UserSession', sessionSchema);
export const CategoryModel = models.Category || model<Category>('Category', categorySchema);
export const MedicationModel = models.Medication || model<Medication>('Medication', medicationSchema);
export const OrderModel = models.Order || model<Order>('Order', orderSchema);

