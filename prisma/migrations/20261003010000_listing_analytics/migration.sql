CREATE TABLE "ProductView" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "viewerKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductView_productId_viewerKey_key" ON "ProductView"("productId", "viewerKey");
CREATE INDEX "ProductView_productId_createdAt_idx" ON "ProductView"("productId", "createdAt");
CREATE INDEX "ProductView_viewerKey_idx" ON "ProductView"("viewerKey");
ALTER TABLE "ProductView" ADD CONSTRAINT "ProductView_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
