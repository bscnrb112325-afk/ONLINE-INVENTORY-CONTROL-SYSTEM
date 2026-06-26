import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUser, SignIn, SignUp } from '@clerk/clerk-react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import Orders from './pages/Orders';
import AIInsightsPage from './pages/AIInsightsPage';
import ZuriShop from './pages/ZuriShop';
import Reports from './pages/Reports';
import SupplierPortal from './pages/SupplierPortal';
import ManagerApprovals from './pages/ManagerApprovals';
import Settings from './pages/Settings';
import { SettingsProvider } from './context/SettingsContext';
import { api } from './api';
import { useEffect, useState } from 'react';

const HomeRedirect = ({ module }: { module?: string }) => {
  switch (module) {
    case 'inventory': return <Navigate to="/inventory" replace />;
    case 'point_of_sale': return <Navigate to="/pos" replace />;
    case 'orders_pipeline': return <Navigate to="/orders" replace />;
    case 'manager_approvals': return <Navigate to="/approvals" replace />;
    case 'supplier_portal': return <Navigate to="/supplier-portal" replace />;
    case 'settings': return <Navigate to="/settings" replace />;
    case 'dashboard':
    default:
      return <Dashboard />;
  }
};

function App() {
  const { user, isSignedIn, isLoaded } = useUser();
  const [dbUser, setDbUser] = useState<any>(null);

  useEffect(() => {
    if (isSignedIn && user) {
      // Sync user to DB and get their role
      api.post('/users/sync', {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName || user.firstName,
        imageUrl: user.imageUrl,
      }).then(res => {
        setDbUser(res.data);
        localStorage.setItem('userRole', res.data.role || 'user');
        if (res.data.module) {
          localStorage.setItem('userModule', res.data.module);
        }
      }).catch(err => {
        console.error('Failed to sync user', err);
      });
    }
  }, [isSignedIn, user]);

  if (!isLoaded || (isSignedIn && !dbUser)) {
    return <div className="flex h-screen items-center justify-center"><span className="loading loading-spinner loading-lg text-primary"></span></div>;
  }

  return (
    <BrowserRouter>
      <SettingsProvider>
        <div className="min-h-screen bg-base-200 text-base-content font-sans">
          <Routes>
            {/* Public Routes */}
            <Route path="/sign-in/*" element={<div className="flex h-screen items-center justify-center bg-base-200"><SignIn routing="path" path="/sign-in" /></div>} />
            <Route path="/sign-up/*" element={<div className="flex h-screen items-center justify-center bg-base-200"><SignUp routing="path" path="/sign-up" /></div>} />
            
            {/* Protected Routes */}
            {isSignedIn ? (
              <Route path="/" element={<Layout />}>
                <Route index element={<HomeRedirect module={dbUser?.module} />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="pos" element={<POS />} />
                <Route path="orders" element={<Orders />} />
                <Route path="ai-insights" element={<AIInsightsPage />} />
                <Route path="zurishop" element={<ZuriShop />} />
                <Route path="reports" element={<Reports />} />
                <Route path="supplier-portal" element={<SupplierPortal />} />
                <Route path="approvals" element={<ManagerApprovals />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            ) : (
              <Route path="*" element={<Navigate to="/sign-in" replace />} />
            )}
          </Routes>
        </div>
      </SettingsProvider>
    </BrowserRouter>
  );
}

export default App;
