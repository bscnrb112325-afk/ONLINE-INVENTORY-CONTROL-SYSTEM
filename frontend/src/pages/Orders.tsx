import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Truck, CheckCircle, Package, Hourglass, User, Calendar, CreditCard, Eye, EyeOff, Clock, ArrowUpRight, ShieldAlert, DollarSign, X, ClipboardCheck, Lock } from 'lucide-react';
import { UserHeader } from '../components/UserHeader';

const ORDER_STATUSES = ['Pending', 'Paid', 'Processing', 'Packed', 'Shipped', 'Delivered'];

const STATUS_ICONS: Record<string, any> = {
  Pending: <Hourglass size={18} className="text-warning" />,
  Paid: <CheckCircle size={18} className="text-success" />,
  Processing: <Package size={18} className="text-info" />,
  Packed: <Package size={18} className="text-indigo-400" />,
  Shipped: <Truck size={18} className="text-purple-400" />,
  Delivered: <CheckCircle size={18} className="text-success" />,
};

const STATUS_BADGES: Record<string, string> = {
  Pending: 'badge-warning text-warning-content',
  Paid: 'badge-success text-success-content',
  Processing: 'badge-info text-info-content',
  Packed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-none',
  Shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-none',
  Delivered: 'badge-success text-success-content',
};

