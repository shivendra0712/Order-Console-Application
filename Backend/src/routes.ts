import { Router } from 'express';
import { notFound } from './errors';
import { getDashboardSummary } from './services/dashboardService';
import { changeOrderStatus, getOrderById, listOrders, placeOrder } from './services/orderService';
import { listProducts } from './services/productService';
import { createOrderSchema, idParamSchema, listOrdersQuerySchema, updateStatusSchema } from './validation';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

router.get('/products', async (_req, res) => {
  res.json({ data: await listProducts() });
});

router.get('/dashboard', async (_req, res) => {
  res.json(await getDashboardSummary());
});

router.get('/orders', async (req, res) => {
  const query = listOrdersQuerySchema.parse(req.query);
  res.json(await listOrders(query));
});

router.get('/orders/:id', async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const order = await getOrderById(id);
  if (!order) throw notFound(`Order ${id} was not found.`);
  res.json({ data: order });
});

router.post('/orders', async (req, res) => {
  const input = createOrderSchema.parse(req.body);
  const order = await placeOrder(input);
  res.status(201).json({ data: order });
});

router.patch('/orders/:id/status', async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const { status } = updateStatusSchema.parse(req.body);
  res.json({ data: await changeOrderStatus(id, status) });
});
