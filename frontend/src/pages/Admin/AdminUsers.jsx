import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

const ROLES = [
  ["super_admin", "Super admin"],
  ["admin", "Admin"],
  ["operations", "Operations"],
  ["seller", "Seller"],
  ["delivery_partner", "Delivery partner (rider)"],
  ["customer", "Customer"],
];

const EMPTY = { email: "", name: "", role: "admin", password: "" };

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null); // null | {mode:"create", form} | {mode:"edit", id, form}
  const isSuper = user?.role === "super_admin";

  const load = () => api.get("/admin/users").then((r) => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const openCreate = () => setModal({ mode: "create", form: { ...EMPTY } });
  const openEdit = (u) => setModal({
    mode: "edit", id: u.id,
    form: { email: u.email || "", name: u.name || "", role: u.role || "admin", password: "" },
  });

  const submit = async () => {
    const f = modal.form;
    if (!f.email && modal.mode === "create") { toast.error("Email is required"); return; }
    if (!f.role) { toast.error("Role is required"); return; }
    try {
      if (modal.mode === "create") {
        if (!f.password) { toast.error("Password is required"); return; }
        const r = await api.post("/admin/users", f);
        toast.success(r.data.action === "updated" ? "Existing user updated" : "User created");
      } else {
        const body = { name: f.name, role: f.role };
        if (f.password) body.password = f.password;
        await api.patch(`/admin/users/${modal.id}`, body);
        toast.success("User updated");
      }
      setModal(null); load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  };

  return (
    <div data-testid="admin-users-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl font-bold">Users & roles</h1>
        {isSuper && (
          <button data-testid="add-user-btn" onClick={openCreate} className="btn-primary py-2 px-3 text-sm flex items-center gap-1">
            <Plus className="h-4 w-4" />Add user
          </button>
        )}
      </div>
      {!isSuper && <div className="mb-3 bg-amber-50 border border-amber-100 text-amber-800 text-xs rounded-lg p-2">Only super-admins can create or edit users.</div>}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500"><tr>
            <th className="py-2 px-3">Name</th><th className="py-2 px-3">Email / Phone</th><th className="py-2 px-3">Role</th><th className="py-2 px-3">Joined</th><th className="py-2 px-3"></th>
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-100" data-testid={`user-row-${u.id}`}>
                <td className="py-2 px-3 font-semibold">{u.name || "—"}</td>
                <td className="py-2 px-3">{u.email || u.phone || "—"}</td>
                <td className="py-2 px-3"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-md uppercase">{u.role}</span></td>
                <td className="py-2 px-3 text-xs text-gray-500">{u.created_at ? new Date(u.created_at).toLocaleString("en-IN") : "—"}</td>
                <td className="py-2 px-3 text-right">
                  {isSuper && (
                    <button data-testid={`edit-user-${u.id}`} onClick={() => openEdit(u)} className="text-xs text-[#E4002B] font-semibold flex items-center gap-1 ml-auto">
                      <Pencil className="h-3 w-3" />Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={5} className="py-4 px-3 text-center text-gray-400 text-xs">No users yet</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-3" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()} data-testid="user-form-modal">
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
            </div>
            <button data-testid="uf-save" onClick={submit} className="mt-4 btn-primary py-2 px-4 text-sm w-full">
              {modal.mode === "create" ? "Create user" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
