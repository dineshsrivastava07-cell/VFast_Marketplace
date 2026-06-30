import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { toast } from "sonner";

export default function AdminRiders() {
  const [riders, setRiders] = useState([]);

  const refresh = () => api.get("/admin/riders").then(r => setRiders(r.data));
  useEffect(() => { refresh(); }, []);

  const setStatus = async (id, status) => {
    await api.post(`/admin/riders/${id}/status`, { status });
    toast.success(`Status → ${status}`); refresh();
  };

  return (
    <div className="space-y-4" data-testid="admin-riders-page">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Riders</h1>
        <Link to="/admin/users" data-testid="riders-add-via-users" className="btn-primary px-3 py-2 text-sm">+ Add rider via Users</Link>
      </div>
      <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-2" data-testid="riders-merge-note">
        Rider accounts are now managed from the <Link to="/admin/users" className="font-semibold underline">Users</Link> module — create a new user with role <code>delivery_partner</code> and fill the rider details there.
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500"><tr>
            <th className="py-2 px-3">Name</th><th className="py-2 px-3">Email / Phone</th><th className="py-2 px-3">Vehicle</th><th className="py-2 px-3">Status</th><th className="py-2 px-3">Today</th><th className="py-2 px-3">Lifetime</th><th className="py-2 px-3">KYC</th>
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
              </tr>
            ))}
            {riders.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-gray-500">No riders yet. Add one via Users.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
