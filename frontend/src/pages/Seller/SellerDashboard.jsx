import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { Package, ShoppingBag, IndianRupee, AlertTriangle } from "lucide-react";

const KPI = ({ label, value, icon: Icon, accent }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-4">
    <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide">
      <Icon className={`h-4 w-4 ${accent}`} /> {label}
    </div>
    <div className="font-display text-2xl font-extrabold mt-1">{value}</div>
  </div>
);

export default function SellerDashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/seller/dashboard").then((r) => setD(r.data)); }, []);
  if (!d) return <div className="text-gray-500">Loading…</div>;
  return (
    <div data-testid="seller-dashboard">
      <h1 className="font-display text-2xl font-bold">Welcome, Seller</h1>
      <p className="text-sm text-gray-500 mb-4">Manage your VFast catalog and track sales here.</p>

      {d.kyc_status !== "approved" && (
        <div className="bg-amber-50 border border-amber-100 text-amber-800 rounded-xl p-3 mb-4 text-sm flex items-center justify-between" data-testid="seller-kyc-banner">
          <span><AlertTriangle className="inline h-4 w-4 mr-1" />Your KYC is <b>{d.kyc_status}</b>. Complete it to start selling.</span>
          <Link to="/seller/kyc" className="text-[#E4002B] font-semibold">Complete KYC →</Link>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="My products" value={d.products} icon={Package} accent="text-blue-600" />
        <KPI label="Today's orders" value={d.today_orders} icon={ShoppingBag} accent="text-emerald-600" />
        <KPI label="Today's GMV" value={`₹${d.today_gmv.toLocaleString("en-IN")}`} icon={IndianRupee} accent="text-emerald-600" />
        <KPI label="Pending fulfilment" value={d.pending_fulfilment} icon={AlertTriangle} accent="text-amber-600" />
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <h3 className="font-semibold mb-2">This week</h3>
          <div className="text-3xl font-display font-extrabold">₹{d.week_gmv.toLocaleString("en-IN")}</div>
          <div className="text-xs text-gray-500">GMV last 7 days</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <h3 className="font-semibold mb-2">Stock alert</h3>
          <div className="text-3xl font-display font-extrabold">{d.out_of_stock}</div>
          <div className="text-xs text-gray-500">Out of stock SKUs</div>
        </div>
      </div>
    </div>
  );
}
