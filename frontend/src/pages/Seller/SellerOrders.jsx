import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";

export default function SellerOrders() {
  const [list, setList] = useState([]);
  const load = () => api.get("/seller/orders").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const markPacked = async (orderNo) => {
    try { await api.post(`/seller/orders/${orderNo}/mark-packed`); toast.success("Marked packed"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  return (
    <div data-testid="seller-orders">
      <h1 className="font-display text-2xl font-bold mb-4">Orders containing my products</h1>
      <div className="space-y-2">
        {list.map((o) => (
          <div key={o.order_no} className="bg-white border border-gray-100 rounded-2xl p-4" data-testid={`seller-order-${o.order_no}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-mono font-semibold">{o.order_no}</div>
                <div className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString("en-IN")} · {o.customer_phone}</div>
              </div>
              <div className="text-right">
                <div className="font-display font-extrabold">₹{o.my_revenue}</div>
                <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100">{o.status.replace(/_/g, " ")}</span>
              </div>
            </div>
            <div className="text-sm mt-2 space-y-1">
              {o.my_items.map((i) => (
                <div key={i.product_id} className="flex justify-between text-xs"><span>{i.name} × {i.qty}</span><span>₹{i.line_total}</span></div>
              ))}
            </div>
            {o.status === "placed" && (
              <button data-testid={`mark-packed-${o.order_no}`} onClick={() => markPacked(o.order_no)} className="mt-2 btn-primary py-1.5 px-3 text-xs">Mark packed</button>
            )}
          </div>
        ))}
        {!list.length && <div className="text-gray-400 text-sm text-center py-8">No orders containing your products yet.</div>}
      </div>
    </div>
  );
}
