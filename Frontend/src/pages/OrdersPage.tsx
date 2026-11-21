import clsx from 'clsx';
import { ChevronLeft, ChevronRight, ClipboardList, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { buttonClass, Card, EmptyState, ErrorState, inputClass, PageHeader, Skeleton, StatusBadge } from '../components/ui';
import { useApi, useDebouncedValue } from '../hooks/useApi';
import { formatDateTime, formatMoney, formatRelative } from '../lib/format';
import { STATUS_META, STATUS_ORDER } from '../lib/status';
import type { OrderStatus } from '../types';

const PAGE_SIZE = 10;

export default function OrdersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const statusParam = params.get('status');
  const status = STATUS_ORDER.includes(statusParam as OrderStatus) ? (statusParam as OrderStatus) : undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [searchInput, setSearchInput] = useState(params.get('q') ?? '');
  const search = useDebouncedValue(searchInput.trim(), 300);

  // Keep the search term in the URL so the list can be shared / survives refresh.
  useEffect(() => {
    if ((params.get('q') ?? '') === search) return;
    const next = new URLSearchParams(params);
    if (search) next.set('q', search);
    else next.delete('q');
    next.delete('page');
    setParams(next, { replace: true });
  }, [search, params, setParams]);

  const { data, error, loading, reload } = useApi(
    () => api.listOrders({ search: search || undefined, status, page, pageSize: PAGE_SIZE }),
    [search, status, page],
  );

  const updateParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const tabs: { key: OrderStatus | undefined; label: string; count?: number }[] = [
    { key: undefined, label: 'All', count: data?.statusCounts.ALL },
    ...STATUS_ORDER.map((s) => ({ key: s, label: STATUS_META[s].label, count: data?.statusCounts[s] })),
  ];

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Orders"
        description="Search by order reference or customer, filter by status, and open an order to update fulfilment."
        actions={
          <Link to="/orders/new" className={buttonClass()}>
            New order
          </Link>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]" role="tablist" aria-label="Filter by status">
            {tabs.map((t) => {
              const active = t.key === status;
              return (
                <button
                  key={t.label}
                  role="tab"
                  aria-selected={active}
                  onClick={() => updateParam('status', t.key)}
                  className={clsx(
                    'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {t.label}
                  {t.count !== undefined && (
                    <span className={clsx('rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="relative md:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search ORD-001001 or customer"
              className={clsx(inputClass(), 'pr-8 pl-9')}
              aria-label="Search orders"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {error && !data ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : data.data.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title={search || status ? 'No matching orders' : 'No orders yet'}
            description={search || status ? 'Try a different reference, customer name or status.' : 'Create the first order to get started.'}
            action={
              search || status ? (
                <button
                  className={buttonClass('secondary')}
                  onClick={() => {
                    setSearchInput('');
                    setParams(new URLSearchParams());
                  }}
                >
                  Clear filters
                </button>
              ) : (
                <Link to="/orders/new" className={buttonClass()}>
                  New order
                </Link>
              )
            }
          />
        ) : (
          <div className={clsx('transition-opacity', loading && 'opacity-60')}>
            {/* Desktop table */}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Items</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/orders/${o.id}`)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-5 py-3.5">
                      <Link to={`/orders/${o.id}`} className="font-medium text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {o.reference}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">{o.customerName}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-600 tabular-nums">{o.itemCount}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-900 tabular-nums">{formatMoney(o.totalCents)}</td>
                    <td className="px-5 py-3.5 text-slate-500" title={formatDateTime(o.createdAt)}>
                      {formatRelative(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile list */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {data.data.map((o) => (
                <li key={o.id}>
                  <Link to={`/orders/${o.id}`} className="block px-4 py-3.5 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-indigo-600">{o.reference}</p>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                      <p className="truncate text-slate-700">{o.customerName}</p>
                      <p className="font-medium text-slate-900 tabular-nums">{formatMoney(o.totalCents)}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {o.itemCount} item(s) · {formatRelative(o.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm sm:px-5">
              <p className="text-slate-500">
                Showing <span className="font-medium text-slate-700">{(data.page - 1) * data.pageSize + 1}</span>–
                <span className="font-medium text-slate-700">{(data.page - 1) * data.pageSize + data.data.length}</span> of{' '}
                <span className="font-medium text-slate-700">{data.total}</span>
              </p>
              <div className="flex gap-2">
                <button
                  className={buttonClass('secondary', 'sm')}
                  disabled={page <= 1}
                  onClick={() => updateParam('page', String(page - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  className={buttonClass('secondary', 'sm')}
                  disabled={page >= totalPages}
                  onClick={() => updateParam('page', String(page + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
