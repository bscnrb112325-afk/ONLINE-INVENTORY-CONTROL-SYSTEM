import { Package, TrendingUp, AlertCircle, DollarSign } from 'lucide-react';

const StatCard = ({ title, value, icon, trend, isPositive }: any) => (
  <div className="stat bg-base-100 shadow-sm rounded-2xl border border-base-200">
    <div className="stat-figure text-primary">
      {icon}
    </div>
    <div className="stat-title text-base-content/70">{title}</div>
    <div className="stat-value text-3xl">{value}</div>
    <div className={`stat-desc font-medium flex items-center gap-1 ${isPositive ? 'text-success' : 'text-error'}`}>
      {trend}
    </div>
  </div>
);

const Dashboard = () => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-base-content">Dashboard Overview</h2>
        <p className="text-base-content/70 mt-1">Real-time inventory and sales metrics.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Revenue" 
          value="$45,231.89" 
          icon={<DollarSign size={32} className="opacity-80" />} 
          trend="↗︎ +20.1% from last month" 
          isPositive={true} 
        />
        <StatCard 
          title="Sales" 
          value="+2350" 
          icon={<TrendingUp size={32} className="opacity-80" />} 
          trend="↗︎ +180 this week" 
          isPositive={true} 
        />
        <StatCard 
          title="Active Inventory" 
          value="12,234" 
          icon={<Package size={32} className="opacity-80" />} 
          trend="12 items low stock" 
          isPositive={false} 
        />
        <StatCard 
          title="Low Stock Alerts" 
          value="12" 
          icon={<AlertCircle size={32} className="text-error opacity-80" />} 
          trend="Needs immediate action" 
          isPositive={false} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6 min-h-[400px]">
          <h3 className="text-lg font-bold mb-4">Sales Analytics</h3>
          {/* Chart placeholder */}
          <div className="w-full h-[300px] flex items-center justify-center bg-base-200 rounded-xl border border-base-300">
             <span className="text-base-content/50">Chart loading...</span>
          </div>
        </div>
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6">
          <h3 className="text-lg font-bold mb-4">Fast Moving Items</h3>
          <ul className="space-y-4">
             {/* List placeholder */}
             {[1, 2, 3, 4, 5].map((i) => (
                <li key={i} className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-base-200 rounded-lg flex items-center justify-center">
                    <Package size={20} className="text-base-content/50" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">Product Item #{i}</h4>
                    <p className="text-xs text-base-content/60">Category Name</p>
                  </div>
                  <div className="font-bold text-sm text-success">+34 sold</div>
                </li>
             ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
