import request from 'supertest';
import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { connectDb, disconnectDb } from '../src/db/connection';
import { orderCount, resetDatabase, stockOf, type SeededProducts } from './helpers';

const app = createApp();
let p: SeededProducts;

beforeEach(async () => {
  p = await resetDatabase();
});

beforeAll(async () => {
  await connectDb();
});

afterAll(async () => {
  await disconnectDb();
});

const placeOrder = (items: { productId: string; quantity: number }[], customerName = 'Test Customer') =>
  request(app).post('/api/orders').send({ customerName, items });

const setStatus = (orderId: string, status: string) =>
  request(app).patch(`/api/orders/${orderId}/status`).send({ status });

describe('POST /api/orders — placement', () => {
  it('places a multi-item order, deducts stock and computes the total', async () => {
    const res = await placeOrder([
      { productId: p.A, quantity: 2 },
      { productId: p.C, quantity: 3 },
    ]);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      reference: 'ORD-001001',
      status: 'PLACED',
      totalCents: 2 * 1000 + 3 * 450,
      itemCount: 5,
      allowedTransitions: ['PACKED', 'CANCELLED'],
    });
    expect(res.body.data.items).toHaveLength(2);
    expect(await stockOf(p.A)).toBe(3);
    expect(await stockOf(p.C)).toBe(7);
    expect(await orderCount()).toBe(1);

    // The stored order is what the API returns.
    const fetched = await request(app).get(`/api/orders/${res.body.data.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.totalCents).toBe(res.body.data.totalCents);
  });

  it('merges duplicate lines for the same product', async () => {
    const res = await placeOrder([
      { productId: p.A, quantity: 1 },
      { productId: p.A, quantity: 2 },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.data.items).toEqual([expect.objectContaining({ productId: p.A, quantity: 3 })]);
    expect(await stockOf(p.A)).toBe(2);
  });

  it('allows ordering exactly the remaining stock', async () => {
    const res = await placeOrder([{ productId: p.A, quantity: 5 }]);
    expect(res.status).toBe(201);
    expect(await stockOf(p.A)).toBe(0);
  });
});

describe('POST /api/orders — insufficient stock', () => {
  it('acceptance: 2 x A + 1 x B (B has 0) fails; A still has 5 and no order is created', async () => {
    const res = await placeOrder([
      { productId: p.A, quantity: 2 },
      { productId: p.B, quantity: 1 },
    ]);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.message).toContain('Product B');
    expect(res.body.error.details.shortages).toEqual([
      expect.objectContaining({ productId: p.B, requested: 1, available: 0 }),
    ]);
    expect(await stockOf(p.A)).toBe(5);
    expect(await stockOf(p.B)).toBe(0);
    expect(await orderCount()).toBe(0);
  });

  it('rejects a quantity larger than available stock', async () => {
    const res = await placeOrder([{ productId: p.A, quantity: 6 }]);
    expect(res.status).toBe(409);
    expect(await stockOf(p.A)).toBe(5);
    expect(await orderCount()).toBe(0);
  });

  it('never oversells under concurrent orders', async () => {
    const results = await Promise.all([
      placeOrder([{ productId: p.A, quantity: 3 }]),
      placeOrder([{ productId: p.A, quantity: 3 }]),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(await stockOf(p.A)).toBe(2);
    expect(await orderCount()).toBe(1);
  });

  it('rejects unknown products without changing anything', async () => {
    const res = await placeOrder([
      { productId: p.A, quantity: 1 },
      { productId: new Types.ObjectId().toString(), quantity: 1 },
    ]);
    expect(res.status).toBe(422);
    expect(await stockOf(p.A)).toBe(5);
    expect(await orderCount()).toBe(0);
  });
});

describe('POST /api/orders — request validation', () => {
  it.each([
    ['empty item list', { customerName: 'X', items: [] }],
    ['missing customer name', { customerName: '  ', items: [{ productId: 1, quantity: 1 }] }],
    ['zero quantity', { customerName: 'X', items: [{ productId: 1, quantity: 0 }] }],
    ['fractional quantity', { customerName: 'X', items: [{ productId: 1, quantity: 1.5 }] }],
    ['string quantity', { customerName: 'X', items: [{ productId: 1, quantity: '2' }] }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await request(app).post('/api/orders').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await orderCount()).toBe(0);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app).post('/api/orders').set('Content-Type', 'application/json').send('{"bad"');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('PATCH /api/orders/:id/status — fulfilment', () => {
  it('follows Placed -> Packed -> Shipped and records history', async () => {
    const { body } = await placeOrder([{ productId: p.A, quantity: 1 }]);
    const id = body.data.id;

    expect((await setStatus(id, 'PACKED')).body.data.status).toBe('PACKED');
    const shipped = await setStatus(id, 'SHIPPED');
    expect(shipped.status).toBe(200);
    expect(shipped.body.data.status).toBe('SHIPPED');
    expect(shipped.body.data.allowedTransitions).toEqual([]);
    expect(shipped.body.data.history.map((h: { toStatus: string }) => h.toStatus)).toEqual(['PLACED', 'PACKED', 'SHIPPED']);
    expect(await stockOf(p.A)).toBe(4); // shipping does not touch stock
  });

  it('rejects skipping a step (Placed -> Shipped) and leaves the order unchanged', async () => {
    const { body } = await placeOrder([{ productId: p.A, quantity: 1 }]);
    const res = await setStatus(body.data.id, 'SHIPPED');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    expect(res.body.error.details).toEqual({ from: 'PLACED', to: 'SHIPPED', allowed: ['PACKED', 'CANCELLED'] });
    const after = await request(app).get(`/api/orders/${body.data.id}`);
    expect(after.body.data.status).toBe('PLACED');
  });

  it.each([
    ['SHIPPED', 'CANCELLED'],
    ['SHIPPED', 'PACKED'],
    ['PACKED', 'PLACED'],
    ['CANCELLED', 'PACKED'],
  ])('rejects %s -> %s', async (from, to) => {
    const { body } = await placeOrder([{ productId: p.A, quantity: 1 }]);
    const id = body.data.id;
    const path: Record<string, string[]> = {
      SHIPPED: ['PACKED', 'SHIPPED'],
      PACKED: ['PACKED'],
      CANCELLED: ['CANCELLED'],
    };
    for (const s of path[from]) expect((await setStatus(id, s)).status).toBe(200);

    const res = await setStatus(id, to);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('rejects an unknown status value with 400', async () => {
    const { body } = await placeOrder([{ productId: p.A, quantity: 1 }]);
    const res = await setStatus(body.data.id, 'DELIVERED');
    expect(res.status).toBe(400);
  });

  it('returns 404 for a missing order', async () => {
    const res = await setStatus(new Types.ObjectId().toString(), 'PACKED');
    expect(res.status).toBe(404);
  });
});

describe('Cancellation and stock restoration', () => {
  it('acceptance: cancel restores stock to 5; repeating the cancel does not increase it again', async () => {
    const { body } = await placeOrder([{ productId: p.A, quantity: 2 }]);
    expect(await stockOf(p.A)).toBe(3);

    const first = await setStatus(body.data.id, 'CANCELLED');
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe('CANCELLED');
    expect(await stockOf(p.A)).toBe(5);

    const second = await setStatus(body.data.id, 'CANCELLED');
    expect(second.status).toBe(409);
    expect(second.body.error.message).toContain('already Cancelled');
    expect(await stockOf(p.A)).toBe(5);
  });

  it('can cancel from Packed and restores stock', async () => {
    const { body } = await placeOrder([
      { productId: p.A, quantity: 2 },
      { productId: p.C, quantity: 4 },
    ]);
    await setStatus(body.data.id, 'PACKED');
    const res = await setStatus(body.data.id, 'CANCELLED');
    expect(res.status).toBe(200);
    expect(await stockOf(p.A)).toBe(5);
    expect(await stockOf(p.C)).toBe(10);
  });

  it('restores stock exactly once under concurrent cancellations', async () => {
    const { body } = await placeOrder([{ productId: p.A, quantity: 2 }]);
    const results = await Promise.all(Array.from({ length: 5 }, () => setStatus(body.data.id, 'CANCELLED')));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await stockOf(p.A)).toBe(5);
  });
});

describe('GET /api/orders — search and filter', () => {
  it('searches by reference and filters by status', async () => {
    const o1 = (await placeOrder([{ productId: p.A, quantity: 1 }], 'Alice')).body.data;
    const o2 = (await placeOrder([{ productId: p.C, quantity: 1 }], 'Bob')).body.data;
    await setStatus(o2.id, 'PACKED');

    const byRef = await request(app).get('/api/orders').query({ search: o1.reference });
    expect(byRef.body.data.map((o: { id: string }) => o.id)).toEqual([o1.id]);

    const packed = await request(app).get('/api/orders').query({ status: 'PACKED' });
    expect(packed.body.data.map((o: { id: string }) => o.id)).toEqual([o2.id]);
    expect(packed.body.statusCounts).toMatchObject({ ALL: 2, PLACED: 1, PACKED: 1 });

    const bad = await request(app).get('/api/orders').query({ status: 'NOPE' });
    expect(bad.status).toBe(400);
  });
});
