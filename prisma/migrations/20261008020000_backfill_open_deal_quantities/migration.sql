UPDATE "Deal" AS deal
SET "quantity" = COALESCE(product."remainingQuantity", product."quantity"),
    "unit" = product."unit"
FROM "Product" AS product
WHERE deal."productId" = product.id
  AND deal.status IN ('PENDING', 'BUYER_CONFIRMED', 'SELLER_CONFIRMED')
  AND deal."quantity" IS NULL
  AND product."unit" IS NOT NULL
  AND COALESCE(product."remainingQuantity", product."quantity") > 0;
