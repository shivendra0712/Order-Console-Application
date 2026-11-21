import { clearDatabase } from '../src/db/connection';
import { Order } from '../src/models/Order';
import { Product } from '../src/models/Product';

export interface SeededProducts {
  A: string; // 5 units  @ $10.00
  B: string; // 0 units  @ $25.00 (out of stock)
  C: string; // 10 units @ $4.50
}

/** Wipes the test database and inserts a small, known catalogue. */
export async function resetDatabase(): Promise<SeededProducts> {
  await clearDatabase();
  const products = await Product.insertMany([
    { sku: 'A', name: 'Product A', category: 'Test', priceCents: 1000, stock: 5 },
    { sku: 'B', name: 'Product B', category: 'Test', priceCents: 2500, stock: 0 },
    { sku: 'C', name: 'Product C', category: 'Test', priceCents: 450, stock: 10 },
  ]);
  const id = (sku: string) => products.find((p) => p.sku === sku)!._id.toString();
  return { A: id('A'), B: id('B'), C: id('C') };
}

export async function stockOf(productId: string): Promise<number> {
  const product = await Product.findById(productId).lean();
  return product!.stock;
}

export async function orderCount(): Promise<number> {
  return Order.countDocuments();
}
