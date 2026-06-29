# Super Admin Guide — VFast

You have full control over VFast. This guide covers the actions only **Super Admin** can take.

## 1. Logging in
1. Open `https://vfast.co.in/admin/login`.
2. Sign in with your Super Admin email and password (initial credentials provided separately at launch).
3. After login you land on the **Live Dashboard**.

## 2. Dashboard overview
- **KPI cards**: Orders today, GMV today (with vs-yesterday %), Active riders, Pending payments, Low stock, Open tickets.
- **Live operations board**: order counts in each status (Placed → Delivered).
- **Charts**: hourly orders (last 24h), today vs yesterday revenue, category sales today.
- **Quick actions** (top right): jump to pending orders, payment verification queue, low-stock list.

## 3. Managing roles & permissions (RBAC) — Super Admin only
- Go to **Admin → Roles & permissions** (`/admin/rbac`).
- For each role you see a matrix of **modules** (dashboard, orders, catalog, ...) × **actions** (read, write, delete).
- Tick / untick checkboxes to grant or revoke permissions, then click **Save**.
- **super_admin** is locked — it always has all permissions.
- To change a user's role, scroll to **Assign role to user**, find the user row and pick a new role from the dropdown.

> ⚠️ Changing permissions takes effect on the user's **next request**. Existing sessions don't need to log out.

## 4. Creating Admin / Operations users
- Go to **Admin → Users** to see the list. The seeded staff are listed there.
- To onboard a new staff member today you should:
  1. Ask the engineering team to create the user with `db.users.insertOne({...})` and a bcrypt password.
  2. *(Coming in Phase 4)* a self-service "Create staff user" modal — until then, use a Mongo script.
- Once the user exists, set their role at **Roles & permissions → Assign role to user**.

## 5. Global app settings & feature flags
**Admin → Settings** (`/admin/settings`) has three tabs:

### General
- App name (defaults to `VFast`)
- Support email / phone
- Data Protection Officer email / phone
- **Maintenance mode** — when on, blocks customer logins and shows a "back soon" banner

### Feature flags
- Enable Cash on Delivery
- Enable UPI QR
- Enable referrals (Phase 4)
- Enable wallet / credits (Phase 4)
- Enable Hindi toggle
- Show DPDP consent banner (Phase 5)

Toggle, click **Save flags**. Changes are live immediately for new page loads.

### Notification templates
- SMS / email / push templates per event (`order_placed`, `out_for_delivery`, `payment_rejected`, …).
- You can add / edit / delete templates. Use placeholders like `{order_no}`, `{total}`, `{eta}`.
- Real providers (MSG91 / SendGrid / FCM) are wired in Phase 3; until then templates are rendered into logs.

## 6. UPI QR code management
**Admin → UPI QR** (`/admin/qr-codes`)
- Upload a new QR image (PNG/JPG, ≤ 5 MB) and set a label + UPI ID (e.g. `vfast@upi`).
- **Scope** = `global` for the default QR shown everywhere, or `pincode` to override for a specific PIN.
- **Preview by PIN** tells you which QR will be shown to a customer in that PIN — use it to sanity-check before going live.
- Click **Delete** to retire an old QR (existing orders still hold a snapshot).

## 7. DPDP console (Phase 5 placeholder)
Until the DPDP console ships, the audit log + DPO email in **Settings** are your tools. Phase 5 will add:
- Consent versioning per user
- Erasure (right-to-be-forgotten) requests
- Grievance redressal queue
- 72-hour breach notification workflow

## 8. Audit log review
**Admin → Audit log** (`/admin/audit`)
- See every privileged action: who, when, what, on which target.
- Filters: by user email, action substring, target type, date.
- Export the visible result as **CSV**.
- Review at least weekly to detect anomalies (mass deletes, role escalations, etc.).

## 9. Generating reports
Today, three CSV exports are available:
- OMS export — `/admin/orders` → **CSV** button (all orders, last 5000).
- COD reconciliation CSV — same place, filtered by `payment_method=cod`.
- Audit log CSV — `/admin/audit` → Export.

For deeper reports (GMV by category, AOV trend, repeat-rate cohort) wait for Phase 4 Analytics, or query Mongo directly via `db.orders.aggregate(...)`.

---

For day-to-day order management see the **Admin guide**. For dark-store operations see the **Operations playbook**.
