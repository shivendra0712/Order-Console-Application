import type { OrderStatus } from '../types';

export const STATUS_ORDER: OrderStatus[] = ['PLACED', 'PACKED', 'SHIPPED', 'CANCELLED'];

export const STATUS_META: Record<
  OrderStatus,
  { label: string; badge: string; dot: string; bar: string; actionLabel: string }
> = {
  PLACED: {
    label: 'Placed',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    dot: 'bg-amber-500',
    bar: 'bg-amber-400',
    actionLabel: 'Mark as placed',
  },
  PACKED: {
    label: 'Packed',
    badge: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    dot: 'bg-sky-500',
    bar: 'bg-sky-500',
    actionLabel: 'Mark as packed',
  },
  SHIPPED: {
    label: 'Shipped',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    actionLabel: 'Mark as shipped',
  },
  CANCELLED: {
    label: 'Cancelled',
    badge: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    dot: 'bg-slate-400',
    bar: 'bg-slate-300',
    actionLabel: 'Cancel order',
  },
};

export const LOW_STOCK_THRESHOLD = 5;
