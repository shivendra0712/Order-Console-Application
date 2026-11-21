import clsx from 'clsx';
import { Boxes, ClipboardList, LayoutDashboard, Menu, PackagePlus, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/orders/new', label: 'New order', icon: PackagePlus, end: true },
  { to: '/orders', label: 'Orders', icon: ClipboardList, end: false },
  { to: '/inventory', label: 'Inventory', icon: Boxes, end: true },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-2">
      <img src="/favicon.svg" alt="" className="size-8" />
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">Order Console</p>
        <p className="text-[11px] text-slate-400">Store operations</p>
      </div>
    </Link>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav className="mt-8 flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) => {
            // "/orders" should not light up while on "/orders/new".
            const active = isActive && !(to === '/orders' && pathname === '/orders/new');
            return clsx(
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
            );
          }}
        >
          <Icon className="size-4.5 shrink-0" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-slate-900 px-3 py-5 lg:flex">
        <Brand />
        <NavItems />
        <div className="mt-auto rounded-lg bg-white/5 p-3 text-xs text-slate-400">
          <p className="font-medium text-slate-200">Phone orders</p>
          <p className="mt-1">Stock is reserved the moment an order is placed.</p>
        </div>
      </aside>

      {/* Mobile drawer */}
      <div className={clsx('fixed inset-0 z-40 lg:hidden', mobileOpen ? 'pointer-events-auto' : 'pointer-events-none')}>
        <div
          className={clsx('absolute inset-0 bg-slate-900/50 transition-opacity', mobileOpen ? 'opacity-100' : 'opacity-0')}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={clsx(
            'absolute inset-y-0 left-0 flex w-64 flex-col bg-slate-900 px-3 py-5 transition-transform',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between">
            <Brand />
            <button className="rounded-md p-1.5 text-slate-400 hover:text-white" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="size-5" />
            </button>
          </div>
          <NavItems onNavigate={() => setMobileOpen(false)} />
        </aside>
      </div>

      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6">
          <button
            className="-ml-1.5 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <p className="truncate text-sm font-medium text-slate-500 lg:hidden">Order Console</p>
          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/orders/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-xs hover:bg-indigo-500"
            >
              <Plus className="size-4" /> <span className="hidden sm:inline">New order</span>
            </Link>
            <div className="flex size-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600" title="Store staff">
              ST
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
