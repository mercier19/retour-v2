import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWarehouse } from '@/contexts/WarehouseContext';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import WarehouseSelector from '@/components/WarehouseSelector';
import Dashboard from '@/components/Dashboard';
import AddParcel from '@/components/AddParcel';
import Boxes from '@/components/Boxes';
import DonnerRetours from '@/components/DonnerRetours';
import StockControl from '@/components/StockControl';
import Statistics from '@/components/Statistics';
import SearchParcels from '@/components/SearchParcels';
import Users from '@/components/admin/Users';
import Warehouses from '@/components/admin/Warehouses';
import { Button } from '@/components/ui/button';
import yalidinelogo from '@/assets/logo_yalidine.png';
import {
  LayoutDashboard,
  Plus,
  BoxIcon,
  HandCoins,
  PackageCheck,
  BarChart3,
  Search,
  Users as UsersIcon,
  Building2,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

type Page = 'dashboard' | 'add' | 'boxes' | 'retours' | 'stock' | 'stats' | 'search' | 'users' | 'warehouses';

const AppLayout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const { currentWarehouse } = useWarehouse();
  const { hasRole, isAdmin, canManageBoxes, canManageStock } = useWarehouseFilter();
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, show: true },
    { id: 'add', label: 'Ajouter', icon: Plus, show: true },
    { id: 'boxes', label: 'Boxes', icon: BoxIcon, show: canManageBoxes },
    { id: 'retours', label: 'Donner retours', icon: HandCoins, show: true },
    { id: 'stock', label: 'Contrôle stock', icon: PackageCheck, show: canManageStock },
    { id: 'stats', label: 'Statistiques', icon: BarChart3, show: true },
    { id: 'search', label: 'Rechercher', icon: Search, show: true },
    { id: 'users', label: 'Utilisateurs', icon: UsersIcon, show: isAdmin },
    { id: 'warehouses', label: 'Dépôts', icon: Building2, show: isAdmin },
  ];

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'add': return <AddParcel />;
      case 'boxes': return canManageBoxes ? <Boxes /> : null;
      case 'retours': return <DonnerRetours />;
      case 'stock': return canManageStock ? <StockControl /> : null;
      case 'stats': return <Statistics />;
      case 'search': return <SearchParcels />;
      case 'users': return isAdmin ? <Users /> : null;
      case 'warehouses': return isAdmin ? <Warehouses /> : null;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar transform transition-transform duration-200 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
            <div className="w-9 h-9 bg-sidebar-primary rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-sidebar-foreground text-sm" style={{ fontFamily: 'var(--font-display)' }}>Yalidine</h1>
              <p className="text-xs text-sidebar-foreground/60">{currentWarehouse.name}</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-sidebar-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Warehouse Selector */}
          <div className="p-3">
            <WarehouseSelector />
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.filter((item) => item.show).map((item) => (
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
            ))}
          </nav>

          {/* User */}
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

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 lg:hidden flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-medium text-sm" style={{ fontFamily: 'var(--font-display)' }}>Yalidine</span>
        </header>
        <div className="p-4 lg:p-6 max-w-6xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
