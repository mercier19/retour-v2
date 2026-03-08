ALTER TABLE parcels ADD COLUMN misrouted_at_warehouse_id UUID REFERENCES warehouses(id) NULL;
ALTER TABLE transfer_history ADD COLUMN misrouted_at_warehouse_id UUID REFERENCES warehouses(id) NULL;