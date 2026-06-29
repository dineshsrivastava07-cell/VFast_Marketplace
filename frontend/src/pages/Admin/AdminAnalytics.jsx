import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Helmet } from "../../components/Helmet";
import { TrendingUp, ShoppingBag, Users, Receipt } from "lucide-react";

const Delta = ({ v }) => (
  <span className={`text-xs font-semibold ${v >= 0 ? "text-emerald-600" : "text-red-600"}`}>
    {v >= 0 ? "▲" : "▼"} {Math.abs(v)}%
  </span>
);

const KPI = ({ label, value, delta, icon: Icon }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-4">
    <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide">
      <Icon className="h-4 w-4" /> {label}
    </div>
    <div className="font-display text-2xl font-extrabold mt-1">{value}</div>
    {delta !== undefined && <Delta v={delta} />}
  </div>
);

function TinyBars({ data, valueKey = "gmv", labelKey = "date", height = 120 }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey] || 0));
  return (
    <div className="flex items-end gap-1 h-32" data-testid="trend-bars">
      {data.map((d, i) => {
        const h = ((d[valueKey] || 0) / max) * height;
        return (
          <div key={i} className="flex-1 flex flex-col items-center" title={`${d[labelKey]}: ${d[valueKey]}`}>
            <div className="w-full bg-[#E4002B]/80 rounded-t" style={{ height: `${h}px`, minHeight: "2px" }} />
          </div>
        );
      })}
    </div>
  );
}

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pincodes, setPincodes] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get(`/analytics/overview?days=${days}`).then((r) => setOverview(r.data)),
      api.get(`/analytics/revenue-trend?days=${days}`).then((r) => setTrend(r.data)),
      api.get(`/analytics/top-products?days=${days}`).then((r) => setProducts(r.data)),
      api.get(`/analytics/top-categories?days=${days}`).then((r) => setCategories(r.data)),
      api.get(`/analytics/by-pincode?days=${days}`).then((r) => setPincodes(r.data)),
    ]);
  }, [days]);

  if (!overview) return <div className="p-8 text-gray-500">Loading analytics…</div>;

  return (
    <div data-testid="admin-analytics">
      <Helmet title="Analytics" />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-gray-500">Revenue trend, AOV, repeat rate, top SKUs, and geo distribution.</p>
        </div>
        <select data-testid="analytics-days" value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
          <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
        </select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KPI label="GMV" value={`₹${overview.current.gmv.toLocaleString("en-IN")}`} delta={overview.deltas.gmv} icon={TrendingUp} />
        <KPI label="Orders" value={overview.current.orders} delta={overview.deltas.orders} icon={ShoppingBag} />
        <KPI label="AOV" value={`₹${overview.current.aov}`} delta={overview.deltas.aov} icon={Receipt} />
        <KPI label="Unique customers" value={overview.current.unique_customers} delta={overview.deltas.customers} icon={Users} />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
        <div className="flex justify-between mb-2">
          <h3 className="font-semibold">Revenue trend</h3>
          <span className="text-xs text-gray-500">Repeat rate: <b>{overview.current.repeat_rate}%</b></span>
        </div>
        <TinyBars data={trend} />
        <div className="flex justify-between text-[10px] text-gray-400 mt-2">
          <span>{trend[0]?.date}</span><span>{trend[trend.length - 1]?.date}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <h3 className="font-semibold mb-2">Top products</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500"><tr><th className="py-1">Product</th><th>Qty</th><th className="text-right">Revenue</th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.product_id} className="border-t border-gray-50"><td className="py-2">{p.name}</td><td>{p.qty_sold}</td><td className="text-right">₹{p.revenue.toLocaleString("en-IN")}</td></tr>
              ))}
              {!products.length && <tr><td colSpan={3} className="py-4 text-center text-gray-400 text-xs">No data</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <h3 className="font-semibold mb-2">Top categories</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500"><tr><th className="py-1">Category</th><th>Items</th><th className="text-right">Revenue</th></tr></thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.category_id} className="border-t border-gray-50"><td className="py-2">{c.name}</td><td>{c.qty}</td><td className="text-right">₹{c.revenue.toLocaleString("en-IN")}</td></tr>
              ))}
              {!categories.length && <tr><td colSpan={3} className="py-4 text-center text-gray-400 text-xs">No data</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 lg:col-span-2">
          <h3 className="font-semibold mb-2">By pincode</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500"><tr><th className="py-1">PIN</th><th>Orders</th><th className="text-right">GMV</th></tr></thead>
            <tbody>
              {pincodes.map((p) => (
                <tr key={p.pincode} className="border-t border-gray-50"><td className="py-2 font-mono">{p.pincode}</td><td>{p.orders}</td><td className="text-right">₹{p.gmv.toLocaleString("en-IN")}</td></tr>
              ))}
              {!pincodes.length && <tr><td colSpan={3} className="py-4 text-center text-gray-400 text-xs">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
