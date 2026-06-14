import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Brain, Sparkles, TrendingUp, AlertTriangle, Check, X, ShieldAlert, BadgeDollarSign, HelpCircle, Clock, Star, ChevronRight } from 'lucide-react';

const AIInsightsPage = () => {
  const queryClient = useQueryClient();
  const [selectedRec, setSelectedRec] = useState<any | null>(null);

  // Fetch pending recommendations
  const { data: recommendations = [], isLoading: recsLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const res = await api.get('/ai/recommendations');
      return res.data;
    },
  });

  // Fetch all AI insights
  const { data: insights = [], isLoading: insightsLoading } = useQuery({
    queryKey: ['insights'],
    queryFn: async () => {
      const res = await api.get('/ai/insights');
      return res.data;
    },
  });

  // Fetch supplier bids for selected recommendation
  const { data: bidsData = null, isLoading: bidsLoading } = useQuery({
    queryKey: ['bids', selectedRec?.id],
    queryFn: async () => {
      if (!selectedRec) return null;
      const res = await api.get(`/ai/bids/${selectedRec.id}`);
      return res.data; // { bids, aiSuggestion }
    },
    enabled: !!selectedRec,
  });

  // Mutator to approve recommendation (general actions e.g. price adjustment)
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/ai/recommendations/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['goods'] });
    },
  });

  // Mutator to approve supplier bid
  const approveBidMutation = useMutation({
    mutationFn: async (bidId: string) => {
      await api.post(`/ai/bids/${bidId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['goods'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setSelectedRec(null);
    },
  });

  // Mutator to dismiss recommendation
  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/ai/recommendations/${id}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  if (recsLoading || insightsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  // Group recommendations
  const restockRecs = recommendations.filter((r: any) => r.action === 'restock');
  const priceRecs = recommendations.filter((r: any) => r.action === 'price_adjust');

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-base-content flex items-center gap-2">
            <Brain className="text-primary animate-pulse" size={32} />
            <span>AI Restocking & Insights</span>
          </h2>
          <p className="text-base-content/70 mt-1">
            Real-time supply chain forecasting, automated procurement, and algorithmic dynamic pricing.
          </p>
        </div>
        <div className="badge badge-primary badge-lg gap-2 py-4 px-6 rounded-xl font-bold shadow-md">
          <Sparkles size={16} />
          Autonomous Engine: Active
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-6">
          <div className="flex justify-between items-start">
            <span className="text-base-content/70 text-sm font-semibold">Procurement Alerts</span>
            <AlertTriangle className="text-warning" size={24} />
          </div>
          <div className="text-3xl font-bold mt-2">{restockRecs.length}</div>
          <div className="text-xs text-base-content/50 mt-1 font-medium">Reorder quantities proposed</div>
        </div>

        <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-6">
          <div className="flex justify-between items-start">
            <span className="text-base-content/70 text-sm font-semibold">Pricing Suggestions</span>
            <BadgeDollarSign className="text-success" size={24} />
          </div>
          <div className="text-3xl font-bold mt-2">{priceRecs.length}</div>
          <div className="text-xs text-base-content/50 mt-1 font-medium">Margin-boosting updates</div>
        </div>

        <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-6">
          <div className="flex justify-between items-start">
            <span className="text-base-content/70 text-sm font-semibold">Model Confidence</span>
            <TrendingUp className="text-primary" size={24} />
          </div>
          <div className="text-3xl font-bold mt-2">93.4%</div>
          <div className="text-xs text-base-content/50 mt-1 font-medium">Average predictive certainty</div>
        </div>

        <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-6">
          <div className="flex justify-between items-start">
            <span className="text-base-content/70 text-sm font-semibold">Total Insights Logged</span>
            <Brain className="text-indigo-400" size={24} />
          </div>
          <div className="text-3xl font-bold mt-2">{insights.length}</div>
          <div className="text-xs text-base-content/50 mt-1 font-medium">Analysis runs completed</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Restocking Procurement Recommendations */}
        <div className="bg-base-100 shadow-md border border-base-200 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2 text-warning">
            <ShieldAlert size={20} />
            <span>AI Restocking & Procurement ({restockRecs.length})</span>
          </h3>
          <p className="text-xs text-base-content/60">
            Automate inventory replenishment. Approving a recommendation notifies the supplier, logs a purchase invoice, and increments stock automatically.
          </p>

          {restockRecs.length === 0 ? (
            <div className="p-8 text-center text-base-content/50 bg-base-200/30 rounded-xl">
              All stock levels are optimal. No restocks recommended.
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {restockRecs.map((rec: any) => (
                <div key={rec.id} className="p-4 rounded-xl border border-base-200 bg-base-200/20 shadow-sm flex justify-between items-center gap-4 hover:border-warning/50 transition-colors">
                  <div className="space-y-1">
                    <div className="font-semibold text-sm">
                      {rec.good?.subCategory?.name}
                    </div>
                    <div className="font-mono text-xs text-base-content/60 flex items-center gap-2">
                      <span>SN: {rec.good?.serial}</span>
                      <span>•</span>
                      <span className="text-error font-bold">Qty: {rec.good?.qty} left</span>
                    </div>
                    <div className="text-xs text-base-content/80 italic font-medium pt-1">
                      {rec.reason}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      className="btn btn-sm btn-warning font-bold gap-1 shadow-sm text-xs rounded-xl py-1 px-3"
                      onClick={() => setSelectedRec(rec)}
                    >
                      <span>Review Bids</span>
                      <ChevronRight size={14} />
                    </button>
                    <button
                      className="btn btn-sm btn-circle btn-ghost text-base-content/50"
                      onClick={() => dismissMutation.mutate(rec.id)}
                      disabled={dismissMutation.isPending}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Pricing Recommendations */}
        <div className="bg-base-100 shadow-md border border-base-200 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2 text-success">
            <BadgeDollarSign size={20} />
            <span>Algorithmic Dynamic Pricing ({priceRecs.length})</span>
          </h3>
          <p className="text-xs text-base-content/60">
            Heuristic dynamic pricing suggests adjustments based on real-time scarcity and excess inventory rules.
          </p>

          {priceRecs.length === 0 ? (
            <div className="p-8 text-center text-base-content/50 bg-base-200/30 rounded-xl">
              No price adjustments recommended.
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {priceRecs.map((rec: any) => (
                <div key={rec.id} className="p-4 rounded-xl border border-base-200 bg-base-200/20 shadow-sm flex justify-between items-center gap-4 hover:border-success/50 transition-colors">
                  <div className="space-y-1">
                    <div className="font-semibold text-sm">
                      {rec.good?.subCategory?.name}
                    </div>
                    <div className="font-mono text-xs text-base-content/60 flex items-center gap-2">
                      <span>SN: {rec.good?.serial}</span>
                      <span>•</span>
                      <span className="text-primary font-bold">Current Base Price: KSh {parseFloat(rec.good?.sellRate).toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-base-content/85 italic font-medium pt-1">
                      {rec.reason}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      className="btn btn-sm btn-circle btn-success shadow-sm"
                      onClick={() => approveMutation.mutate(rec.id)}
                      disabled={approveMutation.isPending}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      className="btn btn-sm btn-circle btn-ghost text-base-content/50"
                      onClick={() => dismissMutation.mutate(rec.id)}
                      disabled={dismissMutation.isPending}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Demand Forecasts List */}
      <div className="bg-base-100 shadow-sm border border-base-200 rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Sparkles size={20} className="text-primary" />
          <span>Demand Forecasts & Historical Certainty</span>
        </h3>
        
        {insights.length === 0 ? (
          <div className="p-8 text-center text-base-content/50">
            No forecasts computed yet. Triggers on sales transactions.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="bg-base-200/50">
                  <th>Item Name</th>
                  <th>Serial / Barcode</th>
                  <th>Analysis Type</th>
                  <th>AI Output / Prediction</th>
                  <th>Confidence</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {insights.map((ins: any) => {
                  let parsedPred: any = {};
                  try {
                    parsedPred = JSON.parse(ins.prediction);
                  } catch (e) {
                    parsedPred = { prediction: ins.prediction };
                  }

                  let outputText = '';
                  if (ins.type === 'demand_forecast') {
                    outputText = `Forecasted Next Week Sales: KSh {parsedPred.predictedSalesNextWeek} units`;
                  } else if (ins.type === 'dynamic_pricing') {
                    outputText = `Suggested dynamic price: KSh ${parsedPred.suggestedPrice}`;
                  } else if (ins.type === 'restock') {
                    outputText = `Reorder recommendation of ${parsedPred.recommendedReorderQty} units`;
                  } else {
                    outputText = ins.prediction;
                  }

                  return (
                    <tr key={ins.id} className="hover:bg-base-200/30 transition-colors">
                      <td className="font-semibold">{ins.good?.subCategory?.name || 'Inventory Item'}</td>
                      <td className="font-mono text-xs">{ins.good?.serial}</td>
                      <td>
                        <span className="badge badge-ghost badge-sm font-medium uppercase tracking-wider">
                          {ins.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="text-sm font-medium">{outputText}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <progress className="progress progress-primary w-20" value={parseFloat(ins.confidence) * 100} max="100"></progress>
                          <span className="text-xs font-bold font-mono">{(parseFloat(ins.confidence) * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="text-xs">{new Date(ins.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Supplier Bids Modal */}
      {selectedRec && (
        <div className="modal modal-open animate-in fade-in duration-300">
          <div className="modal-box max-w-3xl bg-base-100 border border-base-200 shadow-2xl rounded-2xl p-6 relative">
            <button 
              className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4"
              onClick={() => setSelectedRec(null)}
            >
              <X size={18} />
            </button>
            
            <h3 className="text-xl font-bold text-base-content flex items-center gap-2 mb-2">
              <Brain className="text-primary animate-pulse" size={24} />
              <span>Supplier Bid Comparison Portal</span>
            </h3>
            
            <div className="mb-4 bg-base-200/40 p-3 rounded-xl border border-base-200/60">
              <p className="text-xs text-base-content/85 font-medium">
                Product: <span className="text-primary font-bold">{selectedRec.good?.subCategory?.name}</span>
              </p>
              <p className="text-xs text-mono text-base-content/60">
                Serial: {selectedRec.good?.serial} • Current Qty: {selectedRec.good?.qty} units
              </p>
            </div>

            {bidsLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <span className="loading loading-spinner loading-md text-primary"></span>
                <span className="text-xs text-base-content/60 font-medium animate-pulse">Requesting supplier bids and running AI ranking...</span>
              </div>
            ) : !bidsData?.bids || bidsData.bids.length === 0 ? (
              <div className="py-12 text-center text-base-content/50 text-sm">
                No active supplier bids found for this recommendation.
              </div>
            ) : (
              <div className="space-y-6">
                {/* AI Advice Summary */}
                {bidsData.aiSuggestion && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3 items-start animate-in slide-in-from-top duration-300">
                    <Sparkles className="text-primary shrink-0 mt-0.5" size={20} />
                    <div>
                      <h4 className="text-sm font-bold text-primary flex items-center gap-1.5">
                        🤖 AI Recommendation Engine Analysis
                      </h4>
                      <p className="text-xs text-base-content/85 mt-1 leading-relaxed">
                        {bidsData.aiSuggestion.reason}
                      </p>
                    </div>
                  </div>
                )}

                {/* Bids List */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {bidsData.bids.map((bid: any) => {
                    const isAiBest = bidsData.aiSuggestion?.best_supplier_bid_id === bid.id;
                    const aiScore = bidsData.aiSuggestion?.scores?.[bid.id] || 0;
                    
                    return (
                      <div 
                        key={bid.id} 
                        className={`border rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all relative ${
                          isAiBest 
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30 shadow-md scale-105' 
                            : 'border-base-200 bg-base-200/20 hover:border-base-300'
                        }`}
                      >
                        {isAiBest && (
                          <span className="absolute -top-3 left-4 badge badge-primary font-bold text-xs gap-1 py-2 px-3 shadow">
                            <Sparkles size={10} /> BEST CHOICE ({aiScore}%)
                          </span>
                        )}
                        
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-bold text-base-content text-sm truncate">{bid.supplier.name}</h4>
                            <p className="text-xxs text-base-content/50 font-mono mt-0.5">{bid.supplier.address}</p>
                          </div>
                          
                          <div className="space-y-1.5 py-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-base-content/60">Bid Price:</span>
                              <span className="font-bold text-base-content font-mono">
                                KSh {parseFloat(bid.bidPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-base-content/60">Delivery:</span>
                              <span className="font-semibold text-warning flex items-center gap-1">
                                <Clock size={12} /> {bid.deliveryTimeDays} {bid.deliveryTimeDays === 1 ? 'day' : 'days'}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-base-content/60">Reliability:</span>
                              <span className="font-bold text-success flex items-center gap-0.5">
                                <Star size={12} className="fill-success" /> {parseFloat(bid.reliabilityScore).toFixed(1)}/5.0
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          className={`btn btn-sm w-full font-bold shadow ${
                            isAiBest ? 'btn-primary' : 'btn-outline'
                          }`}
                          onClick={() => approveBidMutation.mutate(bid.id)}
                          disabled={approveBidMutation.isPending}
                        >
                          {approveBidMutation.isPending ? (
                            <span className="loading loading-spinner loading-xs"></span>
                          ) : (
                            'Approve Bid'
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="modal-action mt-6">
              <button className="btn btn-outline" onClick={() => setSelectedRec(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInsightsPage;
