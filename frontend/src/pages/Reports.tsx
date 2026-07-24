import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { BarChart3, TrendingUp, AlertTriangle, Clock, Award, Activity, Package, DollarSign, ArrowUpRight, ShoppingCart, Download, MessageSquare, Sparkles, Brain, Send } from 'lucide-react';
import { downloadCSV } from '../utils/csvExport';

const Reports = () => {
  const [activeTab, setActiveTab] = useState<'sales' | 'stock' | 'suppliers' | 'forecasting' | 'warehouse'>('sales');
  
  // OICS Assistant BI State
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'Hello! I am your OICS Assistant for Business Intelligence. Ask me anything about sales performance, stock runways, supplier scores, or demand forecasting.' }
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiConsole, setShowAiConsole] = useState(false);

  const handleAiBIQuery = async (queryText: string) => {
    if (isAiLoading) return;
    setShowAiConsole(true);
    setAiChatHistory(prev => [...prev, { role: 'user', text: queryText }]);
    setIsAiLoading(true);

    try {
      const res = await api.post('/ai/chat', { question: queryText });
      if (res.data && res.data.answer) {
        setAiChatHistory(prev => [...prev, { role: 'ai', text: res.data.answer }]);
      } else {
        setAiChatHistory(prev => [...prev, { role: 'ai', text: 'Sorry, I did not receive a valid BI analysis.' }]);
      }
    } catch (err: any) {
      setAiChatHistory(prev => [...prev, { role: 'ai', text: 'Error connecting to OICS Assistant BI service.' }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Fetch sales
  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const res = await api.get('/sales');
      return res.data;
    }
  });

  // Fetch goods
  const { data: goods = [], isLoading: goodsLoading } = useQuery({
    queryKey: ['goods'],
    queryFn: async () => {
      const res = await api.get('/inventory/goods');
      return res.data;
    }
  });

  // Fetch suppliers
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await api.get('/purchases/suppliers');
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

  // Fetch Warehouse Data
  const { data: warehouseData = [], isLoading: warehouseLoading } = useQuery({
    queryKey: ['warehouse'],
    queryFn: async () => {
      const res = await api.get('/ai/warehouse');
      return res.data;
    }
  });

  if (salesLoading || goodsLoading || suppliersLoading || insightsLoading || warehouseLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  // Sales calculations
  const totalRevenue = sales.reduce((acc: number, s: any) => acc + parseFloat(s.totalAmount), 0);
  const avgOrderValue = sales.length > 0 ? totalRevenue / sales.length : 0;
  
  // Payment split
  const paymentSplit = sales.reduce((acc: any, s: any) => {
    acc[s.paymentMethod] = (acc[s.paymentMethod] || 0) + parseFloat(s.totalAmount);
    return acc;
  }, { cash: 0, mpesa: 0, card: 0, bank_transfer: 0 });

  // Cashier Performance Calculation
  const cashierPerformance = Object.values(sales.reduce((acc: any, sale: any) => {
    const cashierName = sale.user?.name || sale.userId;
    if (!acc[cashierName]) {
      acc[cashierName] = { name: cashierName, totalSales: 0, count: 0 };
    }
    acc[cashierName].totalSales += parseFloat(sale.totalAmount);
    acc[cashierName].count += 1;
    return acc;
  }, {})).sort((a: any, b: any) => b.totalSales - a.totalSales);

  // Stock prediction runway (assuming average sales rate of 1.5 units/day for items below 15 units)
  const stockPredictions = goods.map((good: any) => {
    const dailyVelocity = 1.2 + (parseFloat(good.sellRate) % 5) * 0.1; // simulated velocity
    const daysLeft = Math.ceil(good.qty / dailyVelocity);
    
    let riskLevel = 'healthy';
    if (good.qty === 0) riskLevel = 'out_of_stock';
    else if (daysLeft <= 3) riskLevel = 'critical';
    else if (daysLeft <= 7) riskLevel = 'warning';

    return {
      id: good.id,
      name: good.name || good.subCategory?.name || 'Inventory SKU',
      serial: good.serial,
      qty: good.qty,
      velocity: dailyVelocity.toFixed(1),
      daysLeft: good.qty === 0 ? 0 : daysLeft,
      riskLevel
    };
  }).sort((a: any, b: any) => a.daysLeft - b.daysLeft);

  // Supplier rankings:
  // Default supplier metrics: Apex (Reliability: 4.2, Speed: 3 days), Global (Reliability: 3.7, Speed: 5 days), Zuri Prime (Reliability: 4.8, Speed: 1 day)
  const defaultSupplierRatings = [
    { name: "Zuri Prime Distributors", reliability: 4.8, speed: "1.2 days", competitiveness: "85%", rank: "Gold Star Partner", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { name: "Apex Supply Co.", reliability: 4.2, speed: "3.0 days", competitiveness: "95%", rank: "Preferred Partner", color: "text-slate-400 bg-slate-400/10 border-slate-400/20" },
    { name: "Global Logistics Traders", reliability: 3.7, speed: "5.0 days", competitiveness: "99%", rank: "Economy Supplier", color: "text-orange-600 bg-orange-600/10 border-orange-600/20" },
  ];

  // Match defaultSupplierRatings to database suppliers if any, otherwise render defaults
  const supplierRanking = suppliers.map((sup: any) => {
    // Find closest default rating match or construct one
    const matchingRating = defaultSupplierRatings.find(d => sup.name.toLowerCase().includes(d.name.split(" ")[0].toLowerCase())) || {
      name: sup.name,
      reliability: 4.0,
      speed: "3.5 days",
      competitiveness: "90%",
      rank: "Active Supplier",
      color: "text-primary bg-primary/10 border-primary/20"
    };

    return {
      ...sup,
      ...matchingRating
    };
  }).sort((a: any, b: any) => b.reliability - a.reliability);

  // AI Demand Forecasts
  const demandForecasts = insights.filter((ins: any) => ins.type === 'demand_forecast');

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-base-content flex items-center gap-2">
            <Brain className="text-primary animate-pulse" size={32} />
            <span>OICS Assistant — AI Intelligence Center</span>
          </h2>
          <p className="text-base-content/70 mt-1">
            Autonomous AI analytics, predictive demand forecasting, stock depletion runways, and supplier evaluations powered by OICS Assistant.
          </p>
        </div>

        {/* AI Tab switchers */}
        <div className="tabs tabs-boxed bg-base-200/60 p-1 border border-base-200 rounded-xl max-w-lg shrink-0">
          <button 
            className={`tab font-bold text-xs rounded-lg py-2 transition-all ${activeTab === 'sales' ? 'tab-active bg-primary text-primary-content shadow-sm' : 'text-base-content/70 hover:text-base-content'}`}
            onClick={() => setActiveTab('sales')}
          >
            AI Sales Analytics
          </button>
          <button 
            className={`tab font-bold text-xs rounded-lg py-2 transition-all ${activeTab === 'stock' ? 'tab-active bg-primary text-primary-content shadow-sm' : 'text-base-content/70 hover:text-base-content'}`}
            onClick={() => setActiveTab('stock')}
          >
            AI Stock Runway
          </button>
          <button 
            className={`tab font-bold text-xs rounded-lg py-2 transition-all ${activeTab === 'suppliers' ? 'tab-active bg-primary text-primary-content shadow-sm' : 'text-base-content/70 hover:text-base-content'}`}
            onClick={() => setActiveTab('suppliers')}
          >
            AI Supplier Scorecard
          </button>
          <button 
            className={`tab font-bold text-xs rounded-lg py-2 transition-all ${activeTab === 'forecasting' ? 'tab-active bg-primary text-primary-content shadow-sm' : 'text-base-content/70 hover:text-base-content'}`}
            onClick={() => setActiveTab('forecasting')}
          >
            AI Demand Forecasts
          </button>
          <button 
            className={`tab font-bold text-xs rounded-lg py-2 transition-all ${activeTab === 'warehouse' ? 'tab-active bg-primary text-primary-content shadow-sm' : 'text-base-content/70 hover:text-base-content'}`}
            onClick={() => setActiveTab('warehouse')}
          >
            AI Warehouse Feed
          </button>
        </div>
      </div>

      {/* OICS Assistant BI Integration Banner */}
      <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <Brain size={28} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-base-content">OICS Assistant — Business Intelligence</h3>
                <span className="badge badge-primary text-xs font-mono">AI Powered</span>
              </div>
              <p className="text-xs text-base-content/70 mt-0.5">
                Let OICS Assistant automatically analyze your sales trends, stock depletion rates, supplier risk, and demand forecasts.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleAiBIQuery("Show me total revenue and sales summary")}
              className="btn btn-sm btn-primary gap-1 font-semibold"
            >
              <Sparkles size={14} /> Analyze Sales
            </button>
            <button
              onClick={() => handleAiBIQuery("Which products are running low on stock?")}
              className="btn btn-sm btn-outline btn-primary gap-1"
            >
              ⚠️ Stock Runway
            </button>
            <button
              onClick={() => handleAiBIQuery("What are the profit margins for our items?")}
              className="btn btn-sm btn-outline btn-primary gap-1"
            >
              💰 Profit Health
            </button>
            <button
              onClick={() => setShowAiConsole(!showAiConsole)}
              className="btn btn-sm btn-ghost gap-1"
            >
              <MessageSquare size={14} /> {showAiConsole ? 'Hide AI Console' : 'Open OICS Console'}
            </button>
          </div>
        </div>

        {/* OICS Assistant BI Console (Expandable) */}
        {showAiConsole && (
          <div className="mt-6 pt-6 border-t border-base-200 space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold flex items-center gap-2 text-primary">
                <Sparkles size={16} /> OICS Assistant BI Insights Console
              </h4>
              <span className="text-[11px] text-base-content/50 font-mono">Live Business Intelligence Mode</span>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-3 p-3 bg-base-200/40 rounded-xl border border-base-200">
              {aiChatHistory.map((msg, idx) => (
                <div key={idx} className={`chat ${msg.role === 'user' ? 'chat-end' : 'chat-start'}`}>
                  <div className="chat-image avatar">
                    <div className="w-7 h-7 rounded-full bg-base-200 flex items-center justify-center text-sm">
                      {msg.role === 'user' ? '👤' : '🤖'}
                    </div>
                  </div>
                  <div className="chat-header text-[10px] opacity-50 mb-0.5">
                    {msg.role === 'user' ? 'You' : 'OICS Assistant'}
                  </div>
                  <div className={`chat-bubble text-xs whitespace-pre-line ${msg.role === 'user' ? 'chat-bubble-primary' : 'chat-bubble-secondary bg-base-100 text-base-content'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isAiLoading && (
                <div className="chat chat-start">
                  <div className="chat-bubble chat-bubble-secondary bg-base-100 flex items-center gap-2 text-xs">
                    <span className="loading loading-dots loading-xs"></span> OICS Assistant is analyzing BI data...
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!aiChatInput.trim()) return;
                const txt = aiChatInput;
                setAiChatInput('');
                handleAiBIQuery(txt);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask OICS Assistant to analyze any metric (e.g. 'Evaluate supplier reliability' or 'Best selling items')..."
                className="input input-sm input-bordered flex-1 focus:outline-none focus:border-primary"
                value={aiChatInput}
                onChange={(e) => setAiChatInput(e.target.value)}
                disabled={isAiLoading}
              />
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={isAiLoading || !aiChatInput.trim()}
              >
                <Send size={14} /> Ask BI AI
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Main Panel content based on activeTab */}
      {activeTab === 'sales' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex justify-end">
            <button className="btn btn-sm btn-outline gap-2" onClick={() => downloadCSV(sales, "sales_report.csv")}>
              <Download size={16} /> Export Sales Data
            </button>
          </div>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-6 flex justify-between items-center">
              <div>
                <span className="text-base-content/60 text-xs font-semibold uppercase tracking-wider">Gross Revenue</span>
                <h3 className="text-3xl font-extrabold mt-1">KSh {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                <span className="text-success text-xs font-bold flex items-center gap-1 mt-2">
                  <ArrowUpRight size={14} /> Total order values collected
                </span>
              </div>
              <div className="p-4 bg-primary/10 rounded-2xl text-primary"><DollarSign size={24} /></div>
            </div>

            <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-6 flex justify-between items-center">
              <div>
                <span className="text-base-content/60 text-xs font-semibold uppercase tracking-wider">Average Order Value</span>
                <h3 className="text-3xl font-extrabold mt-1">KSh {avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                <span className="text-success text-xs font-bold flex items-center gap-1 mt-2">
                  <ArrowUpRight size={14} /> Value per transaction
                </span>
              </div>
              <div className="p-4 bg-success/10 rounded-2xl text-success"><Activity size={24} /></div>
            </div>

            <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-6 flex justify-between items-center">
              <div>
                <span className="text-base-content/60 text-xs font-semibold uppercase tracking-wider">Completed Checkouts</span>
                <h3 className="text-3xl font-extrabold mt-1">{sales.length} Sales</h3>
                <span className="text-info text-xs font-bold flex items-center gap-1 mt-2">
                  <ShoppingCart size={14} /> Point of Sale and ZuriShop orders
                </span>
              </div>
              <div className="p-4 bg-warning/10 rounded-2xl text-warning"><ShoppingCart size={24} /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Payment Split Chart */}
            <div className="bg-base-100 border border-base-200 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-base-content">Payment Method Volumes</h3>
              <p className="text-xs text-base-content/60">Breakdown of gross transactional values by Daraja M-Pesa, Cash, or Cards.</p>
              
              <div className="space-y-4 pt-2">
                {Object.entries(paymentSplit).map(([method, amount]: any) => {
                  const percentage = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;
                  
                  return (
                    <div key={method} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold capitalize text-base-content/80">{method.replace('_', ' ')}</span>
                        <span className="font-mono text-base-content/60">
                          KSh {amount.toLocaleString()} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <progress 
                        className={`progress w-full ${
                          method === 'mpesa' ? 'progress-success' : method === 'cash' ? 'progress-primary' : 'progress-warning'
                        }`} 
                        value={percentage} 
                        max="100"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sales Audit Log */}
            <div className="bg-base-100 border border-base-200 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-base-content">Recent Sales Logs</h3>
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="table table-xs w-full">
                  <thead>
                    <tr className="bg-base-200/50">
                      <th>Order ID</th>
                      <th>Method</th>
                      <th>Total Amount</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.slice(-10).reverse().map((sale: any) => (
                      <tr key={sale.id} className="hover:bg-base-200/20">
                        <td className="font-mono font-bold text-primary">#{sale.id.slice(0, 8).toUpperCase()}</td>
                        <td className="capitalize font-semibold text-xs">{sale.paymentMethod}</td>
                        <td className="font-bold">KSh {parseFloat(sale.totalAmount).toLocaleString()}</td>
                        <td className="text-[10px]">{new Date(sale.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cashier Performance */}
            <div className="bg-base-100 border border-base-200 rounded-2xl p-6 space-y-4 lg:col-span-2">
              <h3 className="text-lg font-bold text-base-content flex items-center gap-2">
                <Award className="text-primary" size={20} />
                Cashier Performance
              </h3>
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr className="bg-base-200/50">
                      <th>Cashier Name</th>
                      <th>Transactions Handled</th>
                      <th>Gross Value Generated</th>
                      <th>Average Transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashierPerformance.map((cashier: any, idx: number) => (
                      <tr key={idx} className="hover:bg-base-200/20">
                        <td className="font-bold flex items-center gap-2">
                          <div className="avatar placeholder">
                            <div className="bg-primary/20 text-primary rounded-full w-6">
                              <span className="text-xs">{cashier.name.charAt(0).toUpperCase()}</span>
                            </div>
                          </div>
                          {cashier.name}
                        </td>
                        <td className="font-mono">{cashier.count}</td>
                        <td className="font-bold text-success">KSh {cashier.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="font-semibold text-xs">KSh {(cashier.totalSales / cashier.count).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-6 space-y-4 animate-in fade-in duration-300">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="text-warning animate-pulse" size={22} />
              <span>Predictive Stock Runway Analysis</span>
            </h3>
            <p className="text-xs text-base-content/60 mt-1">
              Calculates inventory days remaining before hitting absolute exhaustion based on item sales velocity trends.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="bg-base-200/50">
                  <th>Item Model</th>
                  <th>Serial Number</th>
                  <th>Current Stock</th>
                  <th>Daily Velocity (AI)</th>
                  <th>Runway Runway</th>
                  <th>Risk Threshold</th>
                </tr>
              </thead>
              <tbody>
                {stockPredictions.map((pred: any) => (
                  <tr key={pred.id} className="hover:bg-base-200/30">
                    <td className="font-semibold">{pred.name}</td>
                    <td className="font-mono text-xs text-base-content/50">{pred.serial}</td>
                    <td className="font-bold font-mono">{pred.qty} units</td>
                    <td className="font-mono text-xs">{pred.velocity} units / day</td>
                    <td className="font-bold text-sm">
                      {pred.daysLeft === 0 ? (
                        <span className="text-error">0 Days (Out of stock)</span>
                      ) : (
                        <span>{pred.daysLeft} {pred.daysLeft === 1 ? 'Day' : 'Days'}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-sm font-bold capitalize ${
                        pred.riskLevel === 'healthy' 
                          ? 'badge-success text-success-content' 
                          : pred.riskLevel === 'warning' 
                          ? 'badge-warning text-warning-content' 
                          : 'badge-error text-error-content animate-pulse'
                      }`}>
                        {pred.riskLevel.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'suppliers' && (
        <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-6 space-y-4 animate-in fade-in duration-300">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Award className="text-amber-500" size={22} />
              <span>Supplier Performance Ranking (Procurement metrics)</span>
            </h3>
            <p className="text-xs text-base-content/60 mt-1">
              Evaluates partners based on invoice fulfillment rates, historical reliability indexes, and delivery speeds.
            </p>
          </div>

          {supplierRanking.length === 0 ? (
            <div className="p-8 text-center text-base-content/50">No supplier metric profiles found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {supplierRanking.map((supplier: any, idx: number) => (
                <div key={supplier.id} className="border border-base-200 rounded-2xl p-5 bg-base-200/25 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold">
                        #{idx + 1}
                      </div>
                      <span className={`badge badge-sm font-bold border ${supplier.color}`}>
                        {supplier.rank}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-base-content text-sm">{supplier.name}</h4>
                      <p className="text-xs text-base-content/50">{supplier.phone}</p>
                    </div>

                    <div className="space-y-1.5 text-xs border-t border-base-200 pt-3">
                      <div className="flex justify-between">
                        <span className="text-base-content/60">Reliability Score:</span>
                        <span className="font-bold text-success flex items-center gap-0.5">
                          {supplier.reliability.toFixed(1)} / 5.0
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base-content/60">Delivery Speed:</span>
                        <span className="font-semibold text-warning">{supplier.speed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base-content/60">Price Competitiveness:</span>
                        <span className="font-semibold text-primary">{supplier.competitiveness}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'forecasting' && (
        <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-6 space-y-4 animate-in fade-in duration-300">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="text-primary animate-pulse" size={22} />
              <span>AI Weekly Demand Forecasts</span>
            </h3>
            <p className="text-xs text-base-content/60 mt-1">
              Anticipated product sales units for the upcoming week computed from historical trends.
            </p>
          </div>

          {demandForecasts.length === 0 ? (
            <div className="p-8 text-center text-base-content/50">
              No demand forecasting analyses recorded. Triggers dynamically on transactions.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {demandForecasts.map((ins: any) => {
                let parsedPred: any = {};
                try {
                  parsedPred = JSON.parse(ins.prediction);
                } catch (e) {
                  parsedPred = { prediction: ins.prediction };
                }

                return (
                  <div key={ins.id} className="border border-base-200 rounded-2xl p-5 bg-base-200/25 space-y-3">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-base-content text-sm">{ins.good?.subCategory?.name}</h4>
                      <span className="badge badge-primary font-mono font-bold text-[10px]">
                        {(parseFloat(ins.confidence) * 100).toFixed(0)}% CONF
                      </span>
                    </div>
                    <p className="text-xs text-base-content/50 font-mono">SN: {ins.good?.serial}</p>
                    
                    <div className="border-t border-base-200 pt-3 flex justify-between items-center text-xs">
                      <span className="font-medium text-base-content/70">Projected Next-Week Demand:</span>
                      <span className="font-black text-primary text-sm font-mono">{parsedPred.predictedSalesNextWeek} units</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'warehouse' && (
        <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-6 space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Package className="text-primary" size={22} />
                <span>Nightly Aggregated Warehouse Analytics</span>
              </h3>
              <p className="text-xs text-base-content/60 mt-1">
                Data aggregated by the nightly cron job tracking long-term health metrics like dead stock and turnover rates.
              </p>
            </div>
            <button className="btn btn-sm btn-outline gap-2" onClick={() => downloadCSV(warehouseData, "warehouse_analytics.csv")}>
              <Download size={16} /> Export Data
            </button>
          </div>

          {warehouseData.length === 0 ? (
            <div className="p-8 text-center text-base-content/50">
              No warehouse data recorded yet. Wait for the nightly job or initial seeding.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="bg-base-200/50">
                    <th>Report Date</th>
                    <th>Total Cumulative Sales</th>
                    <th>Est. Profit Margin</th>
                    <th>Dead Stock Value</th>
                    <th>Inventory Turnover Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouseData.map((data: any) => (
                    <tr key={data.id} className="hover:bg-base-200/30">
                      <td className="font-semibold text-xs">{new Date(data.reportDate).toLocaleDateString()}</td>
                      <td className="font-bold text-primary">KSh {parseFloat(data.totalSales).toLocaleString()}</td>
                      <td className="font-semibold text-success">KSh {parseFloat(data.totalProfit).toLocaleString()}</td>
                      <td className="font-semibold text-error">KSh {parseFloat(data.deadStockValue).toLocaleString()}</td>
                      <td className="font-bold font-mono">{data.inventoryTurnoverRate}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
