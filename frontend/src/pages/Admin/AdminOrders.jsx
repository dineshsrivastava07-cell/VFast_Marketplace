import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const NEXT = { placed: "packed", payment_verified: "packed", packed: "out_for_delivery", out_for_delivery: "delivered" };

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const refresh = () => api.get(`/admin/orders${status ? `?status=${status}` : ""}`).then(r => setOrders(r.data));
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [status]);

  const advance = async (o) => {
    const target = NEXT[o.status];
    if (!target) { toast.error("No next status"); return; }
    await api.post(`/admin/orders/${o.order_no}/advance`, { status: target });
    toast.success(`Order ${o.order_no} → ${target}`);
    refresh();
  };

  return (
    <div className="space-y-4" data-testid="admin-orders-page">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Orders (OMS)</h1>
        <select data-testid="oms-status-filter" value={status} onChange={(e)=>setStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
          <option value="">All statuses</option>
          {["placed","payment_pending","payment_verifying","packed","out_for_delivery","delivered","cancelled","payment_rejected"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500">
            <tr><th className="py-2 px-3">Order</th><th className="py-2 px-3">Customer</th><th className="py-2 px-3">Total</th><th className="py-2 px-3">Pay</th><th className="py-2 px-3">Status</th><th className="py-2 px-3">Actions</th></tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.order_no} className="border-t border-gray-100" data-testid={`oms-row-${o.order_no}`}>
                <td className="py-2 px-3"><Link to={`/orders/${o.order_no}`} className="text-[#E4002B] font-semibold">{o.order_no}</Link></td>
                <td className="py-2 px-3">{o.customer_phone}</td>
                <td className="py-2 px-3 font-semibold">₹{o.total}</td>
                <td className="py-2 px-3 uppercase text-xs">{o.payment_method}</td>
                <td className="py-2 px-3"><span className="text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded-md">{o.status}</span></td>
                <td className="py-2 px-3 flex gap-2">
                  {NEXT[o.status] && <button data-testid={`advance-${o.order_no}`} onClick={()=>advance(o)} className="text-xs bg-[#E4002B] text-white px-2 py-1 rounded-md font-semibold">→ {NEXT[o.status]}</button>}
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td className="py-4 text-center text-gray-500" colSpan={6}>No orders.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
