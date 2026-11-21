export type OrderStatus = 'PLACED' | 'PACKED' | 'SHIPPED' | 'CANCELLED';

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  stock: number;
  updatedAt: string;
}

export interface OrderSummary {
  id: number;
  reference: string;
  customerName: string;
  status: OrderStatus;
  totalCents: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: number;
  productName: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface StatusChange {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedAt: string;
}

export interface OrderDetail extends OrderSummary {
  customerPhone: string | null;
  notes: string | null;
  items: OrderItem[];
  history: StatusChange[];
  allowedTransitions: OrderStatus[];
}

export interface OrderList {
  data: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<OrderStatus | 'ALL', number>;
}

export interface StockShortage {
  productId: number;
  sku: string;
  name: string;
  requested: number;
  available: number;
}

export interface DashboardSummary {
  kpis: {
    totalOrders: number;
    revenueCents: number;
    ordersToday: number;
    revenueTodayCents: number;
    averageOrderCents: number;
    unitsInStock: number;
    productCount: number;
    awaitingPacking: number;
    readyToShip: number;
  };
  statusCounts: Record<OrderStatus, number>;
  dailyOrders: { day: string; orders: number; revenueCents: number }[];
  lowStock: { id: number; sku: string; name: string; stock: number }[];
  lowStockThreshold: number;
  topProducts: { productId: number; name: string; units: number; revenueCents: number }[];
  recentOrders: Pick<OrderSummary, 'id' | 'reference' | 'customerName' | 'status' | 'totalCents' | 'createdAt'>[];
}

export interface CreateOrderPayload {
  customerName: string;
  customerPhone?: string;
  notes?: string;
  items: { productId: number; quantity: number }[];
}
