import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Link } from "react-router-dom";
import { TrendingUp, ShoppingBag, MapPin, Package, AlertCircle, Users as UsersIcon, Activity, LifeBuoy } from "lucide-react";

const Stat = ({ icon: Icon, label, value, sub, tone = "text-[#E4002B]" }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-4">
    <div className="flex items-center justify-between">
      <div className="text-xs text-gray-500 font-semibold uppercase">{label}</div>
      <Icon className={`h-5 w-5 ${tone}`} />
    </div>
    <div className="font-display text-2xl font-extrabold mt-2">{value}</div>
    {sub && <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>}
  </div>
);

const STATUSES = [
  { id: "placed", label: "Placed", color: "bg-blue-50 text-blue-700 border-blue-100" },
  { id: "payment_verifying", label: "Verifying pay", color: "bg-amber-50 text-amber-700 border-amber-100" },
  { id: "packed", label: "Packed", color: "bg-purple-50 text-purple-700 border-purple-100" },
  { id: "out_for_delivery", label: "Out for delivery", color: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  { id: "delivered", label: "Delivered", color: "bg-green-50 text-green-700 border-green-100" },
  { id: "cancelled", label: "Cancelled", color: "bg-red-50 text-red-700 border-red-100" },
];

function BarChart({ data, valueKey, labelKey, max }) {
  const maxV = max || Math.max(1, ...data.map(d => d[valueKey] || 0));
  return (
    <div className="flex items-end h-32 gap-1">
      {data.map((d, i) => {
        const h = (d[valueKey] || 0) / maxV * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d[labelKey]}: ${d[valueKey]}`}>
            <div className="w-full bg-[#FDE6EA] rounded-t-md relative" style={{ height: `${Math.max(h, 2)}%` }}>
              <div className="absolute inset-x-0 bottom-0 bg-[#E4002B] rounded-t-md" style={{ height: `${h}%` }}></div>
            </div>
            {i % 3 === 0 && <div className="text-[8px] text-gray-400">{d[labelKey]}</div>}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboard() {
  const [d, setD] = useState(null);
  const refresh = () => api.get("/admin/dashboard/live").then(r => setD(r.data));
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t); }, []);
  if (!d) return <div className="text-gray-500">Loading...</div>;
  const k = d.kpis;
  const revToday = k.today_gmv;
  const revYday = k.yesterday_gmv;
  const revPct = revYday > 0 ? Math.round(((revToday - revYday) / revYday) * 100) : 0;
  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-2xl font-bold">Live dashboard</h1>
        <div className="flex gap-2">
          <Link to="/admin/orders" className="text-xs btn-primary px-3 py-2" data-testid="qa-pending">View orders</Link>
          <Link to="/admin/payment-queue" className="text-xs px-3 py-2 rounded-xl border border-gray-200 font-semibold bg-white">Verify payments ({k.pending_payments})</Link>
          <Link to="/admin/inventory" className="text-xs px-3 py-2 rounded-xl border border-gray-200 font-semibold bg-white">Low stock ({k.low_stock_alerts})</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat icon={ShoppingBag} label="Orders today" value={k.today_orders} />
        <Stat icon={TrendingUp} label="GMV today" value={`₹${k.today_gmv}`} sub={`${revPct >= 0 ? "+" : ""}${revPct}% vs yesterday`} tone={revPct >= 0 ? "text-green-600" : "text-red-600"} />
        <Stat icon={UsersIcon} label="Active riders" value={k.active_riders} tone="text-indigo-600" />
        <Stat icon={AlertCircle} label="Pending pay" value={k.pending_payments} tone="text-amber-600" />
        <Stat icon={Package} label="Low stock" value={k.low_stock_alerts} tone="text-red-600" />
        <Stat icon={LifeBuoy} label="Open tickets" value={k.open_tickets} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="font-display font-bold mb-3 flex items-center gap-2"><Activity className="h-4 w-4" /> Live operations board</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {STATUSES.map(s => (
              <div key={s.id} data-testid={`ops-${s.id}`} className={`border rounded-xl p-3 ${s.color}`}>
                <div className="text-[10px] uppercase font-bold tracking-wide">{s.label}</div>
                <div className="font-display text-2xl font-extrabold">{d.ops_board[s.id] ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="font-display font-bold mb-3">Hourly orders (24h)</div>
          <BarChart data={d.hourly_orders} valueKey="orders" labelKey="hour" />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="font-display font-bold mb-3">Revenue today vs yesterday</div>
          <div className="flex items-end gap-6 h-32">
            <div className="flex-1 flex flex-col items-center justify-end">
              <div className="font-display font-bold mb-1">₹{k.today_gmv}</div>
              <div className="w-16 bg-[#E4002B] rounded-t-lg" style={{ height: `${Math.min(100, (revToday / Math.max(1, Math.max(revToday, revYday))) * 100)}%`, minHeight: 6 }}></div>
              <div className="mt-1 text-xs text-gray-500">Today</div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-end">
              <div className="font-display font-bold mb-1">₹{k.yesterday_gmv}</div>
              <div className="w-16 bg-gray-400 rounded-t-lg" style={{ height: `${Math.min(100, (revYday / Math.max(1, Math.max(revToday, revYday))) * 100)}%`, minHeight: 6 }}></div>
              <div className="mt-1 text-xs text-gray-500">Yesterday</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="font-display font-bold mb-3">Category sales today</div>
          {d.category_sales.length === 0 ? <div className="text-sm text-gray-500">No sales yet today.</div> :
            <div className="space-y-2">
              {d.category_sales.map((c, i) => {
                const max = d.category_sales[0].revenue || 1;
                const pct = Math.round((c.revenue / max) * 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs"><span className="font-semibold">{c.category}</span><span>₹{c.revenue}</span></div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#E4002B]" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>}
        </div>
      </div>
    </div>
  );
}
