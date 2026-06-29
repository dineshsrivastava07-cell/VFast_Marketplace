import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function SellerProducts() {
  const [list, setList] = useState([]);
  const [cats, setCats] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ slug: "", name: "", brand: "", category_slug: "", subcategory_slug: "", price: "", mrp: "", pack_size: "", veg_type: "veg", stock: 50, eta_minutes: 12, image: "", description: "" });

  const load = () => api.get("/seller/products").then((r) => setList(r.data));
  useEffect(() => {
    load();
    api.get("/catalog/categories").then((r) => setCats(r.data));
  }, []);

  const tops = cats.filter((c) => !c.parent_id);
  const subs = cats.filter((c) => c.parent_id);

  const submit = async () => {
    try {
      await api.post("/admin/catalog/products", {
        ...form, price: parseFloat(form.price), mrp: parseFloat(form.mrp || form.price),
        stock: parseInt(form.stock) || 0, eta_minutes: parseInt(form.eta_minutes) || 12,
      });
      toast.success("Product added"); setShowForm(false); load();
      setForm({ slug: "", name: "", brand: "", category_slug: "", subcategory_slug: "", price: "", mrp: "", pack_size: "", veg_type: "veg", stock: 50, eta_minutes: 12, image: "", description: "" });
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const updateStock = async (prod, stock) => {
    try { await api.patch(`/admin/catalog/products/${prod.id}`, { stock }); toast.success("Stock updated"); load(); }
    catch { toast.error("Failed"); }
  };

  return (
    <div data-testid="seller-products">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl font-bold">My products ({list.length})</h1>
        <button data-testid="add-product-btn" onClick={() => setShowForm((s) => !s)} className="btn-primary py-2 px-3 text-sm flex items-center gap-1"><Plus className="h-4 w-4" />Add product</button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4" data-testid="seller-product-form">
          <div className="grid sm:grid-cols-3 gap-2 text-sm">
            <input data-testid="prod-slug" placeholder="Slug (unique, e.g. my-rice-1kg)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} className="px-3 py-2 rounded-lg border border-gray-200" />
            <input data-testid="prod-name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
            <input data-testid="prod-brand" placeholder="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
            <select data-testid="prod-cat" value={form.category_slug} onChange={(e) => setForm({ ...form, category_slug: e.target.value, subcategory_slug: "" })} className="px-3 py-2 rounded-lg border border-gray-200">
              <option value="">Category…</option>
              {tops.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
            <select data-testid="prod-sub" value={form.subcategory_slug} onChange={(e) => setForm({ ...form, subcategory_slug: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200">
              <option value="">Subcategory (optional)</option>
              {subs.filter((s) => tops.find((t) => t.slug === form.category_slug)?.id === s.parent_id).map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
            </select>
            <select data-testid="prod-veg" value={form.veg_type} onChange={(e) => setForm({ ...form, veg_type: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200">
              <option value="veg">Veg</option><option value="nonveg">Non-veg</option><option value="vegan">Vegan</option><option value="na">N/A</option>
            </select>
            <input data-testid="prod-price" type="number" placeholder="Price ₹" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
            <input data-testid="prod-mrp" type="number" placeholder="MRP ₹" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
            <input data-testid="prod-pack" placeholder="Pack size (e.g. 1 L)" value={form.pack_size} onChange={(e) => setForm({ ...form, pack_size: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
            <input data-testid="prod-stock" type="number" placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
            <input data-testid="prod-image" placeholder="Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 sm:col-span-2" />
            <textarea rows={2} data-testid="prod-desc" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 sm:col-span-3" />
          </div>
          <button data-testid="save-seller-product" onClick={submit} className="mt-3 btn-primary py-2 px-4 text-sm">Save product</button>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 bg-gray-50"><tr><th className="py-2 px-3">Product</th><th>Brand</th><th>Pack</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-gray-50" data-testid={`my-product-${p.slug}`}>
                <td className="py-2 px-3 flex items-center gap-2"><img src={p.image} alt="" className="h-8 w-8 rounded object-cover" />{p.name}</td>
                <td className="text-xs">{p.brand}</td>
                <td className="text-xs">{p.pack_size}</td>
                <td>₹{p.price}</td>
                <td>
                  <input type="number" defaultValue={p.stock} className="w-16 px-2 py-1 rounded border border-gray-200 text-sm"
                    onBlur={(e) => { const v = parseInt(e.target.value); if (v !== p.stock) updateStock(p, v); }} />
                </td>
                <td>{p.in_stock ? <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">In stock</span> : <span className="text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-700">Out</span>}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6} className="py-4 px-3 text-center text-gray-400 text-xs">No products yet. Click "Add product" to list your first SKU.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
