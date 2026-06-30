import React, { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Download, AlertTriangle } from "lucide-react";

const NEXT = { placed: "packed", payment_verified: "packed", packed: "out_for_delivery", out_for_delivery: "delivered" };
const STATUSES = ["placed", "payment_pending", "payment_verifying", "packed", "out_for_delivery", "delivered", "cancelled", "payment_rejected"];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [sla, setSla] = useState([]);
  const [filters, setFilters] = useState({ status: "", payment_method: "", q: "" });
  const [riders, setRiders] = useState([]);
  const [selected, setSelected] = useState({});
  const [bulkAction, setBulkAction] = useState("");
  const [bulkRider, setBulkRider] = useState("");

  const refresh = async () => {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.payment_method) params.append("payment_method", filters.payment_method);
    const r = await api.get(`/admin/orders?${params}`);
    setOrders(r.data);
    const s = await api.get("/admin/oms/sla");
    setSla(s.data);
    const rd = await api.get("/admin/riders");
    setRiders(rd.data);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [filters.status, filters.payment_method]);

  // ----- Live OMS via WebSocket -----
  const [live, setLive] = useState(false);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const base = (process.env.REACT_APP_BACKEND_URL || "").replace(/^http/, "ws");
    if (!base) return;
    const ws = new WebSocket(`${base}/api/ws/oms`);
    ws.onopen = () => setLive(true);
    ws.onclose = () => setLive(false);
    ws.onerror = () => setLive(false);
    ws.onmessage = (msg) => {
      try {
        const evt = JSON.parse(msg.data);
        if (evt.event && evt.event.startsWith("order.")) { setPulse((x) => x + 1); refresh(); }
      } catch { /* ignore */ }
    };
    return () => ws.close();
    // eslint-disable-next-line
  }, []);

  const slaMap = useMemo(() => Object.fromEntries(sla.map(s => [s.order_no, s])), [sla]);
  const filtered = useMemo(() => orders.filter(o =>
    !filters.q || [o.order_no, o.customer_phone, o.address?.pincode].join(" ").toLowerCase().includes(filters.q.toLowerCase())
  ), [orders, filters.q]);

  const toggle = (no) => setSelected(s => ({ ...s, [no]: !s[no] }));
  const selectedNos = Object.keys(selected).filter(k => selected[k]);

  const advance = async (o) => {
    const target = NEXT[o.status];
    if (!target) { toast.error("No next status"); return; }
    await api.post(`/admin/orders/${o.order_no}/advance`, { status: target });
    toast.success(`Order ${o.order_no} → ${target}`);
    refresh();
  };
  const assignRider = async (orderNo, riderId) => {
    if (!riderId) return;
    await api.post(`/admin/orders/${orderNo}/assign-rider`, { rider_id: riderId });
    toast.success(`Rider assigned to ${orderNo}`);
    refresh();
  };
  const override = async (orderNo) => {
    const status = window.prompt("Override status to (placed/packed/out_for_delivery/delivered/cancelled):");
    if (!status) return;
    const reason = window.prompt("Reason for override:") || "manual override";
    await api.post(`/admin/orders/${orderNo}/override-status`, { status, reason });
    toast.success("Status overridden");
    refresh();
  };
  const bulkRun = async () => {
    if (!bulkAction || selectedNos.length === 0) { toast.error("Pick action and orders"); return; }
    const payload = { action: bulkAction, order_nos: selectedNos };
    if (bulkAction === "assign_rider") {
      if (!bulkRider) { toast.error("Pick rider"); return; }
      payload.rider_id = bulkRider;
    }
    if (bulkAction === "advance") {
      const status = window.prompt("Advance to status:");
      if (!status) return;
      payload.status = status;
    }
    const r = await api.post("/admin/oms/bulk", payload);
    toast.success(`Bulk ${bulkAction}: ${r.data.affected} affected`);
    setSelected({});
    refresh();
  };

  const exportCsv = async () => {
    const r = await api.get("/admin/oms/export");
    const blob = new Blob([r.data.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "vfast-orders.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const confirmCod = async (orderNo) => {
    if (!window.confirm(`Confirm COD collected for ${orderNo}? This is immutable.`)) return;
    try { await api.post(`/admin/orders/${orderNo}/confirm-cod`); toast.success("COD marked collected"); refresh(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  // COD summary for the bottom row
  const codStats = orders.reduce((acc, o) => {
    if (o.payment_method !== "cod") return acc;
    acc.total += 1;
    if (o.payment_status === "collected") { acc.collected += 1; acc.amount += o.total || 0; }
    else { acc.pending += 1; }
    return acc;
  }, { total: 0, collected: 0, pending: 0, amount: 0 });

  return (
    <div className="space-y-4" data-testid="admin-orders-page">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          Orders (OMS)
          <span data-testid="oms-live-indicator" className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${live ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
            {live ? "LIVE" : "RECONNECTING"}{pulse > 0 && ` · ${pulse} updates`}
          </span>
        </h1>
        <div className="flex flex-wrap gap-2 items-center">
          <input data-testid="oms-search" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Search order/phone/PIN" className="px-3 py-2 rounded-xl border border-gray-200 text-sm" />
          <select data-testid="oms-status-filter" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select data-testid="oms-pay-filter" value={filters.payment_method} onChange={(e) => setFilters({ ...filters, payment_method: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
            <option value="">All payment</option>
            <option value="cod">COD</option>
            <option value="upi_qr">UPI QR</option>
          </select>
          <button data-testid="oms-export" onClick={exportCsv} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold bg-white"><Download className="h-4 w-4" /> CSV</button>
        </div>
      </div>

      {selectedNos.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 flex flex-wrap gap-2 items-center" data-testid="bulk-bar">
          <span className="text-sm font-semibold">{selectedNos.length} selected</span>
          <select data-testid="bulk-action" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
            <option value="">Bulk action</option>
            <option value="cancel">Cancel</option>
            <option value="assign_rider">Assign rider</option>
            <option value="advance">Advance status</option>
          </select>
          {bulkAction === "assign_rider" && (
            <select value={bulkRider} onChange={(e) => setBulkRider(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
              <option value="">Pick rider</option>
              {riders.map(r => <option key={r.id} value={r.id}>{r.name} ({r.email})</option>)}
            </select>
          )}
          <button data-testid="bulk-run" onClick={bulkRun} className="btn-primary px-3 py-2 text-sm">Run</button>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="py-2 px-3"></th>
              <th className="py-2 px-3">Order</th>
              <th className="py-2 px-3">Customer / PIN</th>
              <th className="py-2 px-3">Total</th>
              <th className="py-2 px-3">Pay</th>
              <th className="py-2 px-3">COD</th>
              <th className="py-2 px-3">SLA</th>
              <th className="py-2 px-3">Rider</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => {
              const slaInfo = slaMap[o.order_no];
              const color = slaInfo?.color === "red" ? "bg-red-50 text-red-700" : slaInfo?.color === "amber" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700";
              return (
                <tr key={o.order_no} className="border-t border-gray-100" data-testid={`oms-row-${o.order_no}`}>
                  <td className="py-2 px-3"><input type="checkbox" checked={!!selected[o.order_no]} onChange={() => toggle(o.order_no)} data-testid={`oms-check-${o.order_no}`} /></td>
                  <td className="py-2 px-3"><Link to={`/orders/${o.order_no}`} className="text-[#E4002B] font-semibold">{o.order_no}</Link></td>
                  <td className="py-2 px-3 text-xs">{o.customer_phone}<div className="text-[10px] text-gray-500">{o.address?.pincode}</div></td>
                  <td className="py-2 px-3 font-semibold">₹{o.total}</td>
                  <td className="py-2 px-3 uppercase text-xs">{o.payment_method}</td>
                  <td className="py-2 px-3 text-xs">
                    {o.payment_method !== "cod" ? <span className="text-gray-300">—</span>
                      : o.payment_status === "collected" ? <span className="text-emerald-700 font-semibold" data-testid={`cod-status-${o.order_no}`}>✓ Collected</span>
                      : <span className="text-amber-700 font-semibold" data-testid={`cod-status-${o.order_no}`}>⏳ Pending</span>}
                  </td>
                  <td className="py-2 px-3">{slaInfo ? <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md ${color}`}>{slaInfo.elapsed_min}m / {slaInfo.eta_minutes}m</span> : "—"}</td>
                  <td className="py-2 px-3 text-xs">
                    <select data-testid={`assign-rider-${o.order_no}`} value={o.rider_id || ""} onChange={(e) => assignRider(o.order_no, e.target.value)} className="px-2 py-1 rounded-md border border-gray-200 text-xs">
                      <option value="">Unassigned</option>
                      {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-3"><span className="text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded-md">{o.status}</span></td>
                  <td className="py-2 px-3 flex gap-1 flex-wrap">
                    {NEXT[o.status] && <button data-testid={`advance-${o.order_no}`} onClick={() => advance(o)} className="text-[10px] bg-[#E4002B] text-white px-2 py-1 rounded-md font-semibold">→ {NEXT[o.status]}</button>}
                    {o.payment_method === "cod" && o.payment_status !== "collected" && (
                      <button data-testid={`confirm-cod-${o.order_no}`} onClick={() => confirmCod(o.order_no)} className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-md font-semibold">Confirm COD</button>
                    )}
                    <button data-testid={`override-${o.order_no}`} onClick={() => override(o.order_no)} className="text-[10px] bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-semibold inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Override</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={10} className="py-4 text-center text-gray-500">No orders.</td></tr>}
          </tbody>
          {codStats.total > 0 && (
            <tfoot data-testid="cod-summary" className="bg-gray-50">
              <tr className="border-t-2 border-gray-200">
                <td colSpan={10} className="py-2 px-3 text-xs">
                  <b>COD summary:</b> {codStats.total} total · <span className="text-emerald-700 font-semibold">{codStats.collected} collected</span> · <span className="text-amber-700 font-semibold">{codStats.pending} pending</span> · ₹{codStats.amount.toLocaleString("en-IN")} collected
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
