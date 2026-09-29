import "server-only";
import { createHash } from "node:crypto";
import type { Commodity, CommodityVariety, ListingStatus, ListingUnit, PriceSnapshotReason, Prisma, SellerGrade } from "@prisma/client";
import { normalizedPrice } from "./units";

export type SnapshotProduct = {
  id: string;
  status: ListingStatus;
  price: { toString(): string };
  quantity: { toString(): string } | null;
  unit: ListingUnit | null;
  commodity: Commodity | null;
  variety: CommodityVariety | null;
  grade: SellerGrade | null;
  packageQuantity: { toString(): string } | null;
  packageUnit: ListingUnit | null;
  category: string;
  country: string | null;
  location: string;
};

export function priceSnapshotState(product: SnapshotProduct) {
  if (product.status !== "ACTIVE" || !product.commodity) return null;
  const normalized = normalizedPrice(product.price, product.quantity, product.unit, product.packageQuantity, product.packageUnit);
  if (!normalized) return null;
  const normalizedPriceValue = normalized.price.toDecimalPlaces(12).toFixed(12);
  const values = {
    commodity: product.commodity,
    variety: product.variety,
    grade: product.grade,
    normalizedUnit: normalized.unit,
    normalizedPrice: normalizedPriceValue,
    category: product.category,
    country: product.country,
    location: product.location.trim(),
  };
  return { values, stateHash: createHash("sha256").update(JSON.stringify(values)).digest("hex") };
}

export async function capturePriceSnapshot(tx: Prisma.TransactionClient, product: SnapshotProduct, options: { force?: boolean; capturedAt?: Date; reason?: PriceSnapshotReason; operation?: string } = {}) {
  const state = priceSnapshotState(product);
  if (!state) return false;
  try {
    const latest = await tx.priceSnapshot.findFirst({ where: { productKey: product.id }, orderBy: [{ capturedAt: "desc" }, { id: "desc" }], select: { stateHash: true } });
    if (!options.force && latest?.stateHash === state.stateHash) return false;
    await tx.priceSnapshot.create({ data: {
      productId: product.id,
      productKey: product.id,
      ...state.values,
      stateHash: state.stateHash,
      captureReason: options.reason ?? "CHANGE",
      ...(options.capturedAt ? { capturedAt: options.capturedAt } : {}),
    } });
    return true;
  } catch (cause) {
    console.error("[price-snapshot]", JSON.stringify({ productId: product.id, operation: options.operation ?? "capture", timestamp: new Date().toISOString(), context: "snapshot write failed" }));
    throw cause;
  }
}
