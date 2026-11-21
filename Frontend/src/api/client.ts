import type {
  CreateOrderPayload,
  DashboardSummary,
  OrderDetail,
  OrderList,
  OrderStatus,
  Product,
} from '../types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Backend base URL comes from Frontend/.env (VITE_API_BASE_URL), e.g. http://localhost:4000/api
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
if (!API_BASE_URL) {
  console.error('VITE_API_BASE_URL is not set. Copy Frontend/.env.example to Frontend/.env and restart the dev server.');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check that the backend is running.');
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? `Request failed (${res.status}).`, err?.details);
  }
  return body as T;
}

export const api = {
  getProducts: () => request<{ data: Product[] }>('/products').then((r) => r.data),

  getDashboard: () => request<DashboardSummary>('/dashboard'),

  listOrders: (params: { search?: string; status?: OrderStatus; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.status) qs.set('status', params.status);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return request<OrderList>(`/orders?${qs}`);
  },

  getOrder: (id: number) => request<{ data: OrderDetail }>(`/orders/${id}`).then((r) => r.data),

  createOrder: (payload: CreateOrderPayload) =>
    request<{ data: OrderDetail }>('/orders', { method: 'POST', body: JSON.stringify(payload) }).then((r) => r.data),

  updateStatus: (id: number, status: OrderStatus) =>
    request<{ data: OrderDetail }>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }).then((r) => r.data),
};
