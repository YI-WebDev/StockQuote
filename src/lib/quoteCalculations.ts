import { TAX_RATE } from '../config/constants';

export function calculateItemAmount(price: number, quantity: number): number {
  return (Number(price) || 0) * (Number(quantity) || 0);
}

export function calculateQuoteTotals(items: Array<{ price: number; quantity: number }>): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const subtotal = items.reduce(
    (sum, item) => sum + calculateItemAmount(item.price, item.quantity),
    0
  );
  const tax = Math.floor(subtotal * TAX_RATE);
  const total = subtotal + tax;
  return { subtotal, tax, total };
}
