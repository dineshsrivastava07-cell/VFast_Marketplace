import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Helmet } from "../../components/Helmet";
import { toast } from "sonner";
import { Shield, AlertTriangle, FileText, Cookie, UserX } from "lucide-react";

const KPI = ({ label, value, icon: Icon, accent }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-4">
    <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide">
      <Icon className={`h-4 w-4 ${accent}`} /> {label}
    </div>
    <div className="font-display text-2xl font-extrabold mt-1">{value}</div>
  </div>
);

const Tab = ({ id, label, active, onClick }) => (
  <button data-testid={`dpdp-tab-${id}`} onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${active ? "bg-[#E4002B] text-white" : "bg-gray-100 text-gray-700"}`}>{label}</button>
);

export default function AdminDPDP() {
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [rights, setRights] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [breaches, setBreaches] = useState([]);
  const [consents, setConsents] = useState([]);
  const [banner, setBanner] = useState(null);

  const loadAll = async () => {
    try {
      const [o, r, g, b, c, bn] = await Promise.all([
        api.get("/dpdp/overview").then((r) => r.data),
        api.get("/dpdp/rights-requests").then((r) => r.data),
        api.get("/dpdp/grievances").then((r) => r.data),
        api.get("/dpdp/breaches").then((r) => r.data),
        api.get("/dpdp/consents").then((r) => r.data),
        api.get("/dpdp/banner-settings").then((r) => r.data),
      ]);
      setOverview(o); setRights(r); setGrievances(g); setBreaches(b); setConsents(c); setBanner(bn);
    } catch (e) { toast.error("Failed to load DPDP data"); }
  };
  useEffect(() => { loadAll(); }, []);

  const processRequest = async (rid, status) => {
    const resolution = prompt(`Resolution note for this ${status} action?`) || "";
    try { await api.post(`/dpdp/rights-requests/${rid}/process`, { status, resolution }); toast.success(`Marked ${status}`); loadAll(); }
    catch (e) { toast.error("Failed"); }
  };
  const resolveGrievance = async (gid) => {
    const resolution = prompt("Resolution?") || "";
    try { await api.post(`/dpdp/grievances/${gid}/resolve`, { resolution }); toast.success("Resolved"); loadAll(); }
    catch { toast.error("Failed"); }
  };
  const logBreach = async () => {
    const title = prompt("Incident title?"); if (!title) return;
    const severity = prompt("Severity (low/medium/high/critical)?", "medium") || "medium";
    const users_impacted = parseInt(prompt("Users impacted?", "0") || "0");
    const summary = prompt("Short summary?") || "";
    try { await api.post("/dpdp/breaches", { title, severity, users_impacted, summary }); toast.success("Breach logged"); loadAll(); }
    catch { toast.error("Failed"); }
  };
  const saveBanner = async () => {
    try { await api.post("/dpdp/banner-settings", banner); toast.success("Banner settings saved"); }
    catch { toast.error("Failed"); }
  };

  if (!overview) return <div className="p-8 text-gray-500">Loading DPDP console…</div>;
  return (
    <div data-testid="admin-dpdp">
      <Helmet title="DPDP compliance" />
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6 text-[#E4002B]" />DPDP compliance console</h1>
          <p className="text-sm text-gray-500">Consent records, data-rights queue, grievance inbox, breach log, and consent banner — Digital Personal Data Protection Act, 2023.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[["overview","Overview"],["rights","Rights requests"],["grievances","Grievances"],["breaches","Breach log"],["consents","Consent records"],["banner","Cookie banner"]]
            .map(([id, lbl]) => <Tab key={id} id={id} label={lbl} active={tab === id} onClick={() => setTab(id)} />)}
        </div>
      </div>

      {tab === "overview" && (
        <div className="space-y-3" data-testid="dpdp-overview-block">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <KPI label="Consents captured" value={overview.consents_total} icon={Shield} accent="text-emerald-600" />
            <KPI label="Rights — open" value={overview.rights_requests_open} icon={UserX} accent="text-amber-600" />
            <KPI label="Rights — total" value={overview.rights_requests_total} icon={UserX} accent="text-gray-600" />
            <KPI label="Grievances open" value={overview.grievances_open} icon={FileText} accent="text-amber-600" />
            <KPI label="Breaches open" value={overview.breaches_open} icon={AlertTriangle} accent="text-red-600" />
          </div>
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl p-3">
            DPDP commitments: consent versioning, purpose-specific capture, withdrawal trail, erasure-on-request, breach log with severity, India-region data storage. Grievance / DPO: configure in Admin → Settings.
          </div>
        </div>
      )}

      {tab === "rights" && (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto" data-testid="dpdp-rights-block">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 bg-gray-50"><tr><th className="py-2 px-3">Type</th><th>User</th><th>Note</th><th>Status</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {rights.map((r) => (
                <tr key={r.id} className="border-t border-gray-50" data-testid={`right-${r.id}`}>
                  <td className="py-2 px-3 uppercase text-xs font-semibold">{r.type}</td>
                  <td className="text-xs">{r.phone || r.email || r.user_id.slice(0, 8)}</td>
                  <td className="text-xs">{r.note}</td>
                  <td><span className={`text-xs px-2 py-0.5 rounded-md ${r.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{r.status}</span></td>
                  <td className="text-xs">{new Date(r.created_at).toLocaleString("en-IN")}</td>
                  <td className="space-x-2 text-xs">
                    {r.status === "open" && <>
                      <button data-testid={`process-${r.id}`} onClick={() => processRequest(r.id, "completed")} className="text-emerald-700 font-semibold">Complete</button>
                      <button onClick={() => processRequest(r.id, "rejected")} className="text-red-600 font-semibold">Reject</button>
                    </>}
                  </td>
                </tr>
              ))}
              {!rights.length && <tr><td colSpan={6} className="py-6 text-center text-gray-400 text-xs">No data rights requests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "grievances" && (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto" data-testid="dpdp-grievances-block">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 bg-gray-50"><tr><th className="py-2 px-3">Subject</th><th>From</th><th>Category</th><th>Status</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {grievances.map((g) => (
                <tr key={g.id} className="border-t border-gray-50">
                  <td className="py-2 px-3 font-semibold">{g.subject}</td>
                  <td className="text-xs">{g.name} · {g.contact}</td>
                  <td className="text-xs uppercase">{g.category}</td>
                  <td><span className={`text-xs px-2 py-0.5 rounded-md ${g.status === "resolved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{g.status}</span></td>
                  <td className="text-xs">{new Date(g.created_at).toLocaleString("en-IN")}</td>
                  <td className="text-xs">{g.status !== "resolved" && <button data-testid={`resolve-${g.id}`} onClick={() => resolveGrievance(g.id)} className="text-[#E4002B] font-semibold">Resolve</button>}</td>
                </tr>
              ))}
              {!grievances.length && <tr><td colSpan={6} className="py-6 text-center text-gray-400 text-xs">No grievances filed.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "breaches" && (
        <div className="space-y-2" data-testid="dpdp-breaches-block">
          <div className="flex justify-end">
            <button data-testid="log-breach" onClick={logBreach} className="btn-primary py-2 px-3 text-sm flex items-center gap-1"><AlertTriangle className="h-4 w-4" />Log breach</button>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500 bg-gray-50"><tr><th className="py-2 px-3">Title</th><th>Severity</th><th>Users impacted</th><th>Detected</th><th>Status</th></tr></thead>
              <tbody>
                {breaches.map((b) => (
                  <tr key={b.id} className="border-t border-gray-50">
                    <td className="py-2 px-3 font-semibold">{b.title}</td>
                    <td><span className={`text-xs px-2 py-0.5 rounded-md ${b.severity === "critical" ? "bg-red-50 text-red-700" : b.severity === "high" ? "bg-orange-50 text-orange-700" : b.severity === "medium" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-700"}`}>{b.severity}</span></td>
                    <td>{b.users_impacted}</td>
                    <td className="text-xs">{new Date(b.detected_at).toLocaleString("en-IN")}</td>
                    <td className="text-xs">{b.status}</td>
                  </tr>
                ))}
                {!breaches.length && <tr><td colSpan={5} className="py-6 text-center text-gray-400 text-xs">No breach records.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "consents" && (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto" data-testid="dpdp-consents-block">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 bg-gray-50"><tr><th className="py-2 px-3">User</th><th>Purpose</th><th>Granted</th><th>Policy</th><th>At</th></tr></thead>
            <tbody>
              {consents.slice(0, 200).map((c) => (
                <tr key={c.id} className="border-t border-gray-50">
                  <td className="py-2 px-3 text-xs">{c.phone || c.email || c.user_id.slice(0, 8)}</td>
                  <td className="text-xs uppercase">{c.purpose}</td>
                  <td>{c.granted ? <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">YES</span> : <span className="text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-700">NO</span>}</td>
                  <td className="text-xs font-mono">{c.policy_version}</td>
                  <td className="text-xs">{new Date(c.at).toLocaleString("en-IN")}</td>
                </tr>
              ))}
              {!consents.length && <tr><td colSpan={5} className="py-6 text-center text-gray-400 text-xs">No consent records yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "banner" && banner && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3" data-testid="dpdp-banner-block">
          <h3 className="font-semibold flex items-center gap-2"><Cookie className="h-5 w-5" />Cookie / consent banner</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" data-testid="banner-enabled" checked={banner.enabled} onChange={(e) => setBanner({ ...banner, enabled: e.target.checked })} />Show banner on the storefront</label>
          <input data-testid="banner-title" value={banner.title} onChange={(e) => setBanner({ ...banner, title: e.target.value })} placeholder="Banner title" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          <textarea data-testid="banner-body" rows={3} value={banner.body} onChange={(e) => setBanner({ ...banner, body: e.target.value })} placeholder="Body" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            <input data-testid="banner-policy-url" value={banner.policy_url || ""} onChange={(e) => setBanner({ ...banner, policy_url: e.target.value })} placeholder="Privacy policy URL" className="px-3 py-2 rounded-lg border border-gray-200" />
            <input data-testid="banner-policy-ver" value={banner.policy_version || ""} onChange={(e) => setBanner({ ...banner, policy_version: e.target.value })} placeholder="Policy version" className="px-3 py-2 rounded-lg border border-gray-200" />
          </div>
          <button data-testid="save-banner-settings" onClick={saveBanner} className="btn-primary py-2 px-4 text-sm">Save</button>
        </div>
      )}
    </div>
  );
}
