import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Package, TrendingUp, AlertCircle, DollarSign, Brain, Sparkles, Bell, BellOff, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const StatCard = ({ title, value, icon, trend, isPositive }: any) => (
  <div className="stat bg-base-100 shadow-md rounded-2xl border border-base-200 p-6 flex items-center justify-between hover:scale-[1.02] transition-transform duration-200">
    <div className="space-y-2">
      <div className="stat-title text-sm font-semibold text-base-content/60">{title}</div>
      <div className="stat-value text-3xl font-extrabold text-base-content">{value}</div>
      <div className={`stat-desc text-xs font-bold flex items-center gap-1 ${isPositive ? 'text-success' : 'text-error'}`}>
        {trend}
      </div>
    </div>
    <div className="p-4 bg-base-200/50 rounded-2xl text-primary">
      {icon}
    </div>
  </div>
);

const Dashboard = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource('http://localhost:5000/api/stream');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (['STOCK_UPDATED', 'LOW_STOCK_DETECTED', 'OUT_OF_STOCK'].includes(data.type)) {
        queryClient.invalidateQueries({ queryKey: ['goods'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['insights'] });
      }
    };
    return () => eventSource.close();
  }, [queryClient]);

  // Fetch sales
  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const res = await api.get('/sales');
      return res.data;
    }
  });

  // Fetch goods
  const { data: goodsList = [], isLoading: goodsLoading } = useQuery({
    queryKey: ['goods'],
    queryFn: async () => {
      const res = await api.get('/inventory/goods');
      return res.data;
    }
  });

  // Fetch notifications
  const { data: notifications = [], isLoading: notifsLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/ai/notifications');
      return res.data;
    }
  });

  // Fetch AI Insights
  const { data: insights = [], isLoading: insightsLoading } = useQuery({
    queryKey: ['insights'],
    queryFn: async () => {
      const res = await api.get('/ai/insights');
      return res.data;
    }
  });

  // Read notification mutation
  const readNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/ai/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  if (salesLoading || goodsLoading || notifsLoading || insightsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  // Calculate statistics
  const totalRevenue = sales.reduce((acc: number, curr: any) => acc + parseFloat(curr.totalAmount), 0);
  const activeInventoryCount = goodsList.reduce((acc: number, curr: any) => acc + curr.qty, 0);
  const lowStockAlerts = goodsList.filter((g: any) => g.qty <= 3).length;
  const unreadNotifs = notifications.filter((n: any) => n.status === 'unread');

  // SVG Chart data calculations (last 7 sales or grouped weekly)
  const chartPoints = sales.slice(-6).map((sale: any, index: number) => ({
    x: 50 + index * 90,
    y: 200 - (parseFloat(sale.totalAmount) / Math.max(...sales.map((s: any) => parseFloat(s.totalAmount) || 100))) * 120,
    label: `KSh ${parseFloat(sale.totalAmount).toFixed(0)}`,
  }));

  // Fast moving items
  const itemSalesCounts: Record<string, number> = {};
  sales.forEach((s: any) => {
    s.saleItems?.forEach((item: any) => {
      const key = item.good?.subCategory?.name || 'Item';
      itemSalesCounts[key] = (itemSalesCounts[key] || 0) + item.quantity;
    });
  });
  const fastMovingItems = Object.entries(itemSalesCounts)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 4);

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      {/* Welcome & Live Alert Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-base-content tracking-tight">System Control Panel</h2>
          <p className="text-base-content/60 mt-1">Real-time indicators, smart workflows, and algorithmic analytics.</p>
        </div>
        {unreadNotifs.length > 0 && (
          <div className="alert alert-warning shadow-sm py-2 px-4 rounded-xl flex gap-2 w-auto animate-bounce text-xs font-semibold">
            <AlertCircle size={16} />
            <span>You have {unreadNotifs.length} unread stock/payment alerts!</span>
          </div>
        )}
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Revenue" 
          value={`KSh ${totalRevenue.toFixed(2)}`} 
          icon={<DollarSign size={24} />} 
          trend="↗︎ Live transactional updates" 
          isPositive={true} 
        />
        <StatCard 
          title="Checkout Transactions" 
          value={sales.length} 
          icon={<TrendingUp size={24} />} 
          trend="↗︎ Updated in real-time" 
          isPositive={true} 
        />
        <StatCard 
          title="Active Inventory" 
          value={`${activeInventoryCount} Units`} 
          icon={<Package size={24} />} 
          trend={`${lowStockAlerts} items low stock`} 
          isPositive={lowStockAlerts === 0} 
        />
        <StatCard 
          title="Critical Alerts" 
          value={lowStockAlerts} 
          icon={<AlertCircle size={24} className={lowStockAlerts > 0 ? "text-error animate-pulse" : ""} />} 
          trend={lowStockAlerts > 0 ? "Action recommended" : "Stock level healthy"} 
          isPositive={lowStockAlerts === 0} 
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns - SVG Chart & AI predictions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue Analytics Chart */}
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp size={20} className="text-primary" />
                <span>Sales & Revenue Analytics</span>
              </h3>
              <Link to="/reports" className="btn btn-ghost btn-xs text-primary flex items-center gap-1 font-semibold">
                <span>View Full Reports</span>
                <ArrowRight size={14} />
              </Link>
            </div>
            
            <div className="w-full h-56 bg-base-200/20 rounded-2xl p-4 border border-base-200 relative overflow-hidden flex items-end">
              {chartPoints.length < 2 ? (
                <div className="w-full h-full flex items-center justify-center text-base-content/50 text-sm">
                  Insufficient sales data to plot revenue trend.
                </div>
              ) : (
                <svg className="w-full h-full" viewBox="0 0 600 200">
                  {/* Grid Lines */}
                  <line x1="40" y1="40" x2="550" y2="40" stroke="rgba(156,163,175,0.1)" strokeWidth="1" />
                  <line x1="40" y1="100" x2="550" y2="100" stroke="rgba(156,163,175,0.1)" strokeWidth="1" />
                  <line x1="40" y1="160" x2="550" y2="160" stroke="rgba(156,163,175,0.1)" strokeWidth="1" />
                  
                  {/* Revenue Line */}
                  <path
                    d={`M ${chartPoints.map((p: any) => `${p.x} ${p.y}`).join(' L ')}`}
                    fill="none"
                    stroke="var(--color-primary, #4f46e5)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* Gradient Fill under Line */}
                  <path
                    d={`M ${chartPoints[0].x} 180 L ${chartPoints.map((p: any) => `${p.x} ${p.y}`).join(' L ')} L ${chartPoints[chartPoints.length - 1].x} 180 Z`}
                    fill="url(#chart-grad)"
                    opacity="0.1"
                  />
                  
                  {/* Definitions */}
                  <defs>
                    <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary, #4f46e5)" />
                      <stop offset="100%" stopColor="var(--color-primary, #4f46e5)" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Points */}
                  {chartPoints.map((p: any, idx: number) => (
                    <g key={idx}>
                      <circle cx={p.x} cy={p.y} r="5" fill="var(--color-primary, #4f46e5)" className="cursor-pointer" />
                      <text x={p.x} y={p.y - 12} textAnchor="middle" className="text-[10px] font-bold font-mono fill-base-content/75">
                        {p.label}
                      </text>
                    </g>
                  ))}
                </svg>
              )}
            </div>
          </div>

          {/* AI Decision Engine Feed */}
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-base-200">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Brain className="text-primary animate-pulse" size={22} />
                <span>AI Forecasting Feed</span>
              </h3>
              <Link to="/ai-insights" className="btn btn-ghost btn-xs text-primary flex items-center gap-1 font-semibold">
                <span>Procurement center</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {insights.length === 0 ? (
              <div className="p-4 text-center text-sm text-base-content/50">
                AI insights pipeline is listening. Make checkouts to trigger forecasting.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.slice(0, 4).map((ins: any) => {
                  let parsedPred: any = {};
                  try {
                    parsedPred = JSON.parse(ins.prediction);
                  } catch (e) {
                    parsedPred = { prediction: ins.prediction };
                  }

                  let body = '';
                  if (ins.type === 'demand_forecast') {
                    body = `Predicted sales volume next week: KSh {parsedPred.predictedSalesNextWeek} units.`;
                  } else if (ins.type === 'dynamic_pricing') {
                    body = `Suggested dynamic price: KSh ${parsedPred.suggestedPrice} (KSh {parsedPred.reason.slice(0, 45)}...)`;
                  } else if (ins.type === 'restock') {
                    body = `Low stock trigger. Suggested restock quantity: KSh {parsedPred.recommendedReorderQty} units.`;
                  }

                  return (
                    <div key={ins.id} className="p-3 bg-base-200/30 border border-base-200 rounded-xl flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="badge badge-primary badge-xs font-mono py-1 capitalize">
                          {ins.type.replace('_', ' ')}
                        </span>
                        <div className="text-sm font-semibold mt-1 truncate">
                          {ins.good?.subCategory?.name}
                        </div>
                        <p className="text-xs text-base-content/70 leading-relaxed">
                          {body}
                        </p>
                      </div>
                      <div className="text-[10px] text-base-content/40 mt-2 font-mono flex justify-between">
                        <span>Confidence: {(parseFloat(ins.confidence) * 100).toFixed(0)}%</span>
                        <span>{new Date(ins.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Alerts, Notifications Drawer, Fast Moving Items */}
        <div className="space-y-6">
          {/* Notifications Drawer */}
          <div className="bg-base-100 rounded-2xl shadow-md border border-base-200 p-6 flex flex-col max-h-96">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Bell className="text-warning animate-bounce" size={20} />
              <span>Real-Time Alert Feed ({unreadNotifs.length})</span>
            </h3>
            
            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-base-content/50 flex flex-col items-center gap-2">
                  <BellOff size={24} className="opacity-50" />
                  <span>No alerts registered yet.</span>
                </div>
              ) : (
                notifications.slice(0, 10).map((notif: any) => (
                  <div 
                    key={notif.id} 
                    className={`p-3 rounded-xl border text-xs relative group flex flex-col justify-between gap-2 transition-all ${notif.status === 'unread' ? 'bg-warning/5 border-warning/30 font-semibold' : 'bg-base-200/30 border-base-200 text-base-content/60'}`}
                  >
                    <p className="leading-normal">{notif.message}</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] text-base-content/40 font-mono">
                        {new Date(notif.createdAt).toLocaleTimeString()}
                      </span>
                      {notif.status === 'unread' && (
                        <button 
                          className="btn btn-ghost btn-square btn-[10px] text-primary hover:bg-primary/10 py-0.5 px-1.5 h-auto min-h-0"
                          onClick={() => readNotificationMutation.mutate(notif.id)}
                          disabled={readNotificationMutation.isPending}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Fast Moving Items */}
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Sparkles size={20} className="text-success" />
              <span>Fast-Moving SKUs</span>
            </h3>
            
            {fastMovingItems.length === 0 ? (
              <div className="p-4 text-center text-sm text-base-content/50">
                Awaiting checkout transactions.
              </div>
            ) : (
              <ul className="space-y-4">
                {fastMovingItems.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold text-sm">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate text-base-content">{item.name}</h4>
                      <p className="text-xs text-base-content/50">High Sales Velocity</p>
                    </div>
                    <div className="font-bold text-sm text-success">+{item.qty} units</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
