-- One fine troy ounce is 31.1034768 grams.
--
-- DECIMAL(18,6) rounds that to 31.103477, so a seeded PAXG or XAUT row cannot
-- carry the gram weight the catalog states. Seven fractional digits store
-- 31.1034768 exactly. Widening the scale does not change values already stored.
--
-- No key material. This column is a published unit ratio.
ALTER TABLE "Asset" ALTER COLUMN "gramsPerToken" TYPE DECIMAL(18,7);
