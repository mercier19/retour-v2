export type AppRole = 'operations' | 'chef_agence' | 'regional' | 'super_admin';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

export interface UserWarehouse {
  user_id: string;
  warehouse_id: string;
}

export interface Box {
  id: string;
  warehouse_id: string;
  name: string;
  quota: number | null;
  created_at: string;
}

export interface Parcel {
  id: string;
  warehouse_id: string;
  tracking: string;
  box_id: string | null;
  boutique: string | null;
  wilaya: string | null;
  commune: string | null;
  status: string | null;
  is_missing: boolean | null;
  given_at: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArchivedParcel {
  id: string;
  warehouse_id: string;
  tracking: string;
  box_name: string | null;
  boutique: string | null;
  wilaya: string | null;
  commune: string | null;
  status: string | null;
  archived_at: string;
  created_at: string | null;
}
