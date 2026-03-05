import React, { createContext, useContext, useEffect, useState } from 'react';
import { Warehouse } from '@/types/database';
import { useAuth } from './AuthContext';

interface WarehouseContextType {
  currentWarehouse: Warehouse | null;
  setCurrentWarehouse: (warehouse: Warehouse) => void;
  showAll: boolean;
  setShowAll: (show: boolean) => void;
  allWarehouseIds: string[];
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

export const WarehouseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { warehouses } = useAuth();
  const [currentWarehouse, setCurrentWarehouseState] = useState<Warehouse | null>(null);
  const [showAll, setShowAllState] = useState(false);

  useEffect(() => {
    if (warehouses.length > 0 && !currentWarehouse) {
      const savedId = localStorage.getItem('selectedWarehouseId');
      if (savedId === '__all__' && warehouses.length > 1) {
        setShowAllState(true);
        setCurrentWarehouseState(warehouses[0]);
      } else {
        const saved = warehouses.find((w) => w.id === savedId);
        setCurrentWarehouseState(saved || warehouses[0]);
      }
    }
    if (warehouses.length === 0) {
      setCurrentWarehouseState(null);
      setShowAllState(false);
    }
  }, [warehouses]);

  const setCurrentWarehouse = (warehouse: Warehouse) => {
    setCurrentWarehouseState(warehouse);
    setShowAllState(false);
    localStorage.setItem('selectedWarehouseId', warehouse.id);
  };

  const setShowAll = (show: boolean) => {
    setShowAllState(show);
    if (show) {
      localStorage.setItem('selectedWarehouseId', '__all__');
    } else if (currentWarehouse) {
      localStorage.setItem('selectedWarehouseId', currentWarehouse.id);
    }
  };

  const allWarehouseIds = warehouses.map((w) => w.id);

  return (
    <WarehouseContext.Provider value={{ currentWarehouse, setCurrentWarehouse, showAll, setShowAll, allWarehouseIds }}>
      {children}
    </WarehouseContext.Provider>
  );
};

export const useWarehouse = () => {
  const context = useContext(WarehouseContext);
  if (!context) throw new Error('useWarehouse must be used within WarehouseProvider');
  return context;
};
