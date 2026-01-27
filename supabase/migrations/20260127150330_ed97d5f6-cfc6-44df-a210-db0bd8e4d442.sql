-- Add missing columns to tb_order_temporary
ALTER TABLE tb_order_temporary 
ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'takeaway',
ADD COLUMN IF NOT EXISTS table_id uuid;

-- Add missing columns to tb_his_admin
ALTER TABLE tb_his_admin 
ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'takeaway',
ADD COLUMN IF NOT EXISTS table_id uuid,
ADD COLUMN IF NOT EXISTS table_number text;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tb_order_temporary_table_id ON tb_order_temporary(table_id);
CREATE INDEX IF NOT EXISTS idx_tb_order_temporary_order_type ON tb_order_temporary(order_type);
CREATE INDEX IF NOT EXISTS idx_tb_his_admin_table_id ON tb_his_admin(table_id);
CREATE INDEX IF NOT EXISTS idx_tb_his_admin_order_type ON tb_his_admin(order_type);