const Orders = () => {
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sales' | 'purchases'>('sales');
  const [receivingPurchase, setReceivingPurchase] = useState<any | null>(null);
  const [verifiedQty, setVerifiedQty] = useState<number>(0);

  // Lock Screen
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    setIsUnlocking(true);
    try {
      const res = await api.post('/users/verify-pos', {
        name: userName,
        password: password
      });
      if (res.data.success) {
        const userRole = res.data.user.role;
        if (userRole === 'admin' || userRole === 'manager') {
          setIsUnlocked(true);
          setLoggedInUser(res.data.user);
        } else {
          setUnlockError('Access Denied: Only Manager and Admin can access Orders.');
        }
      }
    } catch (err: any) {
      setUnlockError('Incorrect username or password.');
    } finally {
      setIsUnlocking(false);
    }
  };


  // Fetch orders from API
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await api.get('/ai/orders');
      return res.data;
    },
  });

  // Fetch supplier purchases (shipments) from API
  const { data: purchasesList = [], isLoading: purchasesLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const res = await api.get('/purchases');
      return res.data;
    },
  });

  // Mutation to update order status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      await api.post(`/ai/orders/${orderId}/status`, { orderStatus: status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Mutation to receive purchase shipment
  const receivePurchaseMutation = useMutation({
    mutationFn: async ({ purchaseId, qty, productId }: { purchaseId: string; qty: number; productId: string }) => {
      await api.post(`/ai/purchases/${purchaseId}/receive`, { qty, productId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['goods'] });
      setReceivingPurchase(null);
    },
  });

  if (isLoading || purchasesLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  const selectedOrder = orders.find((o: any) => o.id === selectedOrderId);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const selectedPurchase = purchasesList.find((p: any) => p.id === selectedPurchaseId);

  if (!isUnlocked) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
        <div className="card w-96 bg-base-100 shadow-2xl border border-base-200">
          <div className="card-body">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Lock size={32} />
              </div>
            </div>
            <h2 className="card-title text-center block text-2xl mb-1">Orders Pipeline Locked</h2>
            <p className="text-center text-base-content/60 text-sm mb-6">To login to Orders Pipeline use details on settings User Management.</p>
            
            <form onSubmit={handleUnlock} className="space-y-4">
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                disabled={isUnlocking || !userName || !password}
              >
                {isUnlocking ? <span className="loading loading-spinner loading-sm"></span> : 'Unlock Orders'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      {loggedInUser && (
        <UserHeader 
          user={loggedInUser} 
          onLogout={() => {
            setIsUnlocked(false);
            setLoggedInUser(null);
            setPassword('');
          }} 
        />
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-base-content flex items-center gap-2">
            <Truck className="text-primary" size={32} />
            <span>Logistics & Supply Chain</span>
          </h2>
          <p className="text-base-content/70 mt-1">
            Track customer orders, manage supplier payments, and verify incoming supplier stock arrivals.
          </p>
        </div>
        
        {/* Tab switcher */}
        <div className="tabs tabs-boxed bg-base-200/60 p-1 border border-base-200 rounded-xl">
          <button 
            className={`tab font-bold text-xs rounded-lg py-2 transition-all ${activeTab === 'sales' ? 'tab-active bg-primary text-primary-content shadow-sm' : 'text-base-content/70 hover:text-base-content'}`}
            onClick={() => setActiveTab('sales')}
          >
            Customer Orders
          </button>
          <button 
            className={`tab font-bold text-xs rounded-lg py-2 transition-all ${activeTab === 'purchases' ? 'tab-active bg-primary text-primary-content shadow-sm' : 'text-base-content/70 hover:text-base-content'}`}
            onClick={() => setActiveTab('purchases')}
          >
            Supplier Shipments
          </button>
        </div>
      </div>

      {activeTab === 'sales' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Side: Orders List */}
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-4">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Truck className="text-primary" />
                <span>Customer Orders ({orders.length})</span>
              </h3>
              
              {orders.length === 0 ? (
                <div className="p-8 text-center text-base-content/50">No customer orders recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr className="bg-base-200/50">
                        <th>Order ID</th>
                        <th>Customer / Cashier</th>
                        <th>Date</th>
                        <th>Total Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order: any) => (
                        <tr 
                          key={order.id} 
                          className={`hover:bg-base-200/30 transition-colors cursor-pointer ${selectedOrderId === order.id ? 'bg-primary/5 hover:bg-primary/10' : ''}`}
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          <td className="font-mono text-xs font-bold text-primary">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td>
                            <div className="text-sm font-semibold">{order.customer?.name || 'Walk-in Customer'}</div>
                            <div className="text-xs text-base-content/50">By: {order.user?.name || 'Cashier'}</div>
                          </td>
                          <td className="text-xs">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>
                          <td className="font-bold text-sm">
                            KSh {parseFloat(order.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td>
                            <span className="badge badge-outline text-xs capitalize flex gap-1 items-center">
                              <CreditCard size={12} />
                              {order.paymentMethod}
                            </span>
                          </td>
                          <td>
                            <span className={`badge badge-sm font-medium ${STATUS_BADGES[(order.orderStatus || 'Pending').charAt(0).toUpperCase() + (order.orderStatus || 'Pending').slice(1)] || 'badge-ghost'}`}>
                              {(order.orderStatus || 'Pending').charAt(0).toUpperCase() + (order.orderStatus || 'Pending').slice(1)}
                            </span>
                          </td>
                          <td>
                            <button 
                              className="btn btn-ghost btn-xs btn-square"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrderId(order.id);
                              }}
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Order Detail & Stepper */}
          <div className="xl:col-span-1">
            {selectedOrder ? (
              <div className="bg-base-100 shadow-md border border-base-200 rounded-2xl p-6 sticky top-6 space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-start border-b border-base-200 pb-4">
                  <div>
                    <h3 className="font-mono text-lg font-bold text-primary">
                      ORDER #{selectedOrder.id.slice(0, 8).toUpperCase()}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-base-content/60 mt-1">
                      <Calendar size={12} />
                      <span>{new Date(selectedOrder.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <span className={`badge font-bold ${STATUS_BADGES[(selectedOrder.orderStatus || 'Pending').charAt(0).toUpperCase() + (selectedOrder.orderStatus || 'Pending').slice(1)] || 'badge-ghost'}`}>
                    {(selectedOrder.orderStatus || 'Pending').charAt(0).toUpperCase() + (selectedOrder.orderStatus || 'Pending').slice(1)}
                  </span>
                </div>

                {/* Progress Stepper */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-base-content/70 uppercase tracking-wider">Delivery Tracker</h4>
                  <ul className="steps steps-vertical w-full text-sm">
                    {ORDER_STATUSES.map((status, index) => {
                      const rawStatus = selectedOrder.orderStatus || 'Pending';
                      const normalizedDbStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
                      const currentStatusIndex = ORDER_STATUSES.indexOf(normalizedDbStatus);
                      const isCompleted = index <= currentStatusIndex;
                      return (
                        <li 
                          key={status} 
                          className={`step ${isCompleted ? 'step-primary' : ''} text-left flex gap-3`}
                        >
                          <span className="font-semibold text-base-content flex items-center gap-2">
                            {STATUS_ICONS[status]}
                            {status}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Action Buttons to Transition Status */}
                <div className="border-t border-base-200 pt-4 space-y-2">
                  <h4 className="text-xs font-bold text-base-content/70 uppercase tracking-wider mb-2">Transition Order Status</h4>
                  <div className="flex flex-wrap gap-2">
                    {ORDER_STATUSES.map((status) => {
                      const rawStatus = selectedOrder.orderStatus || 'Pending';
                      const normalizedDbStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
                      return (
                      <button
                        key={status}
                        className={`btn btn-xs ${normalizedDbStatus === status ? 'btn-primary' : 'btn-outline'}`}
                        disabled={updateStatusMutation.isPending}
                        onClick={() => updateStatusMutation.mutate({ orderId: selectedOrder.id, status })}
                      >
                        {status}
                      </button>
                      );
                    })}
                  </div>
                </div>

                {/* Items List */}
                <div className="border-t border-base-200 pt-4">
                  <h4 className="text-sm font-bold text-base-content/70 mb-3">Order Items</h4>
                  <div className="space-y-3">
                    {selectedOrder.saleItems?.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center text-sm p-2 bg-base-200/50 rounded-lg">
                        <div>
                          <div className="font-semibold">{item.good?.subCategory?.name || 'Inventory Item'}</div>
                          <div className="text-xs text-base-content/50 font-mono">SN: {item.good?.serial}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">x{item.quantity}</div>
                          <div className="text-xs font-medium text-primary">KSh {parseFloat(item.totalPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t border-base-200 pt-4 flex justify-between items-center">
                  <span className="font-bold text-base-content">Total amount paid</span>
                  <span className="text-xl font-bold text-primary">KSh {parseFloat(selectedOrder.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ) : (
              <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-8 text-center text-base-content/50 sticky top-6">
                Select an order from the list to view its tracking stepper pipeline and status controls.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Side: Supplier Purchases List */}
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-4">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Truck className="text-warning" />
                <span>Supplier Shipments / Procurement ({purchasesList.length})</span>
              </h3>
              
              {purchasesList.length === 0 ? (
                <div className="p-8 text-center text-base-content/50">No supplier shipments logged.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr className="bg-base-200/50">
                        <th>Purchase ID</th>
                        <th>Supplier</th>
                        <th>Logistics Manager</th>
                        <th>Date Ordered</th>
                        <th>Total Cost</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchasesList.map((purchase: any) => (
                        <tr 
                          key={purchase.id} 
                          className={`hover:bg-base-200/30 transition-colors cursor-pointer ${selectedPurchaseId === purchase.id ? 'bg-primary/5 hover:bg-primary/10' : ''}`}
                          onClick={() => setSelectedPurchaseId(purchase.id)}
                        >
                          <td className="font-mono text-xs font-bold text-primary">
                            #{purchase.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="font-semibold text-sm">
                            {purchase.supplier?.name}
                          </td>
                          <td className="text-xs text-base-content/60">
                            {purchase.user?.name || 'System Auto'}
                          </td>
                          <td className="text-xs">
                            {new Date(purchase.createdAt).toLocaleDateString()}
                          </td>
                          <td className="font-bold text-sm">
                            KSh {parseFloat(purchase.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td>
                            <span className={`badge badge-sm font-semibold capitalize ${
                              purchase.status === 'completed' 
                                ? 'badge-success text-success-content' 
                                : purchase.status === 'pending' 
                                ? 'badge-warning text-warning-content' 
                                : 'badge-error text-error-content'
                            }`}>
                              {purchase.status}
                            </span>
                          </td>
                          <td>
                            <button 
                              className="btn btn-ghost btn-xs btn-square"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPurchaseId(purchase.id);
                              }}
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Purchase Details & Receiving Form */}
          <div className="xl:col-span-1">
            {selectedPurchase ? (
              <div className="bg-base-100 shadow-md border border-base-200 rounded-2xl p-6 sticky top-6 space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-start border-b border-base-200 pb-4">
                  <div>
                    <h3 className="font-mono text-lg font-bold text-primary">
                      SHIPMENT #{selectedPurchase.id.slice(0, 8).toUpperCase()}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-base-content/60 mt-1">
                      <Calendar size={12} />
                      <span>{new Date(selectedPurchase.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <span className={`badge font-bold uppercase text-xs ${
                    selectedPurchase.status === 'completed' 
                      ? 'badge-success text-success-content' 
                      : 'badge-warning text-warning-content'
                  }`}>
                    {selectedPurchase.status}
                  </span>
                </div>

                {/* Supplier Info card */}
                <div className="bg-base-200/50 p-4 rounded-xl space-y-2 border border-base-200/80">
                  <h4 className="text-xs font-bold text-base-content/60 uppercase tracking-wider">Supplier Details</h4>
                  <div>
                    <div className="font-bold text-sm">{selectedPurchase.supplier?.name}</div>
                    <div className="text-xs text-base-content/70">{selectedPurchase.supplier?.phone}</div>
                    <div className="text-xs text-base-content/75 mt-1">{selectedPurchase.supplier?.address}</div>
                  </div>
                </div>

                {/* Goods list & expected counts */}
                <div>
                  <h4 className="text-xs font-bold text-base-content/60 uppercase tracking-wider mb-2">Item Delivery Verification</h4>
                  {selectedPurchase.goods && selectedPurchase.goods.length > 0 ? (
                    <div className="space-y-3">
                      {selectedPurchase.goods.map((good: any) => {
                        const expectedQty = Math.round(parseFloat(selectedPurchase.totalAmount) / parseFloat(good.buyRate));
                        
                        return (
                          <div key={good.id} className="border border-base-200 rounded-xl p-3 bg-base-200/20 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-bold text-sm">{good.name || good.subCategory?.name}</div>
                                <div className="text-xs font-mono text-base-content/60">SN: {good.serial}</div>
                              </div>
                              <span className="badge badge-outline text-xs">KSh {parseFloat(good.buyRate).toLocaleString()} / unit</span>
                            </div>

                            {selectedPurchase.status === 'pending' ? (
                              <div className="pt-2 border-t border-base-200/80 flex flex-col gap-2">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-medium text-base-content/70">Expected Quantity:</span>
                                  <span className="font-bold text-primary font-mono">{expectedQty} units</span>
                                </div>
                                <div className="form-control">
                                  <label className="label py-1">
                                    <span className="label-text text-xxs font-bold uppercase text-base-content/60">Scanned / Verified Qty Received</span>
                                  </label>
                                  <div className="flex gap-2">
                                    <input 
                                      type="number" 
                                      className="input input-sm input-bordered w-full font-bold font-mono text-center" 
                                      defaultValue={expectedQty}
                                      onChange={(e) => setVerifiedQty(parseInt(e.target.value) || 0)}
                                    />
                                    <button 
                                      className="btn btn-sm btn-success font-bold gap-1 text-xs shrink-0 shadow-sm"
                                      onClick={() => {
                                        const qtyToUse = verifiedQty || expectedQty;
                                        setReceivingPurchase({ purchaseId: selectedPurchase.id, qty: qtyToUse, productId: good.id, goodName: good.name || good.subCategory?.name });
                                      }}
                                    >
                                      <ClipboardCheck size={14} />
                                      <span>Receive & Verify</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="pt-2 border-t border-base-200/80 flex justify-between items-center text-xs font-medium text-success-content bg-success/10 p-2 rounded-lg">
                                <span className="flex items-center gap-1"><CheckCircle size={14} className="text-success" /> Quantity Received:</span>
                                <span className="font-bold font-mono text-success">{good.qty} units (Updated in Stock)</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-base-content/50 italic bg-base-200/30 p-4 rounded-xl text-center">
                      No linked items found on this shipment order.
                    </div>
                  )}
                </div>

                {/* Total Cost */}
                <div className="border-t border-base-200 pt-4 flex justify-between items-center">
                  <span className="font-bold text-base-content">Invoice Value</span>
                  <span className="text-xl font-bold text-primary">KSh {parseFloat(selectedPurchase.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ) : (
              <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-8 text-center text-base-content/50 sticky top-6">
                Select a shipment from the list to view supplier invoices, item details, and physical receipt logs.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shipment Verification Modal */}
      {receivingPurchase && (
        <div className="modal modal-open animate-in fade-in duration-300">
          <div className="modal-box bg-base-100 border border-base-200 shadow-2xl rounded-2xl p-6">
            <h3 className="text-lg font-bold text-base-content flex items-center gap-2 mb-2">
              <ClipboardCheck className="text-success animate-bounce" size={24} />
              <span>Confirm Stock Arrival</span>
            </h3>
            
            <p className="text-sm text-base-content/85 leading-relaxed mb-4">
              Are you sure you want to log the receipt of <span className="font-bold text-primary">{receivingPurchase.qty} units</span> of <span className="font-bold text-base-content">{receivingPurchase.goodName}</span>? 
              This will mark the purchase order as completed, increment stock levels automatically, and trigger catalog shop sync.
            </p>

            <div className="modal-action gap-2">
              <button 
                className="btn btn-outline" 
                onClick={() => setReceivingPurchase(null)}
                disabled={receivePurchaseMutation.isPending}
              >
                Cancel
              </button>
              <button 
                className="btn btn-success font-bold" 
                onClick={() => receivePurchaseMutation.mutate({ 
                  purchaseId: receivingPurchase.purchaseId, 
                  qty: receivingPurchase.qty, 
                  productId: receivingPurchase.productId 
                })}
                disabled={receivePurchaseMutation.isPending}
              >
                {receivePurchaseMutation.isPending ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : (
                  'Confirm & Sync Stock'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
