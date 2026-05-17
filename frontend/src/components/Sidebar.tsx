import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Users, Truck, Settings } from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  
  const menuItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'Inventory', path: '/inventory', icon: <Package size={20} /> },
    { name: 'Point of Sale', path: '/pos', icon: <ShoppingCart size={20} /> },
    { name: 'Customers', path: '/customers', icon: <Users size={20} /> },
    { name: 'Suppliers', path: '/suppliers', icon: <Truck size={20} /> },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="hidden md:flex flex-col w-64 bg-base-100 shadow-xl z-10">
      <div className="flex items-center justify-center h-16 border-b border-base-200">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <Package className="text-primary" />
          StockIQ
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
