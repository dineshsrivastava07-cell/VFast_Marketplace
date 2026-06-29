# VFast — Daily Operations Playbook

Audience: Dark-store manager, Operations user, Senior rider. This is the **single source of truth** for how a VFast store runs each day.

---

## 1. Daily opening checklist (store manager)

| Time | Task | System / where |
| --- | --- | --- |
| T-30 min before opening | Walk-through: lights, fridges, freezers temperatures (4°C, -18°C) | Physical |
| T-25 min | Reconcile previous day's COD cash with bank deposit slips | `/admin/orders?payment_method=cod` → cod-reconciliation tab |
| T-20 min | Print today's expiring batches (next 48h) and pull them to "sell first" shelf | `/admin/inventory` → Batches → near expiry |
| T-15 min | Confirm all rostered riders have toggled **Online** | `/admin/riders` |
| T-10 min | Acknowledge any unresolved exceptions from last night | `/admin/orders` exception queue |
| T-5 min  | Verify UPI QR is uploaded and active for the store's PINs | `/admin/qr-codes` → preview by PIN |
| T-0 (open) | Flip the store **Active** if it had been paused | `/admin/stores` |

---

## 2. Order lifecycle SOP

```
PLACED ──► PACKED ──► OUT_FOR_DELIVERY ──► DELIVERED
   │           │              │                │
   ▼           ▼              ▼                ▼
 Picker     Picker         Rider           Customer
 picks      packs &        rides           confirms
 from       prints         to drop         via OTP
 shelf      label          location        / photo
```

| Status | Owner | SLA from previous step | Action |
| --- | --- | --- | --- |
| `placed` | Picker | 0 min (immediate ack) | Notification fires; print pick-list |
| `packed` | Picker | ≤ 5 min | Move pack to dispatch shelf, scan label |
| `out_for_delivery` | Dispatcher → Rider | ≤ 1 min after rider acknowledges | Rider clicks **Pick up** |
| `delivered` | Rider | ≤ store ETA (10–18 min) | Capture delivery OTP / photo |
| `cancelled` | Anyone | — | Reason must be entered |
| `payment_rejected` | Admin / Ops | — | Customer is auto-notified to retry |

**SLA monitor:** `/admin/orders` colours each row green / amber / red based on elapsed vs ETA. Any **red** row must be intervened by Ops within 60 seconds.

---

## 3. Rider assignment rules & escalation

1. **Auto-assign** (Phase 3+): nearest online rider with `kyc.verified = true` and no current active order.
2. **Manual assign** (today): dispatcher selects rider in OMS row dropdown (`assign-rider-{order_no}`).
3. **Reassign** triggers:
   - Rider hasn't moved status to `out_for_delivery` within 3 min of being assigned
   - Rider has gone `offline` after assignment
