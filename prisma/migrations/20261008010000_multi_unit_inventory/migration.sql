ALTER TABLE "Product"
  ADD COLUMN "originalQuantity" DECIMAL(12,3),
  ADD COLUMN "remainingQuantity" DECIMAL(12,3);

UPDATE "Product"
SET "originalQuantity" = "quantity", "remainingQuantity" = "quantity"
WHERE "quantity" IS NOT NULL AND "unit" IS NOT NULL;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_inventory_pair_check" CHECK (("originalQuantity" IS NULL) = ("remainingQuantity" IS NULL)),
  ADD CONSTRAINT "Product_inventory_positive_check" CHECK ("originalQuantity" IS NULL OR "originalQuantity" > 0),
  ADD CONSTRAINT "Product_inventory_remaining_check" CHECK ("remainingQuantity" IS NULL OR ("remainingQuantity" >= 0 AND "remainingQuantity" <= "originalQuantity"));

ALTER TABLE "Deal"
  ADD COLUMN "quantity" DECIMAL(12,3),
  ADD COLUMN "unit" "ListingUnit";

ALTER TABLE "Deal"
  ADD CONSTRAINT "Deal_quantity_unit_pair_check" CHECK (("quantity" IS NULL) = ("unit" IS NULL)),
  ADD CONSTRAINT "Deal_quantity_positive_check" CHECK ("quantity" IS NULL OR "quantity" > 0);
