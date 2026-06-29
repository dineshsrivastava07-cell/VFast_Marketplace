import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";

export default function AdminRBAC() {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState({});

  const refresh = async () => {
    const [r, u] = await Promise.all([api.get("/admin/rbac"), api.get("/admin/users")]);
    setData(r.data); setUsers(u.data);
    const init = {};
    r.data.roles.forEach(role => { init[role.role] = JSON.parse(JSON.stringify(role.permissions || {})); });
    setEditing(init);
  };
  useEffect(() => { refresh(); }, []);

  const toggle = (role, module, action) => {
    setEditing(prev => {
      const next = { ...prev };
      next[role] = { ...next[role] };
      const arr = next[role][module] || [];
      next[role][module] = arr.includes(action) ? arr.filter(a => a !== action) : [...arr, action];
      return next;
    });
  };
  const save = async (role) => {
    await api.post(`/admin/rbac/${role}`, { permissions: editing[role] });
    toast.success(`${role} permissions saved`);
  };
  const setUserRole = async (uid, role) => {
    await api.post(`/admin/rbac/users/${uid}/role`, { role });
    toast.success("Role updated"); refresh();
  };

  if (!data) return <div className="text-gray-500">Loading…</div>;

  return (
    <div className="space-y-6" data-testid="admin-rbac-page">
      <h1 className="font-display text-2xl font-bold">Roles & permissions</h1>
      <div className="space-y-4">
        {data.roles.map(role => (
          <div key={role.role} className="bg-white border border-gray-100 rounded-2xl p-4" data-testid={`role-${role.role}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-display font-bold uppercase">{role.role.replace(/_/g, " ")}</div>
              <button data-testid={`save-rbac-${role.role}`} onClick={() => save(role.role)} className="btn-primary px-3 py-1.5 text-xs">Save</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-gray-500 uppercase"><th className="py-1 pr-2">Module</th>{data.actions.map(a => <th key={a} className="py-1 px-2">{a}</th>)}</tr></thead>
                <tbody>
                  {data.modules.map(m => (
                    <tr key={m} className="border-t border-gray-100">
                      <td className="py-1 pr-2 font-semibold">{m}</td>
                      {data.actions.map(a => (
                        <td key={a} className="py-1 px-2"><input type="checkbox" data-testid={`perm-${role.role}-${m}-${a}`} checked={(editing[role.role]?.[m] || []).includes(a)} onChange={() => toggle(role.role, m, a)} disabled={role.role === "super_admin"} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="font-display font-bold mb-3">Assign role to user</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500"><tr><th className="py-2 px-3">Name</th><th className="py-2 px-3">Email / Phone</th><th className="py-2 px-3">Role</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="py-2 px-3 font-semibold">{u.name || "—"}</td>
                  <td className="py-2 px-3 text-xs">{u.email || u.phone}</td>
                  <td className="py-2 px-3">
                    <select data-testid={`user-role-${u.id}`} value={u.role} onChange={(e) => setUserRole(u.id, e.target.value)} className="px-2 py-1 rounded-md border border-gray-200 text-xs">
                      {data.roles.map(r => <option key={r.role} value={r.role}>{r.role}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
