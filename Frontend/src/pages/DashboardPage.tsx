import clsx from 'clsx';
import { AlertTriangle, ArrowRight, ClipboardList, DollarSign, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Button, buttonClass, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatRelative, formatWeekday } from '../lib/format';
import { STATUS_META, STATUS_ORDER } from '../lib/status';
import type { DashboardSummary } from '../types';

function KpiCard({
  label,
  value,
  sub,
  icon,
  tone,
  to,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: ReactNode;
  tone: string;
  to?: string;
}) {
  const body = (
    <Card className={clsx('h-full p-5', to && 'transition-shadow hover:shadow-md')}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={clsx('flex size-9 items-center justify-center rounded-lg', tone)}>{icon}</div>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </Card>
  );
  return to ? (
    <Link to={to} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-indigo-600">
      {body}
    </Link>
  ) : (
    body
  );
}

function OrdersChart({ data }: { data: DashboardSummary['dailyOrders'] }) {
  const max = Math.max(1, ...data.map((d) => d.orders));
  const total = data.reduce((s, d) => s + d.orders, 0);
  return (
    <Card>
      <CardHeader title="Orders, last 7 days" description={`${total} order${total === 1 ? '' : 's'} this week`} />
      <div className="px-5 pt-6 pb-4">
        <div className="flex h-44 items-end gap-2 sm:gap-4" role="img" aria-label="Bar chart of orders per day for the last 7 days">
          {data.map((d, i) => {
            const isToday = i === data.length - 1;
            return (
              <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs font-medium text-slate-700 tabular-nums">{d.orders}</span>
                <div
                  className={clsx(
                    'w-full max-w-12 rounded-t-md transition-colors',
                    isToday ? 'bg-indigo-600' : 'bg-indigo-200 group-hover:bg-indigo-300',
                  )}
                  style={{ height: `${Math.max(4, (d.orders / max) * 100)}%` }}
                  title={`${d.orders} orders · ${formatMoney(d.revenueCents)}`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2 sm:gap-4">
          {data.map((d, i) => (
            <span key={d.day} className={clsx('flex-1 text-center text-xs', i === data.length - 1 ? 'font-semibold text-slate-900' : 'text-slate-500')}>
              {i === data.length - 1 ? 'Today' : formatWeekday(d.day)}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function StatusBreakdown({ counts }: { counts: DashboardSummary['statusCounts'] }) {
  const total = STATUS_ORDER.reduce((s, k) => s + counts[k], 0);
  return (
    <Card>
      <CardHeader title="Fulfilment pipeline" description="All orders by current status" />
      <div className="p-5">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
          {total > 0 &&
            STATUS_ORDER.map((s) => (
              <div key={s} className={STATUS_META[s].bar} style={{ width: `${(counts[s] / total) * 100}%` }} />
            ))}
        </div>
        <ul className="mt-5 space-y-3">
          {STATUS_ORDER.map((s) => (
            <li key={s}>
              <Link to={`/orders?status=${s}`} className="flex items-center justify-between rounded-md text-sm hover:text-indigo-600">
                <span className="flex items-center gap-2.5 text-slate-600">
                  <span className={clsx('size-2.5 rounded-full', STATUS_META[s].dot)} />
                  {STATUS_META[s].label}
                </span>
                <span className="font-medium text-slate-900 tabular-nums">
                  {counts[s]}
                  <span className="ml-2 inline-block w-10 text-right text-xs font-normal text-slate-400">
                    {total ? Math.round((counts[s] / total) * 100) : 0}%
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, error, loading, reload } = useApi(api.getDashboard, []);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Today's orders, fulfilment progress and stock alerts at a glance."
        actions={
          <Button variant="secondary" onClick={reload} loading={loading && !!data}>
            {!(loading && data) && <RefreshCw className="size-4" />} Refresh
          </Button>
        }
      />

      {error && !data ? (
        <Card>
          <ErrorState message={error.message} onRetry={reload} />
        </Card>
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Revenue"
              value={formatMoney(data.kpis.revenueCents)}
              sub={`${formatMoney(data.kpis.revenueTodayCents)} today · excludes cancelled`}
              icon={<DollarSign className="size-4.5 text-emerald-600" />}
              tone="bg-emerald-50"
            />
            <KpiCard
              label="Orders today"
              value={data.kpis.ordersToday}
              sub={`${data.kpis.totalOrders} total · avg ${formatMoney(data.kpis.averageOrderCents)}`}
              icon={<ClipboardList className="size-4.5 text-indigo-600" />}
              tone="bg-indigo-50"
              to="/orders"
            />
            <KpiCard
              label="Awaiting packing"
              value={data.kpis.awaitingPacking}
              sub="Orders in Placed status"
              icon={<PackageCheck className="size-4.5 text-amber-600" />}
              tone="bg-amber-50"
              to="/orders?status=PLACED"
            />
            <KpiCard
              label="Ready to ship"
              value={data.kpis.readyToShip}
              sub="Packed and waiting for courier"
              icon={<Truck className="size-4.5 text-sky-600" />}
              tone="bg-sky-50"
              to="/orders?status=PACKED"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <OrdersChart data={data.dailyOrders} />
            </div>
            <StatusBreakdown counts={data.statusCounts} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Recent orders"
                action={
                  <Link to="/orders" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500">
                    View all <ArrowRight className="size-4" />
                  </Link>
                }
              />
              {data.recentOrders.length === 0 ? (
                <EmptyState
                  icon={<ClipboardList className="size-5" />}
                  title="No orders yet"
                  description="Orders you take over the phone will appear here."
                  action={
                    <Link to="/orders/new" className={buttonClass()}>
                      Create first order
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentOrders.map((o) => (
                    <li key={o.id}>
                      <Link to={`/orders/${o.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">{o.reference}</p>
                          <p className="truncate text-xs text-slate-500">
                            {o.customerName} · {formatRelative(o.createdAt)}
                          </p>
                        </div>
                        <StatusBadge status={o.status} />
                        <p className="w-24 text-right text-sm font-medium text-slate-900 tabular-nums">{formatMoney(o.totalCents)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Stock alerts"
                  description={`Products at or below ${data.lowStockThreshold} units`}
                  action={
                    <Link to="/inventory" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                      Inventory
                    </Link>
                  }
                />
                {data.lowStock.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-500">All products are well stocked.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.lowStock.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                        <AlertTriangle className={clsx('size-4 shrink-0', p.stock === 0 ? 'text-rose-500' : 'text-amber-500')} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                          <p className="text-xs text-slate-500">{p.sku}</p>
                        </div>
                        <span className={clsx('text-sm font-semibold tabular-nums', p.stock === 0 ? 'text-rose-600' : 'text-amber-600')}>
                          {p.stock === 0 ? 'Out' : `${p.stock} left`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader title="Top products" description="Units sold, excluding cancelled orders" />
                {data.topProducts.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-500">No sales yet.</p>
                ) : (
                  <ul className="space-y-3 p-5">
                    {data.topProducts.map((p) => (
                      <li key={p.productId}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate text-slate-700">{p.name}</span>
                          <span className="ml-3 shrink-0 font-medium text-slate-900 tabular-nums">{p.units}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${(p.units / data.topProducts[0].units) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
