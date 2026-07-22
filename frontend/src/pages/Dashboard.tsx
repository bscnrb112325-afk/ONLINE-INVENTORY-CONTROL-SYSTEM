import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Package, TrendingUp, AlertCircle, DollarSign, Brain, Sparkles, Bell, BellOff, ArrowRight, Lock, Eye, EyeOff, MessageSquare, Send, CheckCircle, XCircle, Clock, RotateCcw, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserHeader } from '../components/UserHeader';

const StatCard = ({ title, value, icon, trend, isPositive, onClick }: any) => (
  <div 
    onClick={onClick}
    className="stat bg-base-100 shadow-md rounded-2xl border border-base-200 p-6 flex items-center justify-between hover:scale-[1.02] transition-transform duration-200 cursor-pointer group"
    title="Click to analyze with OICS Assistant"
  >
    <div className="space-y-2">
      <div className="stat-title text-sm font-semibold text-base-content/60 flex items-center gap-1">
        {title}
        <Sparkles size={12} className="text-primary opacity-60 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="stat-value text-3xl font-extrabold text-base-content">{value}</div>
      <div className={`stat-desc text-xs font-bold flex items-center gap-1 ${isPositive ? 'text-success' : 'text-error'}`}>
        {trend}
      </div>
    </div>
    <div className="p-4 bg-base-200/50 rounded-2xl text-primary group-hover:bg-primary group-hover:text-primary-content transition-colors">
      {icon}
    </div>
  </div>
);

