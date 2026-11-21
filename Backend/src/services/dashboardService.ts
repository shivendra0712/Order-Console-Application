import type { OrderStatus } from '../domain/orderStatus';
import { Order, type OrderDoc } from '../models/Order';
import { Product, type ProductDoc } from '../models/Product';

export const LOW_STOCK_THRESHOLD = 5;
const DAYS = 7;

const localDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function getDashboardSummary() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWindow = new Date(startOfToday);
  startOfWindow.setDate(startOfWindow.getDate() - (DAYS - 1));

  const [totals, byStatus, windowOrders, lowStock, topProducts, recent, stock] = await Promise.all([
    Order.aggregate<{ totalOrders: number; revenueCents: number; paidOrders: number }>([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          revenueCents: { $sum: { $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$totalCents', 0] } },
          paidOrders: { $sum: { $cond: [{ $ne: ['$status', 'CANCELLED'] }, 1, 0] } },
        },
      },
    ]),
    Order.aggregate<{ _id: OrderStatus; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.find({ createdAt: { $gte: startOfWindow } })
      .select('status totalCents createdAt')
      .lean<Pick<OrderDoc, 'status' | 'totalCents' | 'createdAt'>[]>(),
    Product.find({ stock: { $lte: LOW_STOCK_THRESHOLD } })
      .sort({ stock: 1, name: 1 })
      .lean<ProductDoc[]>(),
    Order.aggregate<{ _id: unknown; name: string; units: number; revenueCents: number }>([
      { $match: { status: { $ne: 'CANCELLED' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.productName' },
          units: { $sum: '$items.quantity' },
          revenueCents: { $sum: '$items.lineTotalCents' },
        },
      },
      { $sort: { units: -1, revenueCents: -1 } },
      { $limit: 5 },
    ]),
    Order.find().select('-items -history').sort({ createdAt: -1, _id: -1 }).limit(6).lean<OrderDoc[]>(),
    Product.aggregate<{ units: number; count: number }>([
      { $group: { _id: null, units: { $sum: '$stock' }, count: { $sum: 1 } } },
    ]),
  ]);

  const statusCounts: Record<OrderStatus, number> = { PLACED: 0, PACKED: 0, SHIPPED: 0, CANCELLED: 0 };
  for (const s of byStatus) statusCounts[s._id] = s.count;

  // 7-day series (server's local days), including days with no orders.
  const daily = new Map<string, { orders: number; revenueCents: number }>();
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(startOfWindow);
    d.setDate(d.getDate() + i);
    daily.set(localDayKey(d), { orders: 0, revenueCents: 0 });
  }
  let ordersToday = 0;
  let revenueTodayCents = 0;
  for (const o of windowOrders) {
    const bucket = daily.get(localDayKey(o.createdAt));
    const revenue = o.status === 'CANCELLED' ? 0 : o.totalCents;
    if (bucket) {
      bucket.orders += 1;
      bucket.revenueCents += revenue;
    }
    if (o.createdAt >= startOfToday) {
      ordersToday += 1;
      revenueTodayCents += revenue;
    }
  }

  const t = totals[0] ?? { totalOrders: 0, revenueCents: 0, paidOrders: 0 };
  return {
    kpis: {
      totalOrders: t.totalOrders,
      revenueCents: t.revenueCents,
      ordersToday,
      revenueTodayCents,
      averageOrderCents: t.paidOrders ? Math.round(t.revenueCents / t.paidOrders) : 0,
      unitsInStock: stock[0]?.units ?? 0,
      productCount: stock[0]?.count ?? 0,
      awaitingPacking: statusCounts.PLACED,
      readyToShip: statusCounts.PACKED,
    },
    statusCounts,
    dailyOrders: [...daily].map(([day, v]) => ({ day, ...v })),
    lowStock: lowStock.map((p) => ({ id: p._id.toString(), sku: p.sku, name: p.name, stock: p.stock })),
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    topProducts: topProducts.map((p) => ({
      productId: String(p._id),
      name: p.name,
      units: p.units,
      revenueCents: p.revenueCents,
    })),
    recentOrders: recent.map((o) => ({
      id: o._id.toString(),
      reference: o.reference,
      customerName: o.customerName,
      status: o.status as OrderStatus,
      totalCents: o.totalCents,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}
