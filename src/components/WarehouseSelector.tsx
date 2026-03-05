import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWarehouse } from '@/contexts/WarehouseContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const WarehouseSelector: React.FC = () => {
  const { warehouses } = useAuth();
  const { currentWarehouse, setCurrentWarehouse, showAll, setShowAll } = useWarehouse();

  if (warehouses.length <= 1) return null;

  const currentValue = showAll ? '__all__' : (currentWarehouse?.id || '');

  return (
    <Select
      value={currentValue}
      onValueChange={(id) => {
        if (id === '__all__') {
          setShowAll(true);
        } else {
          const w = warehouses.find((w) => w.id === id);
          if (w) setCurrentWarehouse(w);
        }
      }}
    >
      <SelectTrigger className="w-full bg-sidebar-accent text-sidebar-foreground border-sidebar-border">
        <SelectValue placeholder="Sélectionner un dépôt" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">📊 Tous les dépôts</SelectItem>
        {warehouses.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default WarehouseSelector;
