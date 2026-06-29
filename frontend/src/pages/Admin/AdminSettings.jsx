import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { toast } from "sonner";

const FLAGS = [
  { k: "cod_enabled", label: "Enable Cash on Delivery" },
  { k: "upi_qr_enabled", label: "Enable UPI QR" },
  { k: "referrals_enabled", label: "Enable referrals" },
  { k: "wallet_enabled", label: "Enable wallet/credits" },
  { k: "hindi_toggle_enabled", label: "Enable Hindi toggle" },
  { k: "dpdp_consent_banner", label: "Show DPDP consent banner" },
];

export default function AdminSettings() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("settings");
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);

  const refresh = async () => {
    const [s, t] = await Promise.all([api.get("/admin/settings"), api.get("/admin/notification-templates")]);
    setData(s.data); setTemplates(t.data);
  };
  useEffect(() => { refresh(); }, []);

  const saveSettings = async () => {
    await api.post("/admin/settings", { settings: data.settings, flags: data.flags });
    toast.success("Settings saved"); refresh();
  };

  const saveTpl = async () => {
    if (!editing.event || !editing.body) return toast.error("Event and body required");
    await api.post("/admin/notification-templates", editing);
    toast.success("Template saved"); setEditing(null); refresh();
  };
  const delTpl = async (id) => {
    if (!window.confirm("Delete template?")) return;
    await api.delete(`/admin/notification-templates/${id}`); toast.success("Deleted"); refresh();
  };

  if (!data) return <div className="text-gray-500">Loading…</div>;

  return (
    <div className="space-y-4" data-testid="admin-settings-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold">App settings</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab("settings")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab==="settings"?"bg-[#E4002B] text-white":"bg-white border border-gray-200"}`}>General</button>
          <button onClick={() => setTab("flags")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab==="flags"?"bg-[#E4002B] text-white":"bg-white border border-gray-200"}`}>Feature flags</button>
          <button onClick={() => setTab("templates")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab==="templates"?"bg-[#E4002B] text-white":"bg-white border border-gray-200"}`}>Notification templates</button>
        </div>
      </div>

      {tab === "settings" && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 grid sm:grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1"><span className="text-xs text-gray-500">App name</span><input data-testid="s-app-name" value={data.settings.app_name} onChange={(e) => setData({ ...data, settings: { ...data.settings, app_name: e.target.value } })} className="px-3 py-2 rounded-xl border border-gray-200" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-gray-500">Support email</span><input data-testid="s-support-email" value={data.settings.support_email} onChange={(e) => setData({ ...data, settings: { ...data.settings, support_email: e.target.value } })} className="px-3 py-2 rounded-xl border border-gray-200" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-gray-500">Support phone</span><input value={data.settings.support_phone} onChange={(e) => setData({ ...data, settings: { ...data.settings, support_phone: e.target.value } })} className="px-3 py-2 rounded-xl border border-gray-200" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-gray-500">DPO email</span><input data-testid="s-dpo-email" value={data.settings.dpo_email} onChange={(e) => setData({ ...data, settings: { ...data.settings, dpo_email: e.target.value } })} className="px-3 py-2 rounded-xl border border-gray-200" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-gray-500">DPO phone</span><input value={data.settings.dpo_phone} onChange={(e) => setData({ ...data, settings: { ...data.settings, dpo_phone: e.target.value } })} className="px-3 py-2 rounded-xl border border-gray-200" /></label>
          <label className="flex items-center gap-2 sm:col-span-2"><input data-testid="s-maintenance" type="checkbox" checked={data.settings.maintenance_mode} onChange={(e) => setData({ ...data, settings: { ...data.settings, maintenance_mode: e.target.checked } })} /> Maintenance mode (block customer logins)</label>
          <div className="sm:col-span-2"><button data-testid="s-save" onClick={saveSettings} className="btn-primary px-4 py-2 text-sm">Save settings</button></div>
        </div>
      )}

      {tab === "flags" && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2 text-sm">
          {FLAGS.map(f => (
            <label key={f.k} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <input data-testid={`flag-${f.k}`} type="checkbox" checked={!!data.flags[f.k]} onChange={(e) => setData({ ...data, flags: { ...data.flags, [f.k]: e.target.checked } })} />
              <span>{f.label}</span>
            </label>
          ))}
          <button data-testid="flags-save" onClick={saveSettings} className="btn-primary px-4 py-2 text-sm mt-3">Save flags</button>
        </div>
      )}

      {tab === "templates" && (
        <div className="space-y-3">
          <button data-testid="tpl-add" onClick={() => setEditing({ channel: "sms", event: "", subject: "", body: "", active: true })} className="btn-primary px-3 py-2 text-sm">+ Add template</button>
          <div className="grid sm:grid-cols-2 gap-3">
            {templates.map(t => (
              <div key={t.id} className="bg-white border border-gray-100 rounded-2xl p-4" data-testid={`tpl-${t.id}`}>
                <div className="flex items-center justify-between">
                  <div><span className="text-[10px] uppercase bg-gray-100 px-2 py-0.5 rounded-md font-bold">{t.channel}</span> · <span className="font-semibold">{t.event}</span></div>
                  <div className="flex gap-2"><button onClick={() => setEditing(t)} className="text-xs text-blue-600">Edit</button><button onClick={() => delTpl(t.id)} className="text-xs text-red-600">Delete</button></div>
                </div>
                {t.subject && <div className="text-xs mt-1 text-gray-500">Subject: {t.subject}</div>}
                <div className="text-sm mt-2 font-mono whitespace-pre-wrap text-gray-700">{t.body}</div>
              </div>
            ))}
            {templates.length === 0 && <div className="text-gray-500">No templates yet.</div>}
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg mb-3">{editing.id ? "Edit" : "Add"} notification template</h3>
            <div className="grid gap-2 text-sm">
              <select value={editing.channel} onChange={(e) => setEditing({ ...editing, channel: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200">
                <option value="sms">SMS</option><option value="email">Email</option><option value="push">Push</option>
              </select>
              <input data-testid="tpl-event" placeholder="event (e.g. order_placed)" value={editing.event} onChange={(e) => setEditing({ ...editing, event: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              {editing.channel === "email" && <input placeholder="Subject" value={editing.subject || ""} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />}
              <textarea data-testid="tpl-body" rows={4} placeholder="Body — use {order_no}, {total}, {eta}" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200" />
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active</label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm">Cancel</button>
              <button data-testid="tpl-save" onClick={saveTpl} className="btn-primary px-4 py-2 text-sm">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
