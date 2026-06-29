# Seller / Vendor Guide — VFast

For brand owners and resellers stocking products on VFast.

> The full **Seller Portal** lands in **Phase 3**. Until then, Admin/Ops manage your catalog on your behalf based on what you submit through the onboarding flow below.

## 1. Onboarding & KYC

1. Email `seller-onboarding@vfast.co.in` with:
   - Company name, GST no., PAN, bank account & IFSC
   - Cancelled cheque image
   - Brand authorisation letters if you sell branded SKUs
2. VFast verifies KYC (1–3 working days). Once approved, you receive seller login credentials.
3. Sign in at `https://vfast.co.in/admin/login` with your seller email.

## 2. Adding & editing products

Until the Phase-3 seller-self-service UI ships, share an Excel/CSV with these columns to your VFast account manager (Ops will bulk-import for you):

```
slug, name, brand, category_slug, subcategory_slug, price, mrp, pack_size,
unit_value, unit, veg_type, stock, reorder_level, eta_minutes, image,
hsn_code, fssai_no, country_of_origin, storage, shelf_life_days,
allergens (comma-separated), description
```

A few rules:
- **slug** must be lowercase kebab-case and unique.
- **price** must be **<= mrp** (discount % is auto-computed).
- **veg_type** ∈ `veg | vegan | nonveg | na`. Indian-standard green/red dot is shown on the storefront.
- **HSN** drives GST rate; **FSSAI** is mandatory for food.
- Image URL must be public HTTPS (or upload via the admin image upload — Ops will help).

## 3. Managing inventory & stock

Once your SKUs are live, ops will share read access to the inventory view. You can request changes via:
- Quick stock updates → email `seller-ops@vfast.co.in`
- Price changes / discounts → email `seller-ops@vfast.co.in` (or, when Phase-3 ships, edit directly)

## 4. Viewing & fulfilling orders

VFast handles fulfillment from a central dark store, so you don't pick or pack — but you can view orders that include your SKUs by filtering in OMS (Phase 3+ will scope this to seller-owned items only).

## 5. Commissions & payouts

Standard commission: **8–18% of subtotal** depending on category. Specific terms are in your signed agreement.

Settlement schedule (Phase 4):
- T+7 days for non-perishable categories
- T+3 days for perishables (dairy, F&V)
- Payout TDS as per Indian regulations

For now, monthly settlements are emailed by VFast Finance with a PDF statement showing GMV, commission, returns, and net payable.

## 6. Performance dashboard (Phase 3)

In Phase 3 you'll see a dedicated seller dashboard with:
- Today's orders for your SKUs
- Top-selling brands / SKUs
- Out-of-stock %
- Average rating per SKU
- Pending payout amount

## Quick contact

| Need | Email |
| --- | --- |
| Add / edit catalog | `seller-ops@vfast.co.in` |
| Payouts / finance | `seller-finance@vfast.co.in` |
| Account issues | `seller-success@vfast.co.in` |
| KYC | `seller-onboarding@vfast.co.in` |
