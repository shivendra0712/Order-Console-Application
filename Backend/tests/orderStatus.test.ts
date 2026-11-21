import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, canTransition } from '../src/domain/orderStatus';

describe('order status state machine', () => {
  const allowed = new Set(['PLACED>PACKED', 'PLACED>CANCELLED', 'PACKED>SHIPPED', 'PACKED>CANCELLED']);

  for (const from of ORDER_STATUSES) {
    for (const to of ORDER_STATUSES) {
      const expected = allowed.has(`${from}>${to}`);
      it(`${from} -> ${to} is ${expected ? 'allowed' : 'rejected'}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }
});
