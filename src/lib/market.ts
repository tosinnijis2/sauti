import type { Prisma } from "@prisma/client";
import { decimalMoney } from "./decimal";

export const productCardSelect = {
  id: true, item: true, price: true, quantity: true, originalQuantity: true, remainingQuantity: true, unit: true, status: true, category: true, location: true, country: true, imageUrl: true, createdAt: true, ownerId: true,
  commodity: true, variety: true, grade: true, packageQuantity: true, packageUnit: true,
  owner: { select: { id: true, name: true, imageUrl: true } },
} satisfies Prisma.ProductSelect;
export type CardProduct = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;
export const formatPrice = (price: { toString(): string }) => decimalMoney(price, 2);
export function listedDate(date: Date) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
