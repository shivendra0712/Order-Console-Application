import type { ClientSession } from 'mongoose';
import { withTransaction } from '../db/connection';
import { ALLOWED_TRANSITIONS, STATUS_LABELS, canTransition, type OrderStatus } from '../domain/orderStatus';
import { AppError, notFound } from '../errors';
import { nextOrderReference } from '../models/Counter';
import { Order, type OrderDoc } from '../models/Order';
import { Product, type ProductDoc } from '../models/Product';
import type { CreateOrderInput, ListOrdersQuery } from '../validation';

export interface OrderSummary {
  id: string;
  reference: string;
  customerName: string;
  status: OrderStatus;
  totalCents: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetail extends OrderSummary {
  customerPhone: string | null;
  notes: string | null;
  items: {
    productId: string;
    productName: string;
    sku: string;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }[];
  history: { fromStatus: OrderStatus | null; toStatus: OrderStatus; changedAt: string }[];
  allowedTransitions: readonly OrderStatus[];
}

export interface StockShortage {
  productId: string;
  sku: string;
  name: string;
  requested: number;
  available: number;
}

const formatList = (labels: string[]) => (labels.length ? labels.join(', ') : 'none (final state)');

const toSummary = (o: OrderDoc): OrderSummary => ({
  id: o._id.toString(),
  reference: o.reference,
  customerName: o.customerName,
  status: o.status as OrderStatus,
  totalCents: o.totalCents,
  itemCount: o.itemCount,
  createdAt: o.createdAt.toISOString(),
  updatedAt: o.updatedAt.toISOString(),
});

const toDetail = (o: OrderDoc): OrderDetail => ({
  ...toSummary(o),
  customerPhone: o.customerPhone ?? null,
  notes: o.notes ?? null,
  items: o.items.map((i) => ({
    productId: i.productId.toString(),
    productName: i.productName,
    sku: i.sku,
    unitPriceCents: i.unitPriceCents,
    quantity: i.quantity,
    lineTotalCents: i.lineTotalCents,
  })),
  history: o.history.map((h) => ({
    fromStatus: (h.fromStatus ?? null) as OrderStatus | null,
    toStatus: h.toStatus as OrderStatus,
    changedAt: h.changedAt.toISOString(),
  })),
  allowedTransitions: ALLOWED_TRANSITIONS[o.status as OrderStatus],
});

// ---------------------------------------------------------------------------
// Place order
// ---------------------------------------------------------------------------

/**
 * Places an order in a single MongoDB transaction. All lines are checked first;
 * if ANY line is short, the transaction aborts and nothing is written. Each
 * decrement is also guarded by { stock: { $gte: qty } }, and concurrent orders
 * for the same product hit a write conflict that makes MongoDB retry the whole
 * transaction against fresh stock — so stock can never be oversold.
 */
export async function placeOrder(input: CreateOrderInput): Promise<OrderDetail> {
  // Merge duplicate lines for the same product (e.g. 1 x A + 2 x A => 3 x A).
  const requested = new Map<string, number>();
  for (const item of input.items) {
    requested.set(item.productId, (requested.get(item.productId) ?? 0) + item.quantity);
  }
  const productIds = [...requested.keys()];

  return withTransaction(async (session) => {
    const products = await Product.find({ _id: { $in: productIds } })
      .session(session)
      .lean<ProductDoc[]>();
    const byId = new Map(products.map((p) => [p._id.toString(), p]));

    const missing = productIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new AppError(422, 'PRODUCT_NOT_FOUND', `Unknown product id(s): ${missing.join(', ')}. The order was not placed.`, {
        productIds: missing,
      });
    }

    const shortages: StockShortage[] = [];
    for (const id of productIds) {
      const product = byId.get(id)!;
      const qty = requested.get(id)!;
      if (product.stock < qty) {
        shortages.push({ productId: id, sku: product.sku, name: product.name, requested: qty, available: product.stock });
      }
    }
    if (shortages.length > 0) {
      const summary = shortages.map((s) => `${s.name} (requested ${s.requested}, available ${s.available})`).join('; ');
      throw new AppError(409, 'INSUFFICIENT_STOCK', `Order rejected — not enough stock for: ${summary}. No stock was changed.`, {
        shortages,
      });
    }

    const items = productIds.map((id) => {
      const p = byId.get(id)!;
      const quantity = requested.get(id)!;
      return {
        productId: p._id,
        productName: p.name,
        sku: p.sku,
        unitPriceCents: p.priceCents,
        quantity,
        lineTotalCents: p.priceCents * quantity,
      };
    });

    for (const item of items) {
      const result = await Product.updateOne(
        { _id: item.productId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { session },
      );
      if (result.modifiedCount !== 1) {
        // Defensive: only reachable if stock changed after it was read.
        throw new AppError(409, 'INSUFFICIENT_STOCK', `Stock for ${item.productName} changed while placing the order. No stock was changed.`);
      }
    }

    const [order] = await Order.create(
      [
        {
          reference: await nextOrderReference(session),
          customerName: input.customerName,
          customerPhone: input.customerPhone || null,
          notes: input.notes || null,
          status: 'PLACED',
          totalCents: items.reduce((sum, i) => sum + i.lineTotalCents, 0),
          itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
          items,
          history: [{ fromStatus: null, toStatus: 'PLACED', changedAt: new Date() }],
        },
      ],
      { session },
    );
    return toDetail(order.toObject() as OrderDoc);
  });
}

// ---------------------------------------------------------------------------
// Change status
// ---------------------------------------------------------------------------

/**
 * Moves an order to a new status. The status update is conditional on the
 * status we just validated ({ status: from }), and runs in the same transaction
 * as the stock restore. So a cancellation can only ever succeed once: a second
 * (or concurrent) attempt sees CANCELLED, is rejected, and never restores stock.
 */
export async function changeOrderStatus(orderId: string, to: OrderStatus): Promise<OrderDetail> {
  return withTransaction(async (session: ClientSession) => {
    const order = await Order.findById(orderId).session(session).lean<OrderDoc>();
    if (!order) throw notFound(`Order ${orderId} was not found.`);

    const from = order.status as OrderStatus;
    if (!canTransition(from, to)) {
      const allowed = ALLOWED_TRANSITIONS[from];
      const message =
        from === to
          ? `Order ${order.reference} is already ${STATUS_LABELS[to]}.`
          : `Cannot change order ${order.reference} from ${STATUS_LABELS[from]} to ${STATUS_LABELS[to]}. ` +
            `Allowed next status: ${formatList(allowed.map((s) => STATUS_LABELS[s]))}.`;
      throw new AppError(409, 'INVALID_STATUS_TRANSITION', message, { from, to, allowed });
    }

    const updated = await Order.findOneAndUpdate(
      { _id: orderId, status: from },
      { $set: { status: to }, $push: { history: { fromStatus: from, toStatus: to, changedAt: new Date() } } },
      { session, returnDocument: 'after' },
    ).lean<OrderDoc>();
    if (!updated) {
      throw new AppError(409, 'INVALID_STATUS_TRANSITION', `Order ${order.reference} was changed by someone else. Reload and try again.`);
    }

    if (to === 'CANCELLED') {
      // Restore exactly the quantities that were deducted at placement.
      await Product.bulkWrite(
        order.items.map((item) => ({
          updateOne: { filter: { _id: item.productId }, update: { $inc: { stock: item.quantity } } },
        })),
        { session },
      );
    }

    return toDetail(updated);
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getOrderById(orderId: string): Promise<OrderDetail | null> {
  const order = await Order.findById(orderId).lean<OrderDoc>();
  return order ? toDetail(order) : null;
}

export interface OrderListResult {
  data: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<OrderStatus | 'ALL', number>;
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listOrders(query: ListOrdersQuery): Promise<OrderListResult> {
  const searchFilter: Record<string, unknown> = {};
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    searchFilter.$or = [{ reference: pattern }, { customerName: pattern }];
  }

  // Counts per status respect the search term but not the status filter, so
  // the UI can show "Placed (3)" etc. on its filter tabs.
  const counts = await Order.aggregate<{ _id: OrderStatus; count: number }>([
    { $match: searchFilter },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const statusCounts: OrderListResult['statusCounts'] = { ALL: 0, PLACED: 0, PACKED: 0, SHIPPED: 0, CANCELLED: 0 };
  for (const c of counts) {
    statusCounts[c._id] = c.count;
    statusCounts.ALL += c.count;
  }

  const filter = query.status ? { ...searchFilter, status: query.status } : searchFilter;
  const orders = await Order.find(filter)
    .select('-items -history')
    .sort({ createdAt: -1, _id: -1 })
    .skip((query.page - 1) * query.pageSize)
    .limit(query.pageSize)
    .lean<OrderDoc[]>();

  return {
    data: orders.map(toSummary),
    total: query.status ? statusCounts[query.status] : statusCounts.ALL,
    page: query.page,
    pageSize: query.pageSize,
    statusCounts,
  };
}

