import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Download } from "lucide-react";

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ user_email: "", action: "", target_type: "", since: "" });

  const refresh = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    api.get(`/admin/audit?${params}`).then(r => setLogs(r.data));
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const exportCsv = async () => {
    const r = await api.get("/admin/audit/export");
    const blob = new Blob([r.data.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "vfast-audit.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4" data-testid="admin-audit-page">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Audit log</h1>
        <button data-testid="audit-export" onClick={exportCsv} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold bg-white"><Download className="h-4 w-4" /> Export CSV</button>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl p-3 grid sm:grid-cols-5 gap-2 text-sm">
        <input data-testid="audit-user" placeholder="User email" value={filters.user_email} onChange={(e) => setFilters({ ...filters, user_email: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
        <input data-testid="audit-action" placeholder="Action contains" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
        <input data-testid="audit-target" placeholder="Target type" value={filters.target_type} onChange={(e) => setFilters({ ...filters, target_type: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
        <input data-testid="audit-since" type="date" value={filters.since} onChange={(e) => setFilters({ ...filters, since: e.target.value ? e.target.value + "T00:00:00+00:00" : "" })} className="px-3 py-2 rounded-xl border border-gray-200" />
        <button data-testid="audit-apply" onClick={refresh} className="btn-primary py-2">Apply</button>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500"><tr><th className="py-2 px-3">When</th><th className="py-2 px-3">User</th><th className="py-2 px-3">Action</th><th className="py-2 px-3">Target</th><th className="py-2 px-3">Details</th></tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-t border-gray-100">
                <td className="py-2 px-3 text-xs text-gray-500">{new Date(l.at).toLocaleString("en-IN")}</td>
                <td className="py-2 px-3 text-xs">{l.user_email || l.user_phone || l.user_role}</td>
                <td className="py-2 px-3 text-xs font-semibold">{l.action}</td>
                <td className="py-2 px-3 text-xs">{l.target_type}{l.target_id ? `:${l.target_id.slice(0, 8)}` : ""}</td>
                <td className="py-2 px-3 text-[10px] font-mono text-gray-600 max-w-md truncate">{JSON.stringify(l.details)}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-gray-500">No audit entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
