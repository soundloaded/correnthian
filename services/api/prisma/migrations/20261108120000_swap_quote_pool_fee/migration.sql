-- The Uniswap v3 fee tier that produced a dex quote: 500, 3000, or 10000.
-- Null when every tier failed or the quote never reached a pool, so a later
-- execution step does not invent one. A public pool fee, not key material.
ALTER TABLE "SwapQuote" ADD COLUMN "poolFee" INTEGER;
