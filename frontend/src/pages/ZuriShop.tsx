import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { ShoppingBag, Search, Plus, Minus, Trash2, ShieldCheck, HelpCircle, Heart, Star, Sparkles, CreditCard, Truck, CheckCircle, Package, Hourglass } from 'lucide-react';

const ORDER_STATUSES = ['Pending', 'Paid', 'Processing', 'Packed', 'Shipped', 'Delivered'];

const STATUS_ICONS: Record<string, any> = {
  Pending: <Hourglass size={18} className="text-warning" />,
  Paid: <CheckCircle size={18} className="text-success" />,
  Processing: <Package size={18} className="text-info" />,
  Packed: <Package size={18} className="text-indigo-400" />,
  Shipped: <Truck size={18} className="text-purple-400" />,
  Delivered: <CheckCircle size={18} className="text-success" />,
};

interface CartItem {
  goodId: string;
  serial: string;
  name: string;
  quantity: number;
  unitPrice: number;
  maxQty: number;
}

const ZuriShop = () => {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card'>('mpesa');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // M-Pesa States
  const [isWaitingForMpesa, setIsWaitingForMpesa] = useState(false);
  const [stkPushRequestId, setStkPushRequestId] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<any>(null);

  // Tracking States
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [trackingId, setTrackingId] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackError, setTrackError] = useState('');

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const eventSource = new EventSource(`${apiUrl}/stream`);
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (['STOCK_UPDATED', 'PRICE_UPDATED'].includes(data.type)) {
        queryClient.invalidateQueries({ queryKey: ['goods'] });
      }
      if (data.type === 'ORDER_STATUS_UPDATED') {
        // Live update the tracking modal if it's currently open for this order
        setTrackedOrder((prev: any) => {
          if (prev && prev.id === data.payload.saleId) {
            return { ...prev, orderStatus: data.payload.orderStatus };
          }
          return prev;
        });
      }
      if (data.type === 'STK_PUSH_SUCCESS' && isWaitingForMpesa) {
        if (lastPayload) checkoutMutation.mutate(lastPayload);
      } else if (data.type === 'STK_PUSH_FAILED' && isWaitingForMpesa) {
        alert('M-Pesa Payment Failed: ' + data.payload.reason);
        setIsWaitingForMpesa(false);
        setIsCheckingOut(false);
      }
    };
    return () => eventSource.close();
  }, [queryClient, isWaitingForMpesa, lastPayload]);

  // Fetch goods catalog
  const { data: goods = [], isLoading } = useQuery({
    queryKey: ['goods'],
    queryFn: async () => {
      const res = await api.get('/inventory/goods');
      return res.data;
    },
  });

  // Mutator to submit order
  const checkoutMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/sales', payload);
      return res.data;
    },
    onSuccess: (data) => {
      // Save order to localStorage for tracking
      try {
        const saved = JSON.parse(localStorage.getItem('zuri_saved_orders') || '[]');
        if (!saved.some((o: any) => o.id === data.id)) {
          saved.push({ id: data.id, date: new Date().toISOString() });
          localStorage.setItem('zuri_saved_orders', JSON.stringify(saved));
        }
      } catch (e) {
        console.error('Could not save to localStorage', e);
      }

      queryClient.invalidateQueries({ queryKey: ['goods'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      setOrderId(data.id);
      setCart([]);
      setCustomerPhone('');
      setCustomerName('');
      setIsWaitingForMpesa(false);
      setStkPushRequestId(null);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      await api.post(`/ai/orders/${orderId}/status`, { orderStatus: status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (trackingId) {
        handleTrackOrder(undefined, trackingId);
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  const addToCart = (good: any) => {
    if (good.qty <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.goodId === good.id);
      if (existing) {
        if (existing.quantity >= good.qty) {
          alert(`Sorry, only ${good.qty} units of this item are currently available.`);
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
          name: good.name || good.subCategory?.name || 'Shop Product',
          quantity: 1,
          unitPrice: parseFloat(good.sellRate),
          maxQty: good.qty,
        },
      ];
    });
  };

  const updateQty = (goodId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.goodId === goodId) {
            const next = item.quantity + delta;
            if (next > item.maxQty) {
              alert(`Only ${item.maxQty} units left in stock.`);
              return item;
            }
            return { ...item, quantity: next };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (goodId: string) => {
    setCart((prev) => prev.filter((item) => item.goodId !== goodId));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  const vat = subtotal * 0.16;
  const total = subtotal + vat;

  const handleShopCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      alert("Please provide your Name and Phone Number to continue.");
      return;
    }

    setIsCheckingOut(true);

    const payload = {
      customerId: null, // Walk-in / anonymous shopper on ZuriShop initially
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      userId: 'system', // customer checkout
      items: cart.map((item) => ({
        goodId: item.goodId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      paymentMethod,
    };

    setLastPayload(payload);

    if (paymentMethod === 'mpesa') {
      setIsWaitingForMpesa(true);
      // Trigger stkpush
      api.post('/sales/mpesa/stkpush', {
        phone: customerPhone || '254700000000',
        amount: total.toFixed(0),
        reference: 'ZuriShop Online Order',
      })
      .then((res) => {
        if (res.data.data && res.data.data.CheckoutRequestID) {
           setStkPushRequestId(res.data.data.CheckoutRequestID);
        } else {
           setStkPushRequestId("MOCK_REQ_ID");
        }
      })
      .catch((err) => {
        console.error(err);
        alert("Failed to initiate STK Push. Check Daraja credentials.");
        setIsWaitingForMpesa(false);
        setIsCheckingOut(false);
      });
    } else {
      checkoutMutation.mutate(payload);
      setIsCheckingOut(false);
    }
  };

  const handleTrackOrder = async (e?: React.FormEvent, directId?: string) => {
    if (e) e.preventDefault();
    const idToTrack = directId || trackingId.trim();
    if (!idToTrack) return;
    
    setTrackingId(idToTrack); // sync the input visually
    setIsTracking(true);
    setTrackError('');
    setTrackedOrder(null);
    try {
      const res = await api.get(`/sales/${idToTrack}`);
      setTrackedOrder(res.data);
    } catch (err: any) {
      setTrackError(err.response?.data?.error || 'Order not found. Please check your Order ID.');
    } finally {
      setIsTracking(false);
    }
  };

  const filteredGoods = goods.filter((good: any) =>
    (good.name || good.subCategory?.name || 'Product').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      {/* Banner */}
      <div className="hero bg-linear-to-r from-primary/20 via-secondary/15 to-base-100 rounded-3xl border border-base-200 overflow-hidden shadow-sm">
        <div className="hero-content text-left p-8 md:p-12">
          <div className="max-w-md space-y-4">
            <span className="badge badge-primary font-bold text-xs uppercase tracking-widest gap-1 py-3 px-4 rounded-xl shadow-sm">
              <Sparkles size={14} />
              <span>ZuriShop</span>
            </span>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-base-content">
              Smart Shopping, Delivered.
            </h1>
            <p className="text-base-content/75 text-sm md:text-base leading-relaxed">
              Browse our high-quality inventory. Place an order online and track fulfillment pipeline stages dynamically.
            </p>
            <button className="btn btn-primary shadow-md mt-2" onClick={() => { setIsTrackModalOpen(true); setTrackedOrder(null); setTrackingId(''); setTrackError(''); }}>
              <Truck size={18} />
              Track My Order
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Product Grid Catalog */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center gap-4 bg-base-100 p-4 border border-base-200 rounded-2xl shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" size={18} />
              <input
                type="text"
                placeholder="Search products in shop..."
                className="input input-bordered w-full pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              <span className="badge badge-outline text-xs py-3 px-4 font-bold border-base-300">
                {filteredGoods.length} products available
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredGoods.map((good: any) => {
              const isOut = good.qty <= 0;
              const isLow = good.qty <= 3 && good.qty > 0;

              return (
                <div 
                  key={good.id} 
                  className={`card bg-base-100 shadow-sm border border-base-200 hover:border-primary hover:shadow-md transition-all duration-300 flex flex-col justify-between cursor-pointer ${isOut ? 'opacity-65' : ''}`}
                  onClick={() => setSelectedProduct(good)}
                >
                  <figure className="px-4 pt-4 relative">
                    {good.imageGoodId ? (
                      <img src={good.imageGoodId} alt="Product" className="w-full h-36 object-cover rounded-2xl border border-base-200/50" />
                    ) : (
                      <div className="w-full h-36 bg-base-200/40 rounded-2xl flex items-center justify-center font-bold text-xs uppercase tracking-widest font-mono text-primary/70 border border-base-200/50">
                        {good.serial.slice(0, 10)}
                      </div>
                    )}
                    {isOut ? (
                      <span className="absolute top-6 right-6 badge badge-error font-bold text-[10px]">
                        Out of Stock
                      </span>
                    ) : isLow ? (
                      <span className="absolute top-6 right-6 badge badge-warning font-bold text-[10px] animate-pulse">
                        Only {good.qty} left
                      </span>
                    ) : (
                      <span className="absolute top-6 right-6 badge badge-success font-bold text-[10px] text-success-content">
                        {good.qty} in stock
                      </span>
                    )}
                  </figure>

                  <div className="card-body p-4 space-y-3">
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-base-content/40 tracking-wider">{good.subCategory?.name || 'Catalog model'}</span>
                        <span className="text-[10px] font-mono font-semibold text-base-content/50 bg-base-200 px-1.5 py-0.5 rounded-md">#{good.serial}</span>
                      </div>
                      <h3 className="card-title text-sm font-bold text-base-content line-clamp-1 mt-0.5">
                        {good.name || good.subCategory?.name || 'Inventory Good'}
                      </h3>
                      {good.description && (
                        <p className="text-xs text-base-content/60 line-clamp-2 mt-1">
                          {good.description}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-xl font-black text-primary">
                        KSh {parseFloat(good.sellRate).toFixed(2)}
                      </span>
                      <button
                        className="btn btn-sm btn-primary rounded-xl font-bold shadow-sm"
                        disabled={isOut}
                        onClick={(e) => { e.stopPropagation(); addToCart(good); }}
                      >
                        <ShoppingBag size={14} />
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Customer Cart Drawer */}
        <div className="lg:col-span-1">
          <div className="bg-base-100 border border-base-200 rounded-2xl shadow-md p-6 sticky top-6 space-y-6">
            <h3 className="text-lg font-bold border-b border-base-200 pb-3 flex items-center justify-between text-base-content">
              <span className="flex items-center gap-2">
                <ShoppingBag className="text-primary" />
                <span>Shopping Bag</span>
              </span>
              <span className="badge badge-primary font-bold">{cart.length} items</span>
            </h3>

            {cart.length === 0 ? (
              <div className="py-12 text-center text-xs text-base-content/40 flex flex-col items-center gap-3">
                <ShoppingBag size={40} className="opacity-40" />
                <p>Your bag is empty. Add products from the catalog to start shopping!</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-75 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.goodId} className="flex justify-between items-center gap-3 p-3 bg-base-200/30 rounded-xl border border-base-200">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-xs text-base-content truncate">{item.name}</h4>
                      <div className="text-[10px] text-primary font-bold mt-0.5">KSh {item.unitPrice.toFixed(2)} each</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button className="btn btn-ghost btn-xs btn-square" onClick={() => updateQty(item.goodId, -1)}>
                        <Minus size={12} />
                      </button>
                      <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                      <button className="btn btn-ghost btn-xs btn-square" onClick={() => updateQty(item.goodId, 1)}>
                        <Plus size={12} />
                      </button>
                    </div>
                    <button className="btn btn-ghost btn-xs btn-square text-error/80 shrink-0" onClick={() => removeItem(item.goodId)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <form onSubmit={handleShopCheckout} className="space-y-4 border-t border-base-200 pt-4">
                <div className="pt-4 border-t border-base-200 mt-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-base-content/70">Full Name</label>
                    <input 
                      type="text" 
                      className="input input-bordered w-full input-sm" 
                      placeholder="e.g. John Doe"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-base-content/70">Phone Number</label>
                    <input 
                      type="tel" 
                      className="input input-bordered w-full input-sm" 
                      placeholder="07..."
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-control space-y-1">
                  <label className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      className={`btn btn-xs ${paymentMethod === 'mpesa' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setPaymentMethod('mpesa')}
                    >
                      M-Pesa
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs ${paymentMethod === 'card' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setPaymentMethod('card')}
                    >
                      Card
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs ${paymentMethod === 'cash' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setPaymentMethod('cash')}
                    >
                      Cash
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs pt-2">
                  <div className="flex justify-between">
                    <span className="text-base-content/60">Subtotal</span>
                    <span>KSh {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/60">Tax (16% VAT)</span>
                    <span>KSh {vat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-base-content pt-2 border-t border-base-200">
                    <span>Grand Total</span>
                    <span className="text-primary">KSh {total.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full shadow-md"
                  onClick={handleShopCheckout}
                  disabled={cart.length === 0 || isCheckingOut || checkoutMutation.isPending || !customerName || !customerPhone}
                >
                  {isCheckingOut || checkoutMutation.isPending ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      <span>Processing Payment...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard size={16} />
                      <span>Place Order (KSh {total.toFixed(2)})</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Success Alert Modal */}
            {orderId && (
              <div className="modal modal-open">
                <div className="modal-box rounded-2xl max-w-sm border border-base-200 text-center space-y-4">
                  <div className="w-16 h-16 bg-success/15 text-success rounded-full flex items-center justify-center mx-auto">
                    <ShieldCheck size={36} />
                  </div>
                  <h3 className="font-bold text-lg">Order Confirmed! 🎉</h3>
                  <p className="text-xs text-base-content/70">
                    Your payment was verified. The order #{orderId.slice(0, 8).toUpperCase()} has been submitted.
                  </p>
                  <p className="text-[10px] text-base-content/50 leading-relaxed bg-base-200/50 p-2.5 rounded-xl border border-base-200">
                    Downstream Actions: stock decremented, demand AI analysis triggered, and shipping pipeline initialized.
                  </p>
                  <div className="modal-action justify-center">
                    <button className="btn btn-primary btn-sm px-6" onClick={() => setOrderId(null)}>
                      Awesome
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
                  <p className="text-sm">Please check your phone ({customerPhone}) and enter your M-Pesa PIN to complete the order.</p>
                  <div className="flex justify-center py-4">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                  </div>
                  {stkPushRequestId && (
                    <p className="text-xs font-mono text-base-content/50">Request ID: {stkPushRequestId}</p>
                  )}
                  <div className="modal-action flex justify-between mt-6">
                    <button className="btn btn-outline btn-error btn-sm" onClick={() => { setIsWaitingForMpesa(false); setIsCheckingOut(false); }}>
                      Cancel Order
                    </button>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        api.post('/sales/mpesa/simulate', {
                          checkoutRequestId: stkPushRequestId,
                          amount: total,
                          phone: customerPhone
                        });
                      }}
                    >
                      Simulate Success
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Product Details Modal */}
            {selectedProduct && (
              <div className="modal modal-open">
                <div className="modal-box rounded-2xl max-w-lg space-y-4 border border-base-200">
                  <h3 className="font-bold text-xl text-base-content">{selectedProduct.name || selectedProduct.subCategory?.name || 'Inventory Good'}</h3>
                  <div className="flex gap-2 text-xs font-mono font-semibold text-base-content/60 bg-base-200 w-fit px-2 py-1 rounded-md">
                    <span>{selectedProduct.subCategory?.name || 'Catalog model'}</span>
                    <span>•</span>
                    <span>#{selectedProduct.serial}</span>
                  </div>
                  
                  {selectedProduct.imageGoodId && (
                    <img src={selectedProduct.imageGoodId} alt="Product" className="w-full h-48 object-cover rounded-xl border border-base-200/50" />
                  )}
                  
                  <div className="bg-base-200/50 p-4 rounded-xl text-sm leading-relaxed text-base-content/80">
                    <h4 className="font-bold text-xs uppercase tracking-widest text-base-content/50 mb-2">Description</h4>
                    {selectedProduct.description || "No description available for this item."}
                  </div>
                  
                  {selectedProduct.productDetails && (
                    <div className="bg-base-200/50 p-4 rounded-xl text-sm leading-relaxed text-base-content/80 mt-2">
                      <h4 className="font-bold text-xs uppercase tracking-widest text-base-content/50 mb-2">Technical Details</h4>
                      {selectedProduct.productDetails}
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-base-200">
                    <span className="text-2xl font-black text-primary">KSh {parseFloat(selectedProduct.sellRate).toFixed(2)}</span>
                    <span className={`badge ${selectedProduct.qty <= 0 ? 'badge-error' : selectedProduct.qty <= 3 ? 'badge-warning' : 'badge-success'} font-bold`}>
                      {selectedProduct.qty} in stock
                    </span>
                  </div>

                  <div className="modal-action mt-6">
                    <button className="btn btn-outline btn-sm" onClick={() => setSelectedProduct(null)}>Close</button>
                    <button 
                      className="btn btn-primary btn-sm"
                      disabled={selectedProduct.qty <= 0}
                      onClick={() => {
                        addToCart(selectedProduct);
                        setSelectedProduct(null);
                      }}
                    >
                      <ShoppingBag size={14} /> Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Tracking Modal */}
            {isTrackModalOpen && (
              <div className="modal modal-open">
                <div className="modal-box rounded-2xl max-w-md border border-base-200 shadow-xl space-y-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Truck className="text-primary" />
                    <span>Track Your Order</span>
                  </h3>
                  
                  <form onSubmit={handleTrackOrder} className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Enter Order ID..." 
                      className="input input-bordered w-full"
                      value={trackingId}
                      onChange={(e) => setTrackingId(e.target.value)}
                      required
                    />
                    <button type="submit" className="btn btn-primary" disabled={isTracking}>
                      {isTracking ? <span className="loading loading-spinner loading-xs"></span> : <Search size={18} />}
                    </button>
                  </form>

                  {/* Recent Orders List (from localStorage) */}
                  {(!trackedOrder && !isTracking && !trackError) && (() => {
                    try {
                      const saved = JSON.parse(localStorage.getItem('zuri_saved_orders') || '[]');
                      if (saved.length > 0) {
                        return (
                          <div className="mt-6 space-y-2">
                            <h4 className="text-xs font-bold text-base-content/50 uppercase tracking-widest border-b border-base-200 pb-2">Recent Orders on this Device</h4>
                            <div className="flex flex-col gap-2 pt-2">
                              {saved.slice().reverse().slice(0, 3).map((so: any) => (
                                <button 
                                  key={so.id}
                                  type="button"
                                  className="btn btn-sm btn-outline btn-ghost justify-start text-left border border-base-200 shadow-sm"
                                  onClick={() => handleTrackOrder(undefined, so.id)}
                                >
                                  <Package size={14} className="text-primary opacity-70" /> 
                                  <span className="font-mono font-semibold">#{so.id.slice(0, 8).toUpperCase()}</span>
                                  <span className="text-[10px] text-base-content/40 font-normal ml-auto">
                                    {new Date(so.date).toLocaleDateString()}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }
                    } catch (e) {
                      return null;
                    }
                    return null;
                  })()}

                  {trackError && <div className="text-error text-sm font-semibold">{trackError}</div>}

                  {trackedOrder && (
                    <div className="mt-6 border border-base-200 rounded-xl p-4 bg-base-200/20">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-mono text-sm font-bold text-primary">#{trackedOrder.id.slice(0,8).toUpperCase()}</span>
                        <span className="badge badge-primary font-bold">{(trackedOrder.orderStatus || 'Pending').charAt(0).toUpperCase() + (trackedOrder.orderStatus || 'Pending').slice(1)}</span>
                      </div>
                      
                      <ul className="steps steps-vertical w-full text-sm mt-2">
                        {ORDER_STATUSES.map((status, index) => {
                          const rawStatus = trackedOrder.orderStatus || 'Pending';
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
                      
                      <div className="mt-4 pt-4 border-t border-base-200">
                        <div className="text-xs text-base-content/60">Total Paid</div>
                        <div className="text-lg font-black text-primary">KSh {parseFloat(trackedOrder.totalAmount).toLocaleString()}</div>
                      </div>
                    </div>
                  )}

                  <div className="modal-action">
                    <button type="button" className="btn btn-ghost" onClick={() => setIsTrackModalOpen(false)}>Close</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZuriShop;
