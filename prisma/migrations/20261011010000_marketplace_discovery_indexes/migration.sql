CREATE INDEX "Product_status_createdAt_idx" ON "Product"("status", "createdAt");
CREATE INDEX "Product_status_price_idx" ON "Product"("status", "price");
CREATE INDEX "Product_status_commodity_variety_grade_idx" ON "Product"("status", "commodity", "variety", "grade");
CREATE INDEX "Product_status_country_idx" ON "Product"("status", "country");
CREATE INDEX "Product_status_unit_idx" ON "Product"("status", "unit");
