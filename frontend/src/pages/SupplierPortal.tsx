import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Building2, PackageCheck, Send, Info } from 'lucide-react';

const SupplierPortal = () => {
  const queryClient = useQueryClient();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'orders' | 'bids'>('orders');

  // Fetch all suppliers for the simulator dropdown
  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await api.get('/inventory/suppliers');
      return res.data;
    },
  });

  // Fetch Orders for selected supplier
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['supplierOrders', selectedSupplierId],
    queryFn: async () => {
      const res = await api.get(`/supplier-portal/${selectedSupplierId}/orders`);
      return res.data;
    },
    enabled: !!selectedSupplierId,
  });

  // Fetch Bids for selected supplier
  const { data: bids = [], isLoading: loadingBids } = useQuery({
    queryKey: ['supplierBids', selectedSupplierId],
    queryFn: async () => {
      const res = await api.get(`/supplier-portal/${selectedSupplierId}/bids`);
      return res.data;
    },
    enabled: !!selectedSupplierId,
  });

  // Mutations
  const updateOrderMutation = useMutation({
    mutationFn: async (payload: { orderId: string, status: string }) => {
      await api.put(`/supplier-portal/${selectedSupplierId}/orders/${payload.orderId}/status`, { status: payload.status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierOrders', selectedSupplierId] });
    },
  });

  const submitBidMutation = useMutation({
    mutationFn: async (payload: { bidId: string; bidPrice: number; deliveryTimeDays: number }) => {
      await api.put(`/supplier-portal/${selectedSupplierId}/bids/${payload.bidId}/submit`, {
        bidPrice: payload.bidPrice,
        deliveryTimeDays: payload.deliveryTimeDays,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierBids', selectedSupplierId] });
    },
  });

  const handleUpdateOrderStatus = (orderId: string, status: string) => {
    const message = status === 'shipped' 
      ? 'Mark this order as SHIPPED?' 
      : 'Mark this order as DELIVERED?';
    if (confirm(message)) {
      updateOrderMutation.mutate({ orderId, status });
    }
  };

  const handleSubmitBid = (e: React.FormEvent, bidId: string) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const bidPrice = Number(formData.get('bidPrice'));
    const deliveryTimeDays = Number(formData.get('deliveryTimeDays'));
    if (!bidPrice || !deliveryTimeDays) return alert('Please enter both price and delivery time.');

    submitBidMutation.mutate({ bidId, bidPrice, deliveryTimeDays });
  };

  if (loadingSuppliers) {
    return <div className="flex justify-center items-center h-full"><span className="loading loading-spinner text-primary"></span></div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200">
        <div>
          <h1 className="text-3xl font-black text-base-content flex items-center gap-3">
            <Building2 className="text-primary" size={32} />
            Supplier Portal
          </h1>
          <p className="text-base-content/60 mt-1">Manage purchase orders and submit restock bids directly.</p>
        </div>
        
        <div className="bg-warning/10 p-4 rounded-xl border border-warning/20 w-full md:w-auto">
          <label className="label py-0 pb-1 font-bold text-xs text-warning-content/80 flex items-center gap-1 uppercase tracking-wider">
            <Info size={14} /> Simulate Login
          </label>
          <select 
            className="select select-bordered w-full md:w-64 bg-base-100"
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
          >
            <option value="" disabled>Select your company...</option>
            {suppliers.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedSupplierId ? (
        <div className="hero bg-base-200/50 rounded-2xl py-20 border border-base-200 border-dashed">
          <div className="hero-content text-center">
            <div className="max-w-md">
              <Building2 className="mx-auto text-base-content/20 mb-4" size={64} />
              <h1 className="text-2xl font-bold">Welcome to the Portal</h1>
              <p className="py-4 text-base-content/60">Please select a supplier identity from the dropdown above to view your active purchase orders and pending bids.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat bg-base-100 rounded-2xl shadow-sm border border-base-200">
              <div className="stat-title font-bold">Active Orders</div>
              <div className="stat-value text-primary">{orders.filter((o: any) => o.status === 'pending').length}</div>
            </div>
            <div className="stat bg-base-100 rounded-2xl shadow-sm border border-base-200">
              <div className="stat-title font-bold">Pending Bids</div>
              <div className="stat-value text-secondary">{bids.filter((b: any) => b.status === 'pending').length}</div>
            </div>
            <div className="stat bg-base-100 rounded-2xl shadow-sm border border-base-200">
              <div className="stat-title font-bold">Completed Orders</div>
              <div className="stat-value text-success">{orders.filter((o: any) => o.status === 'completed').length}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs tabs-boxed bg-base-200/50 p-1 font-bold inline-flex w-full md:w-auto">
            <button 
              className={`tab tab-lg flex-1 ${activeTab === 'orders' ? 'tab-active bg-base-100 shadow-sm' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              Purchase Orders
            </button>
            <button 
              className={`tab tab-lg flex-1 ${activeTab === 'bids' ? 'tab-active bg-base-100 shadow-sm' : ''}`}
              onClick={() => setActiveTab('bids')}
            >
              Bidding System
            </button>
          </div>

          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 min-h-[400px]">
            {activeTab === 'orders' && (
              <div className="p-0 overflow-x-auto">
                <table className="table w-full">
                  <thead className="bg-base-200/50 text-base-content/70">
                    <tr>
                      <th>Order ID</th>
                      <th>Items</th>
                      <th>Total Amount</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-base-content/50">No orders found.</td>
                      </tr>
                    )}
                    {orders.map((order: any) => (
                      <tr key={order.id} className="hover">
                        <td className="font-mono text-xs">{order.id.split('-')[0]}</td>
                        <td>
                          {order.goods?.map((g: any) => (
                            <div key={g.id} className="text-sm">
                              {g.name || g.subCategory?.name} <span className="text-xs text-base-content/50">x{order.expectedQty} (Expected)</span>
                            </div>
                          ))}
                        </td>
                        <td className="font-bold">KSh {parseFloat(order.totalAmount).toLocaleString()}</td>
                        <td>
                          <div className={`badge ${
                            order.status === 'completed' ? 'badge-success' : 
                            order.status === 'shipped' ? 'badge-info' : 
                            'badge-warning'
                          } gap-1 font-bold capitalize`}>
                            {order.status}
                          </div>
                        </td>
                        <td className="text-right space-x-2">
                          {order.status === 'pending' && (
                            <button 
                              className="btn btn-sm btn-info"
                              onClick={() => handleUpdateOrderStatus(order.id, 'shipped')}
                              disabled={updateOrderMutation.isPending}
                            >
                              <Send size={16} /> Mark Shipped
                            </button>
                          )}
                          {order.status === 'shipped' && (
                            <button 
                              className="btn btn-sm btn-success"
                              onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                              disabled={updateOrderMutation.isPending}
                            >
                              <PackageCheck size={16} /> Mark Delivered
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'bids' && (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {bids.length === 0 && (
                  <div className="col-span-full text-center py-8 text-base-content/50">No bidding requests found.</div>
                )}
                {bids.map((bid: any) => (
                  <div key={bid.id} className="card bg-base-200/30 border border-base-200">
                    <div className="card-body">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="card-title text-lg">Restock Request</h3>
                          <p className="text-sm font-bold text-primary mt-1">
                            {bid.recommendation?.good?.name || bid.recommendation?.good?.subCategory?.name || 'Product'}
                          </p>
                          <p className="text-xs text-base-content/70 mt-1">Suggested Qty: {bid.recommendation?.recommendedQty}</p>
                        </div>
                        <div className={`badge ${bid.status === 'pending' ? 'badge-warning' : bid.status === 'submitted' ? 'badge-info' : 'badge-ghost'}`}>
                          {bid.status}
                        </div>
                      </div>
                      
                      <div className="divider my-2"></div>
                      
                      {bid.status === 'pending' ? (
                        <form onSubmit={(e) => handleSubmitBid(e, bid.id)} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="form-control">
                              <label className="label text-xs font-bold">Your Quote (Total)</label>
                              <input 
                                type="number" 
                                name="bidPrice" 
                                className="input input-bordered input-sm" 
                                placeholder="e.g. 50000" 
                                defaultValue={bid.bidPrice}
                                required 
                              />
                            </div>
                            <div className="form-control">
                              <label className="label text-xs font-bold">Delivery Time (Days)</label>
                              <input 
                                type="number" 
                                name="deliveryTimeDays" 
                                className="input input-bordered input-sm" 
                                placeholder="e.g. 3" 
                                defaultValue={bid.deliveryTimeDays}
                                required 
                              />
                            </div>
                          </div>
                          <button 
                            type="submit" 
                            className="btn btn-primary btn-block"
                            disabled={submitBidMutation.isPending}
                          >
                            <Send size={16} /> Submit Bid
                          </button>
                        </form>
                      ) : (
                        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-base-content/60">Submitted Quote:</span>
                            <span className="font-mono font-bold">KSh {parseFloat(bid.bidPrice).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm mt-2">
                            <span className="font-bold text-base-content/60">Delivery Time:</span>
                            <span className="font-bold">{bid.deliveryTimeDays} Days</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPortal;
