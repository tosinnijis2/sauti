ALTER TABLE "SavedSearch"
  ADD COLUMN "queryCommodities" "Commodity"[] NOT NULL DEFAULT ARRAY[]::"Commodity"[],
  ADD COLUMN "queryVarieties" "CommodityVariety"[] NOT NULL DEFAULT ARRAY[]::"CommodityVariety"[],
  ADD COLUMN "queryGrades" "SellerGrade"[] NOT NULL DEFAULT ARRAY[]::"SellerGrade"[];
