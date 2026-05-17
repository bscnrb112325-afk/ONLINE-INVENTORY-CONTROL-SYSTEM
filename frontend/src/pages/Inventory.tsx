const Inventory = () => {
  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold">Inventory Management</h2>
          <p className="text-base-content/70 mt-1">Manage your products, categories, and stock levels.</p>
        </div>
        <button className="btn btn-primary">Add New Item</button>
      </div>
      
      <div className="bg-base-100 shadow-sm rounded-2xl border border-base-200 overflow-hidden">
        <div className="p-4 border-b border-base-200 flex gap-4">
           <input type="text" placeholder="Search inventory..." className="input input-bordered w-full max-w-xs" />
           <select className="select select-bordered w-full max-w-xs">
             <option disabled selected>Filter by Category</option>
             <option>Electronics</option>
             <option>Groceries</option>
           </select>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr className="bg-base-200/50">
                <th>Serial / Barcode</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Stock Level</th>
                <th>Buy Rate</th>
                <th>Sell Rate</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((item) => (
                <tr key={item} className="hover:bg-base-200/30 transition-colors">
                  <td className="font-mono text-xs">SN-1029{item}</td>
                  <td className="font-medium">Product Item {item}</td>
                  <td><span className="badge badge-ghost badge-sm">Category</span></td>
                  <td>{100 - item * 5}</td>
                  <td>$12.00</td>
                  <td>$24.00</td>
                  <td><span className="badge badge-success badge-sm">In Stock</span></td>
                  <td>
                    <button className="btn btn-ghost btn-xs">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
