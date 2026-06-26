import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { api } from '../api';
import { ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, Sparkles, HelpCircle, UserCircle, DollarSign, ReceiptText, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';

interface CartItem {
  goodId: string;
  serial: string;
  name: string;
  quantity: number;
  unitPrice: number;
  maxQty: number;
}

const POS = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scanSerial, setScanSerial] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // M-Pesa States
  const [mpesaPhone, setMpesaPhone] = useState('0700000000');
  const [isWaitingForMpesa, setIsWaitingForMpesa] = useState(false);
  const [stkPushRequestId, setStkPushRequestId] = useState<string | null>(null);

  // New POS Features States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [amountTendered, setAmountTendered] = useState<number>(0);
  
  // Split Payment
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState({ cash: 0, mpesa: 0, card: 0 });

  // Receipt
  const [showReceipt, setShowReceipt] = useState(false);
  const [isSendingDigital, setIsSendingDigital] = useState(false);
  const [lastSalePayload, setLastSalePayload] = useState<any>(null);

  // POS Lock Screen
  const [isPosUnlocked, setIsPosUnlocked] = useState(false);
  const [cashierName, setCashierName] = useState('');
  const [posPassword, setPosPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [activeCashierId, setActiveCashierId] = useState<string | null>(null);
  const [activeCashierName, setActiveCashierName] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Change Password Modal
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // User Role checking
  const isManagerOrAdmin = user?.publicMetadata?.role === 'manager' || user?.publicMetadata?.role === 'admin';

  // Fetch goods
  const { data: goods = [], isLoading } = useQuery({
    queryKey: ['goods'],
    queryFn: async () => {
      const res = await api.get('/inventory/goods');
      return res.data;
    },
  });

  // Fetch AI Insights for cross-selling recommendations
  const { data: insights = [] } = useQuery({
    queryKey: ['insights'],
    queryFn: async () => {
      const res = await api.get('/ai/insights');
      return res.data;
    },
  });

  // Fetch Customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return res.data;
    },
  });

  // Mutator to process checkout sale
  const checkoutMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/sales', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['goods'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      setCart([]);
      setDiscountAmount(0);
      setAmountTendered(0);
      setSplitAmounts({ cash: 0, mpesa: 0, card: 0 });
      setIsWaitingForMpesa(false);
      setStkPushRequestId(null);
      setIsProcessing(false);
      setCheckoutSuccess(true);
      setShowReceipt(true); // Open Receipt Modal
      setTimeout(() => setCheckoutSuccess(false), 5000);
    },
    onError: (error: any) => {
      console.error('Checkout failed:', error);
      alert('Checkout failed: ' + (error.response?.data?.error || error.message));
      setIsProcessing(false);
    }
  });

  // Listen to SSE for STK Push callback
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const eventSource = new EventSource(`${apiUrl}/stream`);
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'STK_PUSH_SUCCESS' && isWaitingForMpesa) {
        console.log('M-Pesa Success Received via SSE', data);
        if (lastSalePayload) {
          // Complete the sale in the backend now that payment is confirmed
          checkoutMutation.mutate(lastSalePayload);
        }
      } else if (data.type === 'STK_PUSH_FAILED' && isWaitingForMpesa) {
        alert('M-Pesa Payment Failed: ' + data.payload.reason);
        setIsWaitingForMpesa(false);
        setIsProcessing(false);
      }
    };
    return () => eventSource.close();
  }, [isWaitingForMpesa, lastSalePayload]);

  // Auto-print receipt when it opens
  useEffect(() => {
    if (showReceipt && lastSalePayload) {
      // Small delay to ensure DOM is rendered before printing
      const timer = setTimeout(() => {
        const printContent = document.getElementById('printable-receipt')?.innerHTML;
        if (printContent) {
          const printWindow = window.open('', '', 'width=300,height=600');
          if (printWindow) {
            printWindow.document.write('<html><head><title>Receipt</title><style>body { font-family: monospace; padding: 10px; margin: 0; }</style></head><body>');
            printWindow.document.write(printContent);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showReceipt, lastSalePayload]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  const handleUnlockPos = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    setIsUnlocking(true);
    try {
      const res = await api.post('/users/verify-pos', {
        name: cashierName,
        password: posPassword
      });
      if (res.data.success) {
        const userRole = res.data.user.role;
        if (userRole === 'admin' || userRole === 'cashier') {
          setIsPosUnlocked(true);
          setActiveCashierId(res.data.user.id);
          setActiveCashierName(res.data.user.name);
        } else {
          setUnlockError('Access Denied: Only Admins and Cashiers can access Point of Sale.');
        }
      }
    } catch (err: any) {
      setUnlockError('Incorrect username or password.');
    } finally {
      setIsUnlocking(false);
    }
  };

  if (!isPosUnlocked) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
        <div className="card w-96 bg-base-100 shadow-2xl border border-base-200">
          <div className="card-body">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Lock size={32} />
              </div>
            </div>
            <h2 className="card-title text-center block text-2xl mb-1">POS Locked</h2>
            <p className="text-center text-base-content/60 text-sm mb-6">To login enter username and password.</p>
            
            <form onSubmit={handleUnlockPos} className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">Cashier Name</span></label>
                <input 
                  type="text" 
                  className="input input-bordered w-full" 
                  placeholder="e.g. John Doe" 
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
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
                    value={posPassword}
                    onChange={(e) => setPosPassword(e.target.value)}
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
                disabled={isUnlocking || !cashierName || !posPassword}
              >
                {isUnlocking ? <span className="loading loading-spinner loading-sm"></span> : 'Unlock Register'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess(false);
    setChangePasswordLoading(true);

    try {
      await api.post('/users/update-pos-password', {
        userId: activeCashierId,
        currentPassword,
        newPassword
      });
      setChangePasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setShowChangePassword(false), 2000);
    } catch (err: any) {
      setChangePasswordError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  // Handle Scanning Barcode directly
  const handleBarcodeScan = async () => {
    if (!scanSerial) return;
    try {
      const res = await api.get(`/sales/scan/${scanSerial}`);
      const good = res.data;
      if (good) {
        addToCart(good);
        setScanSerial('');
      }
    } catch (err) {
      alert("Barcode scan error: Good not found or out of stock.");
    }
  };

  const addToCart = (good: any) => {
    if (good.qty <= 0) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.goodId === good.id);
      if (existing) {
        if (existing.quantity >= good.qty) {
          alert(`Cannot add more. Only ${good.qty} units available in stock.`);
          return prev;
        }
        return prev.map((item) =>
          item.goodId === good.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          goodId: good.id,
          serial: good.serial,
          name: good.name || good.subCategory?.name || 'Catalog Item',
          quantity: 1,
          unitPrice: parseFloat(good.sellRate),
          maxQty: good.qty,
        },
      ];
    });
  };

  const updateQuantity = (goodId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.goodId === goodId) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.maxQty) {
              alert(`Cannot exceed stock limit of ${item.maxQty} units.`);
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (goodId: string) => {
    setCart((prev) => prev.filter((item) => item.goodId !== goodId));
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  const totalAfterDiscount = Math.max(0, subtotal - discountAmount);
  const tax = totalAfterDiscount * 0.16; // 16% VAT
  const total = totalAfterDiscount + tax;

  const change = amountTendered > total ? amountTendered - total : 0;

  const handleCheckout = () => {
    if (cart.length === 0) return;

    if (isSplitPayment) {
      const splitTotal = splitAmounts.cash + splitAmounts.mpesa + splitAmounts.card;
      if (Math.abs(splitTotal - total) > 0.01) {
        alert(`Split payment total (KSh ${splitTotal.toFixed(2)}) must equal the grand total (KSh ${total.toFixed(2)}).`);
        return;
      }
    }

    setIsProcessing(true);
    const userId = activeCashierId || user?.id || 'system';

    const paymentsArray = isSplitPayment ? [
      ...(splitAmounts.cash > 0 ? [{ method: 'cash', amount: splitAmounts.cash }] : []),
      ...(splitAmounts.mpesa > 0 ? [{ method: 'mpesa', amount: splitAmounts.mpesa }] : []),
      ...(splitAmounts.card > 0 ? [{ method: 'card', amount: splitAmounts.card }] : []),
    ] : null;

    const payload = {
      customerId: selectedCustomerId || null,
      userId,
      items: cart.map((item) => ({
        goodId: item.goodId,
        name: item.name,
        serial: item.serial,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      paymentMethod: isSplitPayment ? 'cash' : selectedPaymentMethod,
      payments: paymentsArray,
      discountAmount,
      subtotal,
      totalAmount: total,
      taxAmount: tax,
      amountTendered,
      change,
    };
    
    setLastSalePayload(payload);

    // If payment method is mpesa, initiate STK push and wait for webhook
    if (selectedPaymentMethod === 'mpesa') {
      setIsWaitingForMpesa(true);
      api.post('/sales/mpesa/stkpush', {
        phone: mpesaPhone,
        amount: total.toFixed(0),
        reference: 'OICS POS Checkout',
      })
      .then((res) => {
        if (res.data.data && res.data.data.CheckoutRequestID) {
           setStkPushRequestId(res.data.data.CheckoutRequestID);
        } else {
           // Mock response or failed structure
           setStkPushRequestId("MOCK_REQ_ID");
        }
      })
      .catch((err) => {
        console.error("STK Push error", err);
        alert("Failed to initiate STK Push. Check Daraja credentials.");
        setIsWaitingForMpesa(false);
        setIsProcessing(false);
      });
    } else {
      checkoutMutation.mutate(payload);
      setIsProcessing(false);
    }
  };

  // Filter products matching search keyword
  const filteredProducts = goods.filter((good: any) => {
    const term = searchTerm.toLowerCase();
    return (good.name || good.subCategory?.name || 'Product').toLowerCase().includes(term) ||
           good.serial.toLowerCase().includes(term);
  });

  // AI cross-sell recommendations
  const dynamicPricingInsights = insights.filter((ins: any) => ins.type === 'dynamic_pricing');

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
      {/* Left side - Product Selection Grid */}
      <div className="flex-1 flex flex-col bg-base-100 shadow-md rounded-2xl border border-base-200 overflow-hidden">
        <div className="p-4 border-b border-base-200 bg-base-200/10 flex flex-col sm:flex-row gap-4">
          {/* Scanning Input */}
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" size={18} />
              <input 
                type="text" 
                placeholder="Scan barcode directly (e.g. SN-883921)..." 
                className="input input-bordered w-full pl-10" 
                value={scanSerial}
                onChange={(e) => setScanSerial(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBarcodeScan()}
              />
            </div>
            <button className="btn btn-primary shadow-sm" onClick={handleBarcodeScan}>Scan</button>
          </div>

          {/* Search catalog */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" size={18} />
            <input 
              type="text" 
              placeholder="Search catalog models..." 
              className="input input-bordered w-full pl-10" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        {/* Products catalog list */}
        <div className="flex-1 overflow-y-auto p-4 bg-base-200/30">
          {checkoutSuccess && (
            <div className="alert alert-success shadow-md rounded-2xl mb-4 font-bold animate-pulse text-sm">
              <Sparkles size={16} />
              <span>Checkout logged! Stock updated and AI forecasting triggered.</span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((good: any) => {
              const isOut = good.qty <= 0;
              const isLow = good.qty <= 3 && good.qty > 0;
              
              return (
                <div 
                  key={good.id} 
                  className={`card bg-base-100 shadow-sm border border-base-200 cursor-pointer hover:border-primary/60 hover:scale-[1.02] transition-all duration-200 ${isOut ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={() => !isOut && addToCart(good)}
                >
                  <figure className="px-3 pt-3 relative">
                    {good.imageGoodId ? (
                      <img src={good.imageGoodId} alt="Product" className="w-full h-24 object-cover rounded-xl border border-base-200/50" />
                    ) : (
                      <div className="w-full h-24 bg-primary/5 text-primary rounded-xl flex items-center justify-center font-bold text-xs uppercase font-mono border border-base-200/50">
                        {good.serial.slice(0, 8)}
                      </div>
                    )}
                  </figure>
                  <div className="card-body p-3 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-base-content/40 tracking-wider line-clamp-1 mr-1">{good.subCategory?.name || 'SKU'}</span>
                      <span className="text-[10px] font-mono font-semibold text-base-content/50 bg-base-200 px-1 py-0.5 rounded-md">#{good.serial.slice(0,8)}</span>
                    </div>
                    <h2 className="card-title text-xs font-bold line-clamp-1 text-base-content mt-0.5">
                      {good.name || good.subCategory?.name || 'Inventory Good'}
                    </h2>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-primary font-bold text-sm">
                        KSh {parseFloat(good.sellRate).toFixed(2)}
                      </p>
                      {isOut ? (
                        <span className="badge badge-error badge-xs font-bold">Sold Out</span>
                      ) : isLow ? (
                        <span className="badge badge-warning badge-xs font-bold animate-pulse">Only {good.qty}</span>
                      ) : (
                        <span className="badge badge-success text-success-content badge-xs font-bold">{good.qty} in Stock</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right side - Cart Checkout Drawer */}
      <div className="w-full lg:w-96 flex flex-col bg-base-100 shadow-md rounded-2xl border border-base-200 overflow-hidden">
        <div className="p-4 border-b border-base-200 bg-primary text-primary-content flex justify-between items-center">
          <h2 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
            <ShoppingCart size={18} />
            <span>POS Register - {activeCashierName || 'Cashier'}</span>
          </h2>
          <div className="flex items-center gap-2">
            <button 
              className="btn btn-xs btn-ghost text-primary-content border border-primary-content/30 hover:bg-primary-content hover:text-primary"
              onClick={() => setShowChangePassword(true)}
              title="Change Password"
            >
              <KeyRound size={14} />
            </button>
            <button 
              className="btn btn-xs btn-ghost text-primary-content border border-primary-content/30 hover:bg-primary-content hover:text-primary"
              onClick={() => {
                setIsPosUnlocked(false);
                setActiveCashierId(null);
                setActiveCashierName('');
                setUnlockError('');
              }}
              title="Lock POS"
            >
              <Lock size={14} />
            </button>
            <span className="badge badge-secondary badge-sm font-bold">{cart.length} items</span>
          </div>
        </div>
        
        {/* Cart Item rows */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-base-content/40 text-xs py-8 space-y-2">
              <ShoppingCart size={32} className="opacity-40" />
              <span>Register is empty. Scan barcode or click items to buy.</span>
            </div>
          ) : (
            cart.map((item) => {
              const isLow = item.maxQty <= 3;
              return (
                <div key={item.goodId} className="flex items-center gap-3 p-3 bg-base-200/50 rounded-xl border border-base-200 hover:border-primary/20 transition-all">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-xs truncate text-base-content">{item.name}</h4>
                    <p className="text-[10px] text-base-content/50 font-mono">SN: {item.serial}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-bold text-primary">KSh {item.unitPrice.toFixed(2)} / ea</span>
                      {isLow && (
                        <span className="badge badge-warning badge-[10px] p-1 font-bold animate-pulse">Only {item.maxQty} left</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="btn btn-ghost btn-xs btn-square" onClick={() => updateQuantity(item.goodId, -1)}>
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                    <button className="btn btn-ghost btn-xs btn-square" onClick={() => updateQuantity(item.goodId, 1)}>
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="font-bold text-xs w-16 text-right text-base-content">
                    KSh {(item.quantity * item.unitPrice).toFixed(2)}
                  </div>
                  <button className="btn btn-ghost btn-xs btn-square text-error/70 hover:bg-error/10" onClick={() => removeFromCart(item.goodId)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}

          {/* AI Cross-selling Recommendations */}
          {dynamicPricingInsights.length > 0 && cart.length > 0 && (
            <div className="mt-6 border-t border-base-200 pt-4 space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                <Sparkles size={12} className="animate-spin" />
                <span>AI Suggested Add-ons</span>
              </h4>
              <div className="space-y-2">
                {dynamicPricingInsights.slice(0, 2).map((ins: any) => {
                  let parsedPred: any = {};
                  try {
                    parsedPred = JSON.parse(ins.prediction);
                  } catch (e) {
                    parsedPred = { suggestedPrice: ins.good?.sellRate };
                  }
                  
                  // Check if this item is already in cart
                  const inCart = cart.some(c => c.goodId === ins.good?.id);
                  if (inCart) return null;

                  return (
                    <div 
                      key={ins.id} 
                      className="p-2 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors"
                      onClick={() => addToCart(ins.good)}
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold truncate text-base-content">{ins.good?.subCategory?.name}</div>
                        <div className="text-[9px] text-base-content/50">Dynamic Price: KSh {parseFloat(parsedPred.suggestedPrice || ins.good?.sellRate).toFixed(2)}</div>
                      </div>
                      <button className="btn btn-primary btn-xs font-bold text-[10px]">Add</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Customer & Discount */}
        <div className="p-4 border-t border-base-200 bg-base-100 space-y-3">
          <div className="flex items-center gap-2">
            <UserCircle size={16} className="text-base-content/60" />
            <select 
              className="select select-bordered select-xs w-full"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              <option value="">Walk-in Customer</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {isManagerOrAdmin && (
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-base-content/60" />
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs text-base-content/60 whitespace-nowrap">Discount KSh</span>
                <input 
                  type="number" 
                  min="0"
                  className="input input-bordered input-xs w-full"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}
        </div>

        {/* Cart Sum & Checkout Actions */}
        <div className="p-4 border-t border-base-200 bg-base-200/20 space-y-4">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-base-content/60">Subtotal</span>
              <span className="font-semibold">KSh {subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount Applied</span>
                <span className="font-semibold">-KSh {discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-base-content/60">Tax (16% VAT)</span>
              <span className="font-semibold">KSh {tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-base-300 text-base-content">
              <span>Total</span>
              <span className="text-primary">KSh {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="form-control space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider">Payment Method</label>
              <label className="cursor-pointer label p-0 gap-2">
                <span className="text-[10px] font-bold text-base-content/70">Split</span>
                <input type="checkbox" className="toggle toggle-primary toggle-xs" checked={isSplitPayment} onChange={(e) => setIsSplitPayment(e.target.checked)} />
              </label>
            </div>

            {!isSplitPayment ? (
              <div className="grid grid-cols-3 gap-2">
                <button 
                  className={`btn btn-xs flex gap-1 justify-center py-2 h-auto ${selectedPaymentMethod === 'cash' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSelectedPaymentMethod('cash')}
                >
                  Cash
                </button>
                <button 
                  className={`btn btn-xs flex gap-1 justify-center py-2 h-auto ${selectedPaymentMethod === 'mpesa' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSelectedPaymentMethod('mpesa')}
                >
                  M-Pesa
                </button>
                <button 
                  className={`btn btn-xs flex gap-1 justify-center py-2 h-auto ${selectedPaymentMethod === 'card' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSelectedPaymentMethod('card')}
                >
                  Card
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs w-16">Cash KSh</span>
                  <input type="number" className="input input-bordered input-xs w-full" value={splitAmounts.cash || ''} onChange={(e) => setSplitAmounts({...splitAmounts, cash: Number(e.target.value)})} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-16">M-Pesa KSh</span>
                  <input type="number" className="input input-bordered input-xs w-full" value={splitAmounts.mpesa || ''} onChange={(e) => setSplitAmounts({...splitAmounts, mpesa: Number(e.target.value)})} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-16">Card KSh</span>
                  <input type="number" className="input input-bordered input-xs w-full" value={splitAmounts.card || ''} onChange={(e) => setSplitAmounts({...splitAmounts, card: Number(e.target.value)})} />
                </div>
              </div>
            )}

            {/* M-Pesa Phone Number Input */}
            {!isSplitPayment && selectedPaymentMethod === 'mpesa' && (
               <div className="pt-2 border-t border-base-200 mt-2 space-y-2">
                 <div className="flex items-center justify-between gap-2">
                   <span className="text-xs font-semibold">M-Pesa Phone:</span>
                   <input 
                     type="tel" 
                     className="input input-bordered input-sm w-32"
                     placeholder="07..."
                     value={mpesaPhone}
                     onChange={(e) => setMpesaPhone(e.target.value)}
                   />
                 </div>
               </div>
            )}

            {/* Amount Tendered (For Cash or Split Cash) */}
            {(!isSplitPayment && selectedPaymentMethod === 'cash') || (isSplitPayment && splitAmounts.cash > 0) ? (
              <div className="pt-2 border-t border-base-200 mt-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">Tendered:</span>
                  <input 
                    type="number" 
                    className="input input-bordered input-sm w-32 text-right"
                    placeholder="0.00"
                    value={amountTendered || ''}
                    onChange={(e) => setAmountTendered(Number(e.target.value))}
                  />
                </div>
                {amountTendered > 0 && (
                  <div className="flex items-center justify-between gap-2 bg-success/10 p-2 rounded-lg">
                    <span className="text-xs font-bold text-success">Change Due:</span>
                    <span className="font-bold text-success">KSh {change.toFixed(2)}</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <button 
            className="btn btn-primary w-full btn-md text-sm shadow-md"
            onClick={handleCheckout}
            disabled={cart.length === 0 || isProcessing || checkoutMutation.isPending || (isSplitPayment && Math.abs((splitAmounts.cash + splitAmounts.mpesa + splitAmounts.card) - total) > 0.01)}
          >
            {isProcessing || checkoutMutation.isPending ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                <span>Finalizing...</span>
              </>
            ) : (
              <>
                <CreditCard size={18} />
                <span>Submit Sale (KSh {total.toFixed(2)})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && lastSalePayload && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm p-6 bg-white text-black shadow-2xl rounded-none relative">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-black" onClick={() => setShowReceipt(false)}>✕</button>
            
            {/* Printable Receipt Area */}
            <div className="space-y-4 font-mono text-xs" id="printable-receipt">
              <div className="text-center space-y-1 pb-4 border-b border-gray-300">
                <h3 className="font-bold text-lg uppercase tracking-wider">OICS POS</h3>
                <p>Nairobi, Kenya</p>
                <p>Tel: +254 700 000 000</p>
                <p className="pt-2">Date: {new Date().toLocaleString()}</p>
                <p>Cashier: {activeCashierName || user?.firstName || user?.fullName || 'System'}</p>
              </div>

              <div className="py-2 border-b border-gray-300">
                <div className="flex justify-between font-bold pb-2">
                  <span>Item</span>
                  <span>Total</span>
                </div>
                {lastSalePayload.items.map((item: any, idx: number) => (
                  <div key={idx} className="pb-2">
                    <div className="truncate">{item.name}</div>
                    <div className="flex justify-between text-gray-600">
                      <span>{item.quantity} x {item.unitPrice.toFixed(2)}</span>
                      <span>{(item.quantity * item.unitPrice).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="py-2 space-y-1 text-right">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{lastSalePayload.subtotal.toFixed(2)}</span>
                </div>
                {lastSalePayload.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-{lastSalePayload.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tax (16%):</span>
                  <span>{lastSalePayload.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-300">
                  <span>Total:</span>
                  <span>{lastSalePayload.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="py-2 border-t border-gray-300 space-y-1">
                {lastSalePayload.paymentMethod === 'cash' ? (
                  <>
                    <div className="flex justify-between">
                      <span>Cash Tendered:</span>
                      <span>{lastSalePayload.amountTendered.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Change:</span>
                      <span>{lastSalePayload.change.toFixed(2)}</span>
                    </div>
                  </>
                ) : lastSalePayload.payments ? (
                  <div className="space-y-1">
                    <div className="font-bold">Split Payments:</div>
                    {lastSalePayload.payments.map((p: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span className="uppercase">{p.method}:</span>
                        <span>{p.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span>Payment Method:</span>
                    <span className="uppercase">{lastSalePayload.paymentMethod}</span>
                  </div>
                )}
              </div>
              
              <div className="text-center pt-4 opacity-70">
                <p>Thank you for your business!</p>
                <p className="mt-1 flex justify-center"><ReceiptText size={24} /></p>
              </div>
            </div>

            {/* Actions */}
            <div className="modal-action mt-6 flex flex-col gap-2 w-full">
              <div className="flex gap-2 w-full">
                <button 
                  className="btn btn-outline flex-1"
                  onClick={() => {
                    setIsSendingDigital(true);
                    setTimeout(() => {
                      setIsSendingDigital(false);
                      alert("Digital receipt sent to customer successfully.");
                      setShowReceipt(false);
                    }, 1500);
                  }}
                  disabled={isSendingDigital}
                >
                  {isSendingDigital ? <span className="loading loading-spinner loading-xs"></span> : "Send Digital"}
                </button>
                <button 
                  className="btn btn-primary flex-1"
                  onClick={() => {
                    const printContent = document.getElementById('printable-receipt')?.innerHTML;
                    if (printContent) {
                      const printWindow = window.open('', '', 'width=350,height=600');
                      if (printWindow) {
                        printWindow.document.write('<html><head><title>Receipt</title><script src="https://cdn.tailwindcss.com"></script><style>body { font-family: monospace; padding: 20px; margin: 0; }</style></head><body>');
                        printWindow.document.write(printContent);
                        printWindow.document.write('</body></html>');
                        printWindow.document.close();
                        
                        // Wait for Tailwind CDN to apply styles before printing
                        setTimeout(() => {
                          printWindow.focus();
                          printWindow.print();
                        }, 800);
                      }
                    }
                  }}
                >
                  Print Receipt
                </button>
              </div>
              <button 
                className="btn btn-ghost w-full"
                onClick={() => setShowReceipt(false)}
              >
                Cancel / Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* M-Pesa STK Push Waiting Modal */}
      {isWaitingForMpesa && (
        <div className="modal modal-open">
          <div className="modal-box text-center space-y-4">
            <h3 className="font-bold text-lg text-primary">Awaiting M-Pesa Payment</h3>
            <p className="text-sm">Please ask the customer to check their phone ({mpesaPhone}) and enter their M-Pesa PIN.</p>
            <div className="flex justify-center py-4">
               <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
            {stkPushRequestId && (
              <p className="text-xs font-mono text-base-content/50">Request ID: {stkPushRequestId}</p>
            )}
            <div className="modal-action flex justify-between mt-6">
              <button className="btn btn-outline btn-error btn-sm" onClick={() => { setIsWaitingForMpesa(false); setIsProcessing(false); }}>
                Cancel Payment
              </button>
              
              {/* Simulator Button for Local Testing */}
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  api.post('/sales/mpesa/simulate', {
                    checkoutRequestId: stkPushRequestId,
                    amount: totalAfterDiscount + tax,
                    phone: mpesaPhone
                  });
                }}
              >
                Simulate Success
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="modal modal-open">
          <div className="modal-box w-96">
            <h3 className="font-bold text-lg mb-4">Change POS Password</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Current Password</span></label>
                <div className="relative">
                  <input 
                    type={showCurrentPassword ? "text" : "password"} 
                    className="input input-bordered w-full pr-10"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-base-content/50 hover:text-base-content"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">New Password</span></label>
                <div className="relative">
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    className="input input-bordered w-full pr-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-base-content/50 hover:text-base-content"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              {changePasswordError && (
                <div className="alert alert-error text-sm p-3 rounded-lg">
                  {changePasswordError}
                </div>
              )}

              {changePasswordSuccess && (
                <div className="alert alert-success text-sm p-3 rounded-lg text-success-content font-bold">
                  Password updated successfully!
                </div>
              )}
              
              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={() => setShowChangePassword(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={changePasswordLoading || !currentPassword || !newPassword}>
                  {changePasswordLoading ? <span className="loading loading-spinner loading-sm"></span> : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