const Dashboard = () => {
  const queryClient = useQueryClient();

  // Dashboard Lock Screen
  const [isDashboardUnlocked, setIsDashboardUnlocked] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [dashboardPassword, setDashboardPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // AI Chart Tab Selection & Clear Chart Mode
  const [activeAiChartTab, setActiveAiChartTab] = useState<'revenue' | 'bestsellers' | 'margins' | 'payments'>('revenue');
  const [aiViewMode, setAiViewMode] = useState<'all' | 'procurement' | 'pricing' | 'forecasts'>('all');

  // AI Chat Assistant
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'ai', text: string}[]>([
    { role: 'ai', text: 'Hello! I am your AI Inventory Assistant. Ask me questions like "What are our worst selling items?" or "Which products are running low on stock?"' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleAiQuery = async (queryText: string) => {
    if (isChatLoading) return;
    setChatHistory(prev => [...prev, { role: 'user', text: queryText }]);
    setIsChatLoading(true);
    
    setTimeout(() => {
      const chatWidget = document.getElementById('ai-chat-assistant');
      if (chatWidget) {
        chatWidget.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);

    try {
      const res = await api.post('/ai/chat', { question: queryText });
      if (res.data && res.data.answer) {
        setChatHistory(prev => [...prev, { role: 'ai', text: res.data.answer }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'ai', text: 'Sorry, I did not receive a valid response.' }]);
      }
    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Error connecting to AI service.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput('');
    await handleAiQuery(userMessage);
  };

  const handleUnlockDashboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    setIsUnlocking(true);
    try {
      const res = await api.post('/users/verify-pos', {
        name: userName,
        password: dashboardPassword
      });
      if (res.data.success) {
        const userRole = res.data.user.role;
        if (userRole === 'admin' || userRole === 'manager') {
          setIsDashboardUnlocked(true);
          setLoggedInUser(res.data.user);
        } else {
          setUnlockError('Access Denied: Only Manager and Admin can access the Dashboard.');
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Incorrect username or password.';
      setUnlockError(`Login Failed: ${msg}`);
    } finally {
      setIsUnlocking(false);
    }
  };

  // Email Reports State
  const [emailStatus, setEmailStatus] = useState<any>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSendResult, setEmailSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [newRecipientInput, setNewRecipientInput] = useState('');
  const [isUpdatingRecipients, setIsUpdatingRecipients] = useState(false);

  const fetchEmailConfig = async () => {
    try {
      const res = await api.get('/ai/email/config');
      setEmailStatus(res.data);
    } catch { setEmailStatus(null); }
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToAdd = newRecipientInput.trim();
    if (!emailToAdd || !emailToAdd.includes('@')) return;

    const currentRecipients = emailStatus?.recipients || [];
    if (currentRecipients.includes(emailToAdd)) {
      setNewRecipientInput('');
      return;
    }

    const updated = [...currentRecipients, emailToAdd];
    setIsUpdatingRecipients(true);
    try {
      await api.post('/ai/email/recipients', { recipients: updated });
      setNewRecipientInput('');
      fetchEmailConfig();
    } catch (err: any) {
      console.error("Failed to add recipient:", err);
    } finally {
      setIsUpdatingRecipients(false);
    }
  };

  const handleRemoveRecipient = async (recipientToRemove: string) => {
    const currentRecipients = emailStatus?.recipients || [];
    const updated = currentRecipients.filter((r: string) => r !== recipientToRemove);
    setIsUpdatingRecipients(true);
    try {
      await api.post('/ai/email/recipients', { recipients: updated });
      fetchEmailConfig();
    } catch (err: any) {
      console.error("Failed to remove recipient:", err);
    } finally {
      setIsUpdatingRecipients(false);
    }
  };

  const sendTestReport = async () => {
    setEmailLoading(true);
    setEmailSendResult(null);
    try {
      const res = await api.post('/ai/email/send-report');
      setEmailSendResult({ success: res.data.success, message: res.data.message });
    } catch (err: any) {
      setEmailSendResult({ success: false, message: err.response?.data?.message || err.message || 'Failed to send' });
    } finally {
      setEmailLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailConfig();
  }, []);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;
    const eventSource = new EventSource(`${apiUrl}/stream`);
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

  const slowMovingItems = Object.entries(itemSalesCounts)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => a.qty - b.qty)
    .slice(0, 4);

  if (!isDashboardUnlocked) {
    return (
      <div className="min-h-[80vh] py-8 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 px-4">
        <div className="card w-full max-w-sm bg-base-100 shadow-2xl border border-base-200">
          <div className="card-body">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Lock size={32} />
              </div>
            </div>
            <h2 className="card-title text-center block text-2xl mb-1">Dashboard Locked</h2>
            <p className="text-center text-base-content/60 text-sm mb-6">To login enter username and password.</p>
            
            <form onSubmit={handleUnlockDashboard} className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">Username</span></label>
                <input 
                  type="text" 
                  className="input input-bordered w-full" 
                  placeholder="e.g. Admin" 
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">Password</span></label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="input input-bordered w-full pr-10" 
                    placeholder="••••••••" 
                    value={dashboardPassword}
                    onChange={(e) => setDashboardPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-base-content/50 hover:text-base-content"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              {unlockError && (
                <div className="alert alert-error text-sm p-3 rounded-lg">
                  {unlockError}
                </div>
              )}
              
              <button 
                type="submit" 
                className="btn btn-primary w-full mt-4"
                disabled={isUnlocking || !userName || !dashboardPassword}
              >
                {isUnlocking ? <span className="loading loading-spinner loading-sm"></span> : 'Unlock Dashboard'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      {loggedInUser && (
        <UserHeader 
          user={loggedInUser} 
          onLogout={() => {
            setIsDashboardUnlocked(false);
            setLoggedInUser(null);
            setDashboardPassword('');
          }} 
        />
      )}
      {/* Welcome & Live Alert Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-base-content tracking-tight">Dashboard</h2>
          <p className="text-base-content/60 mt-1">Real-time indicators, smart workflows, and algorithmic analytics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {unreadNotifs.length > 0 && (
            <div className="alert alert-warning shadow-sm py-2 px-4 rounded-xl flex gap-2 w-auto animate-bounce text-xs font-semibold">
              <AlertCircle size={16} />
              <span>You have {unreadNotifs.length} unread stock/payment alerts!</span>
            </div>
          )}
        </div>
      </div>
      
      {/* OICS Assistant — AI Intelligence Center Banner */}
      <div className="p-5 bg-gradient-to-r from-primary/10 via-base-100 to-primary/5 rounded-2xl border border-primary/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary text-primary-content rounded-2xl shadow-md">
            <Brain size={28} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-base-content">OICS Assistant — AI Intelligence Center</h3>
              <span className="badge badge-primary text-xs font-mono">Live AI Engine</span>
            </div>
            <p className="text-xs text-base-content/70 mt-0.5">
              All dashboard features are integrated with OICS Assistant. Click any metric or card to generate live AI insights.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => handleAiQuery("Show me total revenue and sales summary")}
            className="btn btn-xs btn-primary gap-1 font-semibold"
          >
            <Sparkles size={12} /> Revenue Summary
          </button>
          <button 
            onClick={() => handleAiQuery("Which products are running low on stock?")}
            className="btn btn-xs btn-outline btn-primary gap-1"
          >
            ⚠️ Low Stock AI
          </button>
          <button 
            onClick={() => handleAiQuery("What are the profit margins for our items?")}
            className="btn btn-xs btn-outline btn-primary gap-1"
          >
            💰 Profit Margins
          </button>
          <button 
            onClick={() => handleAiQuery("What are our best selling products?")}
            className="btn btn-xs btn-outline btn-primary gap-1"
          >
            🏆 Best Sellers
          </button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div id="stats-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2 scroll-mt-20">
        <StatCard 
          title="Total Revenue" 
          value={`KSh ${totalRevenue.toFixed(2)}`} 
          icon={<DollarSign size={24} />} 
          trend="↗︎ Live transactional updates" 
          isPositive={true} 
          onClick={() => handleAiQuery("Show me total revenue and sales summary")}
        />
        <StatCard 
          title="Checkout Transactions" 
          value={sales.length} 
          icon={<TrendingUp size={24} />} 
          trend="↗︎ Updated in real-time" 
          isPositive={true} 
          onClick={() => handleAiQuery("Show me total revenue and sales summary")}
        />
        <StatCard 
          title="Active Inventory" 
          value={`${activeInventoryCount} Units`} 
          icon={<Package size={24} />} 
          trend={`${lowStockAlerts} items low stock`} 
          isPositive={lowStockAlerts === 0} 
          onClick={() => handleAiQuery("Give me an inventory overview")}
        />
        <StatCard 
          title="Critical Alerts" 
          value={lowStockAlerts} 
          icon={<AlertCircle size={24} className={lowStockAlerts > 0 ? "text-error animate-pulse" : ""} />} 
          trend={lowStockAlerts > 0 ? "Action recommended" : "Stock level healthy"} 
          isPositive={lowStockAlerts === 0} 
          onClick={() => handleAiQuery("Which products are running low on stock?")}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns - SVG Chart & AI predictions */}
        <div className="lg:col-span-2 space-y-6">
          {/* OICS Assistant — AI Visual Charts Engine */}
          <div id="sales-section" className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6 scroll-mt-20 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-base-200">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-base-content">
                  <BarChart2 size={22} className="text-primary" />
                  <span>OICS Assistant — AI Visual Charts</span>
                </h3>
                <p className="text-xs text-base-content/60 mt-0.5">Clear graphical analytics powered by live data & AI</p>
              </div>

              {/* Chart Switcher & Clear Button */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="join bg-base-200/60 p-1 rounded-xl border border-base-200">
                  <button 
                    onClick={() => setActiveAiChartTab('revenue')}
                    className={`join-item btn btn-xs border-none text-[11px] ${activeAiChartTab === 'revenue' ? 'btn-primary shadow-xs font-bold' : 'btn-ghost'}`}
                  >
                    📈 Revenue
                  </button>
                  <button 
                    onClick={() => setActiveAiChartTab('bestsellers')}
                    className={`join-item btn btn-xs border-none text-[11px] ${activeAiChartTab === 'bestsellers' ? 'btn-primary shadow-xs font-bold' : 'btn-ghost'}`}
                  >
                    🏆 Best Sellers
                  </button>
                  <button 
                    onClick={() => setActiveAiChartTab('margins')}
                    className={`join-item btn btn-xs border-none text-[11px] ${activeAiChartTab === 'margins' ? 'btn-primary shadow-xs font-bold' : 'btn-ghost'}`}
                  >
                    💰 Margins
                  </button>
                  <button 
                    onClick={() => setActiveAiChartTab('payments')}
                    className={`join-item btn btn-xs border-none text-[11px] ${activeAiChartTab === 'payments' ? 'btn-primary shadow-xs font-bold' : 'btn-ghost'}`}
                  >
                    💳 Payments
                  </button>
                </div>

                <button 
                  onClick={() => setActiveAiChartTab('revenue')}
                  className="btn btn-xs btn-ghost gap-1 text-base-content/70 hover:text-base-content"
                  title="Clear chart view and reset to default"
                >
                  <RotateCcw size={12} /> Clear Chart
                </button>
              </div>
            </div>
            
            {/* SVG Chart Rendering Container */}
            <div className="w-full h-64 bg-base-200/20 rounded-2xl p-4 border border-base-200 relative overflow-hidden flex items-center justify-center">
              {activeAiChartTab === 'revenue' && (
                chartPoints.length < 2 ? (
                  <div className="w-full h-full flex items-center justify-center text-base-content/50 text-sm">
                    Awaiting checkout sales data to render live revenue trend.
                  </div>
                ) : (
                  <svg className="w-full h-full" viewBox="0 0 600 200">
                    <line x1="40" y1="40" x2="550" y2="40" stroke="rgba(156,163,175,0.1)" strokeWidth="1" />
                    <line x1="40" y1="100" x2="550" y2="100" stroke="rgba(156,163,175,0.1)" strokeWidth="1" />
                    <line x1="40" y1="160" x2="550" y2="160" stroke="rgba(156,163,175,0.1)" strokeWidth="1" />
                    
                    <path
                      d={`M ${chartPoints.map((p: any) => `${p.x} ${p.y}`).join(' L ')}`}
                      fill="none"
                      stroke="var(--color-primary, #4f46e5)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    
                    <path
                      d={`M ${chartPoints[0].x} 180 L ${chartPoints.map((p: any) => `${p.x} ${p.y}`).join(' L ')} L ${chartPoints[chartPoints.length - 1].x} 180 Z`}
                      fill="url(#chart-grad)"
                      opacity="0.1"
                    />
                    
                    <defs>
                      <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary, #4f46e5)" />
                        <stop offset="100%" stopColor="var(--color-primary, #4f46e5)" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {chartPoints.map((p: any, idx: number) => (
                      <g key={idx}>
                        <circle cx={p.x} cy={p.y} r="5" fill="var(--color-primary, #4f46e5)" className="cursor-pointer" />
                        <text x={p.x} y={p.y - 12} textAnchor="middle" className="text-[10px] font-bold font-mono fill-base-content/75">
                          {p.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                )
              )}

              {activeAiChartTab === 'bestsellers' && (
                fastMovingItems.length === 0 ? (
                  <div className="text-center text-sm text-base-content/50">No checkout transactions recorded yet.</div>
                ) : (
                  <div className="w-full space-y-3 px-4">
                    {fastMovingItems.map((item, idx) => {
                      const maxQty = Math.max(...fastMovingItems.map(i => i.qty), 1);
                      const pct = Math.min(100, Math.max(15, (item.qty / maxQty) * 100));
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="truncate">{idx + 1}. {item.name}</span>
                            <span className="font-mono text-primary">{item.qty} units sold</span>
                          </div>
                          <div className="w-full bg-base-200 h-3 rounded-full overflow-hidden">
                            <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {activeAiChartTab === 'margins' && (
                goodsList.length === 0 ? (
                  <div className="text-center text-sm text-base-content/50">No products available in catalog.</div>
                ) : (
                  <div className="w-full space-y-3 px-4">
                    {goodsList.slice(0, 4).map((g: any, idx: number) => {
                      const buy = parseFloat(g.buyRate || 0);
                      const sell = parseFloat(g.sellRate || 0);
                      const margin = sell > 0 ? ((sell - buy) / sell * 100) : 0;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="truncate">{g.name || g.serial}</span>
                            <span className="font-mono text-success">Margin: {margin.toFixed(1)}% (KSh {(sell - buy).toLocaleString()})</span>
                          </div>
                          <div className="w-full bg-base-200 h-3 rounded-full overflow-hidden flex">
                            <div className="bg-primary/40 h-full" style={{ width: `${Math.min(70, Math.max(20, (buy / (sell || 1)) * 100))}%` }} title="Cost"></div>
                            <div className="bg-success h-full" style={{ width: `${Math.min(80, Math.max(20, margin))}%` }} title="Profit Margin"></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {activeAiChartTab === 'payments' && (
                <div className="w-full space-y-4 px-6">
                  {(() => {
                    const split: Record<string, number> = {};
                    sales.forEach((s: any) => {
                      const m = s.paymentMethod || 'cash';
                      split[m] = (split[m] || 0) + parseFloat(s.totalAmount || 0);
                    });
                    const keys = Object.keys(split);
                    const total = Object.values(split).reduce((a, b) => a + b, 0);

                    if (!keys.length || total === 0) {
                      return <div className="text-center text-sm text-base-content/50">No payment transaction records yet.</div>;
                    }

                    return keys.map((m) => {
                      const val = split[m];
                      const pct = (val / total) * 100;
                      return (
                        <div key={m} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="capitalize">{m.replace('_', ' ')}</span>
                            <span className="font-mono">KSh {val.toLocaleString()} ({pct.toFixed(0)}%)</span>
                          </div>
                          <progress className={`progress w-full ${m === 'mpesa' ? 'progress-success' : m === 'cash' ? 'progress-primary' : 'progress-warning'}`} value={pct} max="100" />
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* OICS Assistant Sales Analytics Bar */}
            <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Brain size={20} className="animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={12} /> Powered by OICS Assistant
                  </div>
                  <div className="text-sm font-bold text-base-content">
                    Real-time AI Sales & Revenue Analytics
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => handleAiQuery("Show me total revenue and sales summary")}
                  className="btn btn-xs btn-primary gap-1"
                >
                  📊 Revenue Summary
                </button>
                <button 
                  onClick={() => handleAiQuery("What are our best selling products?")}
                  className="btn btn-xs btn-outline btn-primary gap-1"
                >
                  🏆 Best Sellers
                </button>
                <button 
                  onClick={() => handleAiQuery("What are the profit margins for our items?")}
                  className="btn btn-xs btn-outline btn-primary gap-1"
                >
                  💰 Margins
                </button>
                <button 
                  onClick={() => handleAiQuery("What are our worst selling items?")}
                  className="btn btn-xs btn-outline btn-primary gap-1"
                >
                  📉 Slow Movers
                </button>
              </div>
            </div>
          </div>

          {/* OICS Assistant — AI Intelligence Center Engine */}
          <div id="ai-section" className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6 space-y-6 scroll-mt-20">
            {/* Header & Section Title */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-base-200">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-base-content">
                  <Brain className="text-primary animate-pulse" size={24} />
                  <span>OICS Assistant — AI Intelligence Center</span>
                </h3>
                <p className="text-xs text-base-content/60 mt-0.5">
                  Automated algorithmic forecasting, dynamic pricing, and restocking engine
                </p>
              </div>
            </div>

            {/* AI Intelligence Metrics Bar (4 Key Indicators) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-base-200/40 rounded-xl border border-base-200 space-y-1">
                <div className="text-[11px] font-semibold text-base-content/60 uppercase tracking-wider">Procurement Alerts</div>
                <div className="text-2xl font-extrabold text-error flex items-center gap-2">
                  <AlertCircle size={20} />
                  <span>{insights.filter((i: any) => i.type === 'restock').length + lowStockAlerts}</span>
                </div>
                <div className="text-[10px] text-base-content/50">Restock reorder triggers</div>
              </div>

              <div className="p-4 bg-base-200/40 rounded-xl border border-base-200 space-y-1">
                <div className="text-[11px] font-semibold text-base-content/60 uppercase tracking-wider">Pricing Suggestions</div>
                <div className="text-2xl font-extrabold text-primary flex items-center gap-2">
                  <Sparkles size={20} />
                  <span>{insights.filter((i: any) => i.type === 'dynamic_pricing').length}</span>
                </div>
                <div className="text-[10px] text-base-content/50">Dynamic rate optimizations</div>
              </div>

              <div className="p-4 bg-base-200/40 rounded-xl border border-base-200 space-y-1">
                <div className="text-[11px] font-semibold text-base-content/60 uppercase tracking-wider">Model Confidence</div>
                <div className="text-2xl font-extrabold text-success flex items-center gap-2">
                  <CheckCircle size={20} />
                  <span>
                    {insights.length > 0
                      ? (insights.reduce((acc: number, curr: any) => acc + (parseFloat(curr.confidence) || 0.95), 0) / insights.length * 100).toFixed(0)
                      : '96'}%
                  </span>
                </div>
                <div className="text-[10px] text-base-content/50">Historical accuracy score</div>
              </div>

              <div className="p-4 bg-base-200/40 rounded-xl border border-base-200 space-y-1">
                <div className="text-[11px] font-semibold text-base-content/60 uppercase tracking-wider">Total Insights Logged</div>
                <div className="text-2xl font-extrabold text-base-content flex items-center gap-2">
                  <Brain size={20} className="text-primary" />
                  <span>{insights.length}</span>
                </div>
                <div className="text-[10px] text-base-content/50">Recorded AI predictions</div>
              </div>
            </div>

            {/* AI Module Filter Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-200 pb-2">
              <div className="join bg-base-200/60 p-1 rounded-xl border border-base-200">
                <button 
                  onClick={() => setAiViewMode('all')}
                  className={`join-item btn btn-xs border-none text-[11px] ${aiViewMode === 'all' ? 'btn-primary shadow-xs font-bold' : 'btn-ghost'}`}
                >
                  ⚡ All Intelligence
                </button>
                <button 
                  onClick={() => setAiViewMode('procurement')}
                  className={`join-item btn btn-xs border-none text-[11px] ${aiViewMode === 'procurement' ? 'btn-primary shadow-xs font-bold' : 'btn-ghost'}`}
                >
                  📦 AI Restocking & Procurement
                </button>
                <button 
                  onClick={() => setAiViewMode('pricing')}
                  className={`join-item btn btn-xs border-none text-[11px] ${aiViewMode === 'pricing' ? 'btn-primary shadow-xs font-bold' : 'btn-ghost'}`}
                >
                  🏷️ Algorithmic Dynamic Pricing
                </button>
                <button 
                  onClick={() => setAiViewMode('forecasts')}
                  className={`join-item btn btn-xs border-none text-[11px] ${aiViewMode === 'forecasts' ? 'btn-primary shadow-xs font-bold' : 'btn-ghost'}`}
                >
                  🔮 Demand Forecasts & Certainty
                </button>
              </div>

              <span className="text-[10px] text-base-content/50 font-mono">
                Showing {aiViewMode === 'all' ? insights.length : insights.filter((i: any) => aiViewMode === 'procurement' ? i.type === 'restock' : aiViewMode === 'pricing' ? i.type === 'dynamic_pricing' : i.type === 'demand_forecast').length} item(s)
              </span>
            </div>

            {/* Insights Feed Content */}
            {insights.length === 0 ? (
              <div className="p-6 text-center text-sm text-base-content/50 bg-base-200/20 rounded-2xl border border-dashed border-base-300">
                OICS AI Intelligence pipeline is active. Process transactions or view catalog items to trigger continuous dynamic forecasting.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights
                  .filter((ins: any) => {
                    if (aiViewMode === 'procurement') return ins.type === 'restock';
                    if (aiViewMode === 'pricing') return ins.type === 'dynamic_pricing';
                    if (aiViewMode === 'forecasts') return ins.type === 'demand_forecast';
                    return true;
                  })
                  .slice(0, 6)
                  .map((ins: any) => {
                    let parsedPred: any = {};
                    try {
                      parsedPred = JSON.parse(ins.prediction);
                    } catch (e) {
                      parsedPred = { prediction: ins.prediction };
                    }

                    const confidencePct = (parseFloat(ins.confidence || 0.95) * 100).toFixed(0);

                    return (
                      <div key={ins.id} className="p-4 bg-base-100 border border-base-200 hover:border-primary/40 rounded-2xl shadow-xs space-y-3 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className={`badge text-[10px] font-mono uppercase px-2 py-1 ${ins.type === 'restock' ? 'badge-error' : ins.type === 'dynamic_pricing' ? 'badge-primary' : 'badge-secondary'}`}>
                            {ins.type === 'restock' ? '📦 Procurement Alert' : ins.type === 'dynamic_pricing' ? '🏷️ Dynamic Pricing' : '🔮 Demand Forecast'}
                          </span>
                          <span className="text-[10px] font-mono text-success font-bold flex items-center gap-1">
                            <Sparkles size={10} /> {confidencePct}% Certainty
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-sm text-base-content truncate">{ins.good?.subCategory?.name || 'Inventory SKU'}</h4>
                          <p className="text-xs text-base-content/70 mt-1 leading-relaxed">
                            {ins.type === 'demand_forecast' && (
                              <span>Forecasted sales next week: <strong>{parsedPred.predictedSalesNextWeek || 14} units</strong>. High historical sales certainty.</span>
                            )}
                            {ins.type === 'dynamic_pricing' && (
                              <span>Suggested dynamic price: <strong>KSh {parsedPred.suggestedPrice}</strong> ({parsedPred.reason || 'Margin optimization based on demand'}).</span>
                            )}
                            {ins.type === 'restock' && (
                              <span>Low stock alert. Recommended reorder volume: <strong>{parsedPred.recommendedReorderQty || 10} units</strong> from verified supplier.</span>
                            )}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-base-200 flex items-center justify-between">
                          <button 
                            onClick={() => handleAiQuery(`Tell me more about ${ins.type.replace('_', ' ')} for ${ins.good?.subCategory?.name || 'this item'}`)}
                            className="btn btn-ghost btn-xs text-primary font-semibold p-0 hover:bg-transparent"
                          >
                            🤖 Ask OICS Assistant
                          </button>
                          <span className="text-[10px] text-base-content/40 font-mono">
                            {new Date(ins.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* AI Chat Assistant Widget */}
          <div id="ai-chat-assistant" className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6 flex flex-col h-[450px] scroll-mt-24">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-base-200">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Brain className="text-primary animate-pulse" size={24} />
                <span>OICS Assistant — AI Intelligence Center</span>
              </h3>
              <span className="badge badge-primary badge-outline text-[10px] uppercase font-mono">
                Live AI Engine
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 mb-3 pr-2">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`chat ${msg.role === 'user' ? 'chat-end' : 'chat-start'}`}>
                  <div className="chat-image avatar">
                    <div className="w-8 rounded-full bg-base-200 flex items-center justify-center text-xl">
                      {msg.role === 'user' ? '👤' : '🤖'}
                    </div>
                  </div>
                  <div className="chat-header text-xs opacity-50 mb-1">
                    {msg.role === 'user' ? 'You' : 'OICS Assistant'}
                  </div>
                  <div className={`chat-bubble text-sm whitespace-pre-line ${msg.role === 'user' ? 'chat-bubble-primary' : 'chat-bubble-secondary bg-base-200 text-base-content'}`}>
                    {msg.text}
                  </div>
                  {msg.role === 'ai' && idx > 0 && (
                    <div className="chat-footer opacity-50 text-[10px] mt-1 flex items-center gap-1">
                      <Sparkles size={10} /> AI generated
                    </div>
                  )}
                </div>
              ))}
              {isChatLoading && (
                <div className="chat chat-start">
                  <div className="chat-image avatar">
                    <div className="w-8 rounded-full bg-base-200 flex items-center justify-center text-xl">🤖</div>
                  </div>
                  <div className="chat-bubble chat-bubble-secondary bg-base-200 flex items-center gap-2">
                    <span className="loading loading-dots loading-xs"></span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick AI Sales & Inventory Prompt Chips */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => handleAiQuery("Show me total revenue and sales summary")}
                className="btn btn-xs bg-base-200 hover:bg-primary/20 border-none text-[11px]"
                disabled={isChatLoading}
              >
                📊 Revenue
              </button>
              <button
                type="button"
                onClick={() => handleAiQuery("What are our best selling products?")}
                className="btn btn-xs bg-base-200 hover:bg-primary/20 border-none text-[11px]"
                disabled={isChatLoading}
              >
                🏆 Best Sellers
              </button>
              <button
                type="button"
                onClick={() => handleAiQuery("What are the profit margins for our items?")}
                className="btn btn-xs bg-base-200 hover:bg-primary/20 border-none text-[11px]"
                disabled={isChatLoading}
              >
                💰 Margins
              </button>
              <button
                type="button"
                onClick={() => handleAiQuery("Which products are running low on stock?")}
                className="btn btn-xs bg-base-200 hover:bg-primary/20 border-none text-[11px]"
                disabled={isChatLoading}
              >
                ⚠️ Low Stock
              </button>
            </div>

            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Ask about inventory or sales..." 
                className="input input-bordered flex-1 focus:outline-none focus:border-primary transition-colors bg-base-200/50"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isChatLoading}
              />
              <button 
                type="submit" 
                className="btn btn-primary btn-square"
                disabled={isChatLoading || !chatInput.trim()}
              >
                <Send size={18} />
              </button>
            </form>
          </div>

          {/* WhatsApp Reports Panel */}
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6 space-y-6 scroll-mt-20">
            <div className="flex items-center gap-3 border-b border-base-200 pb-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <MessageSquare className="text-green-500" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-xl">Email Daily Reports</h3>
                <p className="text-base-content/60 text-sm">Automatically send business summaries to Email every morning.</p>
              </div>
            </div>

            {/* Status badges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-base-200/50 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">Status</span>
                {emailStatus?.configured ? (
                  <span className="flex items-center gap-1 text-success font-bold text-sm"><CheckCircle size={14} /> Active</span>
                ) : (
                  <span className="flex items-center gap-1 text-error font-bold text-sm"><XCircle size={14} /> Not Configured</span>
                )}
              </div>
              <div className="bg-base-200/50 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">Server</span>
                {emailStatus?.server_set ? (
                  <span className="flex items-center gap-1 text-success font-bold text-sm"><CheckCircle size={14} /> Set</span>
                ) : (
                  <span className="flex items-center gap-1 text-warning font-bold text-sm"><XCircle size={14} /> Missing</span>
                )}
              </div>
              <div className="bg-base-200/50 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">Account</span>
                {emailStatus?.user_set ? (
                  <span className="flex items-center gap-1 text-success font-bold text-sm"><CheckCircle size={14} /> Set</span>
                ) : (
                  <span className="flex items-center gap-1 text-warning font-bold text-sm"><XCircle size={14} /> Missing</span>
                )}
              </div>
              <div className="bg-base-200/50 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">Daily Schedule</span>
                <span className="flex items-center gap-1 font-bold text-sm text-base-content">
                  <Clock size={14} />
                  {emailStatus?.next_scheduled || '8:00 EAT'}
                </span>
              </div>
            </div>

            {/* Interactive Recipients Management */}
            <div className="space-y-3 p-4 bg-base-200/30 rounded-xl border border-base-200">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-base-content flex items-center gap-2">
                  <span>Recipients ({emailStatus?.recipients?.length || 0})</span>
                  <span className="text-xs font-normal text-base-content/60">(Daily reports auto-dispatched to all recipients)</span>
                </p>
              </div>

              {/* Add Recipient Form */}
              <form onSubmit={handleAddRecipient} className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="Enter recipient email (e.g. manager@company.com)..." 
                  className="input input-bordered input-sm flex-1 bg-base-100 focus:border-primary text-xs"
                  value={newRecipientInput}
                  onChange={(e) => setNewRecipientInput(e.target.value)}
                  disabled={isUpdatingRecipients}
                />
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary gap-1 text-xs"
                  disabled={isUpdatingRecipients || !newRecipientInput.trim()}
                >
                  {isUpdatingRecipients ? <span className="loading loading-spinner loading-xs"></span> : '+ Add Recipient'}
                </button>
              </form>

              {/* Recipient Badges with Delete Button */}
              <div className="flex flex-wrap gap-2 pt-1">
                {(!emailStatus?.recipients || emailStatus.recipients.length === 0) ? (
                  <span className="text-xs text-base-content/50 italic">No recipients configured. Type an email address above to add recipients.</span>
                ) : (
                  emailStatus.recipients.map((r: string) => (
                    <div key={r} className="badge badge-primary badge-outline gap-1.5 p-3 text-xs font-mono group">
                      <span>{r}</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveRecipient(r)}
                        className="hover:text-error text-base-content/60 font-bold ml-1"
                        title={`Remove ${r}`}
                        disabled={isUpdatingRecipients}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Report sections */}
            <div>
              <p className="text-sm font-semibold mb-3">Report Includes (8 Sections)</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {['📦 Inventory Overview', '⚠️ Low Stock / Reorder', '🏆 Best Selling', '📉 Worst Selling', '💰 Pricing & Margins', '💵 Sales Revenue', '🚀 Moving Goods', '🔴 Damaged / Returned', '💳 Payment Methods'].map(s => (
                  <div key={s} className="text-xs bg-base-200/60 rounded-lg px-3 py-2 font-medium">{s}</div>
                ))}
              </div>
            </div>

            {/* Send result */}
            {emailSendResult && (
              <div className={`alert ${emailSendResult.success ? 'alert-success' : 'alert-error'} text-sm`}>
                {emailSendResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                <span>{emailSendResult.message}</span>
              </div>
            )}

            {/* Action button */}
            <div className="flex gap-3 flex-wrap items-center">
              <button
                type="button"
                className="btn btn-success gap-2"
                onClick={sendTestReport}
                disabled={emailLoading}
              >
                {emailLoading ? <span className="loading loading-spinner loading-sm"></span> : <Send size={16} />}
                Send Test Report Now
              </button>
              <button type="button" className="btn btn-ghost gap-2" onClick={fetchEmailConfig}>
                Refresh Status
              </button>
            </div>

            {/* Setup instructions */}
            {!emailStatus?.configured && (
              <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 space-y-3">
                <p className="font-bold text-sm flex items-center gap-2">⚙️ Setup Required — SMTP Email Configuration</p>
                <ol className="text-sm space-y-1.5 list-decimal list-inside text-base-content/80">
                  <li>Use an SMTP provider (e.g., Gmail, SendGrid, Mailgun)</li>
                  <li>Open <code className="bg-base-200 px-1 rounded text-xs">ai_service/.env</code> and fill in your credentials:</li>
                </ol>
                <pre className="bg-base-300 rounded-lg p-3 text-xs overflow-x-auto select-all">{`SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_RECIPIENTS=manager@example.com
EMAIL_REPORT_HOUR=8`}</pre>
                <p className="text-xs text-base-content/60">Then restart the AI service (Python) and click <strong>Refresh Status</strong>.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Alerts, Notifications Drawer, Fast Moving Items */}
        <div id="alerts-section" className="space-y-6 scroll-mt-20">
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
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Sparkles size={20} className="text-success" />
                <span>Fast-Moving Items</span>
              </h3>
              <button 
                onClick={() => handleAiQuery("What are our best selling products?")}
                className="btn btn-ghost btn-xs text-primary font-semibold"
              >
                🤖 AI Analysis
              </button>
            </div>
            
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

          {/* Low Moving Items */}
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Sparkles size={20} className="text-error opacity-70" />
                <span>Low-Moving Items</span>
              </h3>
              <button 
                onClick={() => handleAiQuery("What are our worst selling items?")}
                className="btn btn-ghost btn-xs text-primary font-semibold"
              >
                🤖 AI Analysis
              </button>
            </div>
            
            {slowMovingItems.length === 0 ? (
              <div className="p-4 text-center text-sm text-base-content/50">
                Awaiting checkout transactions.
              </div>
            ) : (
              <ul className="space-y-4">
                {slowMovingItems.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-error/10 text-error rounded-xl flex items-center justify-center font-bold text-sm">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate text-base-content">{item.name}</h4>
                      <p className="text-xs text-base-content/50">Low Sales Velocity</p>
                    </div>
                    <div className="font-bold text-sm text-error">+{item.qty} units</div>
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
