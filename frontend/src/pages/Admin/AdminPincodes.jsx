import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";
import { Upload, Download } from "lucide-react";

export default function AdminPincodes() {
  const [list, setList] = useState([]);
  const [stores, setStores] = useState([]);
  const [zones, setZones] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [tab, setTab] = useState("pins");
  const [form, setForm] = useState({ pincode: "", city: "", delivery_fee: 20, min_order_value: 99, eta_minutes: 12, active: true });
  const [csv, setCsv] = useState(null);

  const refresh = async () => {
    const [p, s, z, w] = await Promise.all([
      api.get("/admin/pincodes"), api.get("/admin/stores"), api.get("/admin/zones"), api.get("/admin/pincodes/waitlist"),
    ]);
    setList(p.data); setStores(s.data); setZones(z.data); setWaitlist(w.data);
  };
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!/^\d{6}$/.test(form.pincode)) { toast.error("PIN must be 6 digits"); return; }
    await api.post("/admin/pincodes", { ...form, delivery_fee: Number(form.delivery_fee), min_order_value: Number(form.min_order_value), eta_minutes: Number(form.eta_minutes) });
    setForm({ pincode: "", city: "", delivery_fee: 20, min_order_value: 99, eta_minutes: 12, active: true });
    toast.success("Saved"); refresh();
  };
  const del = async (p) => { await api.delete(`/admin/pincodes/${p}`); refresh(); };
  const importCsv = async () => {
    if (!csv) return;
    const fd = new FormData(); fd.append("file", csv);
    const r = await api.post("/admin/pincodes/import-csv", fd, { headers: { "Content-Type": "multipart/form-data" }});
    toast.success(`Imported: ${r.data.created} created, ${r.data.updated} updated`);
    setCsv(null); refresh();
  };

  return (
    <div className="space-y-4" data-testid="admin-pincodes-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold">Serviceability</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab("pins")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab==="pins"?"bg-[#E4002B] text-white":"bg-white border border-gray-200"}`} data-testid="pin-tab-list">Serviceable PINs</button>
          <button onClick={() => setTab("waitlist")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab==="waitlist"?"bg-[#E4002B] text-white":"bg-white border border-gray-200"}`} data-testid="pin-tab-waitlist">Waitlist ({waitlist.length})</button>
          <button onClick={() => setTab("csv")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab==="csv"?"bg-[#E4002B] text-white":"bg-white border border-gray-200"}`} data-testid="pin-tab-csv">CSV import</button>
        </div>
      </div>

      {tab === "pins" && <>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 grid sm:grid-cols-8 gap-2 text-sm items-end">
          <input data-testid="pin-pincode" value={form.pincode} onChange={(e)=>setForm({...form, pincode:e.target.value.replace(/\D/g,"")})} placeholder="PIN" maxLength={6} className="px-3 py-2 rounded-xl border border-gray-200" />
          <input data-testid="pin-city" value={form.city} onChange={(e)=>setForm({...form, city:e.target.value})} placeholder="City" className="px-3 py-2 rounded-xl border border-gray-200" />
          <input data-testid="pin-fee" value={form.delivery_fee} onChange={(e)=>setForm({...form, delivery_fee:e.target.value})} placeholder="Fee" className="px-3 py-2 rounded-xl border border-gray-200" />
          <input data-testid="pin-min" value={form.min_order_value} onChange={(e)=>setForm({...form, min_order_value:e.target.value})} placeholder="Min" className="px-3 py-2 rounded-xl border border-gray-200" />
          <input data-testid="pin-eta" value={form.eta_minutes} onChange={(e)=>setForm({...form, eta_minutes:e.target.value})} placeholder="ETA" className="px-3 py-2 rounded-xl border border-gray-200" />
          <select value={form.zone_id || ""} onChange={(e) => setForm({ ...form, zone_id: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200">
            <option value="">No zone</option>{zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <select value={form.store_id || ""} onChange={(e) => setForm({ ...form, store_id: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200">
            <option value="">No store</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button data-testid="pin-save" onClick={save} className="btn-primary py-2">Save</button>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500"><tr>
              <th className="py-2 px-3">PIN</th><th className="py-2 px-3">City</th><th className="py-2 px-3">Fee</th><th className="py-2 px-3">Min</th><th className="py-2 px-3">ETA</th><th className="py-2 px-3">Zone</th><th className="py-2 px-3">Store</th><th className="py-2 px-3">Active</th><th className="py-2 px-3"></th>
            </tr></thead>
            <tbody>
              {list.map(p => {
                const zn = zones.find(z => z.id === p.zone_id); const st = stores.find(s => s.id === p.store_id);
                return <tr key={p.pincode} className="border-t border-gray-100">
                  <td className="py-2 px-3 font-semibold">{p.pincode}</td><td className="py-2 px-3">{p.city}</td><td className="py-2 px-3">₹{p.delivery_fee}</td><td className="py-2 px-3">₹{p.min_order_value}</td><td className="py-2 px-3">{p.eta_minutes} min</td><td className="py-2 px-3 text-xs">{zn?.name || "—"}</td><td className="py-2 px-3 text-xs">{st?.name || "—"}</td><td className="py-2 px-3">{p.active ? "Yes" : "No"}</td>
                  <td className="py-2 px-3"><button data-testid={`pin-del-${p.pincode}`} onClick={()=>del(p.pincode)} className="text-xs text-red-600">Delete</button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </>}

      {tab === "waitlist" && (
        <div className="space-y-2" data-testid="waitlist-list">
          <div className="flex justify-end">
            <button data-testid="waitlist-notify-bulk" onClick={async () => {
              try { const r = await api.post("/admin/pincodes/waitlist/notify-bulk"); toast.success(`Notified ${r.data.notified} pending entries`); refresh(); }
              catch { toast.error("Failed"); }
            }} className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold">Bulk notify all pending</button>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-500"><tr>
                <th className="py-2 px-3">PIN</th><th className="py-2 px-3">Contact</th><th className="py-2 px-3">Requested</th><th className="py-2 px-3">Status</th><th className="py-2 px-3">Actions</th>
              </tr></thead>
              <tbody>
                {waitlist.map((w) => (
                  <tr key={w.id || `${w.pincode}-${w.contact}`} className="border-t border-gray-100" data-testid={`waitlist-${w.id || w.pincode}`}>
                    <td className="py-2 px-3 font-semibold">{w.pincode}</td>
                    <td className="py-2 px-3 text-xs">{w.contact}</td>
                    <td className="py-2 px-3 text-xs text-gray-500">{w.created_at ? new Date(w.created_at).toLocaleString("en-IN") : "—"}</td>
                    <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded-md ${w.status === "notified" ? "bg-emerald-50 text-emerald-700" : w.status === "converted" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{w.status || "pending"}</span></td>
                    <td className="py-2 px-3 space-x-2 text-xs">
                      {w.status !== "notified" && w.id && <button data-testid={`notify-${w.id}`} onClick={async () => {
                        try { await api.post(`/admin/pincodes/waitlist/${w.id}/notify`); toast.success("Notified"); refresh(); }
                        catch { toast.error("Failed"); }
                      }} className="text-[#E4002B] font-semibold">Notify</button>}
                      <button data-testid={`convert-${w.pincode}`} onClick={() => { setTab("pins"); setForm({ ...form, pincode: w.pincode }); }} className="text-blue-600 font-semibold">Convert to serviceable</button>
                    </td>
                  </tr>
                ))}
                {waitlist.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-gray-500">No &quot;notify me&quot; requests yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "csv" && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 max-w-xl space-y-3">
          <div className="font-display font-bold flex items-center gap-2"><Upload className="h-4 w-4" /> Bulk import PIN codes</div>
          <div className="text-xs text-gray-500">CSV columns: <code>pincode,city,delivery_fee,min_order_value,eta_minutes,active,zone_id,store_id</code></div>
          <input data-testid="pin-csv-file" type="file" accept=".csv" onChange={(e) => setCsv(e.target.files?.[0])} />
          <button data-testid="pin-csv-import" onClick={importCsv} className="btn-primary px-3 py-2 text-sm">Import</button>
        </div>
      )}
    </div>
  );
}
