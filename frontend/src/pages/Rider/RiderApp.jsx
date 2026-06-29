import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";
import { Helmet } from "../../components/Helmet";
import { toast } from "sonner";
import { Power, MapPin, Phone, Package, CheckCircle2, Upload, LogOut, IndianRupee, Bike } from "lucide-react";

export default function RiderApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [orders, setOrders] = useState({ active: [], recent: [] });
  const [available, setAvailable] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [tab, setTab] = useState("active");
  const [deliverFor, setDeliverFor] = useState(null);
  const [pod, setPod] = useState({ photo_url: "", signed_by: "", notes: "", cod_collected: false });

  const refresh = async () => {
    try {
      const [m, o, a, e] = await Promise.all([
        api.get("/rider/me").then((r) => r.data),
        api.get("/rider/orders").then((r) => r.data),
        api.get("/rider/available").then((r) => r.data),
        api.get("/rider/earnings").then((r) => r.data),
      ]);
      setMe(m); setOrders(o); setAvailable(a); setEarnings(e);
    } catch (err) { /* silent */ }
  };

  useEffect(() => {
    if (!user || user.role !== "delivery_partner") return;
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [user]);

  if (user === undefined) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!user || user.role !== "delivery_partner")
    return <div className="p-8" data-testid="rider-unauth">Please <Link to="/rider/login" className="text-[#E4002B]">login as rider</Link>.</div>;
  if (!me) return <div className="p-8 text-gray-500">Loading rider workspace…</div>;

  const isOnline = me.rider.status === "online" || me.rider.status === "on_delivery";

  const toggleAvail = async () => {
    try {
      await api.post("/rider/availability", { status: isOnline ? "offline" : "online" });
      toast.success(isOnline ? "You are offline" : "You are online");
      refresh();
    } catch { toast.error("Failed"); }
  };
  const accept = async (no) => { try { await api.post(`/rider/orders/${no}/accept`); toast.success("Order accepted"); refresh(); } catch (e) { toast.error(e.response?.data?.detail || "Failed"); } };
  const pickup = async (no) => { try { await api.post(`/rider/orders/${no}/pickup`); toast.success("Picked up, out for delivery"); refresh(); } catch { toast.error("Failed"); } };
  const codMark = async (no) => { try { await api.post(`/rider/orders/${no}/cod-collected`); toast.success("COD cash collected"); refresh(); } catch { toast.error("Failed"); } };

  const uploadPodPhoto = async (file) => {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await api.post("/payments/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPod((p) => ({ ...p, photo_url: r.data.url }));
      toast.success("Photo uploaded");
    } catch { toast.error("Upload failed"); }
  };

  const submitDelivery = async () => {
    if (!pod.signed_by) { toast.error("Capture recipient name"); return; }
    try {
      await api.post(`/rider/orders/${deliverFor.order_no}/deliver`, pod);
      toast.success("Delivered ✔");
      setDeliverFor(null); setPod({ photo_url: "", signed_by: "", notes: "", cod_collected: false });
      refresh();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const OrderCard = ({ o, mode }) => (
    <div className="bg-white border border-gray-100 rounded-2xl p-4" data-testid={`rider-order-${o.order_no}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono font-semibold">{o.order_no}</div>
          <div className="text-xs text-gray-500">{new Date(o.created_at).toLocaleTimeString("en-IN")} · ₹{o.total} · {o.payment_method?.toUpperCase()}</div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-md ${o.status === "delivered" ? "bg-emerald-50 text-emerald-700" : o.status === "out_for_delivery" ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700"}`}>{o.status.replace(/_/g, " ")}</span>
      </div>
      <div className="text-sm mt-2 text-gray-700">
        <div className="flex items-start gap-1"><MapPin className="h-3.5 w-3.5 mt-0.5 text-gray-400" />{o.address?.flat}, {o.address?.area}, {o.address?.city} - {o.address?.pincode}</div>
        <div className="flex items-center gap-1 mt-1"><Phone className="h-3.5 w-3.5 text-gray-400" />{o.customer_phone}</div>
        <div className="text-xs text-gray-500 mt-1">{o.items.length} item(s) · ETA {o.eta_minutes}m</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "available" && <button data-testid={`accept-${o.order_no}`} onClick={() => accept(o.order_no)} className="btn-primary py-1.5 px-3 text-xs">Accept</button>}
        {mode === "active" && o.status === "packed" && <button data-testid={`pickup-${o.order_no}`} onClick={() => pickup(o.order_no)} className="btn-primary py-1.5 px-3 text-xs">Mark picked up</button>}
        {mode === "active" && o.status === "out_for_delivery" && (
          <button data-testid={`deliver-${o.order_no}`} onClick={() => setDeliverFor(o)} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Mark delivered</button>
        )}
        {mode === "active" && o.payment_method === "cod" && o.payment_status !== "collected" && (
          <button data-testid={`cod-${o.order_no}`} onClick={() => codMark(o.order_no)} className="border border-emerald-500 text-emerald-700 rounded-lg py-1.5 px-3 text-xs flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5" />Mark COD collected</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24" data-testid="rider-app">
      <Helmet title="Rider · VFast" />
      <header className="bg-gray-900 text-white px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-[#E4002B] flex items-center justify-center"><Bike className="h-4 w-4" /></div>
            <div>
              <div className="font-display font-bold">{me.rider.name}</div>
              <div className="text-[10px] text-white/60 uppercase">{me.rider.vehicle || "rider"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button data-testid="avail-toggle" onClick={toggleAvail} className={`rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1 ${isOnline ? "bg-emerald-500" : "bg-gray-700"}`}>
              <Power className="h-3.5 w-3.5" />{isOnline ? "Online" : "Offline"}
            </button>
            <button onClick={() => { logout(); navigate("/rider/login"); }} data-testid="rider-logout" className="text-white/70 hover:text-white"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="bg-white/10 rounded-lg py-2">
            <div className="text-xs text-white/60">Today</div>
            <div className="font-display text-lg font-bold">{me.today_delivered}</div>
          </div>
          <div className="bg-white/10 rounded-lg py-2">
            <div className="text-xs text-white/60">Earnings</div>
            <div className="font-display text-lg font-bold">₹{me.earnings_today}</div>
          </div>
          <div className="bg-white/10 rounded-lg py-2">
            <div className="text-xs text-white/60">Lifetime</div>
            <div className="font-display text-lg font-bold">{me.lifetime_delivered}</div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-3 py-4">
        <div className="flex gap-2 mb-3">
          {[["active", `Active (${orders.active.length})`], ["available", `Available (${available.length})`], ["recent", "Recent"], ["earnings", "Earnings"]].map(([id, label]) => (
            <button key={id} data-testid={`rider-tab-${id}`} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${tab === id ? "bg-[#E4002B] text-white" : "bg-white border border-gray-200 text-gray-700"}`}>{label}</button>
          ))}
        </div>

        {tab === "active" && (
          <div className="space-y-2">
            {orders.active.map((o) => <OrderCard key={o.order_no} o={o} mode="active" />)}
            {!orders.active.length && <div className="text-gray-400 text-sm text-center py-8"><Package className="inline h-4 w-4 mr-1" />No active orders. Check Available tab.</div>}
          </div>
        )}
        {tab === "available" && (
          <div className="space-y-2">
            {!isOnline && <div className="text-amber-700 text-xs bg-amber-50 border border-amber-100 rounded-lg p-2">Go online to accept orders.</div>}
            {available.map((o) => <OrderCard key={o.order_no} o={o} mode="available" />)}
            {!available.length && <div className="text-gray-400 text-sm text-center py-8">No available orders right now.</div>}
          </div>
        )}
        {tab === "recent" && (
          <div className="space-y-2">
            {orders.recent.map((o) => <OrderCard key={o.order_no} o={o} mode="recent" />)}
            {!orders.recent.length && <div className="text-gray-400 text-sm text-center py-8">No recent deliveries.</div>}
          </div>
        )}
        {tab === "earnings" && earnings && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4" data-testid="rider-earnings">
            <div className="font-display text-2xl font-extrabold">₹{earnings.total_14d}</div>
            <div className="text-xs text-gray-500">Last 14 days · ₹25 per delivered order</div>
            <table className="w-full text-sm mt-3">
              <thead className="text-left text-xs text-gray-500"><tr><th className="py-1">Date</th><th>Deliveries</th><th className="text-right">Earnings</th></tr></thead>
              <tbody>
                {earnings.daily.map((d) => (
                  <tr key={d.date} className="border-t border-gray-50"><td className="py-1.5">{d.date}</td><td>{d.deliveries}</td><td className="text-right">₹{d.earnings}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delivery modal */}
      {deliverFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-3" data-testid="deliver-modal">
          <div className="bg-white w-full max-w-md rounded-2xl p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-display font-bold">Proof of delivery</h3>
              <button onClick={() => setDeliverFor(null)} className="text-xs text-gray-500">Cancel</button>
            </div>
            <div className="text-xs text-gray-500 mb-2">Order <span className="font-mono">{deliverFor.order_no}</span> · ₹{deliverFor.total} · {deliverFor.payment_method?.toUpperCase()}</div>
            <input data-testid="pod-name" placeholder="Received by (name)" value={pod.signed_by} onChange={(e) => setPod({ ...pod, signed_by: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-2" />
            <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-300 cursor-pointer text-sm">
              <Upload className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600 text-xs">{pod.photo_url ? "Photo uploaded ✓" : "Upload photo at door (optional)"}</span>
              <input data-testid="pod-photo" type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => uploadPodPhoto(e.target.files?.[0])} />
            </label>
            <input data-testid="pod-notes" placeholder="Notes (optional)" value={pod.notes} onChange={(e) => setPod({ ...pod, notes: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mt-2" />
            {deliverFor.payment_method === "cod" && (
              <label className="flex items-center gap-2 mt-2 text-sm">
                <input type="checkbox" data-testid="pod-cod" checked={pod.cod_collected} onChange={(e) => setPod({ ...pod, cod_collected: e.target.checked })} />
                COD cash collected
              </label>
            )}
            <button data-testid="confirm-deliver" onClick={submitDelivery} className="mt-3 w-full btn-primary py-2.5">Confirm delivery</button>
          </div>
        </div>
      )}
    </div>
  );
}
