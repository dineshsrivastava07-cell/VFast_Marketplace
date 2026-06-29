import React, { useEffect, useState } from "react";
import api from "../../lib/api";

export default function SellerPayouts() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/seller/payouts").then((r) => setList(r.data)); }, []);
  return (
    <div data-testid="seller-payouts">
      <h1 className="font-display text-2xl font-bold mb-4">Payouts</h1>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 bg-gray-50"><tr><th className="py-2 px-3">Period</th><th>GMV</th><th>Commission</th><th>Payout</th><th>Status</th><th>UTR</th></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className="border-t border-gray-50">
                <td className="py-2 px-3 text-xs">{(s.period_from || "").slice(0, 10)} → {(s.period_to || "").slice(0, 10)}</td>
                <td>₹{s.gmv}</td><td>₹{s.commission}</td><td className="font-semibold">₹{s.payout}</td>
                <td><span className={`text-xs px-2 py-0.5 rounded-md ${s.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{s.status}</span></td>
                <td className="text-xs font-mono">{s.utr || "—"}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6} className="py-6 px-3 text-center text-gray-400 text-xs">No payouts yet. Admin will settle after delivered orders accumulate.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
