-- Country for the breeder's second address; IS_DEFAULT_ADDRESS_1 already picks the default.
ALTER TABLE "Breeders" ADD COLUMN IF NOT EXISTS "COUNTRY_2" TEXT;
