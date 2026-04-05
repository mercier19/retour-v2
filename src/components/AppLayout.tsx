import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWarehouse } from '@/contexts/WarehouseContext';
import { usePermission } from '@/hooks/usePermission';
import WarehouseSelector from '@/components/WarehouseSelector';
import Dashboard from '@/components/Dashboard';
import AddParcel from '@/components/AddParcel';
import Boxes from '@/components/Boxes';
import DonnerRetours from '@/components/DonnerRetours';
import StockControl from '@/components/StockControl';
import Statistics from '@/components/Statistics';
import AdvancedStatistics from '@/components/AdvancedStatistics';
import SearchParcels from '@/components/SearchParcels';
import TransferParcels from '@/components/TransferParcels';
import Users from '@/components/admin/Users';
import Warehouses from '@/components/admin/Warehouses';
import Permissions from '@/components/admin/Permissions';
import { Button } from '@/components/ui/button';
import yalidinelogo from '@/assets/logo_yalidine.png';
import InventorySchedule from '@/components/InventorySchedule';
import InventoryExecution from '@/components/InventoryExecution';
import {
  LayoutDashboard, Plus, BoxIcon, HandCoins, PackageCheck, BarChart3,
  Search, Users as UsersIcon, Building2, LogOut, Menu, X,
  ArrowRightLeft, ClipboardCheck, Shield,
} from 'lucide-react';

type Page = 'dashboard' | 'add' | 'boxes' | 'retours' | 'stock' | 'stats' | 'advanced-stats' | 'search' | 'transfer' | 'inventory' | 'users' | 'warehouses' | 'permissions';

const NAV_PERMISSION_MAP: Record<string, string> = {
  dashboard: 'page_dashboard',
  add: 'page_add_parcel',
  boxes: 'page_boxes',
  retours: 'page_donner_retours',
  stock: 'page_stock_control',
  stats: 'page_statistics',
  'advanced-stats': 'page_advanced_stats',
  search: 'page_search',
  transfer: 'page_transfer',
  inventory: 'page_inventory',
  users: 'page_admin_users',
  warehouses: 'page_admin_warehouses',
  permissions: 'page_admin_permissions',
};

const AppLayout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const { currentWarehouse } = useWarehouse();
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Permission checks for each page
  const canDashboard = usePermission('page_dashboard');
  const canAdd = usePermission('page_add_parcel');
  const canBoxes = usePermission('page_boxes');
  const canRetours = usePermission('page_donner_retours');
  const canStock = usePermission('page_stock_control');
  const canStats = usePermission('page_statistics');
  const canAdvStats = usePermission('page_advanced_stats');
  const canSearch = usePermission('page_search');
  const canTransfer = usePermission('page_transfer');
  const canInventory = usePermission('page_inventory');
  const canUsers = usePermission('page_admin_users');
  const canWarehouses = usePermission('page_admin_warehouses');
  const canPermissions = usePermission('page_admin_permissions');

  if (!currentWarehouse) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Aucun dépôt assigné. Contactez un administrateur.</p>
          <Button variant="outline" onClick={signOut}>Se déconnecter</Button>
        </div>
      </div>
    );
  }

  const navItems: { id: Page; label: string; icon: React.ElementType; show: boolean }[] = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, show: canDashboard },
    { id: 'add', label: 'Ajouter', icon: Plus, show: canAdd },
    { id: 'boxes', label: 'Boxes', icon: BoxIcon, show: canBoxes },
    { id: 'retours', label: 'Donner retours', icon: HandCoins, show: canRetours },
    { id: 'stock', label: 'Contrôle stock', icon: PackageCheck, show: canStock },
    { id: 'stats', label: 'Statistiques', icon: BarChart3, show: canStats },
    { id: 'advanced-stats', label: 'Stats avancées', icon: BarChart3, show: canAdvStats },
    { id: 'search', label: 'Rechercher', icon: Search, show: canSearch },
    { id: 'transfer', label: 'Transférer', icon: ArrowRightLeft, show: canTransfer },
    { id: 'inventory', label: 'Inventaires', icon: ClipboardCheck, show: canInventory },
    { id: 'users', label: 'Utilisateurs', icon: UsersIcon, show: canUsers },
    { id: 'warehouses', label: 'Dépôts', icon: Building2, show: canWarehouses },
    { id: 'permissions', label: 'Permissions', icon: Shield, show: canPermissions },
  ];

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return canDashboard ? <Dashboard /> : null;
      case 'add': return canAdd ? <AddParcel /> : null;
      case 'boxes': return canBoxes ? <Boxes /> : null;
      case 'retours': return canRetours ? <DonnerRetours /> : null;
      case 'stock': return canStock ? <StockControl /> : null;
      case 'stats': return canStats ? <Statistics /> : null;
      case 'advanced-stats': return canAdvStats ? <AdvancedStatistics /> : null;
      case 'search': return canSearch ? <SearchParcels /> : null;
      case 'transfer': return canTransfer ? <TransferParcels /> : null;
      case 'inventory': return canInventory ? (
        <div className="space-y-8">
          <InventorySchedule />
          <InventoryExecution />
        </div>
      ) : null;
      case 'users': return canUsers ? <Users /> : null;
      case 'warehouses': return canWarehouses ? <Warehouses /> : null;
      case 'permissions': return canPermissions ? <Permissions /> : null;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar transform transition-transform duration-200 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
            <img alt="Yalidine" className="h-8 brightness-0 invert" src="/lovable-uploads/24bc57ab-84b1-4b7c-a9a7-1ed16fe9536f.png" />
            <div className="ml-auto flex items-center gap-2">
              <p className="text-xs text-sidebar-foreground/60">{currentWarehouse.name}</p>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-sidebar-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="p-3">
            <WarehouseSelector />
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.filter((item) => item.show).map((item) =>
              <button
                key={item.id}
                onClick={() => { setPage(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  page === item.id
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            )}
          </nav>
          <div className="p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-foreground">
                {(profile?.full_name || profile?.email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{profile?.full_name || profile?.email}</p>
                <p className="text-xs text-sidebar-foreground/50 capitalize">{profile?.role?.replace('_', ' ')}</p>
              </div>
              <button onClick={signOut} className="text-sidebar-foreground/50 hover:text-sidebar-foreground">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 lg:hidden flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <img src={yalidinelogo} alt="Yalidine" className="h-6" />
        </header>
        <div className="p-4 lg:p-6 max-w-6xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
