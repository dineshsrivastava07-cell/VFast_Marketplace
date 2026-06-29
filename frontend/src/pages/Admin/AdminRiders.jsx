import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";

export default function AdminRiders() {
  const [riders, setRiders] = useState([]);
  const [adding, setAdding] = useState(null);

  const refresh = () => api.get("/admin/riders").then(r => setRiders(r.data));
  useEffect(() => { refresh(); }, []);

  const setStatus = async (id, status) => {
    await api.post(`/admin/riders/${id}/status`, { status });
    toast.success(`Status → ${status}`); refresh();
  };
  const save = async () => {
    if (!adding.email) return toast.error("Email required");
    await api.post("/admin/riders", adding);
    toast.success("Rider saved"); setAdding(null); refresh();
  };

  return (
    <div className="space-y-4" data-testid="admin-riders-page">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Riders</h1>
        <button data-testid="add-rider-btn" onClick={() => setAdding({ email: "", name: "", phone: "", vehicle: "bike", password: "rider123", kyc: { pan: "", license: "", verified: false }, rider_status: "offline" })} className="btn-primary px-3 py-2 text-sm">+ Add rider</button>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500"><tr>
            <th className="py-2 px-3">Name</th><th className="py-2 px-3">Email / Phone</th><th className="py-2 px-3">Vehicle</th><th className="py-2 px-3">Status</th><th className="py-2 px-3">Today</th><th className="py-2 px-3">Lifetime</th><th className="py-2 px-3">KYC</th><th className="py-2 px-3"></th>
          </tr></thead>
          <tbody>
            {riders.map(r => (
              <tr key={r.id} className="border-t border-gray-100" data-testid={`rider-row-${r.id}`}>
                <td className="py-2 px-3 font-semibold">{r.name}</td>
                <td className="py-2 px-3 text-xs">{r.email}<div className="text-[10px] text-gray-500">{r.phone}</div></td>
                <td className="py-2 px-3">{r.vehicle || "—"}</td>
                <td className="py-2 px-3">
                  <select data-testid={`rider-status-${r.id}`} value={r.rider_status || "offline"} onChange={(e) => setStatus(r.id, e.target.value)} className="px-2 py-1 rounded-md border border-gray-200 text-xs">
                    <option value="online">Online</option><option value="offline">Offline</option><option value="on_delivery">On delivery</option>
                  </select>
                </td>
                <td className="py-2 px-3 text-xs">{r.today_orders} orders · ₹{r.earnings_today}</td>
                <td className="py-2 px-3 text-xs">{r.completed_total} delivered</td>
                <td className="py-2 px-3 text-xs">{r.kyc?.verified ? <span className="text-green-700 font-semibold">Verified</span> : <span className="text-amber-700">Pending</span>}</td>
                <td className="py-2 px-3"></td>
              </tr>
            ))}
            {riders.length === 0 && <tr><td colSpan={8} className="py-4 text-center text-gray-500">No riders. Add one to get started.</td></tr>}
          </tbody>
        </table>
      </div>

      {adding && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setAdding(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg mb-3">Add rider</h3>
            <div className="grid gap-2 text-sm">
              <input placeholder="Name" data-testid="r-name" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <input placeholder="Email" data-testid="r-email" value={adding.email} onChange={(e) => setAdding({ ...adding, email: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <input placeholder="Password (default rider123)" data-testid="r-password" value={adding.password} onChange={(e) => setAdding({ ...adding, password: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <input placeholder="+91 phone" data-testid="r-phone" value={adding.phone} onChange={(e) => setAdding({ ...adding, phone: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <select value={adding.vehicle} onChange={(e) => setAdding({ ...adding, vehicle: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200">
                <option value="bike">Bike</option><option value="scooter">Scooter</option><option value="bicycle">Bicycle</option><option value="ev">EV</option>
              </select>
              <input placeholder="PAN" value={adding.kyc.pan} onChange={(e) => setAdding({ ...adding, kyc: { ...adding.kyc, pan: e.target.value } })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <input placeholder="License no." value={adding.kyc.license} onChange={(e) => setAdding({ ...adding, kyc: { ...adding.kyc, license: e.target.value } })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <label className="flex items-center gap-2"><input type="checkbox" checked={adding.kyc.verified} onChange={(e) => setAdding({ ...adding, kyc: { ...adding.kyc, verified: e.target.checked } })} /> KYC verified</label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAdding(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm">Cancel</button>
              <button data-testid="r-save" onClick={save} className="btn-primary px-4 py-2 text-sm">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
