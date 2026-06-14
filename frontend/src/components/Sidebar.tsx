import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Truck, Brain, ShoppingBag, BarChart3, Building2, CheckCircle2 } from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  
  const menuItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'Inventory', path: '/inventory', icon: <Package size={20} /> },
    { name: 'Point of Sale', path: '/pos', icon: <ShoppingCart size={20} /> },
    { name: 'ZuriShop', path: '/zurishop', icon: <ShoppingBag size={20} /> },
    { name: 'Orders Pipeline', path: '/orders', icon: <Truck size={20} /> },
    { name: 'Manager Approvals', path: '/approvals', icon: <CheckCircle2 size={20} /> },
    { name: 'Supplier Portal', path: '/supplier-portal', icon: <Building2 size={20} /> },
  ];

  return (
    <div className="hidden md:flex flex-col w-64 bg-base-100 shadow-xl z-10 border-r border-base-200">
      <div className="flex items-center justify-center h-16 border-b border-base-200">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <Brain className="text-primary animate-pulse" size={24} />
          <span>StockIQ</span>
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
