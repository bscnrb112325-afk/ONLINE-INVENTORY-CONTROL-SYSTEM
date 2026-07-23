import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Package, Plus, Search, Filter, AlertTriangle, Check, Download, Lock, Eye, EyeOff, X, Camera, AlertCircle, Upload, Sparkles, Barcode, Info, CheckCircle, RefreshCw } from 'lucide-react';
import { downloadCSV } from '../utils/csvExport';
import { UserHeader } from '../components/UserHeader';
import { CameraScanner } from '../components/CameraScanner';

const Inventory = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editGoodId, setEditGoodId] = useState('');
  const [hideAiAlerts, setHideAiAlerts] = useState(false);
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({});

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
  const [brand, setBrand] = useState('');
  const [subCatId, setSubCatId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [buyRate, setBuyRate] = useState('');
  const [sellRate, setSellRate] = useState('');
  const [qty, setQty] = useState('');
  const [reorderThreshold, setReorderThreshold] = useState('10');

  const [imageGoodId, setImageGoodId] = useState('');
  const [productDetails, setProductDetails] = useState('');
  const [dismissedLowStock, setDismissedLowStock] = useState<string[]>([]);

  // AI Vision & Auto-Fill state
  const [showScanner, setShowScanner] = useState(false);
  const [aiSuggestedFields, setAiSuggestedFields] = useState<string[]>([]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiSupplierSuggestion, setAiSupplierSuggestion] = useState('');
  const [duplicateInfo, setDuplicateInfo] = useState<{ id: string; name: string; serial: string; qty: number } | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [barcodeLookupInput, setBarcodeLookupInput] = useState('');
  const [aiSuccessMessage, setAiSuccessMessage] = useState('');

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
      const res = await api.post('/inventory/goods', newGood);
      return res.data;
    },
    onSuccess: async (data) => {
      // Log AI suggestions if any
      if (aiSuggestedFields.length > 0 && data && data.id) {
        const suggestions = aiSuggestedFields.map(field => ({
          productId: data.id,
          fieldName: field,
          suggestedValue: field === 'name' ? name : description,
          confidence: 0.95, // Mock confidence
          status: 'accepted'
        }));
        try {
          await api.post('/ai/suggestions', { suggestions });
        } catch (e) {
          console.error('Failed to log AI suggestions', e);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['goods'] });
      setIsModalOpen(false);
      // reset form
      resetForm();
      setAiSuggestedFields([]);
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || error.message || "Unknown error";
      alert(`Failed to add product: ${msg}`);
    }
  });

  // Mutator to update an existing item
  const updateGoodMutation = useMutation({
    mutationFn: async ({ id, ...updatedGood }: any) => {
      await api.put(`/inventory/goods/${id}`, updatedGood);
    },
    onSuccess: async (_, variables) => {
      // Log AI suggestions if any
      if (aiSuggestedFields.length > 0 && variables.id) {
        const suggestions = aiSuggestedFields.map(field => ({
          productId: variables.id,
          fieldName: field,
          suggestedValue: field === 'name' ? name : description,
          confidence: 0.95,
          status: 'accepted'
        }));
        try {
          await api.post('/ai/suggestions', { suggestions });
        } catch (e) {
          console.error('Failed to log AI suggestions', e);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['goods'] });
      setIsModalOpen(false);
      setEditGoodId('');
      resetForm();
      setAiSuggestedFields([]);
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || error.message || "Unknown error";
      alert(`Failed to update product: ${msg}`);
    }
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

  const analyzeStockMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/ai/analyze-stock');
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      setHideAiAlerts(false); // Re-show alerts when newly scanned
      setDraftQuantities({});
      alert(`AI Analysis complete! Found ${data.newRecommendationsFound} new low-stock items.`);
    }
  });

  const sendDraftsMutation = useMutation({
    mutationFn: async (items: { id: string, qty: number }[]) => {
      await api.post('/ai/recommendations/send-to-suppliers', { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      setDraftQuantities({});
      alert("Drafts successfully sent to supplier portal for bidding!");
    },
  });

  const triggerForecastMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/ai/trigger-forecast');
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['goods'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      alert(data.message);
    },
    onError: (err: any) => {
      alert(`Forecast Job Failed: ${err.message}`);
    }
  });

  const { data: anomalies = [] } = useQuery({
    queryKey: ['anomalies'],
    queryFn: async () => {
      const res = await api.get('/ai/anomalies');
      return res.data;
    },
    refetchInterval: 5000 // Poll for new anomalies
  });

  const dismissAnomalyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/ai/anomalies/${id}/dismiss`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
    }
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
    setBrand('');
    setSubCatId('');
    setSupplierId('');
    setBuyRate('');
    setSellRate('');
    setQty('');
    setReorderThreshold('10');
    setImageGoodId('');
    setProductDetails('');
    setAiSupplierSuggestion('');
    setDuplicateInfo(null);
    setValidationWarnings([]);
    setBarcodeLookupInput('');
    setAiSuccessMessage('');
    setAiSuggestedFields([]);
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

  const handleAiIdentify = async (imageBase64: string | null, barcodeInput: string | null) => {
    setIsAiProcessing(true);
    setAiSuccessMessage('');
    setDuplicateInfo(null);
    setValidationWarnings([]);
    try {
      const res = await api.post('/ai/vision-scan', { imageBase64, barcode: barcodeInput });
      if (res.data.success && res.data.data) {
        const aiData = res.data.data;

        if (aiData.name === "API Key Missing") {
          alert("Gemini API Key is missing! Please add it to ai_service/.env to use AI Vision.");
        }

        const suggested: string[] = [];

        if (aiData.name) {
          setName(aiData.name);
          suggested.push('name');
        }
        if (aiData.serial) {
          setSerial(aiData.serial);
          suggested.push('serial');
        }
        if (aiData.brand) {
          setBrand(aiData.brand);
          suggested.push('brand');
        }
        if (aiData.description) {
          setDescription(aiData.description);
          suggested.push('description');
        }
        if (aiData.buy_rate !== undefined && aiData.buy_rate !== null) {
          setBuyRate(aiData.buy_rate.toString());
          suggested.push('buyRate');
        }
        if (aiData.sell_rate !== undefined && aiData.sell_rate !== null) {
          setSellRate(aiData.sell_rate.toString());
          suggested.push('sellRate');
        }
        if (aiData.qty !== undefined && aiData.qty !== null) {
          setQty(aiData.qty.toString());
          suggested.push('qty');
        }
        if (aiData.reorder_threshold !== undefined && aiData.reorder_threshold !== null) {
          setReorderThreshold(aiData.reorder_threshold.toString());
          suggested.push('reorderThreshold');
        }

        if (aiData.product_details) {
          setProductDetails(aiData.product_details);
          suggested.push('productDetails');
        }

        if (aiData.matchedSubCatId) {
          setSubCatId(aiData.matchedSubCatId);
          suggested.push('subCatId');
        } else if (aiData.category) {
          const matchedCat = subcategories.find((c: any) => 
            c.name.toLowerCase().includes(aiData.category.toLowerCase()) || 
            aiData.category.toLowerCase().includes(c.name.toLowerCase())
          );
          if (matchedCat) {
            setSubCatId(matchedCat.id);
            suggested.push('subCatId');
          }
        }

        if (aiData.matchedSupplierId) {
          setSupplierId(aiData.matchedSupplierId);
          suggested.push('supplierId');
        }
        if (aiData.supplier_suggestion) {
          setAiSupplierSuggestion(aiData.supplier_suggestion);
          suggested.push('supplierSuggestion');
        }

        if (imageBase64) {
          setImageGoodId(imageBase64);
          suggested.push('imageGoodId');
        }

        if (aiData.duplicateFound && aiData.existingProduct) {
          setDuplicateInfo(aiData.existingProduct);
        }

        if (aiData.validationWarnings && aiData.validationWarnings.length > 0) {
          setValidationWarnings(aiData.validationWarnings);
        }

        setAiSuggestedFields(suggested);
        setAiSuccessMessage(`✨ AI identified "${aiData.name || 'product'}"! Category, brand, SKU & pricing suggestions loaded.`);

        setEditGoodId('');
        setIsModalOpen(true);
      }
    } catch (error: any) {
      console.warn('AI identification warning:', error);
      const errMsg = error.response?.data?.error || 'AI Vision scanner notice: Check backend & Python service.';
      setValidationWarnings([errMsg]);
      setIsModalOpen(true);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleScanResult = async (barcode: string | null, imageBase64: string | null) => {
    setShowScanner(false);
    if (barcode) {
      handleAiIdentify(null, barcode);
    } else if (imageBase64) {
      handleAiIdentify(imageBase64, null);
    }
  };

  const handlePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      handleAiIdentify(base64String, null);
    };
    reader.readAsDataURL(file);
  };

  if (goodsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  // Filter recommendations for restocks and deduplicate by productId
  // Also ensure we only show items that are STILL low stock (qty <= threshold)
  const activeRestocksRaw = recommendations.filter((r: any) => 
    r.action === 'restock' && 
    (r.status === 'pending' || r.status === 'review') &&
    r.good && r.good.qty <= (r.good.reorderThreshold ?? 10)
  );
  
  const activeRestocksMap = new Map();
  for (const r of activeRestocksRaw) {
    if (!activeRestocksMap.has(r.productId)) {
      activeRestocksMap.set(r.productId, r);
    }
  }
  const activeRestocks = Array.from(activeRestocksMap.values());
  
  const draftRestocks = activeRestocks.filter((r: any) => r.status === 'review');

  // Filter goods that are low on stock, have no pending restock, and are not dismissed
  const visibleLowStockItems = goods.filter(
    (g: any) => g.qty <= (g.reorderThreshold ?? 10) && 
    !activeRestocks.some((r: any) => r.good?.id === g.id) &&
    !dismissedLowStock.includes(g.id)
  );

  // Filter goods based on search, serial/SKU, and subcategory
  const filteredGoods = goods.filter((good: any) => {
    const term = searchTerm.toLowerCase();
    const nameMatches = (good.name || '').toLowerCase().includes(term) ||
                        (good.subCategory?.name || '').toLowerCase().includes(term) || 
                        (good.serial || '').toLowerCase().includes(term);
    const categoryMatches = selectedCategory === '' || good.subCategory?.categoryId === selectedCategory;
    return nameMatches && categoryMatches;
  });

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serial || !subCatId || !buyRate || !sellRate || !qty || !name) {
      alert("Please ensure all required fields (Item Name, Barcode SKU, Category, Cost, Price, Qty) are filled.");
      return;
    }
    
    const combinedDetails = brand 
      ? `Brand: ${brand}\n${productDetails}`
      : productDetails;

    const payload = {
      name,
      description,
      serial,
      subCatId,
      supplierId: supplierId || null,
      buyRate: parseFloat(buyRate),
      sellRate: parseFloat(sellRate),
      qty: parseInt(qty),
      reorderThreshold: reorderThreshold ? parseInt(reorderThreshold) : 10,
      status: 'in_stock',
      imageGoodId,
      productDetails: combinedDetails
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
    setDuplicateInfo(null);
    setValidationWarnings([]);
    setAiSuccessMessage('');
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
      <div className="min-h-[80vh] py-8 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 px-4">
        <div className="card w-full max-w-sm bg-base-100 shadow-2xl border border-base-200">
          <div className="card-body">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Lock size={32} />
              </div>
            </div>
            <h2 className="card-title text-center block text-2xl mb-1">Inventory Locked</h2>
            <p className="text-center text-base-content/60 text-sm mb-6">To login enter username and password.</p>
            
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
            className="btn btn-outline btn-secondary shadow-md gap-2" 
            onClick={() => analyzeStockMutation.mutate()}
            disabled={analyzeStockMutation.isPending}
          >
            {analyzeStockMutation.isPending ? <span className="loading loading-spinner loading-sm"></span> : <Check size={20} />}
            Run AI Stock Analysis
          </button>
          <button 
            className="btn btn-outline btn-info shadow-md gap-2" 
            onClick={() => triggerForecastMutation.mutate()}
            disabled={triggerForecastMutation.isPending}
          >
            {triggerForecastMutation.isPending ? <span className="loading loading-spinner loading-sm"></span> : <Package size={20} />}
            Run Forecast Job
          </button>
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

      {/* Anomaly Detection Banner */}
      {anomalies.length > 0 && (
        <div className="card bg-error/10 border border-error/30 text-error-content rounded-2xl p-4 flex flex-col gap-2 shadow-sm animate-in slide-in-from-top-4 duration-300 relative mb-6">
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-error shrink-0" size={28} />
              <div>
                <h4 className="font-bold text-sm">AI Data Anomalies Detected</h4>
                <p className="text-xs opacity-90 mt-0.5">
                  The AI detected {anomalies.length} anomalous entry/entries (e.g. negative margins or unrealistic stock). Please review them in the table below.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Restocking Alert Banner */}
      {!hideAiAlerts && activeRestocks.length > 0 && (
        <div className="card bg-warning/10 border border-warning/30 text-warning-content rounded-2xl p-4 flex flex-col gap-3 shadow-sm animate-in slide-in-from-top-4 duration-300 relative">
          <div className="flex flex-row items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-warning animate-bounce shrink-0" size={28} />
              <div>
                <h4 className="font-bold text-sm">Critical Stock AI Alerts</h4>
                <p className="text-xs opacity-90 mt-0.5">
                  AI has detected low/no stock for {activeRestocks.length} product(s).
                  {draftRestocks.length > 0 ? ` Review and adjust quantities below before sending to suppliers.` : ` Bidding requests sent to Supplier Portal.`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                className="btn btn-sm btn-ghost border border-warning/40 shadow-sm"
                onClick={() => setHideAiAlerts(true)}
              >
                Close
              </button>
              {draftRestocks.length > 0 ? (
                <button 
                  className="btn btn-sm btn-warning shadow-md"
                  disabled={sendDraftsMutation.isPending}
                  onClick={() => {
                    const itemsPayload = draftRestocks.map((r: any) => ({
                      id: r.id,
                      qty: draftQuantities[r.id] !== undefined ? draftQuantities[r.id] : r.recommendedQty
                    }));
                    sendDraftsMutation.mutate(itemsPayload);
                  }}
                >
                  {sendDraftsMutation.isPending ? <span className="loading loading-spinner loading-sm"></span> : <Check size={16} />}
                  <span>Send Drafts to Supplier Portal ({draftRestocks.length})</span>
                </button>
              ) : (
                <button 
                  className="btn btn-sm btn-warning shadow-md"
                  disabled
                >
                  <Check size={16} />
                  <span>Awaiting Supplier Bids</span>
                </button>
              )}
            </div>
          </div>
          
          <div className="mt-2 text-sm bg-base-100/50 p-3 rounded-lg border border-warning/20">
            <p className="font-semibold mb-2">Affected Items:</p>
            <ul className="list-none space-y-2">
              {activeRestocks.map((r: any) => (
                <li key={r.id} className="flex items-center gap-4 border-b border-warning/10 pb-2 last:border-0 last:pb-0">
                  <div className="flex-1">
                    <span className="font-mono text-primary font-bold">{r.good?.serial}</span> - {r.good?.subCategory?.name || r.good?.name} 
                    <span className="ml-2 badge badge-sm badge-outline badge-error">Current Stock: {r.good?.qty}</span>
                  </div>
                  {r.status === 'review' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs opacity-70">Adjust Qty:</span>
                      <input 
                        type="number"
                        className="input input-sm input-bordered w-24 text-base-content"
                        value={draftQuantities[r.id] !== undefined ? draftQuantities[r.id] : r.recommendedQty}
                        onChange={(e) => setDraftQuantities({ ...draftQuantities, [r.id]: Number(e.target.value) })}
                      />
                      <span className="badge badge-sm badge-warning">Draft</span>
                    </div>
                  ) : (
                    <span className="badge badge-sm">Pending Bids</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
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
                        <div className="flex flex-col gap-1 items-start">
                          <span>{good.qty} Units</span>
                          {good.forecasts && good.forecasts.length > 0 && good.forecasts[0].suggestedReorderQty > 0 && (
                            <span className="badge badge-info badge-xs text-[10px] font-mono" title={`Based on AI Demand Forecast from ${new Date(good.forecasts[0].forecastDate).toLocaleDateString()}`}>
                              AI Suggests: +{good.forecasts[0].suggestedReorderQty}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-sm font-semibold text-base-content/70">
                          KSh {parseFloat(good.buyRate).toFixed(2)}
                      </td>
                      <td className="text-sm font-bold text-primary">
                          KSh {parseFloat(good.sellRate).toFixed(2)}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1 items-start">
                          {isOut ? (
                            <span className="badge badge-error badge-sm font-bold">Out of Stock</span>
                          ) : isLow ? (
                            <span className="badge badge-warning badge-sm font-bold animate-pulse">Only {good.qty} Left</span>
                          ) : (
                            <span className="badge badge-success badge-sm font-bold text-success-content">In Stock</span>
                          )}
                          {anomalies.filter((a: any) => a.entityId === good.id).map((anom: any) => (
                            <div key={anom.id} className="flex items-center gap-1 mt-1 bg-error/10 text-error px-2 py-1 rounded text-[10px] font-bold border border-error/20">
                              <AlertCircle size={10} />
                              <span title={anom.description} className="uppercase tracking-wider">{anom.anomalyType.replace('_', ' ')}</span>
                              <button onClick={(e) => { e.stopPropagation(); dismissAnomalyMutation.mutate(anom.id); }} className="ml-1 hover:text-red-700 bg-error/20 rounded-full p-0.5" title="Dismiss">
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
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

      {/* Add / Edit Product Modal */}
      {isModalOpen && (() => {
        const buyNum = parseFloat(buyRate) || 0;
        const sellNum = parseFloat(sellRate) || 0;
        const profitVal = sellNum - buyNum;
        const marginPercent = sellNum > 0 ? ((profitVal / sellNum) * 100).toFixed(1) : '0.0';

        return (
        <div className="modal modal-open">
          <div className="modal-box rounded-2xl max-w-lg border border-base-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Title & Actions */}
            <div className="flex justify-between items-center border-b border-base-200 pb-3">
              <div>
                <h3 className="font-bold text-lg text-base-content flex items-center gap-2">
                  <Package className="text-primary w-5 h-5" />
                  <span>{editGoodId ? 'Edit Product' : 'Add New Product'}</span>
                </h3>
                {!editGoodId && (
                  <p className="text-xs text-base-content/60">Upload photo or scan barcode for smart AI auto-fill</p>
                )}
              </div>
              <button 
                type="button" 
                className="btn btn-sm btn-ghost btn-circle"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Smart AI Auto-Fill Tools (When creating new product) */}
            {!editGoodId && (
              <div className="bg-base-200/60 rounded-xl p-3 border border-base-300/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-primary">
                    <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                    AI Identification & Auto-Fill
                  </span>
                  {isAiProcessing && <span className="loading loading-spinner loading-xs text-primary"></span>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Photo Upload Trigger */}
                  <label className="btn btn-sm btn-outline btn-secondary w-full gap-2 cursor-pointer font-semibold text-xs">
                    <Upload className="w-4 h-4" />
                    Upload Product Photo
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handlePhotoFileUpload}
                      disabled={isAiProcessing}
                    />
                  </label>

                  {/* Camera Scanner Trigger */}
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline btn-primary w-full gap-2 font-semibold text-xs"
                    onClick={() => setShowScanner(true)}
                    disabled={isAiProcessing}
                  >
                    <Camera className="w-4 h-4" />
                    Scan Camera / Barcode
                  </button>
                </div>

                {/* Direct Barcode Lookup Input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 absolute left-3 top-2.5 text-base-content/40" />
                    <input 
                      type="text" 
                      placeholder="Or enter Barcode / SKU..." 
                      className="input input-xs input-bordered w-full pl-9"
                      value={barcodeLookupInput}
                      onChange={(e) => setBarcodeLookupInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (barcodeLookupInput.trim()) handleAiIdentify(null, barcodeLookupInput.trim());
                        }
                      }}
                    />
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-xs btn-primary font-bold px-3"
                    onClick={() => {
                      if (barcodeLookupInput.trim()) handleAiIdentify(null, barcodeLookupInput.trim());
                    }}
                    disabled={isAiProcessing || !barcodeLookupInput.trim()}
                  >
                    Identify SKU
                  </button>
                </div>
              </div>
            )}

            {/* AI Loading State Banner */}
            {isAiProcessing && (
              <div className="alert alert-info py-2 px-3 text-xs flex items-center gap-2 border-info/30">
                <span className="loading loading-spinner loading-xs text-info"></span>
                <span>AI processing product photo/barcode, calculating margins & verifying duplicate SKU...</span>
              </div>
            )}

            {/* AI Success Message Banner */}
            {aiSuccessMessage && !isAiProcessing && (
              <div className="alert alert-success py-2 px-3 text-xs flex items-center gap-2 text-success-content">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{aiSuccessMessage}</span>
              </div>
            )}

            {/* Duplicate Check Warning Box */}
            {duplicateInfo && (
              <div className="alert alert-warning py-2.5 px-3 text-xs flex items-start gap-2 border-warning/40 shadow-sm">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block">Duplicate Product Warning</span>
                  <span>
                    Product <strong>"{duplicateInfo.name}"</strong> with SKU <strong>{duplicateInfo.serial}</strong> already exists in inventory ({duplicateInfo.qty} units).
                  </span>
                </div>
              </div>
            )}

            {/* Data Validation Warnings */}
            {validationWarnings.length > 0 && (
              <div className="bg-error/10 border border-error/30 rounded-xl p-2.5 text-xs text-error space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Data Validation Alerts:
                </div>
                {validationWarnings.map((warning, idx) => (
                  <div key={idx} className="ml-4">• {warning}</div>
                ))}
              </div>
            )}
            
            <form onSubmit={handleSaveProduct} className="space-y-4">
              
              {/* Product Name */}
              <div className="form-control">
                <label className="label font-semibold text-xs py-1 flex justify-between">
                  <span>Item Name <span className="text-error">*</span></span>
                  {aiSuggestedFields.includes('name') && (
                    <span className="badge badge-accent badge-xs gap-1 font-mono text-[10px]">
                      <Sparkles className="w-2.5 h-2.5" /> AI Suggested
                    </span>
                  )}
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Wireless Bluetooth Headphones" 
                  className="input input-bordered"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {/* Brand & Barcode SKU */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label font-semibold text-xs py-1 flex justify-between">
                    <span>Brand Name</span>
                    {aiSuggestedFields.includes('brand') && (
                      <span className="badge badge-accent badge-xs text-[10px]">AI</span>
                    )}
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Sony, Samsung" 
                    className="input input-bordered"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </div>

                <div className="form-control">
                  <div className="flex justify-between items-center py-1">
                    <label className="label font-semibold text-xs p-0">
                      Barcode SKU <span className="text-error">*</span>
                    </label>
                    <button 
                      type="button" 
                      onClick={() => setSerial(`SN-${Math.floor(100000 + Math.random() * 900000)}`)}
                      className="text-[11px] text-primary hover:underline font-bold"
                      title="Auto-generate SKU"
                    >
                      ⚡ Auto SKU
                    </button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="e.g. SN-883921" 
                    className="input input-bordered font-mono"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Category & Supplier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label font-semibold text-xs py-1 flex justify-between">
                    <span>Category <span className="text-error">*</span></span>
                    <button type="button" className="text-primary text-xs hover:underline" onClick={() => setIsCatModalOpen(true)}>+ New</button>
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
                  <label className="label font-semibold text-xs py-1 flex justify-between">
                    <span>Supplier</span>
                    <button type="button" className="text-primary text-xs hover:underline" onClick={() => setIsSupModalOpen(true)}>+ New</button>
                  </label>
                  <select 
                    className="select select-bordered"
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                  >
                    <option value="">No Supplier Selected</option>
                    {suppliers.map((sup: any) => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                  {aiSupplierSuggestion && !supplierId && (
                    <span className="text-[10px] text-primary font-semibold mt-1 block">
                      💡 AI Suggests: {aiSupplierSuggestion}
                    </span>
                  )}
                </div>
              </div>

              {/* Cost, Selling Price & Live Profit Margin */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-control">
                    <label className="label font-semibold text-xs py-1">
                      Buy Rate / Cost (KSh) <span className="text-error">*</span>
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="100.00" 
                      className="input input-bordered"
                      value={buyRate}
                      onChange={(e) => setBuyRate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-control">
                    <label className="label font-semibold text-xs py-1 flex justify-between">
                      <span>Sell Rate / Price (KSh) <span className="text-error">*</span></span>
                      {aiSuggestedFields.includes('sellRate') && (
                        <span className="badge badge-accent badge-xs text-[10px]">AI Pricing</span>
                      )}
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="150.00" 
                      className="input input-bordered"
                      value={sellRate}
                      onChange={(e) => setSellRate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Real-time Profit Margin Badge */}
                {(buyNum > 0 || sellNum > 0) && (
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${profitVal < 0 ? 'bg-error/10 border-error/30 text-error' : Number(marginPercent) >= 20 ? 'bg-success/10 border-success/30 text-success' : 'bg-warning/10 border-warning/30 text-warning'}`}>
                    <div className="flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>AI Profit Margin Recommendation:</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="text-sm">{marginPercent}%</span>
                      <span className="text-[11px] opacity-80">(+KSh {profitVal > 0 ? profitVal.toFixed(2) : '0.00'})</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Initial Qty & AI Reorder Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label font-semibold text-xs py-1">
                    Initial Stock Qty <span className="text-error">*</span>
                  </label>
                  <input 
                    type="number" 
                    placeholder="50" 
                    className="input input-bordered"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label font-semibold text-xs py-1 flex justify-between">
                    <span>Reorder Level</span>
                    {aiSuggestedFields.includes('reorderThreshold') && (
                      <span className="badge badge-accent badge-xs text-[10px]">AI Level</span>
                    )}
                  </label>
                  <input 
                    type="number" 
                    placeholder="10" 
                    className="input input-bordered"
                    value={reorderThreshold}
                    onChange={(e) => setReorderThreshold(e.target.value)}
                  />
                </div>
              </div>

              {/* Image URL / Preview */}
              <div className="form-control">
                <label className="label font-semibold text-xs py-1">Image URL / Preview</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    placeholder="https://... or auto-extracted image" 
                    className="input input-bordered flex-1 text-xs"
                    value={imageGoodId}
                    onChange={(e) => setImageGoodId(e.target.value)}
                  />
                  {imageGoodId && (
                    <div className="w-9 h-9 rounded-lg border border-base-300 overflow-hidden shrink-0 bg-base-200 flex items-center justify-center">
                      <img src={imageGoodId} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    </div>
                  )}
                </div>
              </div>

              {/* Product Description */}
              <div className="form-control">
                <label className="label font-semibold text-xs py-1 flex justify-between">
                  <span>Description</span>
                  {aiSuggestedFields.includes('description') && (
                    <span className="badge badge-accent badge-xs text-[10px]">AI</span>
                  )}
                </label>
                <input 
                  type="text" 
                  placeholder="Short description..." 
                  className="input input-bordered"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Specifications & Product Details */}
              <div className="form-control">
                <label className="label font-semibold text-xs py-1 flex justify-between">
                  <span>Product Details & Spec using ai</span>
                  {aiSuggestedFields.includes('productDetails') && (
                    <span className="badge badge-accent badge-xs text-[10px]">AI</span>
                  )}
                </label>
                <textarea 
                  placeholder="Color, weight, dimensions, packaging details..." 
                  className="textarea textarea-bordered h-16 text-xs"
                  value={productDetails}
                  onChange={(e) => setProductDetails(e.target.value)}
                ></textarea>
              </div>

              <div className="modal-action border-t border-base-200 pt-3">
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button 
                  type="submit" 
                  className="btn btn-primary font-bold px-6" 
                  disabled={addGoodMutation.isPending || updateGoodMutation.isPending || isAiProcessing}
                >
                  {(addGoodMutation.isPending || updateGoodMutation.isPending) ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : editGoodId ? (
                    'Save Changes'
                  ) : (
                    'Save Product'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {showScanner && (
        <CameraScanner 
          onClose={() => setShowScanner(false)} 
          onResult={handleScanResult} 
        />
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
