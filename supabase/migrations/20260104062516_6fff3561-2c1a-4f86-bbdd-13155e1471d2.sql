-- Add exchange rate column to restaurants table
ALTER TABLE public.restaurants
ADD COLUMN exchange_rate_usd_to_khr INTEGER DEFAULT 4100;

-- Add comment for documentation
COMMENT ON COLUMN public.restaurants.exchange_rate_usd_to_khr IS 'Exchange rate: 1 USD = X KHR. Integer only (no decimals). Cambodia standard.';