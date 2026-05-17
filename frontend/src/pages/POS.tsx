import { ShoppingCart, Search, Plus, Minus, Trash2 } from 'lucide-react';

const POS = () => {
  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
      {/* Left side - Product Selection */}
      <div className="flex-1 flex flex-col bg-base-100 shadow-sm rounded-2xl border border-base-200 overflow-hidden">
        <div className="p-4 border-b border-base-200">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" size={20} />
              <input 
                type="text" 
                placeholder="Scan barcode or search products..." 
                className="input input-bordered w-full pl-10" 
              />
            </div>
            <button className="btn btn-primary">Scan</button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 bg-base-200/30">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
              <div key={item} className="card bg-base-100 shadow-sm border border-base-200 cursor-pointer hover:border-primary transition-colors">
                <figure className="px-4 pt-4">
                  <div className="w-full h-32 bg-base-200 rounded-xl flex items-center justify-center">
                    <span className="text-base-content/30 text-xs">Image</span>
                  </div>
                </figure>
                <div className="card-body p-4">
                  <h2 className="card-title text-sm">Product Item {item}</h2>
                  <p className="text-primary font-bold">$24.00</p>
                  <div className="card-actions justify-end mt-2">
                    <span className="text-xs text-base-content/60">{10} in stock</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Cart */}
      <div className="w-full lg:w-96 flex flex-col bg-base-100 shadow-sm rounded-2xl border border-base-200 overflow-hidden">
        <div className="p-4 border-b border-base-200 bg-primary text-primary-content">
          <h2 className="font-bold flex items-center gap-2">
            <ShoppingCart size={20} />
            Current Sale
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Cart Items Placeholder */}
            <div className="flex items-center gap-3 p-3 bg-base-200/50 rounded-xl">
              <div className="flex-1">
                <h4 className="font-semibold text-sm">Product Item 1</h4>
                <p className="text-xs text-base-content/70">$24.00 / each</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn btn-xs btn-square btn-ghost"><Minus size={14} /></button>
                <span className="text-sm font-medium w-4 text-center">1</span>
                <button className="btn btn-xs btn-square btn-ghost"><Plus size={14} /></button>
              </div>
              <div className="font-bold text-sm w-16 text-right">$24.00</div>
              <button className="btn btn-xs btn-square btn-ghost text-error"><Trash2 size={16} /></button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-base-200 bg-base-200/30">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-base-content/70">Subtotal</span>
              <span className="font-medium">$24.00</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-base-content/70">Tax (16%)</span>
              <span className="font-medium">$3.84</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-base-300">
              <span>Total</span>
              <span className="text-primary">$27.84</span>
            </div>
          </div>
          <button className="btn btn-primary w-full btn-lg">Process Payment</button>
        </div>
      </div>
    </div>
  );
};

export default POS;
