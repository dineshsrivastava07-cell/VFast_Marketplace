import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";
import { AlertTriangle, PackagePlus } from "lucide-react";

export default function AdminInventory() {
  const [items, setItems] = useState([]);
  const [low, setLow] = useState([]);
  const [batches, setBatches] = useState([]);
  const [nearExpiry, setNearExpiry] = useState([]);
  const [batchForm, setBatchForm] = useState({ product_id: "", batch_no: "", qty: 0, expiry_date: "" });
  const [tab, setTab] = useState("inventory");

  const refresh = async () => {
    const [i, l, b] = await Promise.all([
      api.get("/admin/inventory"),
      api.get("/admin/inventory/low-stock"),
      api.get("/admin/inventory/batches"),
    ]);
    setItems(i.data); setLow(l.data); setBatches(b.data.batches); setNearExpiry(b.data.near_expiry);
  };
  useEffect(() => { refresh(); }, []);

  const updateStock = async (id, stock, reorder) => {
    await api.post(`/admin/inventory/${id}`, { stock: parseInt(stock), reorder_level: parseInt(reorder) });
    toast.success("Stock updated");
    refresh();
  };
  const addBatch = async () => {
    if (!batchForm.product_id || !batchForm.batch_no || !batchForm.qty || !batchForm.expiry_date) {
      toast.error("Fill all batch fields"); return;
    }
    await api.post("/admin/inventory/batches", { ...batchForm, qty: parseInt(batchForm.qty) });
    toast.success("Batch added & stock increased");
    setBatchForm({ product_id: "", batch_no: "", qty: 0, expiry_date: "" });
    refresh();
  };

  return (
    <div className="space-y-4" data-testid="admin-inventory-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold">Inventory</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab("inventory")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab==="inventory"?"bg-[#E4002B] text-white":"bg-white border border-gray-200"}`} data-testid="inv-tab-list">Stock list</button>
          <button onClick={() => setTab("low")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab==="low"?"bg-[#E4002B] text-white":"bg-white border border-gray-200"}`} data-testid="inv-tab-low">Low stock ({low.length})</button>
          <button onClick={() => setTab("batches")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab==="batches"?"bg-[#E4002B] text-white":"bg-white border border-gray-200"}`} data-testid="inv-tab-batches">Batches</button>
        </div>
      </div>

      {tab === "inventory" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button data-testid="sync-from-catalog" onClick={async () => {
              try { const r = await api.post("/admin/inventory/sync-from-catalog", {}); toast.success(`Synced ${r.data.synced} SKUs from catalog`); refresh(); }
              catch (e) { toast.error("Failed"); }
            }} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold bg-white">↺ Sync from Catalog</button>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500"><tr>
              <th className="py-2 px-3">Product</th><th className="py-2 px-3">Brand</th><th className="py-2 px-3">Stock</th><th className="py-2 px-3">Reorder</th><th className="py-2 px-3">Save</th>
            </tr></thead>
            <tbody>
              {items.map(p => <StockRow key={p.id} p={p} onSave={updateStock} />)}
            </tbody>
          </table>
        </div></div>
      )}

      {tab === "low" && (
        <div className="space-y-2" data-testid="low-stock-list">
          {low.length === 0 && <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center text-gray-500">No items below reorder level.</div>}
          {low.map(p => (
            <div key={p.id} className="bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-center gap-3" data-testid={`low-stock-${p.id}`}>
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <img src={p.image} className="h-10 w-10 rounded-md object-cover bg-white" alt="" />
              <div className="flex-1">
                <div className="font-semibold text-sm">{p.name}</div>
                <div className="text-xs text-gray-600">{p.brand} · {p.pack_size}</div>
              </div>
              <div className="text-xs"><span className="font-bold text-red-700">{p.stock}</span> / reorder {p.reorder_level}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "batches" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 grid sm:grid-cols-5 gap-2 text-sm">
            <select data-testid="batch-product" value={batchForm.product_id} onChange={(e) => setBatchForm({ ...batchForm, product_id: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200">
              <option value="">Pick product</option>
              {items.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input data-testid="batch-no" placeholder="Batch no." value={batchForm.batch_no} onChange={(e) => setBatchForm({ ...batchForm, batch_no: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
            <input data-testid="batch-qty" type="number" placeholder="Qty received" value={batchForm.qty} onChange={(e) => setBatchForm({ ...batchForm, qty: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
            <input data-testid="batch-expiry" type="date" value={batchForm.expiry_date} onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
            <button data-testid="batch-save" onClick={addBatch} className="btn-primary py-2 inline-flex items-center justify-center gap-1"><PackagePlus className="h-4 w-4" /> Add batch</button>
          </div>

          {nearExpiry.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-sm" data-testid="near-expiry">
              <div className="font-semibold mb-2 flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-amber-600" /> Near expiry ({nearExpiry.length})</div>
              <div className="space-y-1">
                {nearExpiry.map(b => {
                  const prod = items.find(i => i.id === b.product_id);
                  return <div key={b.id} className="flex justify-between text-xs"><span>{prod?.name || b.product_id} · batch {b.batch_no} · qty {b.qty}</span><span className="font-bold text-red-700">exp {b.expiry_date}</span></div>;
                })}
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-500"><tr><th className="py-2 px-3">Product</th><th className="py-2 px-3">Batch</th><th className="py-2 px-3">Qty</th><th className="py-2 px-3">Expiry</th><th className="py-2 px-3">Received</th></tr></thead>
              <tbody>
                {batches.map(b => {
                  const prod = items.find(i => i.id === b.product_id);
                  return <tr key={b.id} className="border-t border-gray-100"><td className="py-2 px-3 font-semibold">{prod?.name || b.product_id}</td><td className="py-2 px-3">{b.batch_no}</td><td className="py-2 px-3">{b.qty}</td><td className="py-2 px-3">{b.expiry_date}</td><td className="py-2 px-3 text-xs text-gray-500">{b.received_at ? new Date(b.received_at).toLocaleDateString("en-IN") : "—"}</td></tr>;
                })}
                {batches.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-gray-500">No batches recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StockRow({ p, onSave }) {
  const [stock, setStock] = useState(p.stock);
  const [reorder, setReorder] = useState(p.reorder_level || 5);
  const low = stock <= reorder;
  return (
    <tr className={`border-t border-gray-100 ${low ? "bg-amber-50/40" : ""}`} data-testid={`inv-row-${p.id}`}>
      <td className="py-2 px-3 font-semibold">{p.name}</td>
      <td className="py-2 px-3">{p.brand}</td>
      <td className="py-2 px-3"><input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="w-20 px-2 py-1 rounded-md border border-gray-200" /></td>
      <td className="py-2 px-3"><input type="number" value={reorder} onChange={(e) => setReorder(e.target.value)} className="w-20 px-2 py-1 rounded-md border border-gray-200" /></td>
      <td className="py-2 px-3"><button data-testid={`inv-save-${p.id}`} onClick={() => onSave(p.id, stock, reorder)} className="text-xs btn-primary px-2 py-1">Save</button></td>
    </tr>
  );
}
