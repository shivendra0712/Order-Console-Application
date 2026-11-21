import { Schema, model, type InferSchemaType } from 'mongoose';

const productSchema = new Schema(
  {
    sku: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'General', index: true },
    priceCents: { type: Number, required: true, min: 0, validate: Number.isInteger },
    // Never negative: placement only decrements with a { stock: { $gte: qty } } guard.
    stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
  },
  { timestamps: true },
);

export type ProductDoc = InferSchemaType<typeof productSchema> & { _id: import('mongoose').Types.ObjectId };
export const Product = model('Product', productSchema);
