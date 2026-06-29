import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";

export default function AdminStores() {
  const [tab, setTab] = useState("stores");
  const [stores, setStores] = useState([]);
  const [zones, setZones] = useState([]);
  const [editStore, setEditStore] = useState(null);
  const [editZone, setEditZone] = useState(null);

  const refresh = async () => {
    const [s, z] = await Promise.all([api.get("/admin/stores"), api.get("/admin/zones")]);
    setStores(s.data); setZones(z.data);
  };
  useEffect(() => { refresh(); }, []);

  const saveStore = async () => {
    if (!editStore.name) return toast.error("Name required");
    await api.post("/admin/stores", { ...editStore, pincodes: (editStore.pincodes_str || "").split(",").map(s => s.trim()).filter(Boolean) });
    toast.success("Store saved"); setEditStore(null); refresh();
  };
  const delStore = async (id) => {
    if (!window.confirm("Delete store?")) return;
    await api.delete(`/admin/stores/${id}`); toast.success("Deleted"); refresh();
  };
  const saveZone = async () => {
    if (!editZone.name) return toast.error("Name required");
    await api.post("/admin/zones", { ...editZone, pincodes: (editZone.pincodes_str || "").split(",").map(s => s.trim()).filter(Boolean) });
    toast.success("Zone saved"); setEditZone(null); refresh();
  };
  const delZone = async (id) => {
    if (!window.confirm("Delete zone?")) return;
    await api.delete(`/admin/zones/${id}`); toast.success("Deleted"); refresh();
  };

  return (
    <div className="space-y-4" data-testid="admin-stores-page">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Dark stores & zones</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab("stores")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab==="stores"?"bg-[#E4002B] text-white":"bg-white border border-gray-200"}`} data-testid="stores-tab-stores">Dark stores</button>
          <button onClick={() => setTab("zones")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab==="zones"?"bg-[#E4002B] text-white":"bg-white border border-gray-200"}`} data-testid="stores-tab-zones">Zones</button>
        </div>
      </div>

      {tab === "stores" && (
        <>
          <button data-testid="add-store-btn" onClick={() => setEditStore({ name: "", address: "", pincodes_str: "", manager_email: "", operating_hours: "10:00-22:00", active: true })} className="btn-primary px-3 py-2 text-sm">+ Add store</button>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-500"><tr><th className="py-2 px-3">Name</th><th className="py-2 px-3">PINs</th><th className="py-2 px-3">Manager</th><th className="py-2 px-3">Hours</th><th className="py-2 px-3">Active</th><th className="py-2 px-3"></th></tr></thead>
              <tbody>
                {stores.map(s => (
                  <tr key={s.id} className="border-t border-gray-100" data-testid={`store-row-${s.id}`}>
                    <td className="py-2 px-3 font-semibold">{s.name}<div className="text-[10px] text-gray-500">{s.address}</div></td>
                    <td className="py-2 px-3 text-xs">{(s.pincodes || []).join(", ")}</td>
                    <td className="py-2 px-3 text-xs">{s.manager_email}</td>
                    <td className="py-2 px-3 text-xs">{s.operating_hours}</td>
                    <td className="py-2 px-3">{s.active ? "Yes" : "No"}</td>
                    <td className="py-2 px-3 flex gap-2"><button onClick={() => setEditStore({ ...s, pincodes_str: (s.pincodes || []).join(",") })} className="text-xs text-blue-600">Edit</button><button data-testid={`del-store-${s.id}`} onClick={() => delStore(s.id)} className="text-xs text-red-600">Delete</button></td>
                  </tr>
                ))}
                {stores.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-gray-500">No stores yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "zones" && (
        <>
          <button data-testid="add-zone-btn" onClick={() => setEditZone({ name: "", pincodes_str: "", store_id: "", active: true })} className="btn-primary px-3 py-2 text-sm">+ Add zone</button>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-500"><tr><th className="py-2 px-3">Name</th><th className="py-2 px-3">PINs</th><th className="py-2 px-3">Store</th><th className="py-2 px-3">Active</th><th className="py-2 px-3"></th></tr></thead>
              <tbody>
                {zones.map(z => {
                  const st = stores.find(s => s.id === z.store_id);
                  return <tr key={z.id} className="border-t border-gray-100" data-testid={`zone-row-${z.id}`}>
                    <td className="py-2 px-3 font-semibold">{z.name}</td>
                    <td className="py-2 px-3 text-xs">{(z.pincodes || []).join(", ")}</td>
                    <td className="py-2 px-3 text-xs">{st?.name || "—"}</td>
                    <td className="py-2 px-3">{z.active ? "Yes" : "No"}</td>
                    <td className="py-2 px-3 flex gap-2"><button onClick={() => setEditZone({ ...z, pincodes_str: (z.pincodes || []).join(",") })} className="text-xs text-blue-600">Edit</button><button data-testid={`del-zone-${z.id}`} onClick={() => delZone(z.id)} className="text-xs text-red-600">Delete</button></td>
                  </tr>;
                })}
                {zones.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-gray-500">No zones yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editStore && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setEditStore(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg mb-3">{editStore.id ? "Edit" : "Add"} dark store</h3>
            <div className="grid gap-2 text-sm">
              <input placeholder="Name" data-testid="store-name" value={editStore.name} onChange={(e) => setEditStore({ ...editStore, name: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <input placeholder="Address" data-testid="store-address" value={editStore.address} onChange={(e) => setEditStore({ ...editStore, address: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <input placeholder="Pincodes (comma)" data-testid="store-pins" value={editStore.pincodes_str} onChange={(e) => setEditStore({ ...editStore, pincodes_str: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <input placeholder="Manager email" value={editStore.manager_email} onChange={(e) => setEditStore({ ...editStore, manager_email: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <input placeholder="Operating hours (e.g. 10:00-22:00)" value={editStore.operating_hours} onChange={(e) => setEditStore({ ...editStore, operating_hours: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <label className="flex items-center gap-2"><input type="checkbox" checked={editStore.active} onChange={(e) => setEditStore({ ...editStore, active: e.target.checked })} /> Active</label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditStore(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm">Cancel</button>
              <button data-testid="store-save" onClick={saveStore} className="btn-primary px-4 py-2 text-sm">Save</button>
            </div>
          </div>
        </div>
      )}

      {editZone && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setEditZone(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg mb-3">{editZone.id ? "Edit" : "Add"} zone</h3>
            <div className="grid gap-2 text-sm">
              <input placeholder="Name" data-testid="zone-name" value={editZone.name} onChange={(e) => setEditZone({ ...editZone, name: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <input placeholder="Pincodes (comma)" data-testid="zone-pins" value={editZone.pincodes_str} onChange={(e) => setEditZone({ ...editZone, pincodes_str: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <select value={editZone.store_id || ""} onChange={(e) => setEditZone({ ...editZone, store_id: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200">
                <option value="">No store</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <label className="flex items-center gap-2"><input type="checkbox" checked={editZone.active} onChange={(e) => setEditZone({ ...editZone, active: e.target.checked })} /> Active</label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditZone(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm">Cancel</button>
              <button data-testid="zone-save" onClick={saveZone} className="btn-primary px-4 py-2 text-sm">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
