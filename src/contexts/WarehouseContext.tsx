import React, { createContext, useContext, useEffect, useState } from 'react';
import { Warehouse } from '@/types/database';
import { useAuth } from './AuthContext';

interface WarehouseContextType {
  currentWarehouse: Warehouse | null;
  setCurrentWarehouse: (warehouse: Warehouse) => void;
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

export const WarehouseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { warehouses } = useAuth();
  const [currentWarehouse, setCurrentWarehouseState] = useState<Warehouse | null>(null);

  useEffect(() => {
    if (warehouses.length > 0 && !currentWarehouse) {
      const savedId = localStorage.getItem('selectedWarehouseId');
      const saved = warehouses.find((w) => w.id === savedId);
      setCurrentWarehouseState(saved || warehouses[0]);
    }
    if (warehouses.length === 0) {
      setCurrentWarehouseState(null);
    }
  }, [warehouses]);

  const setCurrentWarehouse = (warehouse: Warehouse) => {
    setCurrentWarehouseState(warehouse);
    localStorage.setItem('selectedWarehouseId', warehouse.id);
  };

  return (
    <WarehouseContext.Provider value={{ currentWarehouse, setCurrentWarehouse }}>
      {children}
    </WarehouseContext.Provider>
  );
};

export const useWarehouse = () => {
  const context = useContext(WarehouseContext);
  if (!context) throw new Error('useWarehouse must be used within WarehouseProvider');
  return context;
};
