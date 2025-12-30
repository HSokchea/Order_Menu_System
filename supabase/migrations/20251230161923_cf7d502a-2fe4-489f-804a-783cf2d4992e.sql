-- Enable REPLICA IDENTITY FULL for realtime to capture complete row data
ALTER TABLE public.orders REPLICA IDENTITY FULL;