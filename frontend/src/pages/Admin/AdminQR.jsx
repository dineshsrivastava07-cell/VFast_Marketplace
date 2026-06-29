import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Upload } from "lucide-react";
import { toast } from "sonner";

export default function AdminQR() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ label: "", upi_id: "", image_url: "", scope: "global", pincode: "", active: true });
  const [uploading, setUploading] = useState(false);
  const refresh = () => api.get("/admin/qr-codes").then(r => setList(r.data));
  useEffect(() => { refresh(); }, []);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await api.post("/payments/upload", fd, { headers: { "Content-Type": "multipart/form-data" }});
      setForm((f) => ({ ...f, image_url: r.data.url }));
      toast.success("Image uploaded");
    } catch (e) { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.label || !form.upi_id || !form.image_url) { toast.error("Fill label, UPI ID and image"); return; }
    if (form.scope === "pincode" && !/^\d{6}$/.test(form.pincode)) { toast.error("Pincode required for scoped QR"); return; }
    await api.post("/admin/qr-codes", form);
    setForm({ label: "", upi_id: "", image_url: "", scope: "global", pincode: "", active: true });
    toast.success("QR saved");
    refresh();
  };
  const del = async (id) => { await api.delete(`/admin/qr-codes/${id}`); refresh(); };

  return (
    <div className="space-y-4" data-testid="admin-qr-page">
      <h1 className="font-display text-2xl font-bold">UPI QR codes</h1>
      <div className="bg-white border border-gray-100 rounded-2xl p-4 grid sm:grid-cols-2 gap-3 text-sm">
        <input data-testid="qr-label" value={form.label} onChange={(e)=>setForm({...form, label:e.target.value})} placeholder="Label (e.g. Delhi NCR Main QR)" className="px-3 py-2 rounded-xl border border-gray-200" />
        <input data-testid="qr-upi-id" value={form.upi_id} onChange={(e)=>setForm({...form, upi_id:e.target.value})} placeholder="UPI ID (e.g. vfast@upi)" className="px-3 py-2 rounded-xl border border-gray-200" />
        <select data-testid="qr-scope" value={form.scope} onChange={(e)=>setForm({...form, scope:e.target.value})} className="px-3 py-2 rounded-xl border border-gray-200">
          <option value="global">Global default</option>
          <option value="pincode">PIN-scoped</option>
        </select>
        <input data-testid="qr-pincode" value={form.pincode} onChange={(e)=>setForm({...form, pincode:e.target.value.replace(/\D/g,"")})} placeholder="PIN (only if PIN-scoped)" maxLength={6} className="px-3 py-2 rounded-xl border border-gray-200" />
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 cursor-pointer sm:col-span-2">
          <Upload className="h-4 w-4 text-gray-500" />
          <span className="text-xs text-gray-600">{form.image_url ? "Replace QR image" : "Upload QR image"}</span>
          <input data-testid="qr-image-file" type="file" accept="image/*" className="hidden" onChange={(e)=>upload(e.target.files?.[0])} />
          {uploading && <span className="text-xs text-amber-600">uploading…</span>}
        </label>
        {form.image_url && <img src={form.image_url} alt="QR preview" className="h-40 w-40 object-contain border border-gray-100 rounded-xl bg-white" />}
        <button data-testid="qr-save" onClick={save} className="btn-primary py-2 sm:col-span-2">Save QR</button>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {list.map(q => (
          <div key={q.id} className="bg-white border border-gray-100 rounded-2xl p-3" data-testid={`qr-card-${q.id}`}>
            <img src={q.image_url} alt={q.label} className="w-full h-44 object-contain bg-gray-50 rounded-xl" />
            <div className="mt-2 font-semibold">{q.label}</div>
            <div className="text-xs text-gray-500">{q.scope === "pincode" ? `PIN ${q.pincode}` : "Global"} · {q.upi_id}</div>
            <button data-testid={`qr-del-${q.id}`} onClick={()=>del(q.id)} className="mt-2 text-xs text-red-600">Delete</button>
          </div>
        ))}
        {list.length === 0 && <div className="text-gray-500">No QR codes yet.</div>}
      </div>
    </div>
  );
}
