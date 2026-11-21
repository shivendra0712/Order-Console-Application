import { z } from 'zod';
import { ORDER_STATUSES } from './domain/orderStatus';

const objectId = (message: string) => z.string().regex(/^[0-9a-fA-F]{24}$/, message);

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required').max(120, 'Customer name is too long'),
  customerPhone: z
    .string()
    .trim()
    .max(30, 'Phone number is too long')
    .regex(/^[0-9+()\-\s]*$/, 'Phone number may only contain digits, spaces and + - ( )')
    .optional(),
  notes: z.string().trim().max(500, 'Notes must be 500 characters or fewer').optional(),
  items: z
    .array(
      z.object({
        productId: objectId('Invalid product id'),
        quantity: z
          .number({ error: 'Quantity must be a number' })
          .int('Quantity must be a whole number')
          .min(1, 'Quantity must be at least 1')
          .max(1000, 'Quantity cannot exceed 1000'),
      }),
    )
    .min(1, 'Add at least one product to the order')
    .max(50, 'An order can contain at most 50 lines'),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES, { error: `Status must be one of: ${ORDER_STATUSES.join(', ')}` }),
});

export const listOrdersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export const idParamSchema = objectId('Invalid order id');
