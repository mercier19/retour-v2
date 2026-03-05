import { useWarehouse } from '@/contexts/WarehouseContext';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types/database';

export const useWarehouseFilter = () => {
  const { currentWarehouse, showAll, allWarehouseIds } = useWarehouse();
  const { profile } = useAuth();

  const warehouseId = showAll ? null : (currentWarehouse?.id || null);
  const warehouseIds = showAll ? allWarehouseIds : (currentWarehouse ? [currentWarehouse.id] : []);

  const hasRole = (...roles: AppRole[]) => {
    return profile?.role ? roles.includes(profile.role) : false;
  };

  const canManageBoxes = hasRole('chef_agence', 'regional', 'super_admin');
  const canManageStock = hasRole('regional', 'super_admin');
  const isAdmin = hasRole('super_admin');

  return {
    warehouseId,
    warehouseIds,
    showAll,
    currentWarehouse,
    profile,
    hasRole,
    canManageBoxes,
    canManageStock,
    isAdmin,
  };
};
