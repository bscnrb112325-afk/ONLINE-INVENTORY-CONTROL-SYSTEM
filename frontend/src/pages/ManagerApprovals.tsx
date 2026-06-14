import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { CheckCircle2, XCircle, Clock, Truck, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';

const ManagerApprovals = () => {
  const queryClient = useQueryClient();

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
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
