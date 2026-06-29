# Test Credentials (VFast)

All accounts seeded from /app/backend/.env via app/seed.py (idempotent).

## Staff (email + password JWT)
| Role | Email | Password |
|------|-------|----------|
| Super Admin | super.admin@vfast.local | admin123 |
| Admin | admin@vfast.local | admin123 |
| Operations | ops@vfast.local | ops123 |
| Seller | seller@vfast.local | seller123 |
| Delivery Partner (Rider) | rider@vfast.local | rider123 |

Login endpoints:
- Staff (incl. seller & rider): `POST /api/auth/login` with `{email, password}` → JWT.
- Customer: `POST /api/auth/otp/request` then `POST /api/auth/otp/verify` (SMS mock; dev_code returned in response).

## Customer (OTP)
- Phone: `+919999999999` (any +91 6-9 starting valid mobile works)
- OTP: `dev_code` is returned in API response (mock SMS mode).

## URLs
- Storefront: `/`
- Customer login: `/login`
- Admin: `/admin` (login `/admin/login`)
- Seller portal: `/seller` (login `/seller/login`)
- Rider app: `/rider` (login `/rider/login`)
