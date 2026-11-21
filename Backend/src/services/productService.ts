import { Product, type ProductDoc } from '../models/Product';

export interface ProductDto {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  stock: number;
  updatedAt: string;
}

export const toProductDto = (p: ProductDoc): ProductDto => ({
  id: p._id.toString(),
  sku: p.sku,
  name: p.name,
  description: p.description,
  category: p.category,
  priceCents: p.priceCents,
  stock: p.stock,
  updatedAt: p.updatedAt.toISOString(),
});

export async function listProducts(): Promise<ProductDto[]> {
  const products = await Product.find().sort({ category: 1, name: 1 }).lean<ProductDoc[]>();
  return products.map(toProductDto);
}
