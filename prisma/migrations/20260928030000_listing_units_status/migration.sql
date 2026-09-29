CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'RESERVED', 'SOLD', 'INACTIVE');
CREATE TYPE "ListingUnit" AS ENUM ('ITEM', 'KG', 'G', 'TONNE', 'LITRE', 'ML', 'DOZEN', 'BAG', 'SACK', 'BOX', 'CRATE', 'BUNDLE');

ALTER TABLE "Product"
ADD COLUMN "quantity" DECIMAL(12,3),
ADD COLUMN "unit" "ListingUnit",
ADD COLUMN "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Product" ADD CONSTRAINT "Product_quantity_unit_check" CHECK (
  ("quantity" IS NULL AND "unit" IS NULL) OR
  ("quantity" IS NOT NULL AND "unit" IS NOT NULL AND "quantity" > 0 AND "quantity" <= 999999999.999)
);
