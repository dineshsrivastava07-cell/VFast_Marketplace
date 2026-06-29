import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Helmet } from "../../components/Helmet";
import { toast } from "sonner";

export default function AdminSellerKYC() {
  const [list, setList] = useState([]);
  const load = () => api.get("/seller/admin/kyc").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  const review = async (kyc, status) => {
    let reason = "";
    if (status === "rejected") { reason = prompt("Rejection reason?") || ""; }
    try { await api.post(`/seller/admin/kyc/${kyc.id}/approve`, { status, reason }); toast.success(`KYC ${status}`); load(); }
    catch (e) { toast.error("Failed"); }
  };
  return (
    <div data-testid="admin-seller-kyc">
      <Helmet title="Seller KYC" />
      <h1 className="font-display text-2xl font-bold mb-2">Seller KYC review</h1>
      <p className="text-sm text-gray-500 mb-4">Approve or reject seller onboarding applications.</p>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 bg-gray-50"><tr><th className="py-2 px-3">Business</th><th>GSTIN</th><th>PAN</th><th>FSSAI</th><th>City</th><th>Status</th><th>Submitted</th><th></th></tr></thead>
          <tbody>
            {list.map((k) => (
              <tr key={k.id} className="border-t border-gray-50" data-testid={`kyc-row-${k.id}`}>
                <td className="py-2 px-3 font-semibold">{k.business_name}</td>
                <td className="font-mono text-xs">{k.gstin}</td>
                <td className="font-mono text-xs">{k.pan}</td>
                <td className="font-mono text-xs">{k.fssai}</td>
                <td>{k.city}</td>
                <td><span className={`text-xs px-2 py-0.5 rounded-md ${k.status === "approved" ? "bg-emerald-50 text-emerald-700" : k.status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{k.status}</span></td>
                <td className="text-xs">{k.submitted_at ? new Date(k.submitted_at).toLocaleString("en-IN") : "—"}</td>
                <td className="space-x-2 text-xs">
                  {k.status !== "approved" && <button data-testid={`approve-${k.id}`} onClick={() => review(k, "approved")} className="text-emerald-700 font-semibold">Approve</button>}
                  {k.status !== "rejected" && <button data-testid={`reject-${k.id}`} onClick={() => review(k, "rejected")} className="text-red-600 font-semibold">Reject</button>}
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={8} className="py-4 px-3 text-center text-gray-400 text-xs">No KYC applications</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
