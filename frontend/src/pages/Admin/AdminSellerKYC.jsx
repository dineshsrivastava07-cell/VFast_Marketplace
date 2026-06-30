import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Helmet } from "../../components/Helmet";
import { toast } from "sonner";
import { X } from "lucide-react";

const FILTERS = [["all","All"],["pending_review","Pending"],["info_requested","Info requested"],["approved","Approved"],["rejected","Rejected"]];

export default function AdminSellerKYC() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState(null);

  const load = () => api.get("/seller/admin/kyc").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const review = async (kyc, status) => {
    let reason = "";
    if (status === "rejected") { reason = prompt("Rejection reason?") || ""; }
    try { await api.post(`/seller/admin/kyc/${kyc.id}/approve`, { status, reason }); toast.success(`KYC ${status}`); load(); setDetail(null); }
    catch { toast.error("Failed"); }
  };
  const requestInfo = async (kyc) => {
    const message = prompt("What info do you need from the seller?") || "";
    if (!message) return;
    try { await api.post(`/seller/admin/kyc/${kyc.id}/request-info`, { message }); toast.success("Seller will be notified"); load(); setDetail(null); }
    catch { toast.error("Failed"); }
  };

  const filtered = filter === "all" ? list : list.filter((k) => k.status === filter);
  const counts = list.reduce((a, k) => { a[k.status] = (a[k.status] || 0) + 1; return a; }, {});

  return (
    <div data-testid="admin-seller-kyc">
      <Helmet title="Seller KYC" />
      <h1 className="font-display text-2xl font-bold mb-2">Seller KYC review</h1>
      <p className="text-sm text-gray-500 mb-3">Approve, reject or request more info on seller onboarding applications.</p>
      <div className="flex flex-wrap gap-2 mb-3" data-testid="kyc-filters">
        {FILTERS.map(([v, l]) => (
          <button key={v} data-testid={`kyc-tab-${v}`} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${filter === v ? "bg-[#E4002B] text-white" : "bg-white border border-gray-200"}`}>
            {l}{counts[v] !== undefined && v !== "all" && ` (${counts[v]})`}{v === "all" && list.length > 0 && ` (${list.length})`}
          </button>
        ))}
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 bg-gray-50"><tr><th className="py-2 px-3">Business</th><th>GSTIN</th><th>PAN</th><th>FSSAI</th><th>City</th><th>Status</th><th>Submitted</th><th></th></tr></thead>
          <tbody>
            {filtered.map((k) => (
              <tr key={k.id} className="border-t border-gray-50" data-testid={`kyc-row-${k.id}`}>
                <td className="py-2 px-3 font-semibold">{k.business_name}</td>
                <td className="font-mono text-xs">{k.gstin}</td>
                <td className="font-mono text-xs">{k.pan}</td>
                <td className="font-mono text-xs">{k.fssai}</td>
                <td>{k.city}</td>
                <td>
                  <span className={`text-xs px-2 py-0.5 rounded-md ${k.status === "approved" ? "bg-emerald-50 text-emerald-700" : k.status === "rejected" ? "bg-red-50 text-red-700" : k.status === "info_requested" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{k.status}</span>
                  {k.status === "rejected" && k.reject_reason && <div className="text-[10px] text-red-700 mt-1">{k.reject_reason}</div>}
                </td>
                <td className="text-xs">{k.submitted_at ? new Date(k.submitted_at).toLocaleString("en-IN") : "—"}</td>
                <td className="space-x-2 text-xs">
                  <button data-testid={`view-kyc-${k.id}`} onClick={() => setDetail(k)} className="text-blue-600 font-semibold">View</button>
                  {k.status !== "approved" && <button data-testid={`approve-${k.id}`} onClick={() => review(k, "approved")} className="text-emerald-700 font-semibold">Approve</button>}
                  {k.status !== "rejected" && <button data-testid={`reject-${k.id}`} onClick={() => review(k, "rejected")} className="text-red-600 font-semibold">Reject</button>}
                  {k.status === "pending_review" && <button data-testid={`req-info-${k.id}`} onClick={() => requestInfo(k)} className="text-amber-600 font-semibold">Request info</button>}
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={8} className="py-4 px-3 text-center text-gray-400 text-xs">No KYC applications.</td></tr>}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="kyc-detail">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-display font-bold">{detail.business_name}</h3>
              <button onClick={() => setDetail(null)}><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            {Object.entries({
              "GSTIN": detail.gstin, "PAN": detail.pan, "FSSAI": detail.fssai,
              "Address": detail.address, "City": detail.city, "State": detail.state, "PIN": detail.pincode,
              "Bank": detail.bank_name, "Account": detail.bank_account, "IFSC": detail.ifsc,
              "Submitted": detail.submitted_at, "Status": detail.status,
              "Reject reason": detail.reject_reason, "Info requested": detail.request_message,
            }).filter(([_, v]) => v).map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-2 text-sm py-1.5 border-t border-gray-50">
                <div className="text-gray-500 text-xs">{k}</div>
                <div className="col-span-2 font-mono text-xs break-all">{String(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
