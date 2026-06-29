import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";
import { Helmet } from "../components/Helmet";
import { useAuth } from "../context/AuthContext";
import { CheckCircle2, Clock, Package, Truck, Home as HomeIcon, XCircle, Upload } from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { id: "placed", label: "Order placed", icon: CheckCircle2 },
  { id: "payment_verifying", label: "Verifying payment", icon: Clock },
  { id: "packed", label: "Packed", icon: Package },
  { id: "out_for_delivery", label: "Out for delivery", icon: Truck },
  { id: "delivered", label: "Delivered", icon: HomeIcon },
];

function statusIndex(status) {
  if (status === "payment_pending" || status === "payment_verifying") return 1;
  return STEPS.findIndex((s) => s.id === status);
}

export default function OrderDetail() {
  const { user } = useAuth();
  const { orderNo } = useParams();
  const [order, setOrder] = useState(null);
  const [utr, setUtr] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const refresh = () => api.get(`/orders/${orderNo}`).then((r) => setOrder(r.data));

  useEffect(() => {
    if (!user) return;
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [orderNo, user]);

  if (!user) return <div className="p-8">Please <Link to="/login" className="text-[#E4002B]">login</Link>.</div>;
  if (!order) return <div className="p-8 text-gray-500">Loading...</div>;

  const idx = statusIndex(order.status);
  const isCancelled = order.status === "cancelled";
  const isRejected = order.status === "payment_rejected";

  const submitProof = async () => {
    if (!utr || !proofFile) { toast.error("Add UTR and a screenshot"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", proofFile);
      const up = await api.post("/payments/upload", fd, { headers: { "Content-Type": "multipart/form-data" }});
      await api.post(`/orders/${order.order_no}/upi-proof`, { utr, proof_image_url: up.data.url });
      toast.success("Proof submitted. Our team will verify shortly.");
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Upload failed");
    } finally { setUploading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="order-detail">
      <Helmet title={`Order ${order.order_no}`} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Order {order.order_no}</h1>
          <div className="text-xs text-gray-500">Placed {new Date(order.created_at).toLocaleString("en-IN")}</div>
        </div>
        <Link to="/orders" className="text-sm text-[#E4002B] font-semibold">All orders →</Link>
      </div>

      {/* Timeline */}
      <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-5">
        {isCancelled ? (
          <div className="flex items-center gap-2 text-red-600"><XCircle className="h-5 w-5" /> Order cancelled</div>
        ) : isRejected ? (
          <div className="flex items-center gap-2 text-amber-700"><XCircle className="h-5 w-5" /> Payment proof rejected — please retry payment.</div>
        ) : (
          <div className="flex justify-between gap-2">
            {STEPS.map((s, i) => {
              const done = i <= idx;
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex-1 flex flex-col items-center text-center">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center ${done ? "bg-[#E4002B] text-white" : "bg-gray-100 text-gray-400"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className={`mt-2 text-[11px] font-semibold ${done ? "text-gray-900" : "text-gray-400"}`}>{s.label}</div>
                </div>
              );
            })}
          </div>
        )}
        <div className="text-xs text-gray-500 mt-4">ETA ~{order.eta_minutes} minutes from packed.</div>
      </div>

      {/* UPI proof block */}
      {order.payment_method === "upi_qr" && order.status === "payment_pending" && (
        <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-5" data-testid="upi-proof-block">
          <h3 className="font-display font-bold">Pay via UPI</h3>
          <p className="text-sm text-gray-500">Scan this QR with any UPI app, then enter the UTR/Ref ID and upload the screenshot.</p>
          {order.qr_code ? (
            <div className="mt-3 grid sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <img src={order.qr_code.image_url} alt="UPI QR" className="mx-auto h-48 w-48 object-contain bg-white border border-gray-100 rounded-xl" />
                <div className="text-xs mt-2 text-gray-500">UPI ID: <span className="font-semibold">{order.qr_code.upi_id}</span></div>
                <div className="font-display font-bold text-xl mt-1">Pay ₹{order.total}</div>
              </div>
              <div className="space-y-2 text-sm">
                <input data-testid="upi-utr" value={utr} onChange={(e)=>setUtr(e.target.value)} placeholder="UTR / Reference ID" className="w-full px-3 py-2.5 rounded-xl border border-gray-200" />
                <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-300 cursor-pointer">
                  <Upload className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600 text-xs">{proofFile ? proofFile.name : "Upload payment screenshot"}</span>
                  <input data-testid="upi-proof-file" type="file" accept="image/*" className="hidden" onChange={(e)=>setProofFile(e.target.files?.[0])} />
                </label>
                <button data-testid="submit-proof-btn" onClick={submitProof} disabled={uploading} className="btn-primary w-full py-2.5 disabled:opacity-60">
                  {uploading ? "Submitting..." : "Submit proof for verification"}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-amber-700 mt-3">No UPI QR is configured by the admin yet. Please switch to COD.</div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="font-display font-bold mb-3">Items ({order.items.length})</h3>
        <div className="space-y-2 text-sm">
          {order.items.map((i) => (
            <div key={i.product_id} className="flex justify-between"><span className="text-gray-700">{i.name} × {i.qty}</span><span className="font-semibold">₹{i.line_total}</span></div>
          ))}
        </div>
        <hr className="my-3"/>
        <div className="flex justify-between text-sm"><span>Subtotal</span><span>₹{order.subtotal}</span></div>
        <div className="flex justify-between text-sm"><span>Delivery fee</span><span>{order.delivery_fee === 0 ? "FREE" : `₹${order.delivery_fee}`}</span></div>
        <div className="flex justify-between font-display font-extrabold mt-2"><span>Total</span><span>₹{order.total}</span></div>
        <div className="text-xs text-gray-500 mt-2">Payment: {order.payment_method.toUpperCase()} · {order.payment_status}</div>
      </div>
    </div>
  );
}
