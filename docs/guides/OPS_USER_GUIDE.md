# Operations / Store Manager Guide — VFast

For dark-store managers, pickers-packers, and dispatchers.

## 1. Picking and packing orders

1. Open **Admin → Orders (OMS)** (`/admin/orders`). Filter by status = `placed`.
2. For each order:
   - Open the order detail (click the order number) to see the items, qty, pack size, and image.
   - Pull each SKU off the shelf. If anything is **out of stock**, follow §5 below.
   - When everything is in the pack, click **→ packed** in the OMS row.
3. Label the pack with the order number and place on the dispatch shelf.

> SLA target: **placed → packed in ≤ 5 minutes**.

## 2. Inventory updates

**Admin → Inventory → Stock list** lets you correct stock inline:
- Change the **stock** number (physical count after picking).
- Change the **reorder level** if you want earlier low-stock alerts.
- Click **Save**.

## 3. Inward / purchase entries

Whenever a delivery arrives from the supplier:

1. Go to **Admin → Inventory → Batches**.
2. Pick the product, enter:
   - Batch no. (from the supplier's invoice)
   - Quantity received
   - Expiry date
3. Click **Add batch**. The system increments stock automatically and the new batch shows up in the batches table.

> Always enter batches the day they arrive — the expiry alert depends on this.

## 4. Low-stock alerts

- **Admin → Inventory → Low stock** lists every product at or below its reorder level.
- Order replenishment for these items the same day.
- After the replenishment arrives, log it as a batch (§3).

## 5. Stockout handling

If a customer ordered something that isn't on the shelf:

1. Open the order in OMS and click **Override**.
2. Choose status `cancelled`, reason = `stockout — {product name}`.
3. Update inventory (`/admin/inventory`) to **0 stock** so no further orders are accepted.
4. Customer is notified by the system. If you have the customer's phone, call them to suggest an alternate SKU and place a fresh order on their behalf.

## 6. Assigning orders to riders

1. From OMS, the **Rider** column dropdown on each `packed` order shows online riders.
2. Pick a rider — order is assigned instantly.
3. The rider will see it in their app (Phase 3) or you can tell them in person.
4. Click **→ out_for_delivery** when the rider departs.

If no riders are online, go to **Riders** (`/admin/riders`) and call any rider whose status is `offline`. You can flip their status to `online` from here (admin override).

## 7. Handling exceptions

| Exception | Action |
| --- | --- |
| **Failed delivery** | Rider marks `delivery_failed` via app; you choose: reschedule (new order) or cancel with refund. |
| **Customer refused** | Mark order `cancelled` with reason `refused`. For UPI orders escalate to admin for refund. |
| **Damaged in transit** | Mark `cancelled` reason `damaged`; replace SKU from inventory and create a fresh order, comp delivery fee. |
| **Rider AWOL** | Reassign to another rider. Escalate to rider supervisor if no one available. |

## 8. Batch / expiry management

Every morning before opening:
1. Open **Admin → Inventory → Batches**.
2. Look at the **Near expiry** banner (default window: next 7 days).
3. Move those SKUs to the "sell first" shelf.
4. Apply a markdown if needed (edit price in **Catalog**).
5. Once a batch is fully sold, the qty doesn't auto-decrement — Phase 4 will integrate batch consumption with picking. For now, mentally retire the batch by recording on the daily sheet.

---

KPI targets, escalation matrix, and incident response are in [`/docs/OPERATIONS_PLAYBOOK.md`](../OPERATIONS_PLAYBOOK.md).
