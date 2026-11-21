import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { ORDER_STATUSES } from '../domain/orderStatus';

// Snapshot of the product at the time of the order, so history never changes
// when a product is renamed or repriced later.
const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    unitPriceCents: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const statusChangeSchema = new Schema(
  {
    fromStatus: { type: String, enum: [...ORDER_STATUSES, null], default: null },
    toStatus: { type: String, enum: ORDER_STATUSES, required: true },
    changedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, default: null },
    notes: { type: String, default: null },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: 'PLACED', index: true },
    totalCents: { type: Number, required: true, min: 0 },
    itemCount: { type: Number, required: true, min: 1 },
    items: { type: [orderItemSchema], required: true },
    history: { type: [statusChangeSchema], default: [] },
  },
  { timestamps: true },
);

orderSchema.index({ createdAt: -1, _id: -1 });

export type OrderDoc = InferSchemaType<typeof orderSchema> & { _id: Types.ObjectId };
export const Order = model('Order', orderSchema);
