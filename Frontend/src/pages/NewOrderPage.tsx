import clsx from 'clsx';
import { Minus, PackageSearch, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { api, ApiError } from '../api/client';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  inputClass,
  PageHeader,
  Skeleton,
  StockBadge,
} from '../components/ui';
import { useApi } from '../hooks/useApi';
import { formatMoney } from '../lib/format';
import type { Product, StockShortage } from '../types';

type Cart = Record<string, number>; // productId -> quantity

interface FormErrors {
  customerName?: string;
  customerPhone?: string;
  cart?: string;
}

const PHONE_RE = /^[0-9+()\-\s]*$/;

function ProductCard({ product, inCart, onAdd }: { product: Product; inCart: number; onAdd: () => void }) {
  const remaining = product.stock - inCart;
  const out = product.stock === 0;
  return (
    <Card className={clsx('flex flex-col p-4', out && 'bg-slate-50/60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium tracking-wide text-slate-400 uppercase">
            {product.category} · {product.sku}
          </p>
          <h3 className={clsx('mt-0.5 text-sm font-semibold', out ? 'text-slate-500' : 'text-slate-900')}>{product.name}</h3>
        </div>
        <p className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">{formatMoney(product.priceCents)}</p>
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{product.description}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        <StockBadge stock={product.stock} />
        <Button
          size="sm"
          variant={inCart ? 'secondary' : 'primary'}
          onClick={onAdd}
          disabled={remaining <= 0}
          title={out ? 'This product is out of stock' : remaining <= 0 ? 'All available units are already in the order' : undefined}
        >
          {out ? (
            'Unavailable'
          ) : (
            <>
              <Plus className="size-3.5" /> {inCart ? `Add (${inCart} in order)` : 'Add'}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

export default function NewOrderPage() {
  const navigate = useNavigate();
  const { data: products, error, loading, reload } = useApi(api.getProducts, []);

  const [cart, setCart] = useState<Cart>({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [shortages, setShortages] = useState<Record<string, StockShortage>>({});
  const [submitting, setSubmitting] = useState(false);
  const cartRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const categories = useMemo(() => ['All', ...new Set((products ?? []).map((p) => p.category))], [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products ?? []).filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    );
  }, [products, search, category]);

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ product: byId.get(id), qty }))
    .filter((l): l is { product: Product; qty: number } => Boolean(l.product));
  const totalCents = lines.reduce((s, l) => s + l.product.priceCents * l.qty, 0);
  const unitCount = lines.reduce((s, l) => s + l.qty, 0);

  const setQty = (product: Product, qty: number) => {
    setShortages((s) => {
      if (!s[product.id]) return s;
      const { [product.id]: _removed, ...rest } = s;
      return rest;
    });
    setErrors((e) => ({ ...e, cart: undefined }));
    setCart((c) => {
      const next = { ...c };
      const clamped = Math.min(qty, product.stock);
      if (clamped <= 0) delete next[product.id];
      else next[product.id] = clamped;
      return next;
    });
  };

  const addToCart = (product: Product) => {
    const current = cart[product.id] ?? 0;
    if (current >= product.stock) {
      toast.warn(`Only ${product.stock} unit(s) of ${product.name} available.`);
      return;
    }
    setQty(product, current + 1);
  };

  const validate = (): FormErrors => {
    const e: FormErrors = {};
    if (!customerName.trim()) e.customerName = 'Customer name is required.';
    if (customerPhone && !PHONE_RE.test(customerPhone)) e.customerPhone = 'Use digits, spaces and + - ( ) only.';
    if (lines.length === 0) e.cart = 'Add at least one product to the order.';
    else if (lines.some((l) => l.qty > l.product.stock)) e.cart = 'Some quantities exceed available stock.';
    return e;
  };

  const resetForm = () => {
    setCart({});
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setErrors({});
    setShortages({});
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error(Object.values(found)[0]);
      return;
    }

    setSubmitting(true);
    try {
      const order = await api.createOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
      });
      toast.success(
        <div>
          <p className="font-semibold">Order {order.reference} placed</p>
          <p className="text-xs opacity-80">
            {order.itemCount} item(s) · {formatMoney(order.totalCents)} · stock reserved
          </p>
        </div>,
        { onClick: () => navigate(`/orders/${order.id}`) },
      );
      resetForm();
      void reload();
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'INSUFFICIENT_STOCK') {
        const list = (err.details as { shortages: StockShortage[] }).shortages;
        setShortages(Object.fromEntries(list.map((s) => [s.productId, s])));
        toast.error(
          <div>
            <p className="font-semibold">Order not placed — not enough stock</p>
            <ul className="mt-1 list-disc pl-4 text-xs">
              {list.map((s) => (
                <li key={s.productId}>
                  {s.name}: requested {s.requested}, available {s.available}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs opacity-80">No stock was changed. Adjust the order and try again.</p>
          </div>,
          { autoClose: 8000 },
        );
        void reload(); // stock may have changed since the page was loaded
      } else {
        toast.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="New order" description="Pick products from the catalogue, enter the caller's details and place the order." />

      <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-0 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Catalogue */}
        <section aria-label="Catalogue" className="min-w-0">
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name or SKU"
                className={clsx(inputClass(), 'pl-9')}
                aria-label="Search products"
              />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={clsx(inputClass(), 'w-full sm:w-44')} aria-label="Category">
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {error && !products ? (
            <Card>
              <ErrorState message={error.message} onRetry={reload} />
            </Card>
          ) : loading && !products ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <Card>
              <EmptyState icon={<PackageSearch className="size-5" />} title="No products match" description="Try a different search or category." />
            </Card>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} inCart={cart[p.id] ?? 0} onAdd={() => addToCart(p)} />
              ))}
            </div>
          )}
        </section>

        {/* Order summary */}
        <div ref={cartRef} className="scroll-mt-20">
          <form onSubmit={handleSubmit} noValidate className="lg:sticky lg:top-20">
            <Card>
              <CardHeader
                title="Order summary"
                description={unitCount ? `${unitCount} unit(s) across ${lines.length} product(s)` : 'No products added yet'}
                action={
                  lines.length > 0 && (
                    <button type="button" onClick={() => setCart({})} className="text-xs font-medium text-slate-500 hover:text-rose-600">
                      Clear
                    </button>
                  )
                }
              />

              {lines.length === 0 ? (
                <div className={clsx('m-4 rounded-lg border border-dashed px-4 py-8 text-center', errors.cart ? 'border-rose-300' : 'border-slate-200')}>
                  <ShoppingCart className="mx-auto size-6 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">Add products from the catalogue.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {lines.map(({ product, qty }) => {
                    const shortage = shortages[product.id];
                    return (
                      <li key={product.id} className={clsx('px-5 py-3', shortage && 'bg-rose-50/60')}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
                            <p className="text-xs text-slate-500">
                              {formatMoney(product.priceCents)} each · {product.stock} available
                            </p>
                          </div>
                          <p className="text-sm font-medium text-slate-900 tabular-nums">{formatMoney(product.priceCents * qty)}</p>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="inline-flex items-center rounded-lg ring-1 ring-slate-300">
                            <button
                              type="button"
                              className="p-1.5 text-slate-500 hover:text-slate-900"
                              onClick={() => setQty(product, qty - 1)}
                              aria-label={`Decrease ${product.name}`}
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={product.stock}
                              value={qty}
                              onChange={(e) => setQty(product, Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                              className="w-12 border-x border-slate-300 py-1 text-center text-sm tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                              aria-label={`Quantity of ${product.name}`}
                            />
                            <button
                              type="button"
                              className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                              onClick={() => setQty(product, qty + 1)}
                              disabled={qty >= product.stock}
                              aria-label={`Increase ${product.name}`}
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setQty(product, 0)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            aria-label={`Remove ${product.name}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        {shortage && (
                          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-rose-600">
                            <X className="size-3.5" /> Only {shortage.available} available — reduce quantity or remove.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {errors.cart && <p className="px-5 pb-2 text-xs text-rose-600">{errors.cart}</p>}

              <div className="space-y-4 border-t border-slate-100 px-5 py-4">
                <Field label="Customer name" htmlFor="customerName" error={errors.customerName}>
                  <input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setErrors((x) => ({ ...x, customerName: undefined }));
                    }}
                    className={inputClass(!!errors.customerName)}
                    placeholder="e.g. Priya Sharma"
                    maxLength={120}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Phone" htmlFor="customerPhone" optional error={errors.customerPhone}>
                  <input
                    id="customerPhone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value);
                      setErrors((x) => ({ ...x, customerPhone: undefined }));
                    }}
                    className={inputClass(!!errors.customerPhone)}
                    placeholder="+91 98200 11223"
                    maxLength={30}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Notes" htmlFor="notes" optional>
                  <textarea
                    id="notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={inputClass()}
                    placeholder="Delivery instructions, gift wrap…"
                    maxLength={500}
                  />
                </Field>
              </div>

              <div className="rounded-b-xl border-t border-slate-100 bg-slate-50/70 px-5 py-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-600">Total</span>
                  <span className="text-xl font-semibold text-slate-900 tabular-nums">{formatMoney(totalCents)}</span>
                </div>
                <Button type="submit" className="mt-4 w-full" loading={submitting} disabled={lines.length === 0}>
                  Place order
                </Button>
                <p className="mt-2 text-center text-xs text-slate-500">
                  Stock is checked and reserved on submit. <Link to="/orders" className="text-indigo-600 hover:underline">View orders</Link>
                </p>
              </div>
            </Card>
          </form>
        </div>
      </div>

      {/* Mobile sticky summary bar */}
      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">{unitCount} unit(s)</p>
              <p className="text-base font-semibold text-slate-900 tabular-nums">{formatMoney(totalCents)}</p>
            </div>
            <Button onClick={() => cartRef.current?.scrollIntoView({ behavior: 'smooth' })}>
              <ShoppingCart className="size-4" /> Review order
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
