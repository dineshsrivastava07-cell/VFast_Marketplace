import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";

const VEG_TYPES = ["veg", "vegan", "nonveg", "na"];
const STORAGES = ["ambient", "refrigerated", "frozen"];

export default function AdminCatalog() {
  const [tab, setTab] = useState("products");
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [csv, setCsv] = useState(null);

  const refresh = async () => {
    const [c, p] = await Promise.all([
      api.get("/catalog/categories"),
      api.get("/admin/products"),
    ]);
    setCategories(c.data);
    setProducts(p.data);
  };
  useEffect(() => { refresh(); }, []);

  const allCats = async () => {
    const top = await api.get("/catalog/categories");
    const all = [...top.data];
    for (const t of top.data) {
      const subs = await api.get(`/catalog/categories?parent=${t.slug}`);
      all.push(...subs.data);
    }
    return all;
  };

  const [catTree, setCatTree] = useState([]);
  useEffect(() => { allCats().then(setCatTree); }, []);

  const saveProduct = async (p) => {
    try {
      if (p._isNew) {
        await api.post("/catalog/products", p);
        toast.success("Product created");
      } else {
        await api.patch(`/catalog/products/${p.id}`, p);
        toast.success("Product updated");
      }
      setEditing(null); setCreating(false); refresh();
    } catch (e) { toast.error(e.response?.data?.detail || "Save failed"); }
  };
  const deleteProduct = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    await api.delete(`/catalog/products/${id}`);
    toast.success("Deleted"); refresh();
  };

  const importCsv = async () => {
    if (!csv) return;
    const fd = new FormData(); fd.append("file", csv);
    const r = await api.post("/catalog/products/import-csv", fd, { headers: { "Content-Type": "multipart/form-data" }});
    toast.success(`Imported ${r.data.created} (skipped ${r.data.skipped})`);
    setCsv(null); refresh();
  };

  return (
    <div className="space-y-4" data-testid="admin-catalog-page">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Catalog & inventory</h1>
        <div className="flex gap-2">
          <button data-testid="cat-tab-products" onClick={() => setTab("products")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab==="products"?"bg-[#E4002B] text-white":"bg-white border border-gray-200"}`}>Products</button>
          <button data-testid="cat-tab-categories" onClick={() => setTab("categories")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab==="categories"?"bg-[#E4002B] text-white":"bg-white border border-gray-200"}`}>Categories</button>
          <button data-testid="cat-tab-import" onClick={() => setTab("import")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab==="import"?"bg-[#E4002B] text-white":"bg-white border border-gray-200"}`}>CSV import</button>
        </div>
      </div>

      {tab === "products" && (
        <>
          <div className="flex justify-end"><button data-testid="add-product-btn" onClick={() => { setEditing({ _isNew: true, slug: "", name: "", brand: "", category_slug: "", subcategory_slug: "", image: "", price: 0, mrp: 0, pack_size: "", unit: "g", unit_value: 0, veg_type: "veg", stock: 0, reorder_level: 5, eta_minutes: 12, storage: "ambient", country_of_origin: "India" }); setCreating(true); }} className="btn-primary px-3 py-2 text-sm">+ Add product</button></div>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-500"><tr>
                <th className="py-2 px-3">Product</th><th className="py-2 px-3">Brand</th><th className="py-2 px-3">Pack</th><th className="py-2 px-3">Price/MRP</th><th className="py-2 px-3">Stock</th><th className="py-2 px-3">Reorder</th><th className="py-2 px-3">Veg</th><th className="py-2 px-3"></th>
              </tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="py-2 px-3 flex items-center gap-2"><img src={p.image} className="h-8 w-8 rounded-md object-cover" alt="" /><span className="font-semibold">{p.name}</span></td>
                    <td className="py-2 px-3">{p.brand}</td>
                    <td className="py-2 px-3">{p.pack_size}</td>
                    <td className="py-2 px-3">₹{p.price} / <span className="text-gray-400">₹{p.mrp}</span></td>
                    <td className="py-2 px-3">{p.stock}</td>
                    <td className="py-2 px-3 text-xs">{p.reorder_level}</td>
                    <td className="py-2 px-3 text-xs uppercase">{p.veg_type}</td>
                    <td className="py-2 px-3 flex gap-1"><button data-testid={`edit-${p.slug}`} onClick={() => setEditing({ ...p, category_slug: catTree.find(c => c.id === p.category_id)?.slug, subcategory_slug: catTree.find(c => c.id === p.subcategory_id)?.slug })} className="text-xs text-blue-600 font-semibold">Edit</button><button data-testid={`del-prod-${p.slug}`} onClick={() => deleteProduct(p.id)} className="text-xs text-red-600 font-semibold">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "categories" && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <h3 className="font-display font-bold mb-3">Categories ({catTree.length})</h3>
          <div className="space-y-1 text-sm">
            {catTree.map(c => (
              <div key={c.id} className={`flex items-center justify-between py-1 ${c.parent_id ? "pl-6 text-gray-700" : "font-semibold"}`}>
                <span>{c.parent_id ? "↳ " : ""}{c.name} <span className="text-[10px] text-gray-400">/{c.slug}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "import" && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 max-w-xl space-y-3">
          <div className="font-display font-bold">Bulk import products via CSV</div>
          <div className="text-xs text-gray-500">CSV columns: <code>slug,name,brand,category_slug,subcategory_slug,price,mrp,pack_size,unit_value,unit,veg_type,stock,reorder_level,eta_minutes,image,hsn_code,fssai_no</code></div>
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
            <b>category_slug</b> must match an existing top-level category slug — one of: <code>food-beverages</code>, <code>staples</code>, <code>personal-care</code>, <code>home-care</code>, <code>health-wellness</code>, <code>household-gm</code>.
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <button data-testid="csv-template-btn" onClick={() => {
              const headers = "slug,name,brand,category_slug,subcategory_slug,price,mrp,pack_size,unit_value,unit,veg_type,stock,reorder_level,eta_minutes,image,hsn_code,fssai_no";
              const rows = [
                "sample-product-1,Sample Atta 1kg,Aashirvaad,staples,atta-flour,75,90,1 kg,1,kg,veg,100,10,12,https://images.pexels.com/photos/4198015/pexels-photo-4198015.jpeg,1101,10013011000567",
                "sample-product-2,Sample Milk 500ml,Amul,food-beverages,dairy-eggs,35,40,500 ml,500,ml,veg,50,5,10,https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg,0401,10012011000123",
              ];
              const csvBody = [headers, ...rows].join("\n");
              const blob = new Blob([csvBody], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "vfast-products-template.csv"; a.click();
              URL.revokeObjectURL(url);
            }} className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm">Download CSV template</button>
          </div>
          <input data-testid="csv-file" type="file" accept=".csv" onChange={(e) => setCsv(e.target.files?.[0])} />
          <button data-testid="csv-import-btn" onClick={importCsv} className="btn-primary px-3 py-2 text-sm">Import</button>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => { setEditing(null); setCreating(false); }}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="product-form">
            <h3 className="font-display font-bold text-lg mb-3">{creating ? "Add" : "Edit"} product</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <input placeholder="slug (kebab-case)" value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" data-testid="pf-slug" />
              <input placeholder="Name" value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" data-testid="pf-name" />
              <input placeholder="Brand" value={editing.brand || ""} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" data-testid="pf-brand" />
              <select value={editing.category_slug || ""} onChange={(e) => setEditing({ ...editing, category_slug: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" data-testid="pf-cat">
                <option value="">Top category</option>
                {catTree.filter(c => !c.parent_id).map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
              <select value={editing.subcategory_slug || ""} onChange={(e) => setEditing({ ...editing, subcategory_slug: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" data-testid="pf-subcat">
                <option value="">Subcategory (optional)</option>
                {catTree.filter(c => c.parent_id && categories.find(t => t.id === c.parent_id)?.slug === editing.category_slug).map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
              <input placeholder="Image URL" value={editing.image || ""} onChange={(e) => setEditing({ ...editing, image: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200 col-span-2" data-testid="pf-image" />
              <input type="number" placeholder="Price" value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} className="px-3 py-2 rounded-xl border border-gray-200" data-testid="pf-price" />
              <input type="number" placeholder="MRP" value={editing.mrp ?? ""} onChange={(e) => setEditing({ ...editing, mrp: parseFloat(e.target.value) || 0 })} className="px-3 py-2 rounded-xl border border-gray-200" data-testid="pf-mrp" />
              <input placeholder="Pack size (e.g. 500 g)" value={editing.pack_size || ""} onChange={(e) => setEditing({ ...editing, pack_size: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <select value={editing.unit || "g"} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200">
                {["g", "ml", "kg", "L", "pc"].map(u => <option key={u}>{u}</option>)}
              </select>
              <input type="number" placeholder="Unit value" value={editing.unit_value ?? ""} onChange={(e) => setEditing({ ...editing, unit_value: parseFloat(e.target.value) || 0 })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <select value={editing.veg_type || "na"} onChange={(e) => setEditing({ ...editing, veg_type: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" data-testid="pf-veg">
                {VEG_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <input type="number" placeholder="Stock" value={editing.stock ?? ""} onChange={(e) => setEditing({ ...editing, stock: parseInt(e.target.value) || 0 })} className="px-3 py-2 rounded-xl border border-gray-200" data-testid="pf-stock" />
              <input type="number" placeholder="Reorder level" value={editing.reorder_level ?? ""} onChange={(e) => setEditing({ ...editing, reorder_level: parseInt(e.target.value) || 0 })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <input type="number" placeholder="ETA (min)" value={editing.eta_minutes ?? ""} onChange={(e) => setEditing({ ...editing, eta_minutes: parseInt(e.target.value) || 12 })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <input placeholder="HSN code" value={editing.hsn_code || ""} onChange={(e) => setEditing({ ...editing, hsn_code: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <input placeholder="FSSAI no." value={editing.fssai_no || ""} onChange={(e) => setEditing({ ...editing, fssai_no: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <select value={editing.storage || "ambient"} onChange={(e) => setEditing({ ...editing, storage: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200">
                {STORAGES.map(s => <option key={s}>{s}</option>)}
              </select>
              <input placeholder="Country of origin" value={editing.country_of_origin || "India"} onChange={(e) => setEditing({ ...editing, country_of_origin: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <input placeholder="Shelf life (days)" type="number" value={editing.shelf_life_days || ""} onChange={(e) => setEditing({ ...editing, shelf_life_days: parseInt(e.target.value) || null })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <input placeholder="Allergens (comma-separated)" value={(editing.allergens || []).join(",")} onChange={(e) => setEditing({ ...editing, allergens: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} className="px-3 py-2 rounded-xl border border-gray-200 col-span-2" />
              <textarea placeholder="Description" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200 col-span-2" rows={3} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setEditing(null); setCreating(false); }} className="px-4 py-2 rounded-xl border border-gray-200 text-sm">Cancel</button>
              <button data-testid="pf-save" onClick={() => saveProduct(editing)} className="btn-primary px-4 py-2 text-sm">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
