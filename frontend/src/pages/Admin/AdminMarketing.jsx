import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Helmet } from "../../components/Helmet";
import { toast } from "sonner";
import { Plus, Send, Trash2 } from "lucide-react";

const TabBtn = ({ active, onClick, children, id }) => (
  <button data-testid={`mkt-tab-${id}`} onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${active ? "bg-[#E4002B] text-white" : "bg-gray-100 text-gray-700"}`}>{children}</button>
);

export default function AdminMarketing() {
  const [tab, setTab] = useState("banners");
  return (
    <div data-testid="admin-marketing">
      <Helmet title="Marketing" />
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Marketing</h1>
          <p className="text-sm text-gray-500">Banners, coupons and SMS/push campaigns.</p>
        </div>
        <div className="flex gap-2">
          <TabBtn id="banners" active={tab === "banners"} onClick={() => setTab("banners")}>Banners</TabBtn>
          <TabBtn id="coupons" active={tab === "coupons"} onClick={() => setTab("coupons")}>Coupons</TabBtn>
          <TabBtn id="campaigns" active={tab === "campaigns"} onClick={() => setTab("campaigns")}>Campaigns</TabBtn>
        </div>
      </div>
      {tab === "banners" && <BannersPanel />}
      {tab === "coupons" && <CouponsPanel />}
      {tab === "campaigns" && <CampaignsPanel />}
    </div>
  );
}

function BannersPanel() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ title: "", subtitle: "", image: "", cta: "Shop now", link: "/", sort_order: 100, active: true });
  const load = () => api.get("/marketing/banners").then(r => setList(r.data));
  useEffect(() => { load(); }, []);
  const save = async () => {
    try { await api.post("/marketing/banners", form); toast.success("Banner saved"); setForm({ title: "", subtitle: "", image: "", cta: "Shop now", link: "/", sort_order: 100, active: true }); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const remove = async (id) => { if (!confirm("Delete banner?")) return;
    try { await api.delete(`/marketing/banners/${id}`); toast.success("Deleted"); load(); }
    catch { toast.error("Failed"); }
  };
  return (
    <div className="space-y-4" data-testid="banners-panel">
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <h3 className="font-semibold mb-2">Add / edit banner</h3>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <input data-testid="banner-title" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
          <input data-testid="banner-subtitle" placeholder="Subtitle" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
          <input data-testid="banner-image" placeholder="Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 sm:col-span-2" />
          <input data-testid="banner-cta" placeholder="CTA text" value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
          <input data-testid="banner-link" placeholder="Link (e.g. /c/staples)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
        </div>
        <button data-testid="save-banner" onClick={save} className="mt-3 btn-primary py-2 px-4 text-sm flex items-center gap-1"><Plus className="h-4 w-4" />Save banner</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {list.map((b) => (
          <div key={b.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden" data-testid={`banner-${b.id}`}>
            {b.image && <img src={b.image} alt={b.title} className="w-full h-32 object-cover" />}
            <div className="p-3">
              <div className="font-semibold">{b.title}</div>
              <div className="text-xs text-gray-500">{b.subtitle}</div>
              <div className="text-[11px] text-gray-400 mt-1">CTA: {b.cta} → <span className="font-mono">{b.link}</span></div>
              <button onClick={() => remove(b.id)} className="mt-2 text-xs text-red-600 flex items-center gap-1"><Trash2 className="h-3 w-3" />Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CouponsPanel() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ code: "", type: "percent", value: 10, min_order_value: 99, max_discount: 0, description: "", usage_limit: 1000, per_user_limit: 1, active: true });
  const load = () => api.get("/marketing/coupons").then(r => setList(r.data));
  useEffect(() => { load(); }, []);
  const save = async () => {
    try { await api.post("/marketing/coupons", form); toast.success("Coupon saved"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const remove = async (id) => { if (!confirm("Delete coupon?")) return;
    try { await api.delete(`/marketing/coupons/${id}`); toast.success("Deleted"); load(); } catch { toast.error("Failed"); }
  };
  return (
    <div className="space-y-4" data-testid="coupons-panel">
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <h3 className="font-semibold mb-2">Add coupon</h3>
        <div className="grid sm:grid-cols-3 gap-2 text-sm">
          <input data-testid="coupon-code" placeholder="CODE (e.g. WELCOME10)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="px-3 py-2 rounded-lg border border-gray-200" />
          <select data-testid="coupon-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200">
            <option value="percent">% off</option><option value="flat">Flat ₹ off</option><option value="free_delivery">Free delivery</option><option value="bogo">BOGO</option>
          </select>
          <input data-testid="coupon-value" type="number" placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })} className="px-3 py-2 rounded-lg border border-gray-200" />
          <input data-testid="coupon-min" type="number" placeholder="Min order ₹" value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: parseFloat(e.target.value) || 0 })} className="px-3 py-2 rounded-lg border border-gray-200" />
          <input data-testid="coupon-maxdiscount" type="number" placeholder="Max ₹ discount" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: parseFloat(e.target.value) || 0 })} className="px-3 py-2 rounded-lg border border-gray-200" />
          <input data-testid="coupon-limit" type="number" placeholder="Usage limit" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: parseInt(e.target.value) || 0 })} className="px-3 py-2 rounded-lg border border-gray-200" />
          <input data-testid="coupon-desc" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 sm:col-span-3" />
        </div>
        <button data-testid="save-coupon" onClick={save} className="mt-3 btn-primary py-2 px-4 text-sm">Save coupon</button>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500"><tr><th>Code</th><th>Type</th><th>Value</th><th>Min</th><th>Used / Limit</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t border-gray-50" data-testid={`coupon-row-${c.code}`}>
                <td className="py-2 font-mono">{c.code}</td>
                <td className="uppercase text-xs">{c.type}</td>
                <td>{c.type === "percent" ? `${c.value}%` : `₹${c.value}`}</td>
                <td>₹{c.min_order_value}</td>
                <td>{c.used_count}/{c.usage_limit || "∞"}</td>
                <td>{c.active ? <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">Active</span> : <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">Off</span>}</td>
                <td><button onClick={() => remove(c.id)} className="text-xs text-red-600">Delete</button></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} className="py-4 text-center text-gray-400 text-xs">No coupons</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignsPanel() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: "", channel: "sms", subject: "", body: "Hey {name}! Save 20% on staples today on VFast.", segment: "all", segment_value: "" });
  const [sends, setSends] = useState(null);
  const load = () => api.get("/marketing/campaigns").then(r => setList(r.data));
  useEffect(() => { load(); }, []);
  const create = async () => {
    try { await api.post("/marketing/campaigns", form); toast.success("Campaign created"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const sendNow = async (id) => {
    if (!confirm("Send this campaign now? (Mocked — no real SMS/email is sent)")) return;
    try { const r = await api.post(`/marketing/campaigns/${id}/send`); toast.success(`Mocked: ${r.data.sent_count} sends queued.`); load(); }
    catch (e) { toast.error("Failed"); }
  };
  const remove = async (id) => { if (!confirm("Delete?")) return;
    try { await api.delete(`/marketing/campaigns/${id}`); load(); } catch { toast.error("Failed"); }
  };
  const viewSends = async (id) => { const r = await api.get(`/marketing/campaigns/${id}/sends`); setSends({ id, rows: r.data }); };
  return (
    <div className="space-y-4" data-testid="campaigns-panel">
      <div className="bg-amber-50 border border-amber-100 text-amber-800 text-xs rounded-xl p-3">SMS/Push/Email send is <b>MOCKED</b> — recipients are recorded in <code>campaign_sends</code> but no real provider is configured.</div>
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <h3 className="font-semibold mb-2">New campaign</h3>
        <div className="grid sm:grid-cols-3 gap-2 text-sm">
          <input data-testid="camp-name" placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
          <select data-testid="camp-channel" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200">
            <option value="sms">SMS</option><option value="push">Push</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option>
          </select>
          <select data-testid="camp-segment" value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200">
            <option value="all">All customers</option>
            <option value="recent_buyers">Recent buyers</option>
            <option value="inactive">Inactive (never bought)</option>
            <option value="by_pincode">By pincode</option>
          </select>
          {form.segment === "by_pincode" && (
            <input data-testid="camp-pin" placeholder="Target PIN (e.g. 110001)" value={form.segment_value} onChange={(e) => setForm({ ...form, segment_value: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
          )}
          {form.channel === "email" && (
            <input data-testid="camp-subject" placeholder="Email subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 sm:col-span-2" />
          )}
          <textarea data-testid="camp-body" rows={3} placeholder="Body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 sm:col-span-3" />
        </div>
        <button data-testid="create-campaign" onClick={create} className="mt-3 btn-primary py-2 px-4 text-sm flex items-center gap-2"><Plus className="h-4 w-4" />Create draft</button>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500"><tr><th>Name</th><th>Channel</th><th>Segment</th><th>Status</th><th>Sent</th><th></th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t border-gray-50" data-testid={`camp-row-${c.id}`}>
                <td className="py-2">{c.name}</td>
                <td className="uppercase text-xs">{c.channel}</td>
                <td className="text-xs">{c.segment}{c.segment_value ? ` · ${c.segment_value}` : ""}</td>
                <td><span className={`text-xs px-2 py-0.5 rounded-md ${c.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{c.status}</span></td>
                <td>{c.sent_count}</td>
                <td className="space-x-2 text-xs">
                  {c.status !== "sent" && <button data-testid={`send-camp-${c.id}`} onClick={() => sendNow(c.id)} className="text-[#E4002B] font-semibold inline-flex items-center gap-1"><Send className="h-3 w-3" />Send</button>}
                  {c.status === "sent" && <button onClick={() => viewSends(c.id)} className="text-blue-600 font-semibold">View sends</button>}
                  <button onClick={() => remove(c.id)} className="text-gray-500">Delete</button>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6} className="py-4 text-center text-gray-400 text-xs">No campaigns yet</td></tr>}
          </tbody>
        </table>
      </div>
      {sends && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4" data-testid="sends-block">
          <div className="flex justify-between mb-2"><h3 className="font-semibold">Sends for {sends.id.slice(0, 8)}…</h3>
            <button onClick={() => setSends(null)} className="text-xs text-gray-500">Close</button></div>
          <div className="max-h-72 overflow-y-auto text-xs">
            {sends.rows.map((r, i) => (
              <div key={i} className="flex justify-between border-t border-gray-50 py-1.5"><span className="font-mono">{r.target}</span><span className="text-gray-500">{r.status}</span></div>
            ))}
            {!sends.rows.length && <div className="text-gray-400">No sends</div>}
          </div>
        </div>
      )}
    </div>
  );
}
