import { Boxes, PackageX, TriangleAlert } from 'lucide-react';
import { api } from '../api/client';
import { Card, ErrorState, PageHeader, Skeleton, StockBadge } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatRelative } from '../lib/format';
import { LOW_STOCK_THRESHOLD } from '../lib/status';

export default function InventoryPage() {
  const { data, error, reload } = useApi(api.getProducts, []);

  const totalUnits = data?.reduce((s, p) => s + p.stock, 0) ?? 0;
  const stockValue = data?.reduce((s, p) => s + p.stock * p.priceCents, 0) ?? 0;
  const low = data?.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length ?? 0;
  const out = data?.filter((p) => p.stock === 0).length ?? 0;

  return (
    <>
      <PageHeader title="Inventory" description="Live stock levels. Stock changes automatically when orders are placed or cancelled." />

      {error && !data ? (
        <Card>
          <ErrorState message={error.message} onRetry={reload} />
        </Card>
      ) : !data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Products', value: data.length, icon: <Boxes className="size-4 text-indigo-600" /> },
              { label: 'Units in stock', value: totalUnits, icon: <Boxes className="size-4 text-emerald-600" /> },
              { label: 'Low stock', value: low, icon: <TriangleAlert className="size-4 text-amber-600" /> },
              { label: 'Out of stock', value: out, icon: <PackageX className="size-4 text-rose-600" /> },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  {s.icon} {s.label}
                </div>
                <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{s.value}</p>
              </Card>
            ))}
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">Product</th>
                    <th className="px-5 py-3 font-medium">Category</th>
                    <th className="px-5 py-3 text-right font-medium">Price</th>
                    <th className="px-5 py-3 text-right font-medium">On hand</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Last change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.sku}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{p.category}</td>
                      <td className="px-5 py-3 text-right text-slate-700 tabular-nums">{formatMoney(p.priceCents)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900 tabular-nums">{p.stock}</td>
                      <td className="px-5 py-3">
                        <StockBadge stock={p.stock} />
                      </td>
                      <td className="px-5 py-3 text-slate-500">{formatRelative(p.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Stock value at list price: <span className="font-medium text-slate-700">{formatMoney(stockValue)}</span>
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
