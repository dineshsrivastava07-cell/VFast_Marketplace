import React, { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import { Plus, Pencil, Search, Download, KeyRound, ShieldCheck } from "lucide-react";

const ROLES = [
  ["super_admin", "Super admin"],
  ["admin", "Admin"],
  ["operations", "Operations"],
  ["seller", "Seller"],
  ["delivery_partner", "Delivery partner (rider)"],
  ["customer", "Customer"],
];
const STAFF_ROLES = new Set(["super_admin", "admin", "operations"]);
const FILTERS = [
  ["", "All users"],
  ["staff", "Staff"],
  ["delivery_partner", "Riders"],
  ["seller", "Sellers"],
  ["customer", "Customers"],
];
const VEHICLES = ["bike", "scooter", "bicycle", "ev"];
const EMPTY = { email: "", name: "", role: "admin", password: "", send_welcome: true,
                 phone: "", vehicle: "bike", kyc: { pan: "", license: "", verified: false } };

function downloadCsv(filename, rows, headers) {
  const escape = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminUsers() {
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";
  const [users, setUsers] = useState([]);
  const [rights, setRights] = useState({});
  const [modal, setModal] = useState(null);
  const [resetModal, setResetModal] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");

  const load = async () => {
    const [u, r] = await Promise.all([
      api.get("/admin/users"),
      api.get("/admin/rbac/summary").catch(() => ({ data: {} })),
    ]);
    setUsers(u.data);
    setRights(r.data || {});
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => setModal({ mode: "create", form: { ...EMPTY } });
  const openEdit = (u) => setModal({
    mode: "edit", id: u.id,
    form: {
      email: u.email || "", name: u.name || "", role: u.role || "admin", password: "",
      send_welcome: false, phone: u.phone || "",
      vehicle: u.vehicle || "bike",
      kyc: u.kyc || { pan: "", license: "", verified: false },
    },
  });

  const submit = async () => {
    const f = modal.form;
    if (!f.role) { toast.error("Role is required"); return; }
    try {
      if (modal.mode === "create") {
        if (!f.email) { toast.error("Email is required"); return; }
        if (!f.password) { toast.error("Password is required"); return; }
        const r = await api.post("/admin/users", f);
        toast.success(r.data.action === "updated" ? "Existing user updated" : "User created");
      } else {
        const body = { name: f.name, role: f.role };
        if (f.password) body.password = f.password;
        if (f.role === "delivery_partner") {
          body.phone = f.phone;
          body.vehicle = f.vehicle;
          body.kyc = f.kyc;
        }
        await api.patch(`/admin/users/${modal.id}`, body);
        toast.success("User updated");
      }
      setModal(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const toggleActive = async (u) => {
    try {
      await api.patch(`/admin/users/${u.id}`, { active: !(u.active !== false) });
      toast.success(u.active !== false ? "Deactivated" : "Activated");
      load();
    }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const submitReset = async () => {
    if (!resetModal.new_password || resetModal.new_password.length < 6) {
      toast.error("Password must be at least 6 chars"); return;
    }
    try {
      await api.post(`/admin/users/${resetModal.id}/reset-password`, {
        new_password: resetModal.new_password,
        notify: resetModal.notify,
      });
      toast.success("Password reset");
      setResetModal(null);
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const filtered = useMemo(() => users.filter((u) => {
    if (filter === "staff" && !STAFF_ROLES.has(u.role)) return false;
    if (filter && filter !== "staff" && u.role !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const blob = `${u.name || ""} ${u.email || ""} ${u.phone || ""}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }), [users, filter, search]);

  const dist = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});

  const exportCsv = () => downloadCsv("vfast-users.csv", filtered.map((u) => ({
    id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
    active: u.active !== false, created_at: u.created_at,
  })), ["id", "name", "email", "phone", "role", "active", "created_at"]);

  const isRiderForm = modal?.form?.role === "delivery_partner";

  return (
    <div data-testid="admin-users-page">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold">Users & roles</h1>
        <div className="flex gap-2">
          <button onClick={exportCsv} data-testid="users-export-btn" className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold bg-white"><Download className="h-4 w-4" />Export CSV</button>
          {isSuper && (
            <button data-testid="add-user-btn" onClick={openCreate} className="btn-primary py-2 px-3 text-sm flex items-center gap-1"><Plus className="h-4 w-4" />Add user</button>
          )}
        </div>
      </div>
      {!isSuper && <div className="mb-3 bg-amber-50 border border-amber-100 text-amber-800 text-xs rounded-lg p-2">Only super-admins can add users or edit details. As an admin you can deactivate / reactivate accounts.</div>}

      {/* Role distribution */}
      <div className="flex flex-wrap gap-2 mb-3" data-testid="role-distribution">
        {Object.entries(dist).map(([role, count]) => (
          <span key={role} className="text-xs px-2 py-1 rounded-full bg-gray-100 font-semibold">
            {count} {role.replace(/_/g, " ")}{count !== 1 && "s"}
          </span>
        ))}
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-wrap gap-2 items-center mb-3">
        {FILTERS.map(([v, l]) => (
          <button key={v} data-testid={`users-filter-${v || "all"}`} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${filter === v ? "bg-[#E4002B] text-white" : "bg-white border border-gray-200"}`}>{l}</button>
        ))}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input data-testid="users-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name / email / phone" className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm" />
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500"><tr>
            <th className="py-2 px-3">Name</th>
            <th className="py-2 px-3">Email / Phone</th>
            <th className="py-2 px-3">Role</th>
            <th className="py-2 px-3">Rights</th>
            <th className="py-2 px-3">Status</th>
            <th className="py-2 px-3">Joined</th>
            <th className="py-2 px-3"></th>
          </tr></thead>
          <tbody>
            {filtered.map((u) => {
              const active = u.active !== false;
              const chips = (rights[u.role] || []).slice(0, 4);
              const more = Math.max(0, (rights[u.role] || []).length - chips.length);
              return (
                <tr key={u.id} className="border-t border-gray-100 align-top" data-testid={`user-row-${u.id}`}>
                  <td className="py-2 px-3 font-semibold">{u.name || "—"}</td>
                  <td className="py-2 px-3">{u.email || u.phone || "—"}</td>
                  <td className="py-2 px-3"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-md uppercase">{u.role}</span></td>
                  <td className="py-2 px-3">
                    <div className="flex flex-wrap gap-1 max-w-[280px]" data-testid={`rights-chips-${u.id}`}>
                      {chips.map((m) => (
                        <span key={m} className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                          <ShieldCheck className="h-2.5 w-2.5" />{m.replace(/_/g, " ")}
                        </span>
                      ))}
                      {more > 0 && <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-semibold">+{more} more</span>}
                      {chips.length === 0 && <span className="text-[10px] text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded-md ${active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{active ? "Active" : "Inactive"}</span></td>
                  <td className="py-2 px-3 text-xs text-gray-500">{u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN") : "—"}</td>
                  <td className="py-2 px-3 text-right space-x-2 whitespace-nowrap">
                    <button data-testid={`toggle-active-${u.id}`} onClick={() => toggleActive(u)} className="text-xs text-gray-600 font-semibold">{active ? "Deactivate" : "Activate"}</button>
                    {isSuper && (
                      <>
                        <button data-testid={`edit-user-${u.id}`} onClick={() => openEdit(u)} className="text-xs text-[#E4002B] font-semibold inline-flex items-center gap-1"><Pencil className="h-3 w-3" />Edit</button>
                        <button data-testid={`reset-pw-${u.id}`} onClick={() => setResetModal({ id: u.id, name: u.name, email: u.email, new_password: "", notify: true })} className="text-xs text-indigo-600 font-semibold inline-flex items-center gap-1"><KeyRound className="h-3 w-3" />Reset PW</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={7} className="py-4 px-3 text-center text-gray-400 text-xs">No users match.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-3" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="user-form-modal">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-display font-bold text-lg">{modal.mode === "create" ? "Add user" : "Edit user"}</h3>
              <button onClick={() => setModal(null)} className="text-xs text-gray-500">Cancel</button>
            </div>
            <div className="space-y-2 text-sm">
              <input data-testid="uf-email" placeholder="Email" type="email" value={modal.form.email}
                disabled={modal.mode === "edit"}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, email: e.target.value } })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 disabled:bg-gray-50" />
              <input data-testid="uf-name" placeholder="Full name" value={modal.form.name}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200" />
              <select data-testid="uf-role" value={modal.form.role}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, role: e.target.value } })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200">
                {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input data-testid="uf-password" type="password"
                placeholder={modal.mode === "edit" ? "New password (leave blank to keep current)" : "Password"}
                value={modal.form.password}
                onChange={(e) => setModal({ ...modal, form: { ...modal.form, password: e.target.value } })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200" />

              {isRiderForm && (
                <div className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50" data-testid="uf-rider-extras">
                  <div className="text-[10px] uppercase font-bold text-gray-500">Rider details</div>
                  <input data-testid="uf-phone" placeholder="+91 phone" value={modal.form.phone}
                    onChange={(e) => setModal({ ...modal, form: { ...modal.form, phone: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200" />
                  <select data-testid="uf-vehicle" value={modal.form.vehicle}
                    onChange={(e) => setModal({ ...modal, form: { ...modal.form, vehicle: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200">
                    {VEHICLES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <input data-testid="uf-pan" placeholder="PAN" value={modal.form.kyc.pan}
                    onChange={(e) => setModal({ ...modal, form: { ...modal.form, kyc: { ...modal.form.kyc, pan: e.target.value } } })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200" />
                  <input data-testid="uf-license" placeholder="License no." value={modal.form.kyc.license}
                    onChange={(e) => setModal({ ...modal, form: { ...modal.form, kyc: { ...modal.form.kyc, license: e.target.value } } })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200" />
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" data-testid="uf-kyc-verified" checked={modal.form.kyc.verified}
                    onChange={(e) => setModal({ ...modal, form: { ...modal.form, kyc: { ...modal.form.kyc, verified: e.target.checked } } })} /> KYC verified</label>
                </div>
              )}

              {modal.mode === "create" && (
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input data-testid="uf-welcome" type="checkbox" checked={modal.form.send_welcome}
                    onChange={(e) => setModal({ ...modal, form: { ...modal.form, send_welcome: e.target.checked } })} />
                  Send welcome email with credentials
                </label>
              )}
            </div>
            <button data-testid="uf-save" onClick={submit} className="mt-4 btn-primary py-2 px-4 text-sm w-full">
              {modal.mode === "create" ? "Create user" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {resetModal && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-3" onClick={() => setResetModal(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()} data-testid="reset-pw-modal">
            <h3 className="font-display font-bold text-lg mb-1">Reset password</h3>
            <p className="text-xs text-gray-500 mb-3">Force-set a new password for <b>{resetModal.name || resetModal.email}</b>.</p>
            <input data-testid="reset-new-pw" type="password" placeholder="New password (min 6 chars)" value={resetModal.new_password}
              onChange={(e) => setResetModal({ ...resetModal, new_password: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <label className="flex items-center gap-2 text-xs text-gray-600 mt-2">
              <input data-testid="reset-notify" type="checkbox" checked={resetModal.notify}
                onChange={(e) => setResetModal({ ...resetModal, notify: e.target.checked })} />
              Email the new password to the user
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setResetModal(null)} className="text-sm text-gray-500">Cancel</button>
              <button data-testid="reset-pw-save" onClick={submitReset} className="btn-primary px-4 py-2 text-sm">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
