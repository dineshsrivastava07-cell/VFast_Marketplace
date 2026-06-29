import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Helmet } from "../components/Helmet";
import api from "../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, User } from "lucide-react";

const STATES = ["Andhra Pradesh","Bihar","Delhi","Gujarat","Haryana","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","West Bengal"];

export default function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name || ""); setEmail(user.email || "");
    api.get("/customer/addresses").then((r) => setAddresses(r.data));
  }, [user]);

  if (!user) return <div className="p-8" data-testid="profile-need-login">Please <Link to="/login" className="text-[#E4002B]">login</Link>.</div>;

  const saveProfile = async () => {
    try {
      const r = await api.patch("/customer/profile", { name, email });
      setUser({ ...user, name: r.data.name, email: r.data.email });
      toast.success("Profile updated");
    } catch (e) { toast.error("Failed"); }
  };

  const saveAddr = async () => {
    try {
      await api.post("/customer/addresses", form);
      toast.success("Address saved"); setForm(null);
      const r = await api.get("/customer/addresses"); setAddresses(r.data);
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const deleteAddr = async (id) => {
    if (!confirm("Delete address?")) return;
    try { await api.delete(`/customer/addresses/${id}`); setAddresses((a) => a.filter((x) => x.id !== id)); }
    catch { toast.error("Failed"); }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="profile-page">
      <Helmet title="My profile" />
      <div className="flex items-center gap-2 mb-4">
        <div className="h-12 w-12 rounded-full bg-[#FDE6EA] text-[#E4002B] flex items-center justify-center"><User className="h-6 w-6" /></div>
        <div>
          <h1 className="font-display text-2xl font-bold">{user.name || "VFast Customer"}</h1>
          <div className="text-xs text-gray-500">{user.phone}</div>
        </div>
      </div>

      <section className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
        <h2 className="font-semibold mb-2">Profile details</h2>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <input data-testid="profile-name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200" />
          <input data-testid="profile-email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200" />
        </div>
        <button data-testid="save-profile" onClick={saveProfile} className="mt-3 btn-primary py-2 px-4 text-sm">Save profile</button>
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">Saved addresses</h2>
          <button data-testid="add-address" onClick={() => setForm({ label: "Home", flat: "", area: "", landmark: "", city: "New Delhi", state: "Delhi", pincode: "", phone: user.phone || "", is_default: addresses.length === 0 })} className="text-[#E4002B] font-semibold text-sm flex items-center gap-1"><Plus className="h-4 w-4" />Add address</button>
        </div>
        <div className="space-y-2">
          {addresses.map((a) => (
            <div key={a.id} className="border border-gray-100 rounded-xl p-3 text-sm flex justify-between" data-testid={`addr-${a.id}`}>
              <div>
                <div className="font-semibold flex items-center gap-1">{a.label} {a.is_default && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">Default</span>}</div>
                <div className="text-xs text-gray-600">{a.flat}, {a.area} {a.landmark && `· ${a.landmark}`}</div>
                <div className="text-xs text-gray-500">{a.city}, {a.state} - {a.pincode} · {a.phone}</div>
              </div>
              <button onClick={() => deleteAddr(a.id)} className="text-red-600 text-xs flex items-center gap-1 self-start"><Trash2 className="h-3 w-3" />Remove</button>
            </div>
          ))}
          {!addresses.length && <div className="text-gray-400 text-sm text-center py-4">No addresses saved.</div>}
        </div>
        {form && (
          <div className="mt-4 p-3 border border-gray-100 rounded-xl" data-testid="address-form">
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <input data-testid="addr-form-label" placeholder="Label (Home / Office)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
              <input data-testid="addr-form-flat" placeholder="Flat / House" value={form.flat} onChange={(e) => setForm({ ...form, flat: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
              <input data-testid="addr-form-area" placeholder="Area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 sm:col-span-2" />
              <input data-testid="addr-form-landmark" placeholder="Landmark" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 sm:col-span-2" />
              <input data-testid="addr-form-city" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
              <select data-testid="addr-form-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200">{STATES.map((s) => <option key={s}>{s}</option>)}</select>
              <input data-testid="addr-form-pin" placeholder="PIN (6 digits)" maxLength={6} value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "") })} className="px-3 py-2 rounded-lg border border-gray-200" />
              <input data-testid="addr-form-phone" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
              <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />Set as default</label>
            </div>
            <div className="flex gap-2 mt-3">
              <button data-testid="save-address" onClick={saveAddr} className="btn-primary py-2 px-4 text-sm">Save address</button>
              <button onClick={() => setForm(null)} className="text-gray-500 text-sm">Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
