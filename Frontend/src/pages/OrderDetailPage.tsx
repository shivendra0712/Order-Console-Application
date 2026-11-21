import clsx from 'clsx';
import { ArrowLeft, Ban, Check, PackageCheck, Phone, StickyNote, Truck, User } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { api, ApiError } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Button, buttonClass, Card, CardHeader, ErrorState, Skeleton, StatusBadge } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { formatDateTime, formatMoney } from '../lib/format';
import { STATUS_META } from '../lib/status';
import type { OrderDetail, OrderStatus } from '../types';

const STEPS: OrderStatus[] = ['PLACED', 'PACKED', 'SHIPPED'];

function FulfilmentStepper({ order }: { order: OrderDetail }) {
  const cancelled = order.status === 'CANCELLED';
  // For a cancelled order, show how far it got before cancellation.
  const reached = new Set(order.history.map((h) => h.toStatus));
  const currentIndex = cancelled ? -1 : STEPS.indexOf(order.status);

  return (
    <ol className="flex items-center">
      {STEPS.map((step, i) => {
        const done = cancelled ? reached.has(step) : i <= currentIndex;
        const isCurrent = !cancelled && i === currentIndex;
        return (
          <li key={step} className={clsx('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={clsx(
                  'flex size-8 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-white',
                  done ? (cancelled ? 'bg-slate-300 text-white' : 'bg-indigo-600 text-white') : 'bg-slate-100 text-slate-400',
                  isCurrent && 'ring-indigo-100',
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={clsx('text-xs font-medium', isCurrent ? 'text-indigo-700' : done ? 'text-slate-700' : 'text-slate-400')}>
                {STATUS_META[step].label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={clsx(
                  'mx-2 mb-5 h-0.5 flex-1 rounded',
                  !cancelled && i < currentIndex ? 'bg-indigo-600' : cancelled && reached.has(STEPS[i + 1]) ? 'bg-slate-300' : 'bg-slate-200',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderDetailPage() {
  const id = Number(useParams().id);
  const { data: order, error, loading, reload, setData } = useApi(() => api.getOrder(id), [id]);
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const changeStatus = async (status: OrderStatus) => {
    if (!order) return;
    setPending(status);
    try {
      const updated = await api.updateStatus(order.id, status);
      setData(updated);
      setConfirmCancel(false);
      if (status === 'CANCELLED') {
        toast.info(`Order ${updated.reference} cancelled. ${updated.itemCount} unit(s) returned to stock.`);
      } else {
        toast.success(`Order ${updated.reference} marked as ${STATUS_META[status].label.toLowerCase()}.`);
      }
    } catch (e) {
      const err = e as ApiError;
      toast.error(err.message);
      setConfirmCancel(false);
      // Someone else may have changed the order — show the server's truth.
      if (err.status === 409) void reload();
    } finally {
      setPending(null);
    }
  };

  if (error && !order) {
    return (
      <Card>
        <ErrorState message={error.status === 404 ? 'This order does not exist.' : error.message} onRetry={error.status === 404 ? undefined : reload} />
        <div className="pb-8 text-center">
          <Link to="/orders" className="text-sm font-medium text-indigo-600 hover:underline">
            Back to orders
          </Link>
        </div>
      </Card>
    );
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const can = (s: OrderStatus) => order.allowedTransitions.includes(s);

  return (
    <>
      <Link to="/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> All orders
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{order.reference}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">Placed {formatDateTime(order.createdAt)}</p>
        </div>

        <div className={clsx('flex flex-wrap gap-2', loading && 'pointer-events-none opacity-60')}>
          {can('PACKED') && (
            <Button onClick={() => changeStatus('PACKED')} loading={pending === 'PACKED'} disabled={!!pending}>
              <PackageCheck className="size-4" /> Mark as packed
            </Button>
          )}
          {can('SHIPPED') && (
            <Button onClick={() => changeStatus('SHIPPED')} loading={pending === 'SHIPPED'} disabled={!!pending}>
              <Truck className="size-4" /> Mark as shipped
            </Button>
          )}
          {can('CANCELLED') && (
            <Button variant="danger" onClick={() => setConfirmCancel(true)} disabled={!!pending}>
              <Ban className="size-4" /> Cancel order
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5 sm:p-6">
            <FulfilmentStepper order={order} />
            {order.status === 'CANCELLED' && (
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                This order was cancelled and its stock was returned to inventory. No further changes are possible.
              </p>
            )}
            {order.status === 'SHIPPED' && (
              <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">This order has shipped. Fulfilment is complete.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Items" description={`${order.itemCount} unit(s)`} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-2.5 font-medium">Product</th>
                    <th className="px-5 py-2.5 text-right font-medium">Unit price</th>
                    <th className="px-5 py-2.5 text-right font-medium">Qty</th>
                    <th className="px-5 py-2.5 text-right font-medium">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <tr key={item.productId}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{item.productName}</p>
                        <p className="text-xs text-slate-500">{item.sku}</p>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600 tabular-nums">{formatMoney(item.unitPriceCents)}</td>
                      <td className="px-5 py-3 text-right text-slate-900 tabular-nums">{item.quantity}</td>
                      <td className="px-5 py-3 text-right font-medium text-slate-900 tabular-nums">{formatMoney(item.lineTotalCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td colSpan={3} className="px-5 py-3.5 text-right text-sm font-medium text-slate-600">
                      Order total
                    </td>
                    <td className="px-5 py-3.5 text-right text-base font-semibold text-slate-900 tabular-nums">{formatMoney(order.totalCents)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer" />
            <dl className="space-y-3 p-5 text-sm">
              <div className="flex gap-3">
                <User className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <dd className="font-medium text-slate-900">{order.customerName}</dd>
              </div>
              <div className="flex gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <dd className={order.customerPhone ? 'text-slate-700' : 'text-slate-400'}>{order.customerPhone ?? 'No phone number'}</dd>
              </div>
              <div className="flex gap-3">
                <StickyNote className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <dd className={clsx('whitespace-pre-line', order.notes ? 'text-slate-700' : 'text-slate-400')}>{order.notes ?? 'No notes'}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <ol className="p-5">
              {[...order.history].reverse().map((h, i, arr) => (
                <li key={`${h.toStatus}-${h.changedAt}`} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < arr.length - 1 && <span className="absolute top-4 left-[5px] h-full w-px bg-slate-200" aria-hidden />}
                  <span className={clsx('relative mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-white', STATUS_META[h.toStatus].dot)} />
                  <div>
                    <p className="text-sm text-slate-900">
                      {h.fromStatus ? (
                        <>
                          {STATUS_META[h.fromStatus].label} → <span className="font-medium">{STATUS_META[h.toStatus].label}</span>
                        </>
                      ) : (
                        <span className="font-medium">Order placed</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTime(h.changedAt)}</p>
                    {h.toStatus === 'CANCELLED' && <p className="mt-0.5 text-xs text-slate-500">Stock returned to inventory</p>}
                    {!h.fromStatus && <p className="mt-0.5 text-xs text-slate-500">Stock reserved</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Link to="/orders/new" className={clsx(buttonClass('secondary'), 'w-full')}>
            Create another order
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel ${order.reference}?`}
        message={`The ${order.itemCount} reserved unit(s) will be returned to stock. A cancelled order can't be reopened.`}
        confirmLabel="Cancel order"
        loading={pending === 'CANCELLED'}
        onConfirm={() => changeStatus('CANCELLED')}
        onClose={() => setConfirmCancel(false)}
      />
    </>
  );
}
