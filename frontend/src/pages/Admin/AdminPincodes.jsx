import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";

export default function AdminPincodes() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ pincode: "", city: "", delivery_fee: 20, min_order_value: 99, eta_minutes: 12, active: true });
  const refresh = () => api.get("/admin/pincodes").then(r => setList(r.data));
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!/^\d{6}$/.test(form.pincode)) { toast.error("PIN must be 6 digits"); return; }
    await api.post("/admin/pincodes", { ...form, delivery_fee: Number(form.delivery_fee), min_order_value: Number(form.min_order_value), eta_minutes: Number(form.eta_minutes) });
    setForm({ pincode: "", city: "", delivery_fee: 20, min_order_value: 99, eta_minutes: 12, active: true });
    toast.success("Saved");
    refresh();
  };
  const del = async (p) => { await api.delete(`/admin/pincodes/${p}`); refresh(); };

  return (
    <div className="space-y-4" data-testid="admin-pincodes-page">
      <h1 className="font-display text-2xl font-bold">Serviceable PIN codes</h1>
      <div className="bg-white border border-gray-100 rounded-2xl p-4 grid sm:grid-cols-6 gap-2 text-sm items-end">
        <input data-testid="pin-pincode" value={form.pincode} onChange={(e)=>setForm({...form, pincode:e.target.value.replace(/\D/g,"")})} placeholder="PIN" maxLength={6} className="px-3 py-2 rounded-xl border border-gray-200" />
        <input data-testid="pin-city" value={form.city} onChange={(e)=>setForm({...form, city:e.target.value})} placeholder="City" className="px-3 py-2 rounded-xl border border-gray-200" />
        <input data-testid="pin-fee" value={form.delivery_fee} onChange={(e)=>setForm({...form, delivery_fee:e.target.value})} placeholder="Fee" className="px-3 py-2 rounded-xl border border-gray-200" />
        <input data-testid="pin-min" value={form.min_order_value} onChange={(e)=>setForm({...form, min_order_value:e.target.value})} placeholder="Min order" className="px-3 py-2 rounded-xl border border-gray-200" />
        <input data-testid="pin-eta" value={form.eta_minutes} onChange={(e)=>setForm({...form, eta_minutes:e.target.value})} placeholder="ETA min" className="px-3 py-2 rounded-xl border border-gray-200" />
        <button data-testid="pin-save" onClick={save} className="btn-primary py-2">Save</button>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500"><tr>
            <th className="py-2 px-3">PIN</th><th className="py-2 px-3">City</th><th className="py-2 px-3">Fee</th><th className="py-2 px-3">Min</th><th className="py-2 px-3">ETA</th><th className="py-2 px-3">Active</th><th className="py-2 px-3"></th>
          </tr></thead>
          <tbody>
            {list.map(p => (
              <tr key={p.pincode} className="border-t border-gray-100">
                <td className="py-2 px-3 font-semibold">{p.pincode}</td>
                <td className="py-2 px-3">{p.city}</td>
                <td className="py-2 px-3">₹{p.delivery_fee}</td>
                <td className="py-2 px-3">₹{p.min_order_value}</td>
                <td className="py-2 px-3">{p.eta_minutes} min</td>
                <td className="py-2 px-3">{p.active ? "Yes" : "No"}</td>
                <td className="py-2 px-3"><button data-testid={`pin-del-${p.pincode}`} onClick={()=>del(p.pincode)} className="text-xs text-red-600">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
