import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";

const STATES = ["Andhra Pradesh","Bihar","Delhi","Gujarat","Haryana","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","West Bengal"];

export default function SellerKYC() {
  const [kyc, setKyc] = useState(null);
  const [form, setForm] = useState({
    business_name: "", gstin: "", pan: "", fssai: "",
    address: "", city: "", state: "Delhi", pincode: "",
    bank_name: "", bank_account: "", ifsc: "",
  });
  useEffect(() => {
    api.get("/seller/kyc").then((r) => { setKyc(r.data); if (r.data.business_name) setForm({ ...form, ...r.data }); });
    // eslint-disable-next-line
  }, []);

  const submit = async () => {
    try { await api.post("/seller/kyc", form); toast.success("KYC submitted for review"); const r = await api.get("/seller/kyc"); setKyc(r.data); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const status = kyc?.status || "not_submitted";

  return (
    <div data-testid="seller-kyc-page">
      <h1 className="font-display text-2xl font-bold mb-1">KYC & business details</h1>
      <p className="text-sm text-gray-500 mb-4">VFast verifies every seller. Submit your business and bank info; an admin will review.</p>

      <div className={`rounded-xl p-3 mb-4 text-sm font-semibold ${status === "approved" ? "bg-emerald-50 text-emerald-700" : status === "rejected" ? "bg-red-50 text-red-700" : status === "pending_review" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-700"}`} data-testid="kyc-status">
        Status: {status.replace(/_/g, " ")}
        {kyc?.reject_reason && <div className="text-xs font-normal mt-1">Reason: {kyc.reject_reason}</div>}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
        <h3 className="font-semibold text-sm">Business</h3>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <input data-testid="kyc-bname" placeholder="Business / Trade name" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
          <input data-testid="kyc-gstin" placeholder="GSTIN (15 chars)" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} maxLength={15} className="px-3 py-2 rounded-lg border border-gray-200" />
          <input data-testid="kyc-pan" placeholder="PAN (10 chars)" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} maxLength={10} className="px-3 py-2 rounded-lg border border-gray-200" />
          <input data-testid="kyc-fssai" placeholder="FSSAI No. (14 digits)" value={form.fssai} onChange={(e) => setForm({ ...form, fssai: e.target.value })} maxLength={14} className="px-3 py-2 rounded-lg border border-gray-200" />
          <input data-testid="kyc-address" placeholder="Registered address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 sm:col-span-2" />
          <input data-testid="kyc-city" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
          <select data-testid="kyc-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200">
            {STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <input data-testid="kyc-pin" placeholder="PIN (6 digits)" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "") })} maxLength={6} className="px-3 py-2 rounded-lg border border-gray-200" />
        </div>
        <h3 className="font-semibold text-sm pt-2">Bank (for payouts)</h3>
        <div className="grid sm:grid-cols-3 gap-2 text-sm">
          <input data-testid="kyc-bank" placeholder="Bank name" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
          <input data-testid="kyc-acc" placeholder="Account number" value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
          <input data-testid="kyc-ifsc" placeholder="IFSC" value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })} className="px-3 py-2 rounded-lg border border-gray-200" />
        </div>
        <button data-testid="submit-kyc" onClick={submit} className="btn-primary py-2 px-4 text-sm">Submit for review</button>
      </div>
    </div>
  );
}
