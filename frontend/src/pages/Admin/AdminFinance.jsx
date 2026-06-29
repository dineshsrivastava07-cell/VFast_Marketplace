import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { Helmet } from "../../components/Helmet";
import { toast } from "sonner";
import { Download, IndianRupee, ShoppingBag, Wallet, TrendingUp, FileText } from "lucide-react";

const KPI = ({ label, value, icon: Icon, accent }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-4">
    <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide">
      <Icon className={`h-4 w-4 ${accent}`} /> {label}
    </div>
    <div className="font-display text-2xl font-extrabold mt-1">{value}</div>
  </div>
);

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminFinance() {
  const [tab, setTab] = useState("summary");
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [cod, setCod] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [settlePreview, setSettlePreview] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [refundForm, setRefundForm] = useState({ order_no: "", amount: "", reason: "", mode: "upi" });
  const [invOrderNo, setInvOrderNo] = useState("");
  const [invoice, setInvoice] = useState(null);

  const loadAll = async () => {
    try {
      const [s, c, sp, sl, rf] = await Promise.all([
        api.get(`/finance/summary?days=${days}`).then(r => r.data),
        api.get("/finance/cod-reconciliation").then(r => r.data),
        api.get(`/finance/settlements/preview?days=${days}`).then(r => r.data),
        api.get("/finance/settlements").then(r => r.data),
        api.get("/finance/refunds").then(r => r.data),
      ]);
      setSummary(s); setCod(c); setSettlePreview(sp.rows || []); setSettlements(sl); setRefunds(rf);
    } catch (e) { toast.error("Failed to load finance data"); }
  };
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [days]);

  const exportGmv = async () => {
    const r = await api.get(`/finance/exports/gmv?days=${days}`); downloadCsv(`gmv-${days}d.csv`, r.data.csv);
  };
  const exportSettlements = async () => {
    const r = await api.get(`/finance/exports/settlements`); downloadCsv(`settlements.csv`, r.data.csv);
  };
  const createSettlement = async (row) => {
    try {
      await api.post("/finance/settlements/create", {
        seller_id: row.seller_id, seller_name: row.seller_name,
        period_from: new Date(Date.now() - days * 86400000).toISOString(),
        period_to: new Date().toISOString(),
        gmv: row.gmv, commission: row.commission, payout: row.payout,
      });
      toast.success(`Settlement created for ${row.seller_name}`); loadAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const markPaid = async (id) => {
    const utr = prompt("Enter UTR/Ref ID"); if (!utr) return;
    try { await api.post(`/finance/settlements/${id}/mark-paid`, { utr }); toast.success("Marked paid"); loadAll(); }
    catch (e) { toast.error("Failed"); }
  };
  const submitRefund = async () => {
    try { await api.post("/finance/refunds", { ...refundForm, amount: parseFloat(refundForm.amount) || 0 });
      toast.success("Refund initiated"); setRefundForm({ order_no: "", amount: "", reason: "", mode: "upi" }); loadAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const completeRefund = async (id) => {
    const ref = prompt("Reference / UTR for this refund"); if (!ref) return;
    try { await api.post(`/finance/refunds/${id}/complete`, { ref }); toast.success("Refund completed"); loadAll(); }
    catch (e) { toast.error("Failed"); }
  };
  const fetchInvoice = async () => {
    if (!invOrderNo) return;
    try { setInvoice((await api.get(`/finance/invoices/${invOrderNo}`)).data); }
    catch (e) { toast.error(e.response?.data?.detail || "Order not found"); }
  };
  const markCodCollected = async (orderNo) => {
    try { await api.post(`/finance/cod-reconciliation/${orderNo}/collect`); toast.success("Marked collected"); loadAll(); }
    catch (e) { toast.error("Failed"); }
  };

  const Tab = ({ id, label }) => (
    <button data-testid={`fin-tab-${id}`} onClick={() => setTab(id)}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === id ? "bg-[#E4002B] text-white" : "bg-gray-100 text-gray-700"}`}>{label}</button>
  );

  return (
    <div data-testid="admin-finance">
      <Helmet title="Finance" />
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Finance</h1>
          <p className="text-sm text-gray-500">GMV, COD reconciliation, seller settlements, refunds and GST invoices.</p>
        </div>
        <div className="flex items-center gap-2">
          <select data-testid="fin-days" value={days} onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={exportGmv} data-testid="export-gmv" className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm flex items-center gap-2"><Download className="h-4 w-4" />GMV CSV</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Tab id="summary" label="Revenue summary" />
        <Tab id="cod" label="COD reconciliation" />
        <Tab id="settlements" label="Seller settlements" />
        <Tab id="refunds" label="Refunds" />
        <Tab id="invoices" label="GST invoices" />
      </div>

      {tab === "summary" && summary && (
        <div className="space-y-4" data-testid="fin-summary-block">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KPI label="GMV" value={`₹${summary.summary.gmv.toLocaleString("en-IN")}`} icon={IndianRupee} accent="text-emerald-600" />
            <KPI label="Orders" value={summary.summary.orders} icon={ShoppingBag} accent="text-blue-600" />
            <KPI label="AOV" value={`₹${summary.summary.aov}`} icon={TrendingUp} accent="text-amber-600" />
            <KPI label="Delivery fees" value={`₹${summary.summary.delivery.toLocaleString("en-IN")}`} icon={Wallet} accent="text-purple-600" />
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <h3 className="font-semibold mb-2">By payment method</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500"><tr><th className="py-1">Method</th><th>Orders</th><th>GMV</th></tr></thead>
              <tbody>
                {summary.by_method.map((m) => (
                  <tr key={m.method} className="border-t border-gray-50"><td className="py-2 uppercase">{m.method}</td><td>{m.orders}</td><td>₹{m.gmv.toLocaleString("en-IN")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "cod" && cod && (
        <div className="space-y-4" data-testid="fin-cod-block">
          <div className="grid sm:grid-cols-4 gap-3">
            <KPI label="Collected orders" value={cod.summary.collected_orders} icon={Wallet} accent="text-emerald-600" />
            <KPI label="Pending orders" value={cod.summary.pending_orders} icon={Wallet} accent="text-amber-600" />
            <KPI label="Amount collected" value={`₹${cod.summary.amount_collected.toLocaleString("en-IN")}`} icon={IndianRupee} accent="text-emerald-600" />
            <KPI label="Amount pending" value={`₹${cod.summary.amount_pending.toLocaleString("en-IN")}`} icon={IndianRupee} accent="text-amber-600" />
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 overflow-x-auto">
            <h3 className="font-semibold mb-2">By rider</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500"><tr><th className="py-1">Rider</th><th>Orders</th><th>Collected</th><th>Pending</th></tr></thead>
              <tbody>
                {(cod.by_rider || []).map((r) => (
                  <tr key={r.rider_id} className="border-t border-gray-50">
                    <td className="py-2">{r.rider_name}</td><td>{r.orders}</td>
                    <td>₹{r.collected.toLocaleString("en-IN")}</td>
                    <td>₹{r.pending.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 overflow-x-auto">
            <h3 className="font-semibold mb-2">COD orders</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500"><tr><th className="py-1">Order</th><th>Rider</th><th>Total</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {(cod.orders || []).slice(0, 50).map((o) => (
                  <tr key={o.order_no} className="border-t border-gray-50">
                    <td className="py-2 font-mono">{o.order_no}</td>
                    <td>{o.rider_name || "—"}</td>
                    <td>₹{o.total}</td>
                    <td><span className={`text-xs px-2 py-0.5 rounded-md ${o.payment_status === "collected" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{o.payment_status || "pending"}</span></td>
                    <td>{o.payment_status !== "collected" && (
                      <button data-testid={`mark-collected-${o.order_no}`} onClick={() => markCodCollected(o.order_no)} className="text-xs text-[#E4002B] font-semibold">Mark collected</button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "settlements" && (
        <div className="space-y-4" data-testid="fin-settlements-block">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 overflow-x-auto">
            <div className="flex justify-between mb-2">
              <h3 className="font-semibold">Pending payouts (preview)</h3>
              <span className="text-xs text-gray-500">10% commission · last {days} days</span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500"><tr><th>Seller</th><th>Items</th><th>GMV</th><th>Commission</th><th>Payout</th><th></th></tr></thead>
              <tbody>
                {settlePreview.map((r) => (
                  <tr key={r.seller_id} className="border-t border-gray-50">
                    <td className="py-2">{r.seller_name}</td><td>{r.items}</td>
                    <td>₹{r.gmv}</td><td>₹{r.commission}</td><td>₹{r.payout}</td>
                    <td><button data-testid={`create-settlement-${r.seller_id}`} onClick={() => createSettlement(r)} className="text-xs text-[#E4002B] font-semibold">Create settlement</button></td>
                  </tr>
                ))}
                {!settlePreview.length && <tr><td colSpan={6} className="py-4 text-center text-gray-400 text-xs">No deliveries in this window</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 overflow-x-auto">
            <div className="flex justify-between mb-2"><h3 className="font-semibold">Created settlements</h3>
              <button onClick={exportSettlements} data-testid="export-settlements" className="text-xs text-gray-700 font-semibold flex items-center gap-1"><Download className="h-3.5 w-3.5" />Export CSV</button>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500"><tr><th>Seller</th><th>Period</th><th>Payout</th><th>Status</th><th>UTR</th><th></th></tr></thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id} className="border-t border-gray-50">
                    <td className="py-2">{s.seller_name}</td>
                    <td className="text-xs">{(s.period_from || "").slice(0, 10)} → {(s.period_to || "").slice(0, 10)}</td>
                    <td>₹{s.payout}</td>
                    <td><span className={`text-xs px-2 py-0.5 rounded-md ${s.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{s.status}</span></td>
                    <td className="text-xs font-mono">{s.utr || "—"}</td>
                    <td>{s.status !== "paid" && <button data-testid={`mark-paid-${s.id}`} onClick={() => markPaid(s.id)} className="text-xs text-[#E4002B] font-semibold">Mark paid</button>}</td>
                  </tr>
                ))}
                {!settlements.length && <tr><td colSpan={6} className="py-4 text-center text-gray-400 text-xs">No settlements yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "refunds" && (
        <div className="space-y-4" data-testid="fin-refunds-block">
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <h3 className="font-semibold mb-2">Initiate refund</h3>
            <div className="grid sm:grid-cols-4 gap-2 text-sm">
              <input data-testid="refund-order-no" placeholder="Order no." value={refundForm.order_no} onChange={(e) => setRefundForm({ ...refundForm, order_no: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
              <input data-testid="refund-amount" placeholder="Amount ₹" value={refundForm.amount} onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
              <select data-testid="refund-mode" value={refundForm.mode} onChange={(e) => setRefundForm({ ...refundForm, mode: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200">
                <option value="upi">UPI</option><option value="bank">Bank</option><option value="cash">Cash</option>
              </select>
              <input data-testid="refund-reason" placeholder="Reason" value={refundForm.reason} onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200" />
            </div>
            <button data-testid="submit-refund" onClick={submitRefund} className="mt-3 btn-primary py-2 px-4 text-sm">Initiate refund</button>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 overflow-x-auto">
            <h3 className="font-semibold mb-2">Refunds</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500"><tr><th>Order</th><th>Amount</th><th>Mode</th><th>Reason</th><th>Status</th><th>Ref</th><th></th></tr></thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r.id} className="border-t border-gray-50">
                    <td className="py-2 font-mono">{r.order_no}</td><td>₹{r.amount}</td>
                    <td className="uppercase text-xs">{r.mode}</td><td className="text-xs">{r.reason}</td>
                    <td><span className={`text-xs px-2 py-0.5 rounded-md ${r.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{r.status}</span></td>
                    <td className="text-xs font-mono">{r.ref || "—"}</td>
                    <td>{r.status !== "completed" && <button data-testid={`complete-refund-${r.id}`} onClick={() => completeRefund(r.id)} className="text-xs text-[#E4002B] font-semibold">Complete</button>}</td>
                  </tr>
                ))}
                {!refunds.length && <tr><td colSpan={7} className="py-4 text-center text-gray-400 text-xs">No refunds yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "invoices" && (
        <div className="space-y-4" data-testid="fin-invoices-block">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Order number</label>
              <input data-testid="invoice-order-no" value={invOrderNo} onChange={(e) => setInvOrderNo(e.target.value)} placeholder="VF260629XXXX" className="w-full px-3 py-2 rounded-lg border border-gray-200" />
            </div>
            <button data-testid="fetch-invoice" onClick={fetchInvoice} className="btn-primary py-2 px-4 text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Generate</button>
          </div>
          {invoice && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6" data-testid="invoice-block">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-display text-xl font-bold">{invoice.seller}</h2>
                  <div className="text-xs text-gray-500">GSTIN: {invoice.gstin}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">{invoice.invoice_no}</div>
                  <div className="text-xs text-gray-500">{new Date(invoice.issued_at).toLocaleString("en-IN")}</div>
                </div>
              </div>
              <hr className="my-3" />
              <div className="text-sm">Bill to: <span className="font-semibold">{invoice.bill_to}</span> ({invoice.phone})</div>
              <div className="text-xs text-gray-500">{invoice.address?.flat}, {invoice.address?.area}, {invoice.address?.city} - {invoice.address?.pincode}</div>
              <table className="w-full text-sm mt-4">
                <thead><tr className="text-xs text-gray-500 text-left"><th className="py-1">Item</th><th>Qty</th><th>Price</th><th className="text-right">Line</th></tr></thead>
                <tbody>{invoice.items.map((i) => (
                  <tr key={i.product_id} className="border-t border-gray-50"><td className="py-2">{i.name}</td><td>{i.qty}</td><td>₹{i.price}</td><td className="text-right">₹{i.line_total}</td></tr>
                ))}</tbody>
              </table>
              <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal (excl. GST)</span><span>₹{invoice.subtotal_excl_gst}</span></div>
                <div className="flex justify-between"><span>GST ({(invoice.gst_rate * 100).toFixed(0)}%)</span><span>₹{invoice.gst_amount}</span></div>
                <div className="flex justify-between"><span>Delivery</span><span>₹{invoice.delivery_fee}</span></div>
                <div className="flex justify-between font-display font-extrabold text-lg"><span>Total</span><span>₹{invoice.total}</span></div>
                <div className="text-xs text-gray-500 mt-2">Paid via {invoice.payment_method?.toUpperCase()}</div>
              </div>
              <button onClick={() => window.print()} className="mt-4 btn-primary py-2 px-4 text-sm">Print invoice</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
