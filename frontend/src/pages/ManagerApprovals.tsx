import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { CheckCircle2, XCircle, Clock, Truck, ShieldCheck, AlertCircle, Sparkles, Lock, Eye, EyeOff, Wifi, CreditCard } from 'lucide-react';
import { UserHeader } from '../components/UserHeader';

const ManagerApprovals = () => {
  const queryClient = useQueryClient();

  // Lock Screen
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'pending' | 'unpaid' | 'paid'>('pending');
  const [paymentModalOrderId, setPaymentModalOrderId] = useState<string | null>(null);
  const [tapToPayOrderId, setTapToPayOrderId] = useState<string | null>(null);
  const [tapStatus, setTapStatus] = useState<'waiting' | 'processing' | 'success'>('waiting');

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
          setUnlockError('Access Denied: Only Manager and Admin can access Approvals.');
        }
      }
    } catch (err: any) {
      setUnlockError('Incorrect username or password.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const { data: bids = [], isLoading } = useQuery({
    queryKey: ['submittedBids'],
    queryFn: async () => {
      const res = await api.get('/approvals/bids');
      return res.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ bidId, paymentMethod }: { bidId: string, paymentMethod: string }) => {
      // In a real app we'd pass the actual manager's userId from auth context
      const res = await api.put(`/approvals/bids/${bidId}/approve`, { userId: null, paymentMethod });
      return res.data;
    },
    onSuccess: (data) => {
      alert(`Bid Approved! Purchase Order ${data.purchaseId.split('-')[0]} automatically generated.`);
      queryClient.invalidateQueries({ queryKey: ['submittedBids'] });
    },
    onError: (err: any) => {
      alert('Error approving bid: ' + err.message);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (bidId: string) => {
      await api.put(`/approvals/bids/${bidId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submittedBids'] });
    },
  });

  const { data: purchases = [], isLoading: isLoadingPurchases } = useQuery({
    queryKey: ['managerPurchases'],
    queryFn: async () => {
      const res = await api.get('/purchases');
      return res.data;
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ purchaseId, paymentMethod }: { purchaseId: string, paymentMethod?: string }) => {
      const res = await api.put(`/purchases/${purchaseId}/pay`, { isPaid: true, paymentMethod });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managerPurchases'] });
      if (tapToPayOrderId) {
        setTapStatus('success');
        setTimeout(() => {
          setTapToPayOrderId(null);
        }, 1500);
      }
    }
  });

  const handleTapToPay = (orderId: string) => {
    setPaymentModalOrderId(null);
    setTapToPayOrderId(orderId);
    setTapStatus('waiting');
  };

  const handleSimulateTap = () => {
    if (tapStatus !== 'waiting' || !tapToPayOrderId) return;
    setTapStatus('processing');
    setTimeout(() => {
      markPaidMutation.mutate({ purchaseId: tapToPayOrderId, paymentMethod: 'card' });
    }, 1500);
  };

  const handleMpesaPay = (orderId: string) => {
    setPaymentModalOrderId(null);
    if(confirm('Process M-Pesa payment?')) {
      markPaidMutation.mutate({ purchaseId: orderId, paymentMethod: 'mpesa' });
    }
  };

  const unpaidPurchases = purchases.filter((p: any) => !p.isPaid);
  const paidPurchases = purchases.filter((p: any) => p.isPaid);

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><span className="loading loading-spinner text-primary"></span></div>;
  }

  // Group bids by recommendation
  const groupedBids: Record<string, { recommendation: any; bids: any[] }> = {};
  bids.forEach((bid: any) => {
    const recId = bid.recommendationId;
    if (!groupedBids[recId]) {
      groupedBids[recId] = {
        recommendation: bid.recommendation,
        bids: []
      };
    }
    groupedBids[recId].bids.push(bid);
  });

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
            <h2 className="card-title text-center block text-2xl mb-1">Manager Approvals Locked</h2>
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
                {isUnlocking ? <span className="loading loading-spinner loading-sm"></span> : 'Unlock Approvals'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
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
      <div className="bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-base-content flex items-center gap-3">
            <CheckCircle2 className="text-primary" size={32} />
            Manager Approvals & Payments
          </h1>
          <p className="text-base-content/60 mt-1">Review supplier quotes and manage payments for approved Purchase Orders.</p>
        </div>
        <div className="tabs tabs-boxed bg-base-200/50 p-1 font-bold">
          <a className={`tab ${activeTab === 'pending' ? 'tab-active bg-primary text-white' : ''}`} onClick={() => setActiveTab('pending')}>Pending Approvals</a>
          <a className={`tab ${activeTab === 'unpaid' ? 'tab-active bg-primary text-white' : ''}`} onClick={() => setActiveTab('unpaid')}>Not Paid</a>
          <a className={`tab ${activeTab === 'paid' ? 'tab-active bg-primary text-white' : ''}`} onClick={() => setActiveTab('paid')}>Paid</a>
        </div>
      </div>

      {activeTab === 'pending' && (
        <>
          {Object.keys(groupedBids).length === 0 ? (
            <div className="hero bg-base-200/50 rounded-2xl py-20 border border-base-200 border-dashed">
              <div className="hero-content text-center">
                <div className="max-w-md">
                  <ShieldCheck className="mx-auto text-success/20 mb-4" size={64} />
                  <h1 className="text-2xl font-bold">All Caught Up!</h1>
                  <p className="py-4 text-base-content/60">There are no pending supplier bids awaiting your approval.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedBids).map(([recId, group]) => (
                <div key={recId} className="bg-base-100 rounded-2xl shadow-sm border border-base-200 overflow-hidden">
              <div className="bg-base-200/50 p-4 border-b border-base-200 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-warning text-xs font-bold uppercase tracking-wider">Restock Request</span>
                    <span className="text-xs font-mono text-base-content/50">ID: {recId.split('-')[0]}</span>
                  </div>
                  <h3 className="text-xl font-bold mt-1">
                    {group.recommendation?.good?.name || group.recommendation?.good?.subCategory?.name || 'Unknown Product'}
                  </h3>
                  <p className="text-sm text-base-content/70 mt-0.5">
                    <AlertCircle className="inline w-4 h-4 mr-1 text-warning" />
                    {group.recommendation?.reason}
                  </p>
                </div>
              </div>

              <div className="p-0 overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr className="bg-base-100">
                      <th>Supplier</th>
                      <th>Quoted Total</th>
                      <th>Est. Delivery</th>
                      <th>Reliability Score</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.bids.map(bid => (
                      <tr key={bid.id} className={`hover ${bid.isRecommended ? 'bg-primary/5' : ''}`}>
                        <td>
                          <div className="font-bold flex items-center gap-2">
                            {bid.supplier?.name}
                            {bid.isRecommended && (
                              <span className="badge badge-xs badge-primary animate-pulse" title={bid.recommendationReason}>
                                <Sparkles size={10} className="mr-1" /> AI Recommended
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-base-content/50">{bid.supplier?.email}</div>
                        </td>
                        <td className="font-mono font-bold text-primary">
                          KSh {parseFloat(bid.bidPrice).toLocaleString()}
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <Truck size={14} className="text-base-content/40" />
                            {bid.deliveryTimeDays} Days
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <progress 
                              className={`progress w-16 ${Number(bid.reliabilityScore) > 4 ? 'progress-success' : 'progress-warning'}`} 
                              value={bid.reliabilityScore} 
                              max="5"
                            ></progress>
                            <span className="text-xs font-bold">{bid.reliabilityScore}/5</span>
                          </div>
                        </td>
                        <td className="flex justify-end items-center gap-2">
                          <div className="flex flex-col gap-1 items-end max-w-xs">
                            <select 
                              className="select select-sm select-bordered w-full"
                              value={selectedPaymentMethod[bid.id] || 'mpesa'}
                              onChange={e => setSelectedPaymentMethod({...selectedPaymentMethod, [bid.id]: e.target.value})}
                            >
                              <option value="mpesa">M-Pesa</option>
                              <option value="card">Card</option>
                            </select>
                            <span className="text-[10px] uppercase font-bold text-base-content/50">Terms: Net 30 Days</span>
                          </div>
                          <button 
                            className="btn btn-sm btn-ghost text-error"
                            onClick={() => {
                              if(confirm('Reject this bid?')) rejectMutation.mutate(bid.id);
                            }}
                            disabled={rejectMutation.isPending || approveMutation.isPending}
                          >
                            <XCircle size={16} /> Reject
                          </button>
                          <button 
                            className="btn btn-sm btn-success text-white font-bold shadow-sm"
                            onClick={() => {
                              const pMethod = selectedPaymentMethod[bid.id] || 'mpesa';
                              if(confirm(`Approve this bid for KSh ${bid.bidPrice} via ${pMethod.toUpperCase()}? (Payment Due: Net 30 Days). This will generate a Purchase Order.`)) {
                                approveMutation.mutate({ bidId: bid.id, paymentMethod: pMethod });
                              }
                            }}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                          >
                            <CheckCircle2 size={16} /> Approve & Generate PO
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
              ))}
            </div>
          )}
        </>
      )}

      {(activeTab === 'unpaid' || activeTab === 'paid') && (
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 overflow-hidden">
          <div className="bg-base-200/50 p-4 border-b border-base-200">
            <h2 className="text-xl font-bold">{activeTab === 'unpaid' ? 'Unpaid Orders' : 'Paid Orders'}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Supplier</th>
                  <th>Total Amount</th>
                  <th>Payment Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === 'unpaid' ? unpaidPurchases : paidPurchases).length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-base-content/50">No {activeTab} orders found.</td></tr>
                )}
                {(activeTab === 'unpaid' ? unpaidPurchases : paidPurchases).map((order: any) => (
                  <tr 
                    key={order.id} 
                    className={`hover ${activeTab === 'unpaid' ? 'cursor-pointer hover:bg-base-200 transition-colors' : ''}`}
                    onClick={() => {
                      if (activeTab === 'unpaid') setPaymentModalOrderId(order.id);
                    }}
                  >
                    <td className="font-mono text-xs">{order.id.split('-')[0]}</td>
                    <td>
                      <div className="font-bold">{order.supplier?.name}</div>
                      <div className="text-xs text-base-content/50">{order.supplier?.email}</div>
                    </td>
                    <td className="font-bold text-primary">KSh {parseFloat(order.totalAmount).toLocaleString()}</td>
                    <td>
                      <div className="uppercase font-medium text-xs text-base-content/70">{order.paymentMethod || 'card'}</div>
                      {order.paymentDueDate && <div className="text-[10px] text-base-content/50 mt-1">Due: {new Date(order.paymentDueDate).toLocaleDateString()}</div>}
                    </td>
                    <td>
                      <div className={`badge ${order.isPaid ? 'badge-success' : 'badge-warning'} font-bold`}>
                        {order.isPaid ? 'Paid' : 'Unpaid'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Choose Payment Method Modal */}
      {paymentModalOrderId && (() => {
        const selectedOrder = unpaidPurchases.find((p: any) => p.id === paymentModalOrderId);
        const supplier = selectedOrder?.supplier;
        const prefMode = supplier?.paymentMode || 'Not Set';
        const mpesaDetails = supplier?.mpesaDetails || 'No details provided';
        const cardDetails = supplier?.cardDetails || 'No details provided';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-300/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-base-100 p-8 rounded-3xl shadow-2xl flex flex-col max-w-sm w-full mx-4 border border-base-200">
              <h3 className="text-2xl font-black mb-2">Process Payment</h3>
              <p className="text-base-content/70 mb-4">Select payment method for this order:</p>

              <div className="bg-base-200 p-4 rounded-xl mb-6 border border-base-300">
                <div className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">Supplier Preferences</div>
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-base-content/70">Preferred Mode:</span>
                    <span className="font-bold uppercase text-primary">{prefMode}</span>
                  </div>
                  {prefMode === 'mpesa' && (
                    <div className="flex flex-col mt-2">
                      <span className="text-base-content/70 text-xs">M-Pesa Till/Paybill:</span>
                      <span className="font-mono font-bold bg-base-100 p-2 rounded mt-1 border border-base-300">{mpesaDetails}</span>
                    </div>
                  )}
                  {prefMode === 'card' && (
                    <div className="flex flex-col mt-2">
                      <span className="text-base-content/70 text-xs">Card/Bank Details:</span>
                      <span className="font-mono font-bold bg-base-100 p-2 rounded mt-1 border border-base-300 break-all">{cardDetails}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <button 
                  className={`btn btn-lg flex justify-between items-center ${prefMode === 'mpesa' ? 'btn-success' : 'btn-outline'}`}
                  onClick={() => handleMpesaPay(paymentModalOrderId)}
                  disabled={markPaidMutation.isPending}
                >
                  <span>M-Pesa</span>
                  <div className={`w-8 h-8 rounded-full ${prefMode === 'mpesa' ? 'bg-white/20' : 'bg-base-200'} flex items-center justify-center`}>
                    <CheckCircle2 size={18} className={prefMode === 'mpesa' ? 'text-white' : ''} />
                  </div>
                </button>

                <button 
                  className={`btn btn-lg flex justify-between items-center ${prefMode === 'card' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => handleTapToPay(paymentModalOrderId)}
                  disabled={markPaidMutation.isPending}
                >
                  <span>Card (Tap to Pay)</span>
                  <CreditCard size={20} />
                </button>
              </div>

              <button 
                className="btn btn-ghost mt-6 w-full"
                onClick={() => setPaymentModalOrderId(null)}
                disabled={markPaidMutation.isPending}
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}

      {/* Tap to Pay Modal Overlay */}
      {tapToPayOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-300/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-base-100 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 border border-base-200">
            <h3 className="text-2xl font-black mb-6">Tap to Pay</h3>
            
            <div 
              className={`relative w-40 h-40 flex items-center justify-center mb-6 transition-transform ${tapStatus === 'waiting' ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}`}
              onClick={handleSimulateTap}
            >
              {tapStatus === 'waiting' && (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping"></div>
                  <div className="absolute inset-4 rounded-full border-4 border-primary/40 animate-pulse bg-primary/5"></div>
                  <Wifi size={64} className="text-primary animate-pulse" />
                  <div className="absolute -bottom-8 text-xs font-bold text-primary animate-bounce">Click here to tap card</div>
                </>
              )}
              {tapStatus === 'processing' && (
                <div className="flex flex-col items-center">
                  <span className="loading loading-spinner loading-lg text-primary mb-2"></span>
                  <span className="font-bold text-base-content/70">Processing...</span>
                </div>
              )}
              {tapStatus === 'success' && (
                <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center animate-in zoom-in">
                  <CheckCircle2 size={48} className="text-success" />
                </div>
              )}
            </div>

            <p className="text-center font-medium text-lg">
              {tapStatus === 'waiting' && "Please tap card on the device reader"}
              {tapStatus === 'processing' && "Authorizing payment..."}
              {tapStatus === 'success' && "Payment Successful!"}
            </p>

            {tapStatus === 'waiting' && (
              <button 
                className="btn btn-ghost mt-8 w-full"
                onClick={() => setTapToPayOrderId(null)}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerApprovals;
