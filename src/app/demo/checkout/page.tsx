import type { Metadata } from "next";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = { title: "Demo — checkout" };

export default function DemoCheckoutPage() {
  return <CheckoutClient />;
}
