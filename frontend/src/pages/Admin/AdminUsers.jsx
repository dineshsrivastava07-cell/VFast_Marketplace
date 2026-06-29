import React, { useEffect, useState } from "react";
import api from "../../lib/api";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  useEffect(() => { api.get("/admin/users").then(r => setUsers(r.data)); }, []);
  return (
    <div data-testid="admin-users-page">
      <h1 className="font-display text-2xl font-bold mb-4">Users & roles</h1>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500"><tr><th className="py-2 px-3">Name</th><th className="py-2 px-3">Email / Phone</th><th className="py-2 px-3">Role</th><th className="py-2 px-3">Joined</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-gray-100">
                <td className="py-2 px-3 font-semibold">{u.name || "—"}</td>
                <td className="py-2 px-3">{u.email || u.phone || "—"}</td>
                <td className="py-2 px-3"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-md uppercase">{u.role}</span></td>
                <td className="py-2 px-3 text-xs text-gray-500">{u.created_at ? new Date(u.created_at).toLocaleString("en-IN") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
