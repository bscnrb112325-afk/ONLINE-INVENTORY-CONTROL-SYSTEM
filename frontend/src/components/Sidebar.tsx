import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Truck, Brain, ShoppingBag, BarChart3, Building2, CheckCircle2, Settings as SettingsIcon } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

const Sidebar = () => {
  const location = useLocation();
  const { settings } = useSettings();
  
  const menuItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'Inventory', path: '/inventory', icon: <Package size={20} /> },
    { name: 'Point of Sale', path: '/pos', icon: <ShoppingCart size={20} /> },
    { name: 'ZuriShop', path: '/zurishop', icon: <ShoppingBag size={20} /> },
    { name: 'Orders Pipeline', path: '/orders', icon: <Truck size={20} /> },
    { name: 'Manager Approvals', path: '/approvals', icon: <CheckCircle2 size={20} /> },
    { name: 'Supplier Portal', path: '/supplier-portal', icon: <Building2 size={20} /> },
    { name: 'Settings', path: '/settings', icon: <SettingsIcon size={20} /> },
  ];

  return (
    <div className="hidden md:flex flex-col w-64 bg-base-100 shadow-xl z-10 border-r border-base-200">
      <div className="flex items-center min-h-20 border-b border-base-200 px-4 py-4">
        <h1 className="text-base font-bold text-primary flex w-full items-center justify-between gap-3 overflow-hidden">
          <span className="truncate leading-tight text-left">{settings?.companyName || 'OICS'}</span>
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-12 w-auto max-w-[50%] object-contain rounded shrink-0" />
          ) : (
            <Brain className="text-primary animate-pulse shrink-0" size={36} />
          )}
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <ul className="menu w-full px-4 gap-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.name}>
                <Link
                  to={item.path}
                  className={`flex gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary text-primary-content active:bg-primary/90' 
                      : 'hover:bg-base-200 text-base-content/80 hover:text-base-content'
                  }`}
                >
                  {item.icon}
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
