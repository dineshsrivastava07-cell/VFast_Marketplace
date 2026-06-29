import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function AdminPaymentQueue() {
  const [orders, setOrders] = useState([]);
  const [reason, setReason] = useState({});
  const refresh = () => api.get("/admin/orders?status=payment_verifying").then(r => setOrders(r.data));
  useEffect(() => { refresh(); }, []);

  const verify = async (orderNo, status) => {
    const payload = { status };
    if (status === "rejected") payload.reason = reason[orderNo] || "Proof not valid";
    await api.post(`/admin/orders/${orderNo}/verify-payment`, payload);
    toast.success(`Order ${orderNo} ${status}`);
    refresh();
  };

  return (
    <div className="space-y-4" data-testid="admin-payment-queue">
      <h1 className="font-display text-2xl font-bold">Payment verification queue</h1>
      {orders.length === 0 && <div className="text-gray-500 bg-white border border-gray-100 rounded-2xl p-6 text-center">No payments awaiting verification.</div>}
      <div className="grid md:grid-cols-2 gap-4">
        {orders.map(o => (
          <div key={o.order_no} className="bg-white border border-gray-100 rounded-2xl p-4" data-testid={`verify-card-${o.order_no}`}>
            <div className="flex items-center justify-between">
              <div>
                <Link to={`/orders/${o.order_no}`} className="font-display font-bold text-[#E4002B]">{o.order_no}</Link>
                <div className="text-xs text-gray-500">{o.customer_phone} · ₹{o.total}</div>
              </div>
              <div className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md uppercase font-bold">{o.status}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 items-start text-sm">
              <div>
                <div className="text-xs text-gray-500 mb-1">Proof screenshot</div>
                {o.proof?.proof_image_url ? <img src={o.proof.proof_image_url} alt="proof" className="rounded-xl border border-gray-100 max-h-48 object-contain" /> : <div className="text-gray-400 italic">No proof uploaded</div>}
              </div>
              <div className="space-y-2">
                <div className="text-xs text-gray-500">UTR / Ref ID</div>
                <div className="font-mono text-sm">{o.proof?.utr || "—"}</div>
                <input data-testid={`reject-reason-${o.order_no}`} value={reason[o.order_no] || ""} onChange={(e)=>setReason({...reason, [o.order_no]: e.target.value})} placeholder="Reason if rejecting" className="px-3 py-2 rounded-xl border border-gray-200 w-full text-xs" />
                <div className="flex gap-2">
                  <button data-testid={`verify-${o.order_no}`} onClick={()=>verify(o.order_no, "verified")} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-semibold">Verify</button>
                  <button data-testid={`reject-${o.order_no}`} onClick={()=>verify(o.order_no, "rejected")} className="flex-1 bg-gray-100 text-gray-800 rounded-lg py-2 text-sm font-semibold">Reject</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
