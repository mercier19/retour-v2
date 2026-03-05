import { useWarehouse } from '@/contexts/WarehouseContext';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types/database';

export const useWarehouseFilter = () => {
  const { currentWarehouse } = useWarehouse();
  const { profile } = useAuth();

  const warehouseId = currentWarehouse?.id || null;

  const hasRole = (...roles: AppRole[]) => {
    return profile?.role ? roles.includes(profile.role) : false;
  };

  const canManageBoxes = hasRole('chef_agence', 'regional', 'super_admin');
  const canManageStock = hasRole('chef_agence', 'regional', 'super_admin');
  const isAdmin = hasRole('super_admin');

  return {
    warehouseId,
    currentWarehouse,
    profile,
    hasRole,
    canManageBoxes,
    canManageStock,
    isAdmin,
  };
};
