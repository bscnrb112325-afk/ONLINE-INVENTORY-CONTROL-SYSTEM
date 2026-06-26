import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { CheckCircle2, XCircle, Clock, Truck, ShieldCheck, AlertCircle, Sparkles, Lock, Eye, EyeOff } from 'lucide-react';
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
    mutationFn: async (bidId: string) => {
      // In a real app we'd pass the actual manager's userId from auth context
      const res = await api.put(`/approvals/bids/${bidId}/approve`, { userId: null });
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
      <div className="h-[80vh] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 px-4">
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
      <div className="bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200">
        <h1 className="text-3xl font-black text-base-content flex items-center gap-3">
          <CheckCircle2 className="text-primary" size={32} />
          Manager Approvals
        </h1>
        <p className="text-base-content/60 mt-1">Review supplier quotes for restock recommendations and approve Purchase Orders.</p>
      </div>

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
                        <td className="text-right space-x-2">
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
                              if(confirm(`Approve this bid for KSh ${bid.bidPrice}? This will generate a Purchase Order.`)) {
                                approveMutation.mutate(bid.id);
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
    </div>
  );
};

export default ManagerApprovals;
