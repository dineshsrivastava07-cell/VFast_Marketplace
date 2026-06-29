import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Link } from "react-router-dom";
import { TrendingUp, ShoppingBag, MapPin, Package, AlertCircle } from "lucide-react";

const Stat = ({ icon: Icon, label, value, tone="text-[#E4002B]" }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-4">
    <div className="flex items-center justify-between">
      <div className="text-xs text-gray-500 font-semibold uppercase">{label}</div>
      <Icon className={`h-5 w-5 ${tone}`} />
    </div>
    <div className="font-display text-2xl font-extrabold mt-2">{value}</div>
  </div>
);

export default function AdminDashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/dashboard").then(r => setD(r.data)); }, []);
  if (!d) return <div className="text-gray-500">Loading...</div>;
  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <h1 className="font-display text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat icon={ShoppingBag} label="Total orders" value={d.total_orders} />
        <Stat icon={TrendingUp} label="GMV" value={`₹${d.gmv}`} />
        <Stat icon={AlertCircle} label="To verify" value={d.pending_verification} tone="text-amber-600" />
        <Stat icon={ShoppingBag} label="Delivered" value={d.delivered} tone="text-green-600" />
        <Stat icon={MapPin} label="Active PINs" value={d.active_pincodes} />
        <Stat icon={Package} label="Products" value={d.products} />
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="font-display font-bold mb-3">Recent orders</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 uppercase">
              <tr><th className="py-2 pr-3">Order</th><th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">Total</th><th className="py-2 pr-3">Pay</th><th className="py-2 pr-3">Status</th></tr>
            </thead>
            <tbody>
              {d.recent_orders.map(o => (
                <tr key={o.order_no} className="border-t border-gray-100">
                  <td className="py-2 pr-3"><Link to={`/orders/${o.order_no}`} className="text-[#E4002B] font-semibold">{o.order_no}</Link></td>
                  <td className="py-2 pr-3">{o.customer_phone || o.customer_name || "-"}</td>
                  <td className="py-2 pr-3 font-semibold">₹{o.total}</td>
                  <td className="py-2 pr-3 uppercase text-xs">{o.payment_method}</td>
                  <td className="py-2 pr-3"><span className="text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded-md">{o.status}</span></td>
                </tr>
              ))}
              {d.recent_orders.length === 0 && <tr><td className="py-3 text-gray-500" colSpan={5}>No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