4. **Escalation**:
   - 2 reassignments without progress → escalate to store manager (slack #vfast-ops).
   - 3 failed pickup attempts → cancel the order with reason `rider unavailable` and refund per §5.

---

## 4. Stockout handling

When a picker finds the shelf empty:

1. Open the order on OMS, click **Override status** → choose `cancelled` with reason `stockout`.
2. (Optional) Tag the order with exception=stockout: backend already lists it in `/admin/orders/exceptions`.
3. The picker updates inventory: `/admin/inventory` → set product stock to actual physical count.
4. The customer is auto-notified via the seeded `order_cancelled_stockout` template (see `/admin/settings` → templates).
5. If the customer is reachable, ops may suggest a substitute SKU and create a fresh order on their behalf.

---

## 5. COD reconciliation SOP

End-of-shift:

1. Open **OMS → COD reconciliation** (`/api/admin/oms/cod-reconciliation`).
2. For every order in **Pending**, count the cash collected and click **Mark cash collected**.
3. Total of `Pending → Collected` must equal cash bag count. Variance < ₹50 is accepted; >₹50 raise an incident.
4. Hand the cash bag to the supervisor with a printed reconciliation report (export CSV via the OMS Export button).
5. Supervisor deposits to bank by 10:30 the next morning and pastes deposit slip in #vfast-finance.

---

## 6. UPI QR payment verification SOP

For every order in the **Payment verification queue** (`/admin/payment-queue`):

1. Open the proof screenshot + UTR shown on the card.
2. Cross-check on the relevant UPI app dashboard that the **amount** equals the order total and the **UTR** matches.
3. Click **Verify** if it's good (order auto-advances to `packed`).
4. Click **Reject** with a reason (e.g. "UTR not found", "amount mismatch") — the customer is notified to retry.
5. SLA: every order in the queue must be touched within **10 minutes**.

Common rejection reasons:
- UTR doesn't match (typo by customer)
- Amount mismatch (customer paid less)
- Screenshot is for a different order / older payment
- Same UTR was already used on another order (potential abuse)

---

## 7. Failed delivery SOP

| Scenario | Rider action | Ops action |
| --- | --- | --- |
| Customer unreachable on phone | Wait 5 min at drop point, call twice from rider app | If still unreachable, mark `delivery_failed`, attempt reschedule with customer support |
| Wrong address | Call customer, ask for landmark; if unable, return to store | Move order to `cancelled` with reason `wrong_address` |
| Customer refused | Photograph the package, mark `refused` | Initiate refund flow (COD = no refund needed; UPI = refund within 24h) |
| Damage in transit | Mark `damaged`, return to store | Replace item from inventory and dispatch fresh; do NOT mark delivered |

---

## 8. Escalation matrix

| Issue | First responder | Escalate to |
| --- | --- | --- |
| Order stuck > 30 min | Dispatcher | Store manager |
| Rider AWOL / phone off | Dispatcher | Rider supervisor |
| Payment dispute | Operations | Finance + admin |
| System / API down | On-call engineer | CTO (vfast-oncall@vmart.local) |
| Product safety / FSSAI issue | Store manager | Compliance officer |
| Customer abuse / threat | Dispatcher | Support lead → Police if needed |

---

## 9. KPI targets

| Metric | Target | Where measured |
| --- | --- | --- |
| Order fulfillment time (placed → out_for_delivery) | **< 5 min** | OMS SLA monitor |
| Delivery SLA (placed → delivered) | **< 30 min** | OMS / `/admin/dashboard/live` |
| UPI QR payment verification turnaround | **< 10 min** | Payment queue |
| First-attempt delivery success | **> 96%** | Dashboard exceptions |
| Stockout rate | **< 2%** of orders/day | Admin → inventory low-stock |
| Rider utilisation | **70–85%** | Riders page |
| COD reconciliation variance | **0** end-of-shift | COD recon tab |

---

## 10. Weekly inventory audit SOP

Every **Monday before opening**:

1. Pick **20 random SKUs** across all categories (suggest by GMV or by aisle).
2. Physical count vs system stock; record variances in a Google Sheet.
3. Update inventory for any SKU with variance > 2 units.
4. Investigate root cause for any variance > 10% (shrinkage, mis-pick, theft).
5. Submit the audit summary to the regional ops head every Monday by 10:00.

---

## 11. Incident response

### Backend / API down
1. Confirm via `https://api.vfast.co.in/api/health` returning non-200.
2. Page on-call engineer in #vfast-oncall.
3. Switch the customer storefront banner to **"We're temporarily paused — back soon"** via the **maintenance_mode** flag at `/admin/settings`.
4. Once recovered, monitor for 30 min before flipping maintenance back off.

### Payment failure surge (UPI rejections > 10% in 1h)
1. Verify the active QR isn't expired/wrong by previewing it at `/admin/qr-codes`.
2. Switch to a backup global QR.
3. Increase verifier headcount until backlog clears.

### Rider no-show / shortage
1. Pause new order acceptance for the affected PIN by toggling **active** off at `/admin/pincodes`.
2. Reroute open orders to the nearest active dark store.
3. Notify customers of revised ETA via the SMS template.

### Data breach / DPDP incident
1. Immediately rotate `JWT_SECRET` and force re-login.
2. File an internal incident at `incident@vmart.local`.
3. DPO must notify the Indian Computer Emergency Response Team within 72 hours (DPDP Act § 30).
4. See the DPDP console (Phase 5) for the formal workflow.
