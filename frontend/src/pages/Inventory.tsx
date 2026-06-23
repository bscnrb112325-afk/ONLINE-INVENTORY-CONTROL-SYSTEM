import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Package, Plus, Search, Filter, AlertTriangle, Check, Download, Lock, Eye, EyeOff } from 'lucide-react';
import { downloadCSV } from '../utils/csvExport';
import { UserHeader } from '../components/UserHeader';

const Inventory = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editGoodId, setEditGoodId] = useState('');

  // Category & Supplier Modals
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isSupModalOpen, setIsSupModalOpen] = useState(false);
  const [newSupName, setNewSupName] = useState('');
  const [newSupEmail, setNewSupEmail] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [serial, setSerial] = useState('');
  const [subCatId, setSubCatId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [buyRate, setBuyRate] = useState('');
  const [sellRate, setSellRate] = useState('');
  const [qty, setQty] = useState('');
  const [reorderThreshold, setReorderThreshold] = useState('10');
  const [imageGoodId, setImageGoodId] = useState('');
  const [productDetails, setProductDetails] = useState('');
  const [dismissedLowStock, setDismissedLowStock] = useState<string[]>([]);

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
        if (userRole === 'admin' || userRole === 'manager' || userRole === 'inventory') {
          setIsUnlocked(true);
          setLoggedInUser(res.data.user);
        } else {
          setUnlockError('Access Denied: Only Admin, Manager, and Inventory roles can access this page.');
        }
      }
    } catch (err: any) {
      setUnlockError('Incorrect username or password.');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Fetch goods
  const { data: goods = [], isLoading: goodsLoading } = useQuery({
    queryKey: ['goods'],
    queryFn: async () => {
      const res = await api.get('/inventory/goods');
      return res.data;
    },
  });

  // Fetch recommendations (specifically restocks)
  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const res = await api.get('/ai/recommendations');
      return res.data;
    },
  });

  // Fetch subcategories
  const { data: subcategories = [] } = useQuery({
    queryKey: ['subcategories'],
    queryFn: async () => {
      const res = await api.get('/inventory/subcategories');
      return res.data;
    },
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await api.get('/inventory/suppliers');
      return res.data;
    },
  });

  // Mutator to add new item
  const addGoodMutation = useMutation({
    mutationFn: async (newGood: any) => {
      await api.post('/inventory/goods', newGood);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods'] });
      setIsModalOpen(false);
      // reset form
      setName('');
      setDescription('');
      setSerial('');
      setSubCatId('');
      setSupplierId('');
      setBuyRate('');
      setSellRate('');
      setQty('');
      setReorderThreshold('10');
      setImageGoodId('');
    },
  });

  // Mutator to update an existing item
  const updateGoodMutation = useMutation({
    mutationFn: async ({ id, ...updatedGood }: any) => {
      await api.put(`/inventory/goods/${id}`, updatedGood);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods'] });
      setIsModalOpen(false);
      setEditGoodId('');
      resetForm();
    },
  });

  const deleteGoodMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/inventory/goods/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods'] });
    },
  });

  const manualRestockMutation = useMutation({
    mutationFn: async ({ id, qty }: { id: string, qty: number }) => {
      const res = await api.post(`/inventory/goods/${id}/restock`, { qty });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      alert("Restock request submitted successfully and is pending approval.");
    },
  });

  const addCatMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/inventory/subcategories', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
      setIsCatModalOpen(false);
      setNewCatName('');
      if (data && data.id) {
        setSubCatId(data.id);
      }
    }
  });

  const addSupMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/inventory/suppliers', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsSupModalOpen(false);
      setNewSupName('');
      setNewSupEmail('');
      if (data && data.id) {
        setSupplierId(data.id);
      }
    }
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setSerial('');
    setSubCatId('');
    setSupplierId('');
    setBuyRate('');
    setSellRate('');
    setQty('');
    setReorderThreshold('10');
    setImageGoodId('');
    setProductDetails('');
  };

  // Mutator to quick approve restock recommendation
  const approveRestockMutation = useMutation({
    mutationFn: async (recId: string) => {
      await api.post(`/ai/recommendations/${recId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  if (goodsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  // Filter recommendations for restocks
  const activeRestocks = recommendations.filter((r: any) => r.action === 'restock' && r.status === 'pending');

  // Filter goods that are low on stock, have no pending restock, and are not dismissed
  const visibleLowStockItems = goods.filter(
    (g: any) => g.qty <= (g.reorderThreshold ?? 10) && 
    !activeRestocks.some((r: any) => r.good?.id === g.id) &&
    !dismissedLowStock.includes(g.id)
  );

  // Filter goods based on search and subcategory name
  const filteredGoods = goods.filter((good: any) => {
    const nameMatches = (good.subCategory?.name || 'Product').toLowerCase().includes(searchTerm.toLowerCase()) || 
                        good.serial.toLowerCase().includes(searchTerm.toLowerCase());
    const categoryMatches = selectedCategory === '' || good.subCategory?.categoryId === selectedCategory;
    return nameMatches && categoryMatches;
  });

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serial || !subCatId || !buyRate || !sellRate || !qty || !name) return;
    
    const payload = {
      name,
      description,
      serial,
      subCatId,
      supplierId,
      buyRate: parseFloat(buyRate),
      sellRate: parseFloat(sellRate),
      qty: parseInt(qty),
      reorderThreshold: parseInt(reorderThreshold),
      status: 'in_stock',
      imageGoodId,
      productDetails
    };

    if (editGoodId) {
      updateGoodMutation.mutate({ id: editGoodId, ...payload });
    } else {
      addGoodMutation.mutate(payload);
    }
  };

  const handleEditClick = (good: any) => {
    setEditGoodId(good.id);
    setName(good.name || '');
    setDescription(good.description || '');
    setSerial(good.serial || '');
    setSubCatId(good.subCatId || '');
    setSupplierId(good.supplierId || '');
    setBuyRate(good.buyRate ? good.buyRate.toString() : '');
    setSellRate(good.sellRate ? good.sellRate.toString() : '');
    setQty(good.qty !== undefined ? good.qty.toString() : '');
    setReorderThreshold(good.reorderThreshold !== undefined ? good.reorderThreshold.toString() : '10');
    setImageGoodId(good.imageGoodId || '');
    setProductDetails(good.productDetails || '');
    setIsModalOpen(true);
  };

  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // If the user is typing in a form field manually, it takes time. 
      // A scanner inputs keys very rapidly (e.g., <30ms per key)
      const currentTime = Date.now();
      
      if (currentTime - lastKeyTime > 50) {
        buffer = ''; // Reset buffer if it's slow human typing
      }

      if (e.key === 'Enter' && buffer.length >= 3) {
        // Prevent form submission if focused somewhere else
        e.preventDefault();
        
        // Check if item exists in inventory
        const existingGood = goods.find((g: any) => g.serial === buffer);
        if (existingGood) {
          handleEditClick(existingGood);
        } else {
          resetForm();
          setSerial(buffer);
          setIsModalOpen(true);
        }
        buffer = '';
      } else if (e.key.length === 1) { 
        // Only capture single characters (alphanumeric/symbols)
        buffer += e.key;
      }
      
      lastKeyTime = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goods]);

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
            <h2 className="card-title text-center block text-2xl mb-1">Inventory Locked</h2>
            <p className="text-center text-base-content/60 text-sm mb-6">To login to Inventory use details on settings User Management.</p>
            
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
                {isUnlocking ? <span className="loading loading-spinner loading-sm"></span> : 'Unlock Inventory'}
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
      {/* Top Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-3xl font-bold text-base-content">Inventory Control</h2>
          <p className="text-base-content/70 mt-1">Manage catalog items, monitor real-time levels, and execute dynamic restocks.</p>
        </div>
        <div className="flex gap-2">
          <button 
            className="btn btn-outline shadow-md gap-2" 
            onClick={() => downloadCSV(filteredGoods, "inventory_export.csv")}
          >
            <Download size={20} />
            Export CSV
          </button>
          <button className="btn btn-primary shadow-md gap-2" onClick={() => {
            setEditGoodId('');
            resetForm();
            setIsModalOpen(true);
          }}>
            <Plus size={20} />
            Add New Product
          </button>
        </div>
      </div>

      {/* AI Restocking Alert Banner */}
      {activeRestocks.length > 0 && (
        <div className="card bg-warning/10 border border-warning/30 text-warning-content rounded-2xl p-4 flex flex-row items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-warning animate-bounce shrink-0" size={28} />
            <div>
              <h4 className="font-bold text-sm">Critical Stock Restock Recommends</h4>
              <p className="text-xs opacity-90 mt-0.5">
                AI predicts restocking requests for {activeRestocks.length} product(s) to prevent stockout.
              </p>
            </div>
          </div>
          <button 
            className="btn btn-sm btn-warning shadow-md"
            onClick={() => approveRestockMutation.mutate(activeRestocks[0].id)}
            disabled={approveRestockMutation.isPending}
          >
            <Check size={16} />
            <span>Approve Restock for {activeRestocks[0].good?.subCategory?.name}</span>
          </button>
        </div>
      )}

      {/* Main Stock Table */}
      <div className="bg-base-100 shadow-md rounded-2xl border border-base-200 overflow-hidden">
        {/* Table Filters */}
        <div className="p-4 border-b border-base-200 flex flex-wrap gap-4 bg-base-200/20">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" size={18} />
            <input 
              type="text" 
              placeholder="Search by SKU, serial, name..." 
              className="input input-bordered w-full pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-base-content/60" />
            <select 
              className="select select-bordered"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {subcategories.map((sub: any) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table List */}
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-base-200/50">
                <th>Serial / Barcode</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Stock Quantity</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGoods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-base-content/50">
                    No products matching search filters.
                  </td>
                </tr>
              ) : (
                filteredGoods.map((good: any) => {
                  const isLow = good.qty <= 3;
                  const isOut = good.qty === 0;

                  return (
                    <tr key={good.id} className="hover:bg-base-200/30 transition-colors">
                      <td className="font-mono text-xs font-bold text-primary">
                        {good.imageGoodId && <img src={good.imageGoodId} alt="Product" className="w-8 h-8 rounded-md inline-block mr-2 object-cover" />}
                        {good.serial}
                      </td>
                      <td className="font-semibold text-sm max-w-[200px]">
                        <div className="truncate">{good.name || good.subCategory?.name || 'Inventory Good'}</div>
                        {good.description && <span className="block text-[10px] font-normal text-base-content/50 truncate mt-0.5" title={good.description}>{good.description}</span>}
                      </td>
                      <td>
                        <span className="badge badge-ghost badge-sm text-xs font-semibold">
                          {good.subCategory?.name || 'SKU'}
                        </span>
                      </td>
                      <td className="font-bold text-sm">
                        {good.qty} Units
                      </td>
                      <td className="text-sm font-semibold text-base-content/70">
                          KSh {parseFloat(good.buyRate).toFixed(2)}
                      </td>
                      <td className="text-sm font-bold text-primary">
                          KSh {parseFloat(good.sellRate).toFixed(2)}
                      </td>
                      <td>
                        {isOut ? (
                          <span className="badge badge-error badge-sm font-bold">Out of Stock</span>
                        ) : isLow ? (
                          <span className="badge badge-warning badge-sm font-bold animate-pulse">Only {good.qty} Left</span>
                        ) : (
                          <span className="badge badge-success badge-sm font-bold text-success-content">In Stock</span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button 
                            className="btn btn-xs btn-outline"
                            onClick={() => handleEditClick(good)}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn btn-xs btn-outline btn-warning"
                            onClick={() => {
                              const qty = window.prompt("Enter number of units to request for restock:");
                              if (qty && !isNaN(Number(qty)) && Number(qty) > 0) {
                                manualRestockMutation.mutate({ id: good.id, qty: Number(qty) });
                              }
                            }}
                            disabled={manualRestockMutation.isPending}
                          >
                            Restock
                          </button>
                          <button 
                            className="btn btn-xs btn-outline btn-error"
                            onClick={() => {
                              if (window.confirm("Are you sure you want to permanently delete this product?")) {
                                deleteGoodMutation.mutate(good.id);
                              }
                            }}
                            disabled={deleteGoodMutation.isPending}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box rounded-2xl max-w-md border border-base-200 shadow-xl space-y-4">
            <h3 className="font-bold text-lg text-base-content flex items-center gap-2">
              <Package className="text-primary" />
              <span>{editGoodId ? 'Edit Product' : 'Add New Catalog SKU'}</span>
            </h3>
            
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="form-control">
                <label className="label font-semibold text-xs">Item Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Premium Coffee Beans" 
                  className="input input-bordered"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label font-semibold text-xs">Barcode Serial / SKU</label>
                  <input 
                    type="text" 
                    placeholder="e.g. SN-883921" 
                    className="input input-bordered"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    required
                  />
                </div>
                <div className="form-control">
                  <label className="label font-semibold text-xs">Image URL</label>
                  <input 
                    type="text" 
                    placeholder="https://..." 
                    className="input input-bordered"
                    value={imageGoodId}
                    onChange={(e) => setImageGoodId(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label font-semibold text-xs">Description</label>
                <input 
                  type="text" 
                  placeholder="Short description..." 
                  className="input input-bordered"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label font-semibold text-xs flex justify-between">
                    <span>Category Product</span>
                    <button type="button" className="text-primary text-xs" onClick={() => setIsCatModalOpen(true)}>+ New</button>
                  </label>
                  <select 
                    className="select select-bordered"
                    value={subCatId}
                    onChange={(e) => setSubCatId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select category model</option>
                    {subcategories.map((sub: any) => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label font-semibold text-xs flex justify-between">
                    <span>Supplier</span>
                    <button type="button" className="text-primary text-xs" onClick={() => setIsSupModalOpen(true)}>+ New</button>
                  </label>
                  <select 
                    className="select select-bordered"
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                  >
                    <option value="">No Supplier</option>
                    {suppliers.map((sup: any) => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label font-semibold text-xs">Buy Rate (Cost)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="10.00" 
                    className="input input-bordered"
                    value={buyRate}
                    onChange={(e) => setBuyRate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-control">
                  <label className="label font-semibold text-xs">Sell Rate (Price)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="20.00" 
                    className="input input-bordered"
                    value={sellRate}
                    onChange={(e) => setSellRate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label font-semibold text-xs">Initial Qty</label>
                  <input 
                    type="number" 
                    placeholder="100" 
                    className="input input-bordered"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    required
                  />
                </div>
                <div className="form-control">
                  <label className="label font-semibold text-xs">Reorder Threshold</label>
                  <input 
                    type="number" 
                    placeholder="10" 
                    className="input input-bordered"
                    value={reorderThreshold}
                    onChange={(e) => setReorderThreshold(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label font-semibold text-xs">Product Details</label>
                <textarea 
                  placeholder="Extra details, size, color, brand..." 
                  className="textarea textarea-bordered h-16"
                  value={productDetails}
                  onChange={(e) => setProductDetails(e.target.value)}
                ></textarea>
              </div>

              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addGoodMutation.isPending || updateGoodMutation.isPending}>
                  {editGoodId ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add Category Modal */}
      {isCatModalOpen && (
        <div className="modal modal-open z-[1000]">
          <div className="modal-box rounded-2xl max-w-sm shadow-2xl">
            <h3 className="font-bold text-lg">New Category</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (newCatName) addCatMutation.mutate({ name: newCatName, description: 'New category' });
            }}>
              <div className="form-control mt-4">
                <label className="label font-semibold text-xs">Category Name</label>
                <input 
                  type="text" 
                  className="input input-bordered"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={() => setIsCatModalOpen(false)}>Cancel</button>
                <button 
                  type="submit"
                  className="btn btn-primary" 
                  disabled={!newCatName || addCatMutation.isPending}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {isSupModalOpen && (
        <div className="modal modal-open z-[1000]">
          <div className="modal-box rounded-2xl max-w-sm shadow-2xl">
            <h3 className="font-bold text-lg">New Supplier</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (newSupName) addSupMutation.mutate({ name: newSupName, email: newSupEmail, phone: '', address: '' });
            }}>
              <div className="form-control mt-4">
                <label className="label font-semibold text-xs">Supplier Name</label>
                <input 
                  type="text" 
                  className="input input-bordered"
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="form-control mt-4">
                <label className="label font-semibold text-xs">Email</label>
                <input 
                  type="email" 
                  className="input input-bordered"
                  value={newSupEmail}
                  onChange={(e) => setNewSupEmail(e.target.value)}
                />
              </div>
              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={() => setIsSupModalOpen(false)}>Cancel</button>
                <button 
                  type="submit"
                  className="btn btn-primary" 
                  disabled={!newSupName || addSupMutation.isPending}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Low Stock Popup Notification */}
      {visibleLowStockItems.length > 0 && (
        <div className="toast toast-end toast-bottom z-9999 mb-4 mr-4">
          {visibleLowStockItems.map((item: any) => (
            <div className="alert shadow-2xl border border-warning/50 bg-base-100 flex-col items-start gap-2 max-w-sm" key={item.id}>
              <div className="flex justify-between w-full items-center gap-4">
                <div className="flex items-center gap-2 text-warning">
                  <AlertTriangle size={20} />
                  <span className="font-bold">Low Stock Alert</span>
                </div>
                <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setDismissedLowStock(prev => [...prev, item.id])}>✕</button>
              </div>
              <div className="text-sm">
                <span className="font-semibold">{item.name || item.subCategory?.name || item.serial}</span> is down to <span className="font-bold text-error">{item.qty}</span> units (Threshold: {item.reorderThreshold ?? 10}).
              </div>
              <div className="w-full flex justify-end mt-1">
                <button 
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    manualRestockMutation.mutate({ id: item.id, qty: 50 });
                    setDismissedLowStock(prev => [...prev, item.id]);
                  }}
                  disabled={manualRestockMutation.isPending}
                >
                  Send to Supplier Portal
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Inventory;
