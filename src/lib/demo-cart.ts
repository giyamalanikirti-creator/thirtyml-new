/**
 * Demo cart — client-side only, lives in localStorage. Shape kept tiny so
 * the checkout page can read it without any server round-trip.
 */

export type DemoCartItem = {
  id: string;
  title: string;
  subtitle: string;
  pricePaise: number;
  qty: number;
};

const KEY = "thirtyml.demo.cart.v1";

function isCart(x: unknown): x is DemoCartItem[] {
  return (
    Array.isArray(x) &&
    x.every(
      (i) =>
        i &&
        typeof i === "object" &&
        typeof (i as DemoCartItem).id === "string" &&
        typeof (i as DemoCartItem).pricePaise === "number" &&
        Number.isInteger((i as DemoCartItem).pricePaise) &&
        typeof (i as DemoCartItem).qty === "number"
    )
  );
}

export function readCart(): DemoCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return isCart(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(items: DemoCartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

export function addItem(item: Omit<DemoCartItem, "qty">): DemoCartItem[] {
  const cart = readCart();
  const existing = cart.find((i) => i.id === item.id);
  const next = existing
    ? cart.map((i) =>
        i.id === item.id ? { ...i, qty: i.qty + 1 } : i
      )
    : [...cart, { ...item, qty: 1 }];
  writeCart(next);
  return next;
}

export function clearCart() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function cartSubtotalPaise(cart: DemoCartItem[]): number {
  return cart.reduce((sum, i) => sum + i.pricePaise * i.qty, 0);
}
