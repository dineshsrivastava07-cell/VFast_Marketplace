import React, { useEffect, useState } from "react";
import api from "../../lib/api";

export default function AdminProducts() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/admin/products").then(r => setItems(r.data)); }, []);
  return (
    <div data-testid="admin-products-page">
      <h1 className="font-display text-2xl font-bold mb-4">Catalog</h1>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500"><tr><th className="py-2 px-3">Product</th><th className="py-2 px-3">Pack</th><th className="py-2 px-3">Price</th><th className="py-2 px-3">MRP</th><th className="py-2 px-3">Stock</th><th className="py-2 px-3">ETA</th></tr></thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="py-2 px-3 flex items-center gap-2"><img src={p.image} alt={p.name} className="h-8 w-8 rounded-md object-cover" /><span className="font-semibold">{p.name}</span></td>
                <td className="py-2 px-3">{p.pack_size}</td>
                <td className="py-2 px-3 font-bold">₹{p.price}</td>
                <td className="py-2 px-3 text-gray-500">₹{p.mrp}</td>
                <td className="py-2 px-3">{p.stock}</td>
                <td className="py-2 px-3">{p.eta_minutes} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
