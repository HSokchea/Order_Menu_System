
-- Add 200-character limit to customer_notes on tb_order_temporary
ALTER TABLE public.tb_order_temporary
  ADD CONSTRAINT chk_customer_notes_length CHECK (length(customer_notes) <= 200);

-- Add 200-character limit to customer_notes on tb_his_admin
ALTER TABLE public.tb_his_admin
  ADD CONSTRAINT chk_his_customer_notes_length CHECK (length(customer_notes) <= 200);

-- Add 200-character limit to customer_notes on orders table
ALTER TABLE public.orders
  ADD CONSTRAINT chk_orders_customer_notes_length CHECK (length(customer_notes) <= 200);
