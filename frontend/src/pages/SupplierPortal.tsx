import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Building2, PackageCheck, Send, Info, LayoutDashboard, ShoppingCart, Truck, Tag, FileText, Bell, UserCircle, Plus } from 'lucide-react';

const SupplierPortal = () => {
  const queryClient = useQueryClient();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'deliveries' | 'bids' | 'pricing' | 'documents' | 'profile' | 'notifications'>('dashboard');

  // Fetch all suppliers for the simulator dropdown
  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await api.get('/inventory/suppliers');
      return res.data;
    },
  });

  // Queries for selected supplier
  const { data: dashboardStats = {} } = useQuery({
    queryKey: ['supplierDashboard', selectedSupplierId],
    queryFn: async () => (await api.get(`/supplier-portal/${selectedSupplierId}/dashboard`)).data,
    enabled: !!selectedSupplierId,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['supplierOrders', selectedSupplierId],
    queryFn: async () => (await api.get(`/supplier-portal/${selectedSupplierId}/orders`)).data,
    enabled: !!selectedSupplierId,
  });

  const { data: bids = [] } = useQuery({
    queryKey: ['supplierBids', selectedSupplierId],
    queryFn: async () => (await api.get(`/supplier-portal/${selectedSupplierId}/bids`)).data,
    enabled: !!selectedSupplierId,
  });

  const { data: goods = [] } = useQuery({
    queryKey: ['supplierGoods', selectedSupplierId],
    queryFn: async () => (await api.get(`/supplier-portal/${selectedSupplierId}/goods`)).data,
    enabled: !!selectedSupplierId,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['supplierDocuments', selectedSupplierId],
    queryFn: async () => (await api.get(`/supplier-portal/${selectedSupplierId}/documents`)).data,
    enabled: !!selectedSupplierId,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['supplierNotifications', selectedSupplierId],
    queryFn: async () => (await api.get(`/supplier-portal/${selectedSupplierId}/notifications`)).data,
    enabled: !!selectedSupplierId,
  });

  // Mutations
  const updateOrderMutation = useMutation({
    mutationFn: async (payload: { orderId: string, status: string }) => {
      await api.put(`/supplier-portal/${selectedSupplierId}/orders/${payload.orderId}/status`, { status: payload.status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierOrders', selectedSupplierId] });
      queryClient.invalidateQueries({ queryKey: ['supplierDashboard', selectedSupplierId] });
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: async (payload: { goodId: string, buyRate: number }) => {
      await api.put(`/supplier-portal/${selectedSupplierId}/goods/${payload.goodId}/price`, { buyRate: payload.buyRate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierGoods', selectedSupplierId] });
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post(`/supplier-portal/${selectedSupplierId}/documents`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierDocuments', selectedSupplierId] });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.put(`/supplier-portal/${selectedSupplierId}/profile`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  const registerSupplierMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post(`/supplier-portal/register`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      alert("Registration successful!");
    },
  });

  const markNotifReadMutation = useMutation({
    mutationFn: async (notifId: string) => {
      await api.put(`/supplier-portal/${selectedSupplierId}/notifications/${notifId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierNotifications', selectedSupplierId] });
      queryClient.invalidateQueries({ queryKey: ['supplierDashboard', selectedSupplierId] });
    },
  });

  // Action Handlers
  const handleUpdateOrderStatus = (orderId: string, status: string) => {
    if (confirm(`Are you sure you want to mark this order as ${status.toUpperCase()}?`)) {
      updateOrderMutation.mutate({ orderId, status });
    }
  };

  const handleUpdatePrice = (e: React.FormEvent, goodId: string) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const buyRate = Number(formData.get('buyRate'));
    updatePriceMutation.mutate({ goodId, buyRate });
  };

  const handleUploadDoc = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    uploadDocMutation.mutate({
      title: formData.get('title'),
      type: formData.get('type'),
      fileUrl: formData.get('fileUrl'),
      purchaseId: formData.get('purchaseId') || undefined
    });
    (e.target as HTMLFormElement).reset();
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    updateProfileMutation.mutate({
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      address: formData.get('address'),
    });
    alert("Profile updated successfully!");
  };

  const handleRegisterSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    registerSupplierMutation.mutate({
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      address: formData.get('address'),
    });
    (e.target as HTMLFormElement).reset();
  };

  if (loadingSuppliers) {
    return <div className="flex justify-center items-center h-full"><span className="loading loading-spinner text-primary"></span></div>;
  }

  const selectedSupplier = suppliers.find((s: any) => s.id === selectedSupplierId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200">
        <div>
          <h1 className="text-3xl font-black text-base-content flex items-center gap-3">
            <Building2 className="text-primary" size={32} />
            Supplier Portal
          </h1>
          <p className="text-base-content/60 mt-1">Manage orders, update pricing, and track deliveries.</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="hero bg-base-200/50 rounded-2xl py-20 border border-base-200 border-dashed">
            <div className="hero-content text-center">
              <div className="max-w-md">
                <Building2 className="mx-auto text-base-content/20 mb-4" size={64} />
                <h1 className="text-2xl font-bold">Welcome to the Portal</h1>
                <p className="py-4 text-base-content/60">Please select a supplier identity from the dropdown above to view your portal.</p>
              </div>
            </div>
          </div>
          <div className="bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200">
             <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Plus className="text-success" /> Register New Supplier</h2>
             <form onSubmit={handleRegisterSupplier} className="space-y-4">
                <input type="text" name="name" className="input input-bordered w-full" placeholder="Company Name" required />
                <input type="email" name="email" className="input input-bordered w-full" placeholder="Email Address" />
                <input type="text" name="phone" className="input input-bordered w-full" placeholder="Phone Number" />
                <textarea name="address" className="textarea textarea-bordered w-full" placeholder="Physical Address" />
                <button type="submit" className="btn btn-success w-full" disabled={registerSupplierMutation.isPending}>
                  {registerSupplierMutation.isPending ? 'Registering...' : 'Register as Supplier'}
                </button>
             </form>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <ul className="menu bg-base-100 p-2 rounded-2xl shadow-sm border border-base-200 gap-1">
              <li><a className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}><LayoutDashboard size={18} /> Dashboard</a></li>
              <li><a className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}><ShoppingCart size={18} /> Orders <span className="badge badge-sm badge-primary">{orders.filter((o:any) => o.status === 'pending').length}</span></a></li>
              <li><a className={activeTab === 'deliveries' ? 'active' : ''} onClick={() => setActiveTab('deliveries')}><Truck size={18} /> Deliveries</a></li>
              <li><a className={activeTab === 'bids' ? 'active' : ''} onClick={() => setActiveTab('bids')}><PackageCheck size={18} /> Bids {dashboardStats.pendingBids > 0 && <span className="badge badge-sm badge-primary">{dashboardStats.pendingBids}</span>}</a></li>
              <li><a className={activeTab === 'pricing' ? 'active' : ''} onClick={() => setActiveTab('pricing')}><Tag size={18} /> Pricing</a></li>
              <li><a className={activeTab === 'documents' ? 'active' : ''} onClick={() => setActiveTab('documents')}><FileText size={18} /> Documents</a></li>
              <li><a className={activeTab === 'notifications' ? 'active' : ''} onClick={() => setActiveTab('notifications')}><Bell size={18} /> Notifications {dashboardStats.unreadNotificationsCount > 0 && <span className="badge badge-sm badge-error">{dashboardStats.unreadNotificationsCount}</span>}</a></li>
              <li><a className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}><UserCircle size={18} /> Profile</a></li>
            </ul>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                 <h2 className="text-2xl font-bold">Overview</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="stat bg-base-100 rounded-2xl shadow-sm border border-base-200">
                      <div className="stat-figure text-primary"><ShoppingCart size={32} /></div>
                      <div className="stat-title">New Orders</div>
                      <div className="stat-value text-primary">{dashboardStats.activeOrders || 0}</div>
                    </div>
                    <div className="stat bg-base-100 rounded-2xl shadow-sm border border-base-200">
                      <div className="stat-figure text-info"><Truck size={32} /></div>
                      <div className="stat-title">In Transit</div>
                      <div className="stat-value text-info">{dashboardStats.shippedOrders || 0}</div>
                    </div>
                    <div className="stat bg-base-100 rounded-2xl shadow-sm border border-base-200">
                      <div className="stat-figure text-success"><PackageCheck size={32} /></div>
                      <div className="stat-title">Completed</div>
                      <div className="stat-value text-success">{dashboardStats.completedOrders || 0}</div>
                    </div>
                    <div className="stat bg-base-100 rounded-2xl shadow-sm border border-base-200">
                      <div className="stat-figure text-warning"><Bell size={32} /></div>
                      <div className="stat-title">Alerts</div>
                      <div className="stat-value text-warning">{dashboardStats.unreadNotificationsCount || 0}</div>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200">
                       <h3 className="font-bold text-lg mb-4">Recent Notifications</h3>
                       {notifications.length === 0 ? <p className="text-sm text-base-content/50">No notifications.</p> : (
                         <div className="space-y-3">
                           {notifications.slice(0, 5).map((n:any) => (
                             <div key={n.id} className={`p-3 rounded-xl border ${n.isRead ? 'bg-base-200/30 border-base-200' : 'bg-warning/10 border-warning/20'}`}>
                               <p className="text-sm font-medium">{n.message}</p>
                               <p className="text-xs text-base-content/50 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 min-h-[400px]">
                 <div className="p-4 border-b border-base-200 bg-base-200/30">
                    <h2 className="text-xl font-bold">New & Pending Orders</h2>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Date</th>
                          <th>Items</th>
                          <th>Total Amount</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.filter((o:any) => o.status === 'pending').length === 0 && (
                          <tr><td colSpan={6} className="text-center py-8 text-base-content/50">No new orders found.</td></tr>
                        )}
                        {orders.filter((o:any) => o.status === 'pending').map((order: any) => (
                          <tr key={order.id} className="hover">
                            <td className="font-mono text-xs">{order.id.split('-')[0]}</td>
                            <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                            <td>
                              {order.goods?.map((g: any) => (
                                <div key={g.id} className="text-sm">
                                  {g.name || g.subCategory?.name} <span className="text-xs text-base-content/50">x{order.expectedQty}</span>
                                </div>
                              ))}
                            </td>
                            <td className="font-bold">KSh {parseFloat(order.totalAmount).toLocaleString()}</td>
                            <td><div className="badge badge-warning font-bold">Pending</div></td>
                            <td className="text-right space-x-2">
                               <button className="btn btn-sm btn-success" onClick={() => handleUpdateOrderStatus(order.id, 'accepted')}>Accept</button>
                               <button className="btn btn-sm btn-error" onClick={() => handleUpdateOrderStatus(order.id, 'rejected')}>Reject</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              </div>
            )}

            {activeTab === 'deliveries' && (
              <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 min-h-[400px]">
                 <div className="p-4 border-b border-base-200 bg-base-200/30">
                    <h2 className="text-xl font-bold">Delivery Tracking</h2>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Items</th>
                          <th>Status</th>
                          <th className="text-right">Update Delivery</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.filter((o:any) => ['accepted', 'shipped', 'completed'].includes(o.status)).length === 0 && (
                          <tr><td colSpan={4} className="text-center py-8 text-base-content/50">No active deliveries.</td></tr>
                        )}
                        {orders.filter((o:any) => ['accepted', 'shipped', 'completed'].includes(o.status)).map((order: any) => (
                          <tr key={order.id} className="hover">
                            <td className="font-mono text-xs">{order.id.split('-')[0]}</td>
                            <td>
                              {order.goods?.map((g: any) => (
                                <div key={g.id} className="text-sm">
                                  {g.name || g.subCategory?.name} <span className="text-xs text-base-content/50">x{order.expectedQty}</span>
                                </div>
                              ))}
                            </td>
                            <td>
                              <div className={`badge ${order.status === 'completed' ? 'badge-success' : order.status === 'shipped' ? 'badge-info' : 'badge-primary'} font-bold capitalize`}>
                                {order.status}
                              </div>
                            </td>
                            <td className="text-right space-x-2">
                               {order.status === 'accepted' && (
                                 <button className="btn btn-sm btn-info" onClick={() => handleUpdateOrderStatus(order.id, 'shipped')}><Truck size={16} /> Mark Dispatched</button>
                               )}
                               {order.status === 'shipped' && (
                                 <button className="btn btn-sm btn-success" onClick={() => handleUpdateOrderStatus(order.id, 'completed')}><PackageCheck size={16} /> Mark Delivered</button>
                               )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              </div>
            )}

            {activeTab === 'bids' && (
              <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 min-h-100">
                 <div className="p-4 border-b border-base-200 bg-base-200/30">
                    <h2 className="text-xl font-bold">Open Bids (Restock Requests)</h2>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Requested Qty</th>
                          <th>Your Bid Price</th>
                          <th>Delivery Time (Days)</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bids.filter((b:any) => b.status === 'pending').length === 0 && (
                          <tr><td colSpan={5} className="text-center py-8 text-base-content/50">No pending bids.</td></tr>
                        )}
                        {bids.filter((b:any) => b.status === 'pending').map((bid: any) => (
                          <tr key={bid.id} className="hover">
                            <td>
                               <div className="font-bold">{bid.recommendation?.good?.name || bid.recommendation?.good?.subCategory?.name}</div>
                               <div className="text-xs text-base-content/60">SN: {bid.recommendation?.good?.serial}</div>
                            </td>
                            <td><div className="badge badge-outline">{bid.recommendation?.recommendedQty}</div></td>
                            <td colSpan={3} className="p-0">
                               <form onSubmit={async (e) => {
                                 e.preventDefault();
                                 const fd = new FormData(e.target as HTMLFormElement);
                                 await api.put(`/supplier-portal/${selectedSupplierId}/bids/${bid.id}/submit`, {
                                   bidPrice: fd.get('bidPrice'),
                                   deliveryTimeDays: fd.get('deliveryTimeDays')
                                 });
                                 queryClient.invalidateQueries({ queryKey: ['supplierBids', selectedSupplierId] });
                                 queryClient.invalidateQueries({ queryKey: ['supplierDashboard', selectedSupplierId] });
                               }} className="flex items-center gap-2 p-2 w-full justify-end">
                                 <input type="number" step="0.01" name="bidPrice" defaultValue={bid.bidPrice} className="input input-bordered input-sm w-24" placeholder="Price" required />
                                 <input type="number" name="deliveryTimeDays" defaultValue={bid.deliveryTimeDays} className="input input-bordered input-sm w-20" placeholder="Days" required />
                                 <button type="submit" className="btn btn-sm btn-primary">Submit Bid</button>
                               </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              </div>
            )}

            {activeTab === 'pricing' && (
              <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 min-h-[400px]">
                 <div className="p-4 border-b border-base-200 bg-base-200/30">
                    <h2 className="text-xl font-bold">Product Pricing</h2>
                    <p className="text-sm text-base-content/60">Update the supply prices for items you provide.</p>
                 </div>
                 <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {goods.length === 0 && <p className="text-base-content/50 p-4">No products associated with your account.</p>}
                    {goods.map((good: any) => (
                       <div key={good.id} className="p-4 border border-base-200 rounded-xl bg-base-200/30">
                          <h3 className="font-bold">{good.name || good.subCategory?.name}</h3>
                          <p className="text-xs text-base-content/60 mb-3">SN: {good.serial}</p>
                          <form onSubmit={(e) => handleUpdatePrice(e, good.id)} className="flex gap-2">
                             <input type="number" step="0.01" name="buyRate" defaultValue={good.buyRate} className="input input-bordered input-sm flex-1" required />
                             <button type="submit" className="btn btn-sm btn-primary">Update</button>
                          </form>
                       </div>
                    ))}
                 </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-6">
                <div className="bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200">
                   <h2 className="text-xl font-bold mb-4">Upload Document</h2>
                   <form onSubmit={handleUploadDoc} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control">
                        <label className="label text-xs font-bold">Document Title</label>
                        <input type="text" name="title" className="input input-bordered w-full" placeholder="e.g. Invoice INV-001" required />
                      </div>
                      <div className="form-control">
                        <label className="label text-xs font-bold">Document Type</label>
                        <select name="type" className="select select-bordered w-full" required>
                          <option value="invoice">Invoice</option>
                          <option value="delivery_note">Delivery Note</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="form-control md:col-span-2">
                        <label className="label text-xs font-bold">File URL / Cloud Link (Simulated Upload)</label>
                        <input type="url" name="fileUrl" className="input input-bordered w-full" placeholder="https://example.com/document.pdf" required />
                      </div>
                      <div className="form-control md:col-span-2">
                        <label className="label text-xs font-bold">Related Order ID (Optional)</label>
                        <select name="purchaseId" className="select select-bordered w-full">
                           <option value="">None</option>
                           {orders.map((o:any) => (
                             <option key={o.id} value={o.id}>{o.id.split('-')[0]} - {new Date(o.createdAt).toLocaleDateString()}</option>
                           ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <button type="submit" className="btn btn-primary" disabled={uploadDocMutation.isPending}>Upload Document</button>
                      </div>
                   </form>
                </div>
                
                <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200">
                   <div className="p-4 border-b border-base-200 bg-base-200/30">
                      <h3 className="font-bold">Uploaded Documents</h3>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="table w-full">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Title</th>
                            <th>Type</th>
                            <th>Link</th>
                          </tr>
                        </thead>
                        <tbody>
                          {documents.length === 0 && (
                            <tr><td colSpan={4} className="text-center py-8 text-base-content/50">No documents uploaded.</td></tr>
                          )}
                          {documents.map((doc: any) => (
                            <tr key={doc.id}>
                              <td className="text-xs">{new Date(doc.createdAt).toLocaleDateString()}</td>
                              <td className="font-medium">{doc.title}</td>
                              <td className="capitalize">{doc.type.replace('_', ' ')}</td>
                              <td><a href={doc.fileUrl} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline">View File</a></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 min-h-[400px]">
                 <div className="p-4 border-b border-base-200 bg-base-200/30">
                    <h2 className="text-xl font-bold">Notifications</h2>
                 </div>
                 <div className="p-4 space-y-4">
                    {notifications.length === 0 && <p className="text-base-content/50 text-center py-8">You have no notifications.</p>}
                    {notifications.map((n:any) => (
                      <div key={n.id} className={`p-4 rounded-xl border flex justify-between items-center ${n.isRead ? 'bg-base-200/30 border-base-200' : 'bg-warning/10 border-warning/20'}`}>
                         <div>
                            <p className="font-medium">{n.message}</p>
                            <p className="text-xs text-base-content/50 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                         </div>
                         {!n.isRead && (
                           <button className="btn btn-sm btn-ghost" onClick={() => markNotifReadMutation.mutate(n.id)}>Mark Read</button>
                         )}
                      </div>
                    ))}
                 </div>
              </div>
            )}

            {activeTab === 'profile' && selectedSupplier && (
              <div className="bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200 max-w-2xl">
                 <h2 className="text-xl font-bold mb-6">Company Profile</h2>
                 <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="form-control">
                      <label className="label text-xs font-bold">Company Name</label>
                      <input type="text" name="name" className="input input-bordered w-full" defaultValue={selectedSupplier.name} required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control">
                        <label className="label text-xs font-bold">Email Address</label>
                        <input type="email" name="email" className="input input-bordered w-full" defaultValue={selectedSupplier.email} />
                      </div>
                      <div className="form-control">
                        <label className="label text-xs font-bold">Phone Number</label>
                        <input type="text" name="phone" className="input input-bordered w-full" defaultValue={selectedSupplier.phone} />
                      </div>
                    </div>
                    <div className="form-control">
                      <label className="label text-xs font-bold">Physical Address</label>
                      <textarea name="address" className="textarea textarea-bordered w-full" defaultValue={selectedSupplier.address} />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={updateProfileMutation.isPending}>
                      {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
                    </button>
                 </form>
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPortal;
