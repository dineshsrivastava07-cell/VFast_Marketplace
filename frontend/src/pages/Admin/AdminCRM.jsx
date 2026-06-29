import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Helmet } from "../../components/Helmet";
import { toast } from "sonner";
import { Search, MessageSquare } from "lucide-react";

export default function AdminCRM() {
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [tab, setTab] = useState("customers");

  const load = async () => {
    const params = new URLSearchParams(); if (q) params.set("q", q); if (segment) params.set("segment", segment);
    const r = await api.get(`/crm/customers?${params}`); setCustomers(r.data);
  };
  const loadTickets = () => api.get("/crm/tickets").then(r => setTickets(r.data));
  useEffect(() => { load(); loadTickets(); /* eslint-disable-next-line */ }, [segment]);

  const openCustomer = async (uid) => {
    try { const r = await api.get(`/crm/customers/${uid}`); setSelected(r.data); }
    catch { toast.error("Failed"); }
  };
  const setTicket = async (tid, status) => {
    try { await api.post(`/crm/tickets/${tid}/status`, { status }); loadTickets(); toast.success("Updated"); }
    catch { toast.error("Failed"); }
  };

  return (
    <div data-testid="admin-crm">
      <Helmet title="CRM" />
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold">CRM</h1>
          <p className="text-sm text-gray-500">Customers, lifetime value, segments and support tickets.</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="crm-tab-customers" onClick={() => setTab("customers")} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === "customers" ? "bg-[#E4002B] text-white" : "bg-gray-100 text-gray-700"}`}>Customers</button>
          <button data-testid="crm-tab-tickets" onClick={() => setTab("tickets")} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === "tickets" ? "bg-[#E4002B] text-white" : "bg-gray-100 text-gray-700"}`}>Tickets</button>
        </div>
      </div>

      {tab === "customers" && (
        <div className="space-y-3">
          <div className="bg-white border border-gray-100 rounded-2xl p-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input data-testid="crm-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Phone, name or email" className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </div>
            <select data-testid="crm-segment" value={segment} onChange={(e) => setSegment(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              <option value="">All segments</option><option value="active">Active (30d)</option><option value="inactive">Inactive</option><option value="new">New (no orders)</option>
            </select>
            <button onClick={load} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">Search</button>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500 bg-gray-50"><tr><th className="py-2 px-3">Name</th><th>Phone / Email</th><th>Segment</th><th>Orders</th><th>LTV</th><th>Last order</th></tr></thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => openCustomer(c.id)} data-testid={`crm-row-${c.id}`}>
                    <td className="py-2 px-3 font-semibold">{c.name || "—"}</td>
                    <td className="text-xs">{c.phone || c.email || "—"}</td>
                    <td><span className={`text-xs px-2 py-0.5 rounded-md ${c.segment === "active" ? "bg-emerald-50 text-emerald-700" : c.segment === "inactive" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{c.segment}</span></td>
                    <td>{c.order_count}</td>
                    <td>₹{c.ltv.toLocaleString("en-IN")}</td>
                    <td className="text-xs">{c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("en-IN") : "—"}</td>
                  </tr>
                ))}
                {!customers.length && <tr><td colSpan={6} className="py-4 px-3 text-center text-gray-400 text-xs">No customers</td></tr>}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4" data-testid="crm-detail-block">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-display text-lg font-bold">{selected.customer.name || "—"}</h3>
                  <div className="text-xs text-gray-500">{selected.customer.phone} · {selected.customer.email || "no email"}</div>
                </div>
                <button onClick={() => setSelected(null)} className="text-xs text-gray-500">Close</button>
              </div>
              <div className="grid sm:grid-cols-4 gap-3 mt-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3"><div className="text-xs text-gray-500">Orders</div><div className="font-display font-extrabold text-xl">{selected.stats.order_count}</div></div>
                <div className="bg-gray-50 rounded-xl p-3"><div className="text-xs text-gray-500">LTV</div><div className="font-display font-extrabold text-xl">₹{selected.stats.ltv}</div></div>
                <div className="bg-gray-50 rounded-xl p-3"><div className="text-xs text-gray-500">AOV</div><div className="font-display font-extrabold text-xl">₹{selected.stats.aov}</div></div>
                <div className="bg-gray-50 rounded-xl p-3"><div className="text-xs text-gray-500">Last order</div><div className="text-sm font-semibold">{selected.stats.last_order_at ? new Date(selected.stats.last_order_at).toLocaleDateString("en-IN") : "—"}</div></div>
              </div>
              <h4 className="mt-4 font-semibold text-sm">Recent orders</h4>
              <div className="text-xs space-y-1 mt-1 max-h-48 overflow-y-auto">
                {selected.orders.slice(0, 20).map((o) => (
                  <div key={o.order_no} className="flex justify-between border-t border-gray-50 py-1.5">
                    <span className="font-mono">{o.order_no}</span><span>₹{o.total} · {o.status}</span>
                  </div>
                ))}
                {!selected.orders.length && <div className="text-gray-400">No orders yet</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "tickets" && (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto" data-testid="tickets-block">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 bg-gray-50"><tr><th className="py-2 px-3">Ticket</th><th>Order</th><th>Subject</th><th>Status</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-gray-50">
                  <td className="py-2 px-3 font-mono text-xs">{t.id.slice(0, 8)}…</td>
                  <td className="text-xs">{t.order_no || "—"}</td>
                  <td>{t.subject}</td>
                  <td><span className="text-xs px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">{t.status}</span></td>
                  <td className="text-xs">{new Date(t.created_at).toLocaleString("en-IN")}</td>
                  <td className="space-x-2 text-xs">
                    {t.status !== "resolved" && <button data-testid={`resolve-${t.id}`} onClick={() => setTicket(t.id, "resolved")} className="text-[#E4002B] font-semibold">Resolve</button>}
                    {t.status !== "closed" && <button onClick={() => setTicket(t.id, "closed")} className="text-gray-600">Close</button>}
                  </td>
                </tr>
              ))}
              {!tickets.length && <tr><td colSpan={6} className="py-6 text-center text-gray-400 text-xs"><MessageSquare className="inline h-4 w-4 mr-1" />No support tickets yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
