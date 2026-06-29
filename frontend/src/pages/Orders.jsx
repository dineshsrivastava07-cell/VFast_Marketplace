import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Helmet } from "../components/Helmet";
import { useAuth } from "../context/AuthContext";

const STATUS_COLOR = {
  placed: "bg-blue-50 text-blue-700",
  payment_pending: "bg-amber-50 text-amber-700",
  payment_verifying: "bg-amber-50 text-amber-700",
  packed: "bg-purple-50 text-purple-700",
  out_for_delivery: "bg-indigo-50 text-indigo-700",
  delivered: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
  payment_rejected: "bg-red-50 text-red-700",
};

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) return;
    api.get("/orders/").then((r) => setOrders(r.data)).finally(() => setLoading(false));
  }, [user]);
  if (!user) return <div className="p-8">Please <Link to="/login" className="text-[#E4002B]">login</Link>.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="orders-page">
      <Helmet title="My orders" />
      <h1 className="font-display text-2xl font-bold">My orders</h1>
      <div className="mt-6 space-y-3">
        {loading && <div className="text-gray-500">Loading...</div>}
        {!loading && orders.length === 0 && <div className="text-gray-500">You haven't placed any orders yet.</div>}
        {orders.map((o) => (
          <Link key={o.order_no} to={`/orders/${o.order_no}`} className="block bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-sm" data-testid={`order-row-${o.order_no}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display font-bold">{o.order_no}</div>
                <div className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString("en-IN")} · {o.items.length} item(s)</div>
              </div>
              <div className="text-right">
                <div className="font-display font-extrabold">₹{o.total}</div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${STATUS_COLOR[o.status] || "bg-gray-100 text-gray-700"}`}>{o.status.replace(/_/g, " ")}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
