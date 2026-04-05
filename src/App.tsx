import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WarehouseProvider } from "@/contexts/WarehouseContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/components/Login";
import { useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

const AuthGate = () => {
  const { loading, user } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }
  if (!user) return <Login />;
  return (
    <WarehouseProvider>
      <PermissionProvider>
        <AppLayout />
      </PermissionProvider>
    </WarehouseProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/*" element={<AuthGate />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
