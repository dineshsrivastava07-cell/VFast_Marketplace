import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";
import { Search, Download, X } from "lucide-react";

function downloadCsv(filename, rows, headers) {
  const escape = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const PAGE = 50;

  const load = () => api.get("/admin/users?role=customer").then((r) => setCustomers(r.data));
  useEffect(() => { load(); }, []);

  const openProfile = async (c) => {
    try {
      const r = await api.get(`/admin/customers/${c.id}/summary`);
      setDetail(r.data);
    } catch { toast.error("Failed to load"); }
  };
  const deactivate = async (c) => {
    if (!window.confirm(`Deactivate ${c.name || c.phone || c.email}?`)) return;
    try { await api.patch(`/admin/users/${c.id}`, { active: false }); toast.success("Deactivated"); load(); }
    catch { toast.error("Failed"); }
  };

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${c.name || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase().includes(q);
  });
  const visible = filtered.slice(0, page * PAGE);

  const exportCsv = () => downloadCsv("vfast-customers.csv", filtered.map((c) => ({
    id: c.id, name: c.name, phone: c.phone, email: c.email,
    active: c.active !== false, created_at: c.created_at,
  })), ["id", "name", "phone", "email", "active", "created_at"]);

  return (
    <div data-testid="admin-customers-page">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold">Customers <span className="text-gray-400 text-base">({customers.length})</span></h1>
        <button onClick={exportCsv} data-testid="customers-export" className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold bg-white"><Download className="h-4 w-4" />Export CSV</button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input data-testid="customers-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name / phone / email" className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm" />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500 bg-gray-50"><tr>
            <th className="py-2 px-3">Name</th><th>Phone / Email</th><th>Joined</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {visible.map((c) => {
              const active = c.active !== false;
              return (
                <tr key={c.id} className="border-t border-gray-100" data-testid={`customer-row-${c.id}`}>
                  <td className="py-2 px-3 font-semibold">{c.name || "—"}</td>
                  <td className="py-2 px-3 text-xs">{c.phone || c.email || "—"}</td>
                  <td className="py-2 px-3 text-xs text-gray-500">{c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN") : "—"}</td>
                  <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded-md ${active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{active ? "Active" : "Inactive"}</span></td>
                  <td className="py-2 px-3 text-right space-x-2">
                    <button data-testid={`view-${c.id}`} onClick={() => openProfile(c)} className="text-xs text-[#E4002B] font-semibold">View</button>
                    {active && <button data-testid={`deactivate-${c.id}`} onClick={() => deactivate(c)} className="text-xs text-gray-600">Deactivate</button>}
                  </td>
                </tr>
              );
            })}
            {!visible.length && <tr><td colSpan={5} className="py-6 text-center text-gray-400 text-xs">No customers.</td></tr>}
          </tbody>
        </table>
      </div>

      {visible.length < filtered.length && (
        <div className="text-center mt-3">
          <button data-testid="load-more" onClick={() => setPage(page + 1)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm">Load more ({filtered.length - visible.length} remaining)</button>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={() => setDetail(null)}>
          <div className="bg-white max-w-2xl w-full rounded-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="customer-detail">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-display font-bold text-lg">{detail.customer.name || "—"}</h3>
                <div className="text-xs text-gray-500">{detail.customer.phone || detail.customer.email}</div>
              </div>
              <button onClick={() => setDetail(null)}><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm mb-4">
              <div className="bg-gray-50 rounded-xl p-3"><div className="text-xs text-gray-500">Orders</div><div className="font-display text-xl font-extrabold">{detail.order_count}</div></div>
              <div className="bg-gray-50 rounded-xl p-3"><div className="text-xs text-gray-500">Total spend</div><div className="font-display text-xl font-extrabold">₹{detail.total_spent.toLocaleString("en-IN")}</div></div>
              <div className="bg-gray-50 rounded-xl p-3"><div className="text-xs text-gray-500">Last order</div><div className="text-sm font-semibold">{detail.last_order_at ? new Date(detail.last_order_at).toLocaleDateString("en-IN") : "—"}</div></div>
            </div>
            <h4 className="font-semibold text-sm mb-1">Addresses</h4>
            <div className="text-xs space-y-1 mb-3">
              {detail.addresses.map((a) => (
                <div key={a.id} className="border border-gray-100 rounded-lg p-2">
                  <b>{a.label}</b> · {a.flat}, {a.area}, {a.city} - {a.pincode}
                </div>
              ))}
              {!detail.addresses.length && <div className="text-gray-400">No saved addresses.</div>}
            </div>
            <h4 className="font-semibold text-sm mb-1">Recent orders</h4>
            <div className="space-y-1 text-xs">
              {detail.orders.slice(0, 20).map((o) => (
                <div key={o.order_no} className="flex justify-between border-t border-gray-50 py-1.5">
                  <span className="font-mono">{o.order_no}</span>
                  <span>₹{o.total} · {o.status} · {new Date(o.created_at).toLocaleDateString("en-IN")}</span>
                </div>
              ))}
              {!detail.orders.length && <div className="text-gray-400">No orders.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
