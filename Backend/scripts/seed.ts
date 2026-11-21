/**
 * Resets the app database to a known demo state: a synthetic catalogue and a
 * handful of sample orders. Orders are created through the real service layer,
 * so stock levels are consistent with the orders that exist.
 *
 *   npm run db:seed
 */
import { clearDatabase, connectDb, disconnectDb } from '../src/db/connection';
import type { OrderStatus } from '../src/domain/orderStatus';
import { Order } from '../src/models/Order';
import { Product } from '../src/models/Product';
import { changeOrderStatus, placeOrder } from '../src/services/orderService';

const PRODUCTS = [
  { sku: 'MSE-200', name: 'Wireless Mouse', category: 'Accessories', priceCents: 2499, stock: 48, description: 'Silent-click 2.4 GHz mouse with USB-C receiver.' },
  { sku: 'KBD-K8', name: 'Mechanical Keyboard', category: 'Accessories', priceCents: 8900, stock: 20, description: 'Hot-swappable 75% keyboard, brown switches.' },
  { sku: 'HUB-7C', name: 'USB-C Hub 7-in-1', category: 'Accessories', priceCents: 3950, stock: 30, description: 'HDMI 4K, 3x USB-A, SD/microSD, 100 W pass-through.' },
  { sku: 'MON-27K', name: '27" 4K Monitor', category: 'Displays', priceCents: 32900, stock: 9, description: 'IPS panel, 60 Hz, USB-C with 65 W charging.' },
  { sku: 'HPH-NC1', name: 'Noise-Cancelling Headphones', category: 'Audio', priceCents: 14900, stock: 0, description: 'Over-ear ANC headphones with 30-hour battery.' },
  { sku: 'STD-ALU', name: 'Aluminium Laptop Stand', category: 'Workspace', priceCents: 4500, stock: 5, description: 'Adjustable height, fits 11–17" laptops.' },
  { sku: 'CAM-HD', name: 'HD Webcam 1080p', category: 'Video', priceCents: 5999, stock: 14, description: 'Autofocus webcam with dual microphones.' },
  { sku: 'CHR-ERG', name: 'Ergonomic Office Chair', category: 'Workspace', priceCents: 24900, stock: 6, description: 'Mesh back, adjustable lumbar and armrests.' },
];

type SeedOrder = {
  customerName: string;
  customerPhone?: string;
  daysAgo: number;
  items: [sku: string, qty: number][];
  path: OrderStatus[];
};

const ORDERS: SeedOrder[] = [
  { customerName: 'Priya Sharma', customerPhone: '+91 98200 11223', daysAgo: 6, items: [['MON-27K', 1], ['HUB-7C', 1]], path: ['PACKED', 'SHIPPED'] },
  { customerName: 'Daniel Okafor', customerPhone: '+44 20 7946 0123', daysAgo: 5, items: [['KBD-K8', 1], ['MSE-200', 1]], path: ['PACKED', 'SHIPPED'] },
  { customerName: 'Mei Lin', daysAgo: 4, items: [['CHR-ERG', 1]], path: ['CANCELLED'] },
  { customerName: 'Arjun Mehta', customerPhone: '+91 99876 54321', daysAgo: 3, items: [['CAM-HD', 2], ['MSE-200', 2]], path: ['PACKED', 'SHIPPED'] },
  { customerName: 'Sofia Rossi', daysAgo: 2, items: [['STD-ALU', 1], ['HUB-7C', 1]], path: ['PACKED'] },
  { customerName: 'Liam Walker', customerPhone: '+1 415 555 0199', daysAgo: 1, items: [['MON-27K', 2]], path: ['PACKED'] },
  { customerName: 'Ananya Iyer', daysAgo: 0, items: [['KBD-K8', 1], ['STD-ALU', 1], ['MSE-200', 1]], path: [] },
  { customerName: 'Noah Fischer', customerPhone: '+49 30 901820', daysAgo: 0, items: [['CHR-ERG', 1]], path: [] },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const STEP_MS = 90 * 60 * 1000;

async function main() {
  await connectDb();
  await clearDatabase();

  const products = await Product.insertMany(PRODUCTS);
  const ids = new Map(products.map((p) => [p.sku, p._id.toString()]));
  console.log(`Seeded ${products.length} products.`);

  for (const o of ORDERS) {
    const order = await placeOrder({
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      items: o.items.map(([sku, quantity]) => ({ productId: ids.get(sku)!, quantity })),
    });
    for (const status of o.path) await changeOrderStatus(order.id, status);

    // Spread demo orders over the last week so the dashboard chart has shape.
    // Uses the raw collection because Mongoose treats createdAt as immutable.
    if (o.daysAgo > 0) {
      const createdAt = new Date(Date.now() - o.daysAgo * DAY_MS);
      const fresh = await Order.findById(order.id).lean();
      await Order.collection.updateOne(
        { _id: fresh!._id },
        {
          $set: {
            createdAt,
            updatedAt: new Date(createdAt.getTime() + o.path.length * STEP_MS),
            history: fresh!.history.map((h, i) => ({ ...h, changedAt: new Date(createdAt.getTime() + i * STEP_MS) })),
          },
        },
      );
    }
  }
  console.log(`Seeded ${ORDERS.length} sample orders.`);
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
