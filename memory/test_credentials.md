# Test Credentials (DEV / MOCK)

> Auto-managed by `/app/backend/app/seed.py`. All passwords below are seeded on every boot.

## Staff (email + password)

| Role             | Email                              | Password   |
|------------------|------------------------------------|------------|
| Super Admin      | `super.admin@vfast.local`          | `admin123` |
| Admin            | `admin@vfast.local`                | `admin123` |
| Operations       | `ops@vfast.local`                  | `ops123`   |
| Seller           | `seller@vfast.local`               | `seller123`|
| Delivery partner | `rider@vfast.local`                | `rider123` |

Sign in at **`/admin/login`**.

## Customer (phone OTP, mock SMS)

- Phone: `+919999999999` (or `+9199XXXXXXXX`)
- Send OTP at `/login` → backend returns the 6-digit `dev_code` in the JSON response (mock SMS mode).
- Seed ensures the demo customer is always `active=true` on every boot.

## Google Sign-In (Custom OAuth)

`GOOGLE_CLIENT_ID` is intentionally **unset** — the frontend renders a disabled "Google Sign-In · coming soon" pill on both `/login` and `/admin/login`. To enable, set `GOOGLE_CLIENT_ID` in `/app/backend/.env` (no restart needed for hot reload).

## Email (Resend)

`EMAIL_API_KEY` is unset. All emails are mocked and logged as `[MOCK EMAIL] tag=… to=… subject=…` in backend logs.

Super Admin can paste a real Resend API key + sender in **`/admin/settings → Email config`** to activate live email at runtime.

## Staff email allowlist

When creating staff/seller/rider users (and during Google staff login), the email **must** end in one of:
`@vmart.co.in` · `@vmartretail.com` · `@limeroad.com` · `@vfast.local`
or be exactly `dineshsrivastava07@gmail.com` / `pawanprajapati1980@gmail.com`.

Customer accounts can use any email — they typically sign in via phone OTP.

## Quick links

- Customer app: `/`  · login `/login`
- Admin panel: `/admin` · login `/admin/login`
- Seller portal: `/seller` · login `/seller/login`
- Rider app: `/rider` · login `/rider/login`
- Password reset confirm: `/reset-password?token=…`
