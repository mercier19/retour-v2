import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWarehouse } from '@/contexts/WarehouseContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const WarehouseSelector: React.FC = () => {
  const { warehouses } = useAuth();
  const { currentWarehouse, setCurrentWarehouse } = useWarehouse();

  if (warehouses.length <= 1) return null;

  return (
    <Select
      value={currentWarehouse?.id || ''}
      onValueChange={(id) => {
        const w = warehouses.find((w) => w.id === id);
        if (w) setCurrentWarehouse(w);
      }}
    >
      <SelectTrigger className="w-[220px] bg-sidebar-accent text-sidebar-foreground border-sidebar-border">
        <SelectValue placeholder="Sélectionner un dépôt" />
      </SelectTrigger>
      <SelectContent>
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
